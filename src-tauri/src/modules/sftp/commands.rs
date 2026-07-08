use std::fs;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use ssh2::{HashType, OpenFlags, OpenType, RenameFlags};
use tauri::{AppHandle, State};

use crate::modules::secrets::{
    SecretsState, delete_secret_value, get_secret_value, set_secret_value,
};
use crate::modules::workspace::{WorkspaceEnv, WorkspaceRegistry, resolve_path};

use super::path::{
    authorize_existing_local_dir, authorize_existing_local_entry, authorize_existing_local_file,
    authorize_local_write_target, join_remote_path, local_partial_path, remote_basename,
    remote_dirname, remote_partial_path, validate_remote_path,
};
use super::profile::{
    HostKeyTrust, SftpAuthMethod, SftpProfile, SftpSecretKind, compare_host_key, secret_key,
    validate_profile,
};
use super::session::{ManagedSftpSession, SftpState};
use super::store::{
    generate_profile_id, read_profiles, remove_profile, upsert_profile, write_profiles,
};
use super::transfer::{
    SftpTransferDirection, SftpTransferEvent, SftpTransferStatus, emit_transfer,
};

const SFTP_KEYRING_SERVICE: &str = "kite-sftp";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(12);
const IO_TIMEOUT: Duration = Duration::from_secs(30);
const TRANSFER_CHUNK_SIZE: usize = 64 * 1024;

type TransferCancelMap = Arc<std::sync::Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum DeleteStrategy {
    Directory,
    Unlink,
}

struct TransferMeta {
    id: String,
    connection_id: String,
    direction: SftpTransferDirection,
    source: String,
    target: String,
    overwrite: bool,
}

impl TransferMeta {
    fn event(
        &self,
        bytes_done: u64,
        bytes_total: u64,
        status: SftpTransferStatus,
        error: Option<String>,
    ) -> SftpTransferEvent {
        SftpTransferEvent {
            id: self.id.clone(),
            connection_id: self.connection_id.clone(),
            direction: self.direction.clone(),
            source: self.source.clone(),
            target: self.target.clone(),
            bytes_done,
            bytes_total,
            status,
            error,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpProfileSaveRequest {
    pub id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u32,
    pub username: String,
    pub auth_method: SftpAuthMethod,
    pub private_key_path: Option<String>,
    pub default_remote_path: String,
    pub trusted_host_key: Option<String>,
    pub password: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum SftpConnectResult {
    Connected {
        connection_id: String,
        profile: SftpProfile,
        fingerprint: String,
    },
    HostKeyRequired {
        profile_id: String,
        host: String,
        port: u32,
        fingerprint: String,
        previous_fingerprint: Option<String>,
        changed: bool,
    },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SftpEntryKind {
    File,
    Dir,
    Symlink,
    Other,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpDirEntry {
    pub name: String,
    pub path: String,
    pub kind: SftpEntryKind,
    pub size: u64,
    pub mtime: u64,
    pub permissions: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SftpConflictPolicy {
    Skip,
    Overwrite,
    Rename,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpBatchIssue {
    pub source: String,
    pub target: String,
    pub error: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpBatchTransferResult {
    pub transfer_ids: Vec<String>,
    pub skipped: Vec<SftpBatchIssue>,
    pub errors: Vec<SftpBatchIssue>,
}

impl SftpBatchTransferResult {
    fn empty() -> Self {
        Self {
            transfer_ids: Vec::new(),
            skipped: Vec::new(),
            errors: Vec::new(),
        }
    }
}

#[derive(Clone, Debug)]
struct UploadPlan {
    local: PathBuf,
    source: String,
    target: String,
    overwrite: bool,
}

#[derive(Clone, Debug)]
struct DownloadPlan {
    source: String,
    local: PathBuf,
    target: String,
    overwrite: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpUploadEntriesRequest {
    pub connection_id: String,
    pub local_paths: Vec<String>,
    pub remote_dir: String,
    pub conflict_policy: SftpConflictPolicy,
    pub workspace: Option<WorkspaceEnv>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpDownloadEntriesRequest {
    pub connection_id: String,
    pub remote_paths: Vec<String>,
    pub local_dir: String,
    pub conflict_policy: SftpConflictPolicy,
    pub workspace: Option<WorkspaceEnv>,
}

#[tauri::command]
pub fn sftp_profile_list(app: AppHandle) -> Result<Vec<SftpProfile>, String> {
    read_profiles(&app)
}

#[tauri::command]
pub fn sftp_profile_save(
    app: AppHandle,
    state: State<'_, SecretsState>,
    input: SftpProfileSaveRequest,
) -> Result<SftpProfile, String> {
    let id = input
        .id
        .filter(|id| !id.trim().is_empty())
        .unwrap_or_else(|| generate_profile_id(&input.username, &input.host));
    let profile = SftpProfile {
        id,
        name: input.name.trim().to_string(),
        host: input.host.trim().to_string(),
        port: input.port,
        username: input.username.trim().to_string(),
        auth_method: input.auth_method,
        private_key_path: input
            .private_key_path
            .map(|path| path.trim().to_string())
            .filter(|path| !path.is_empty()),
        default_remote_path: input.default_remote_path.trim().to_string(),
        trusted_host_key: input
            .trusted_host_key
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty()),
    };
    validate_profile(&profile)?;

    if let Some(password) = input.password.filter(|value| !value.is_empty()) {
        set_secret_value(
            &app,
            &state,
            SFTP_KEYRING_SERVICE,
            &secret_key(&profile.id, SftpSecretKind::Password),
            &password,
        )?;
    }
    if let Some(passphrase) = input.passphrase.filter(|value| !value.is_empty()) {
        set_secret_value(
            &app,
            &state,
            SFTP_KEYRING_SERVICE,
            &secret_key(&profile.id, SftpSecretKind::Passphrase),
            &passphrase,
        )?;
    }

    let mut profiles = read_profiles(&app)?;
    upsert_profile(&mut profiles, profile.clone())?;
    write_profiles(&app, &profiles)?;
    Ok(profile)
}

#[tauri::command]
pub fn sftp_profile_delete(
    app: AppHandle,
    secrets_state: State<'_, SecretsState>,
    sftp_state: State<'_, SftpState>,
    profile_id: String,
) -> Result<(), String> {
    let mut profiles = read_profiles(&app)?;
    remove_profile(&mut profiles, &profile_id);
    write_profiles(&app, &profiles)?;
    delete_secret_value(
        &app,
        &secrets_state,
        SFTP_KEYRING_SERVICE,
        &secret_key(&profile_id, SftpSecretKind::Password),
    )?;
    delete_secret_value(
        &app,
        &secrets_state,
        SFTP_KEYRING_SERVICE,
        &secret_key(&profile_id, SftpSecretKind::Passphrase),
    )?;
    sftp_state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .retain(|_, session| session.profile_id != profile_id);
    Ok(())
}

#[tauri::command]
pub async fn sftp_connect(
    app: AppHandle,
    sftp_state: State<'_, SftpState>,
    secrets_state: State<'_, SecretsState>,
    profile_id: String,
    accept_host_key: Option<bool>,
) -> Result<SftpConnectResult, String> {
    let profiles = read_profiles(&app)?;
    let profile = profiles
        .into_iter()
        .find(|profile| profile.id == profile_id)
        .ok_or_else(|| "SFTP profile not found".to_string())?;
    validate_profile(&profile)?;

    let password = get_secret_value(
        &app,
        &secrets_state,
        SFTP_KEYRING_SERVICE,
        &secret_key(&profile.id, SftpSecretKind::Password),
    )?;
    let passphrase = get_secret_value(
        &app,
        &secrets_state,
        SFTP_KEYRING_SERVICE,
        &secret_key(&profile.id, SftpSecretKind::Passphrase),
    )?;
    let accept_host_key = accept_host_key.unwrap_or(false);
    let state = sftp_state.inner().clone();
    let app_for_blocking = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        connect_blocking(
            &app_for_blocking,
            state,
            profile,
            password,
            passphrase,
            accept_host_key,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn sftp_disconnect(state: State<'_, SftpState>, connection_id: String) -> Result<(), String> {
    state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&connection_id);
    Ok(())
}

#[tauri::command]
pub fn sftp_read_dir(
    state: State<'_, SftpState>,
    connection_id: String,
    path: String,
) -> Result<Vec<SftpDirEntry>, String> {
    validate_remote_path(&path)?;
    let session = get_session(&state, &connection_id)?;
    let guard = session.session.lock().map_err(|e| e.to_string())?;
    let sftp = guard.sftp().map_err(|e| e.to_string())?;
    let mut entries: Vec<SftpDirEntry> = sftp
        .readdir(Path::new(&path))
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter_map(|(entry_path, stat)| {
            let name = entry_path.file_name()?.to_string_lossy().into_owned();
            let kind = if stat.is_dir() {
                SftpEntryKind::Dir
            } else if stat.is_file() {
                SftpEntryKind::File
            } else if stat.file_type().is_symlink() {
                SftpEntryKind::Symlink
            } else {
                SftpEntryKind::Other
            };
            Some(SftpDirEntry {
                name,
                path: entry_path.to_string_lossy().replace('\\', "/"),
                kind,
                size: stat.size.unwrap_or(0),
                mtime: stat.mtime.unwrap_or(0) * 1000,
                permissions: stat.perm.map(format_permissions),
            })
        })
        .collect();
    entries.sort_by(|a, b| {
        let rank = |kind: &SftpEntryKind| match kind {
            SftpEntryKind::Dir => 0,
            SftpEntryKind::Symlink => 1,
            SftpEntryKind::File => 2,
            SftpEntryKind::Other => 3,
        };
        rank(&a.kind)
            .cmp(&rank(&b.kind))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
pub fn sftp_search(
    state: State<'_, SftpState>,
    connection_id: String,
    path: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SftpDirEntry>, String> {
    validate_remote_path(&path)?;
    let query = validate_remote_search_query(&query)?;
    let limit = limit.unwrap_or(200).clamp(1, 500);
    let session = get_session(&state, &connection_id)?;
    let guard = session.session.lock().map_err(|e| e.to_string())?;
    let sftp = guard.sftp().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    collect_remote_search(&sftp, &path, &query, limit, &mut out)?;
    Ok(out)
}

#[tauri::command]
pub fn sftp_create_dir(
    state: State<'_, SftpState>,
    connection_id: String,
    path: String,
) -> Result<(), String> {
    validate_remote_create_dir_path(&path)?;
    let session = get_session(&state, &connection_id)?;
    let guard = session.session.lock().map_err(|e| e.to_string())?;
    let sftp = guard.sftp().map_err(|e| e.to_string())?;
    if sftp.stat(Path::new(&path)).is_ok() {
        return Err(format!("remote target already exists: {path}"));
    }
    sftp.mkdir(Path::new(&path), 0o755)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sftp_rename(
    state: State<'_, SftpState>,
    connection_id: String,
    source_path: String,
    target_path: String,
) -> Result<(), String> {
    validate_remote_path(&source_path)?;
    validate_remote_path(&target_path)?;
    if source_path == target_path {
        return Ok(());
    }
    let session = get_session(&state, &connection_id)?;
    let guard = session.session.lock().map_err(|e| e.to_string())?;
    let sftp = guard.sftp().map_err(|e| e.to_string())?;
    if sftp.stat(Path::new(&target_path)).is_ok() {
        return Err(format!("remote target already exists: {target_path}"));
    }
    rename_remote_without_overwrite(&sftp, Path::new(&source_path), Path::new(&target_path))
}

#[tauri::command]
pub fn sftp_delete(
    state: State<'_, SftpState>,
    connection_id: String,
    paths: Vec<String>,
) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    let session = get_session(&state, &connection_id)?;
    let guard = session.session.lock().map_err(|e| e.to_string())?;
    let sftp = guard.sftp().map_err(|e| e.to_string())?;
    for path in paths {
        validate_remote_path(&path)?;
        delete_remote_entry(&sftp, &path)?;
    }
    Ok(())
}

#[tauri::command]
pub fn sftp_upload_entries(
    app: AppHandle,
    state: State<'_, SftpState>,
    registry: State<'_, WorkspaceRegistry>,
    input: SftpUploadEntriesRequest,
) -> Result<SftpBatchTransferResult, String> {
    validate_remote_path(&input.remote_dir)?;
    let workspace = WorkspaceEnv::from_option(input.workspace);
    let session = get_session(&state, &input.connection_id)?;
    let mut result = SftpBatchTransferResult::empty();
    let mut plans = Vec::new();

    {
        let guard = session.session.lock().map_err(|e| e.to_string())?;
        let sftp = guard.sftp().map_err(|e| e.to_string())?;
        for raw in input.local_paths {
            let base_name = local_basename_for_remote(&raw, &workspace)?;
            let target = join_remote_path(&input.remote_dir, &base_name)?;
            match collect_upload_plans(
                &sftp,
                &raw,
                target,
                input.conflict_policy,
                &workspace,
                &registry,
                &mut plans,
            ) {
                Ok(()) => {}
                Err(error) if error == "skipped" => {
                    result.skipped.push(SftpBatchIssue {
                        source: raw,
                        target: input.remote_dir.clone(),
                        error,
                    });
                }
                Err(error) => result.errors.push(SftpBatchIssue {
                    source: raw,
                    target: input.remote_dir.clone(),
                    error,
                }),
            }
        }
    }

    let transfers = state.transfers.clone();
    for plan in plans {
        match queue_upload_transfer(
            app.clone(),
            transfers.clone(),
            session.clone(),
            input.connection_id.clone(),
            plan,
        ) {
            Ok(id) => result.transfer_ids.push(id),
            Err(error) => result.errors.push(SftpBatchIssue {
                source: String::new(),
                target: String::new(),
                error,
            }),
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn sftp_download_entries(
    app: AppHandle,
    state: State<'_, SftpState>,
    registry: State<'_, WorkspaceRegistry>,
    input: SftpDownloadEntriesRequest,
) -> Result<SftpBatchTransferResult, String> {
    let workspace = WorkspaceEnv::from_option(input.workspace);
    let local_root = authorize_existing_local_dir(&input.local_dir, &workspace, &registry)?;
    let session = get_session(&state, &input.connection_id)?;
    let mut result = SftpBatchTransferResult::empty();
    let mut plans = Vec::new();

    {
        let guard = session.session.lock().map_err(|e| e.to_string())?;
        let sftp = guard.sftp().map_err(|e| e.to_string())?;
        for remote_path in input.remote_paths {
            validate_remote_path(&remote_path)?;
            let name = safe_local_name_from_remote(&remote_path)?;
            let target = local_root.join(name);
            match collect_download_plans(
                &sftp,
                &remote_path,
                target,
                input.conflict_policy,
                &mut plans,
            ) {
                Ok(()) => {}
                Err(error) if error == "skipped" => result.skipped.push(SftpBatchIssue {
                    source: remote_path,
                    target: input.local_dir.clone(),
                    error,
                }),
                Err(error) => result.errors.push(SftpBatchIssue {
                    source: remote_path,
                    target: input.local_dir.clone(),
                    error,
                }),
            }
        }
    }

    let transfers = state.transfers.clone();
    for plan in plans {
        match queue_download_transfer(
            app.clone(),
            transfers.clone(),
            session.clone(),
            input.connection_id.clone(),
            plan,
        ) {
            Ok(id) => result.transfer_ids.push(id),
            Err(error) => result.errors.push(SftpBatchIssue {
                source: String::new(),
                target: String::new(),
                error,
            }),
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn sftp_upload_file(
    app: AppHandle,
    state: State<'_, SftpState>,
    registry: State<'_, WorkspaceRegistry>,
    connection_id: String,
    local_path: String,
    remote_path: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<String, String> {
    validate_remote_path(&remote_path)?;
    let workspace = WorkspaceEnv::from_option(workspace);
    let local = authorize_existing_local_file(&local_path, &workspace, &registry)?;
    let session = get_session(&state, &connection_id)?;
    queue_upload_transfer(
        app,
        state.transfers.clone(),
        session,
        connection_id,
        UploadPlan {
            local,
            source: local_path,
            target: remote_path,
            overwrite: false,
        },
    )
}

#[tauri::command]
pub fn sftp_download_file(
    app: AppHandle,
    state: State<'_, SftpState>,
    registry: State<'_, WorkspaceRegistry>,
    connection_id: String,
    remote_path: String,
    local_path: String,
    workspace: Option<WorkspaceEnv>,
) -> Result<String, String> {
    validate_remote_path(&remote_path)?;
    let workspace = WorkspaceEnv::from_option(workspace);
    let local = authorize_local_write_target(&local_path, &workspace, &registry)?;
    let session = get_session(&state, &connection_id)?;
    queue_download_transfer(
        app,
        state.transfers.clone(),
        session,
        connection_id,
        DownloadPlan {
            source: remote_path,
            local,
            target: local_path,
            overwrite: false,
        },
    )
}

#[tauri::command]
pub fn sftp_cancel_transfer(
    state: State<'_, SftpState>,
    transfer_id: String,
) -> Result<(), String> {
    if let Some(cancel) = state
        .transfers
        .lock()
        .map_err(|e| e.to_string())?
        .get(&transfer_id)
    {
        cancel.store(true, Ordering::Relaxed);
    }
    Ok(())
}

fn connect_blocking(
    app: &AppHandle,
    state: SftpState,
    mut profile: SftpProfile,
    password: Option<String>,
    passphrase: Option<String>,
    accept_host_key: bool,
) -> Result<SftpConnectResult, String> {
    let addr = format!("{}:{}", profile.host, profile.port)
        .to_socket_addrs()
        .map_err(|e| e.to_string())?
        .next()
        .ok_or_else(|| "could not resolve SFTP host".to_string())?;
    let tcp = TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT).map_err(|e| e.to_string())?;
    tcp.set_read_timeout(Some(IO_TIMEOUT))
        .map_err(|e| e.to_string())?;
    tcp.set_write_timeout(Some(IO_TIMEOUT))
        .map_err(|e| e.to_string())?;

    let mut session = ssh2::Session::new().map_err(|e| e.to_string())?;
    session.set_tcp_stream(tcp);
    session.handshake().map_err(|e| e.to_string())?;
    let fingerprint = fingerprint(&session)?;
    let trust = compare_host_key(profile.trusted_host_key.as_deref(), &fingerprint);
    match trust {
        HostKeyTrust::Trusted => {}
        HostKeyTrust::Missing | HostKeyTrust::Mismatch if !accept_host_key => {
            return Ok(SftpConnectResult::HostKeyRequired {
                profile_id: profile.id,
                host: profile.host,
                port: profile.port,
                previous_fingerprint: profile.trusted_host_key.clone(),
                changed: matches!(trust, HostKeyTrust::Mismatch),
                fingerprint,
            });
        }
        HostKeyTrust::Missing | HostKeyTrust::Mismatch => {
            profile.trusted_host_key = Some(fingerprint.clone());
        }
    }

    authenticate(
        &mut session,
        &profile,
        password.as_deref(),
        passphrase.as_deref(),
    )?;
    if !session.authenticated() {
        return Err("SFTP authentication failed".into());
    }

    if profile.trusted_host_key.as_deref() == Some(fingerprint.as_str()) {
        let mut profiles = read_profiles(app)?;
        upsert_profile(&mut profiles, profile.clone())?;
        write_profiles(app, &profiles)?;
    }

    let connection_id = new_id("sftp-conn");
    state.sessions.lock().map_err(|e| e.to_string())?.insert(
        connection_id.clone(),
        ManagedSftpSession {
            profile_id: profile.id.clone(),
            session: Arc::new(std::sync::Mutex::new(session)),
        },
    );
    Ok(SftpConnectResult::Connected {
        connection_id,
        profile,
        fingerprint,
    })
}

fn authenticate(
    session: &mut ssh2::Session,
    profile: &SftpProfile,
    password: Option<&str>,
    passphrase: Option<&str>,
) -> Result<(), String> {
    match profile.auth_method {
        SftpAuthMethod::Password => {
            let password = password.ok_or_else(|| "SFTP password is not saved".to_string())?;
            session
                .userauth_password(&profile.username, password)
                .map_err(|e| e.to_string())
        }
        SftpAuthMethod::PrivateKey => {
            let key_path = profile
                .private_key_path
                .as_deref()
                .ok_or_else(|| "private key path is required".to_string())?;
            session
                .userauth_pubkey_file(&profile.username, None, Path::new(key_path), passphrase)
                .map_err(|e| e.to_string())
        }
    }
}

fn get_session(state: &SftpState, connection_id: &str) -> Result<ManagedSftpSession, String> {
    state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .get(connection_id)
        .cloned()
        .ok_or_else(|| "SFTP connection not found".into())
}

fn fingerprint(session: &ssh2::Session) -> Result<String, String> {
    let hash = session
        .host_key_hash(HashType::Sha256)
        .ok_or_else(|| "server did not provide a host key fingerprint".to_string())?;
    Ok(format!(
        "SHA256:{}",
        base64::engine::general_purpose::STANDARD_NO_PAD.encode(hash)
    ))
}

fn non_overwriting_rename_flags() -> [RenameFlags; 2] {
    [RenameFlags::ATOMIC, RenameFlags::empty()]
}

fn rename_remote_without_overwrite(
    sftp: &ssh2::Sftp,
    source: &Path,
    target: &Path,
) -> Result<(), String> {
    let mut last_error = None;
    for flags in non_overwriting_rename_flags() {
        match sftp.rename(source, target, Some(flags)) {
            Ok(()) => return Ok(()),
            Err(err) => last_error = Some(err),
        }
    }
    Err(last_error
        .map(|err| err.to_string())
        .unwrap_or_else(|| "remote rename failed".to_string()))
}

fn rename_remote_with_overwrite(
    sftp: &ssh2::Sftp,
    source: &Path,
    target: &Path,
) -> Result<(), String> {
    let mut last_error = None;
    for flags in [
        RenameFlags::ATOMIC | RenameFlags::OVERWRITE,
        RenameFlags::OVERWRITE,
    ] {
        match sftp.rename(source, target, Some(flags)) {
            Ok(()) => return Ok(()),
            Err(err) => last_error = Some(err),
        }
    }
    Err(last_error
        .map(|err| err.to_string())
        .unwrap_or_else(|| "remote overwrite rename failed".to_string()))
}

fn validate_remote_create_dir_path(path: &str) -> Result<(), String> {
    validate_remote_path(path)?;
    let name = remote_basename(path)?;
    if matches!(name.as_str(), "." | "..") {
        return Err("remote directory name is invalid".into());
    }
    Ok(())
}

fn remote_exists(sftp: &ssh2::Sftp, path: &str) -> bool {
    sftp.lstat(Path::new(path)).is_ok()
}

fn is_symlink_perm(perm: u32) -> bool {
    perm & 0o170000 == 0o120000
}

fn remote_is_dir_stat(stat: &ssh2::FileStat) -> bool {
    stat.perm
        .map(delete_strategy_from_perm)
        .is_some_and(|strategy| strategy == DeleteStrategy::Directory)
}

fn remote_is_symlink_stat(stat: &ssh2::FileStat) -> bool {
    stat.perm.is_some_and(is_symlink_perm)
}

fn delete_remote_entry(sftp: &ssh2::Sftp, path: &str) -> Result<(), String> {
    let stat = sftp.lstat(Path::new(path)).map_err(|e| e.to_string())?;
    match stat.perm.map(delete_strategy_from_perm) {
        Some(DeleteStrategy::Directory) => {
            let children = sftp.readdir(Path::new(path)).map_err(|e| e.to_string())?;
            for (child, _) in children {
                let child_path = child.to_string_lossy().replace('\\', "/");
                delete_remote_entry(sftp, &child_path)?;
            }
            sftp.rmdir(Path::new(path)).map_err(|e| e.to_string())
        }
        _ => sftp.unlink(Path::new(path)).map_err(|e| e.to_string()),
    }
}

fn local_basename_for_remote(raw: &str, workspace: &WorkspaceEnv) -> Result<String, String> {
    let resolved = resolve_path(raw, workspace);
    let name = resolved
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("local path has no file name: {raw}"))?;
    if name.is_empty() || matches!(name, "." | "..") || name.contains('\0') {
        return Err(format!("invalid local file name: {name}"));
    }
    Ok(name.to_string())
}

fn safe_local_name_from_remote(path: &str) -> Result<String, String> {
    let name = remote_basename(path)?;
    if name.is_empty()
        || matches!(name.as_str(), "." | "..")
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
    {
        return Err(format!("remote file name is unsafe locally: {name}"));
    }
    Ok(name)
}

fn collect_upload_plans(
    sftp: &ssh2::Sftp,
    raw: &str,
    target: String,
    conflict_policy: SftpConflictPolicy,
    workspace: &WorkspaceEnv,
    registry: &WorkspaceRegistry,
    plans: &mut Vec<UploadPlan>,
) -> Result<(), String> {
    let local = authorize_existing_local_entry(raw, workspace, registry)?;
    let resolved = resolve_path(raw, workspace);
    let meta = fs::symlink_metadata(&resolved).map_err(|e| e.to_string())?;
    if meta.file_type().is_symlink() {
        return Err("local symlinks are not followed".into());
    }
    if meta.is_dir() {
        return collect_upload_dir(sftp, &local, target, conflict_policy, plans);
    }
    if !meta.is_file() {
        return Err(format!(
            "local source is not a regular file: {}",
            local.display()
        ));
    }
    let Some((target, overwrite)) = resolve_remote_file_target(sftp, &target, conflict_policy)?
    else {
        return Err("skipped".into());
    };
    plans.push(UploadPlan {
        local,
        source: raw.to_string(),
        target,
        overwrite,
    });
    Ok(())
}

fn collect_upload_dir(
    sftp: &ssh2::Sftp,
    local_dir: &Path,
    remote_dir: String,
    conflict_policy: SftpConflictPolicy,
    plans: &mut Vec<UploadPlan>,
) -> Result<(), String> {
    let Some(remote_dir) = resolve_remote_dir_target(sftp, &remote_dir, conflict_policy)? else {
        return Err("skipped".into());
    };

    for entry in fs::read_dir(local_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let child = entry.path();
        let meta = fs::symlink_metadata(&child).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            continue;
        }
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| "local file name is not valid UTF-8".to_string())?;
        let child_remote = join_remote_path(&remote_dir, &name)?;
        if meta.is_dir() {
            collect_upload_dir(sftp, &child, child_remote, conflict_policy, plans)?;
        } else if meta.is_file() {
            if let Some((target, overwrite)) =
                resolve_remote_file_target(sftp, &child_remote, conflict_policy)?
            {
                plans.push(UploadPlan {
                    local: child.clone(),
                    source: child.to_string_lossy().into_owned(),
                    target,
                    overwrite,
                });
            }
        }
    }
    Ok(())
}

fn resolve_remote_file_target(
    sftp: &ssh2::Sftp,
    target: &str,
    policy: SftpConflictPolicy,
) -> Result<Option<(String, bool)>, String> {
    validate_remote_path(target)?;
    if !remote_exists(sftp, target) {
        return Ok(Some((target.to_string(), false)));
    }
    match policy {
        SftpConflictPolicy::Skip => Ok(None),
        SftpConflictPolicy::Overwrite => Ok(Some((target.to_string(), true))),
        SftpConflictPolicy::Rename => {
            let candidate = next_remote_conflict_path(target, |path| remote_exists(sftp, path))?;
            Ok(Some((candidate, false)))
        }
    }
}

fn resolve_remote_dir_target(
    sftp: &ssh2::Sftp,
    target: &str,
    policy: SftpConflictPolicy,
) -> Result<Option<String>, String> {
    validate_remote_create_dir_path(target)?;
    match sftp.lstat(Path::new(target)) {
        Ok(stat) if remote_is_dir_stat(&stat) => match policy {
            SftpConflictPolicy::Skip => Ok(None),
            SftpConflictPolicy::Overwrite => Ok(Some(target.to_string())),
            SftpConflictPolicy::Rename => {
                let candidate =
                    next_remote_conflict_path(target, |path| remote_exists(sftp, path))?;
                sftp.mkdir(Path::new(&candidate), 0o755)
                    .map_err(|e| e.to_string())?;
                Ok(Some(candidate))
            }
        },
        Ok(_) => match policy {
            SftpConflictPolicy::Skip => Ok(None),
            SftpConflictPolicy::Rename => {
                let candidate =
                    next_remote_conflict_path(target, |path| remote_exists(sftp, path))?;
                sftp.mkdir(Path::new(&candidate), 0o755)
                    .map_err(|e| e.to_string())?;
                Ok(Some(candidate))
            }
            SftpConflictPolicy::Overwrite => {
                delete_remote_entry(sftp, target)?;
                sftp.mkdir(Path::new(target), 0o755)
                    .map_err(|e| e.to_string())?;
                Ok(Some(target.to_string()))
            }
        },
        Err(_) => {
            sftp.mkdir(Path::new(target), 0o755)
                .map_err(|e| e.to_string())?;
            Ok(Some(target.to_string()))
        }
    }
}

fn collect_download_plans(
    sftp: &ssh2::Sftp,
    remote_path: &str,
    local_target: PathBuf,
    conflict_policy: SftpConflictPolicy,
    plans: &mut Vec<DownloadPlan>,
) -> Result<(), String> {
    let stat = sftp
        .lstat(Path::new(remote_path))
        .map_err(|e| e.to_string())?;
    if remote_is_symlink_stat(&stat) {
        return Err("remote symlinks are not followed".into());
    }
    if remote_is_dir_stat(&stat) {
        return collect_download_dir(sftp, remote_path, local_target, conflict_policy, plans);
    }
    let Some((local, overwrite)) = resolve_local_file_target(local_target, conflict_policy)? else {
        return Err("skipped".into());
    };
    plans.push(DownloadPlan {
        source: remote_path.to_string(),
        target: local.to_string_lossy().into_owned(),
        local,
        overwrite,
    });
    Ok(())
}

fn collect_download_dir(
    sftp: &ssh2::Sftp,
    remote_dir: &str,
    local_dir: PathBuf,
    conflict_policy: SftpConflictPolicy,
    plans: &mut Vec<DownloadPlan>,
) -> Result<(), String> {
    let Some(local_dir) = resolve_local_dir_target(local_dir, conflict_policy)? else {
        return Err("skipped".into());
    };
    let children = sftp
        .readdir(Path::new(remote_dir))
        .map_err(|e| e.to_string())?;
    for (child, stat) in children {
        if remote_is_symlink_stat(&stat) {
            continue;
        }
        let name = child
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "remote child has no safe file name".to_string())?;
        if name.contains('/') || name.contains('\\') || name.contains('\0') {
            continue;
        }
        let child_remote = child.to_string_lossy().replace('\\', "/");
        collect_download_plans(
            sftp,
            &child_remote,
            local_dir.join(name),
            conflict_policy,
            plans,
        )?;
    }
    Ok(())
}

fn resolve_local_file_target(
    target: PathBuf,
    policy: SftpConflictPolicy,
) -> Result<Option<(PathBuf, bool)>, String> {
    if !target.exists() {
        return Ok(Some((target, false)));
    }
    match policy {
        SftpConflictPolicy::Skip => Ok(None),
        SftpConflictPolicy::Rename => Ok(Some((next_local_conflict_path(&target)?, false))),
        SftpConflictPolicy::Overwrite => {
            let meta = fs::symlink_metadata(&target).map_err(|e| e.to_string())?;
            if meta.is_dir() && !meta.file_type().is_symlink() {
                return Err(format!("local target is a directory: {}", target.display()));
            }
            Ok(Some((target, true)))
        }
    }
}

fn resolve_local_dir_target(
    target: PathBuf,
    policy: SftpConflictPolicy,
) -> Result<Option<PathBuf>, String> {
    if !target.exists() {
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        return Ok(Some(target));
    }

    let meta = fs::symlink_metadata(&target).map_err(|e| e.to_string())?;
    if meta.is_dir() && !meta.file_type().is_symlink() {
        return match policy {
            SftpConflictPolicy::Skip => Ok(None),
            SftpConflictPolicy::Overwrite => Ok(Some(target)),
            SftpConflictPolicy::Rename => {
                let candidate = next_local_conflict_path(&target)?;
                fs::create_dir_all(&candidate).map_err(|e| e.to_string())?;
                Ok(Some(candidate))
            }
        };
    }

    match policy {
        SftpConflictPolicy::Skip => Ok(None),
        SftpConflictPolicy::Rename => {
            let candidate = next_local_conflict_path(&target)?;
            fs::create_dir_all(&candidate).map_err(|e| e.to_string())?;
            Ok(Some(candidate))
        }
        SftpConflictPolicy::Overwrite => {
            fs::remove_file(&target).map_err(|e| e.to_string())?;
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            Ok(Some(target))
        }
    }
}

fn next_local_conflict_path(target: &Path) -> Result<PathBuf, String> {
    let parent = target
        .parent()
        .ok_or_else(|| "local target has no parent directory".to_string())?;
    let name = target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "local target has no safe file name".to_string())?;
    let (stem, ext) = split_name_extension(name);
    for idx in 1..=999 {
        let candidate = parent.join(format!("{stem} ({idx}){ext}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("could not find an available local target name".into())
}

fn queue_upload_transfer(
    app: AppHandle,
    transfers: TransferCancelMap,
    session: ManagedSftpSession,
    connection_id: String,
    plan: UploadPlan,
) -> Result<String, String> {
    let id = new_id("sftp-upload");
    let cancel = Arc::new(AtomicBool::new(false));
    transfers
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), cancel.clone());
    let meta = TransferMeta {
        id: id.clone(),
        connection_id,
        direction: SftpTransferDirection::Upload,
        source: plan.source,
        target: plan.target,
        overwrite: plan.overwrite,
    };
    emit_transfer(
        &app,
        meta.event(
            0,
            fs::metadata(&plan.local).map(|m| m.len()).unwrap_or(0),
            SftpTransferStatus::Queued,
            None,
        ),
    );
    spawn_transfer(move || {
        run_upload(app, transfers, session, meta, plan.local, cancel);
    })?;
    Ok(id)
}

fn queue_download_transfer(
    app: AppHandle,
    transfers: TransferCancelMap,
    session: ManagedSftpSession,
    connection_id: String,
    plan: DownloadPlan,
) -> Result<String, String> {
    let id = new_id("sftp-download");
    let cancel = Arc::new(AtomicBool::new(false));
    transfers
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), cancel.clone());
    let meta = TransferMeta {
        id: id.clone(),
        connection_id,
        direction: SftpTransferDirection::Download,
        source: plan.source,
        target: plan.target,
        overwrite: plan.overwrite,
    };
    emit_transfer(&app, meta.event(0, 0, SftpTransferStatus::Queued, None));
    spawn_transfer(move || {
        run_download(app, transfers, session, meta, plan.local, cancel);
    })?;
    Ok(id)
}

fn delete_strategy_from_perm(perm: u32) -> DeleteStrategy {
    match perm & 0o170000 {
        0o040000 => DeleteStrategy::Directory,
        _ => DeleteStrategy::Unlink,
    }
}

fn next_remote_conflict_path(
    target: &str,
    exists: impl Fn(&str) -> bool,
) -> Result<String, String> {
    validate_remote_path(target)?;
    let parent = remote_dirname(target)?;
    let name = remote_basename(target)?;
    let (stem, ext) = split_name_extension(&name);
    for idx in 1..=999 {
        let candidate = join_remote_path(&parent, &format!("{stem} ({idx}){ext}"))?;
        if !exists(&candidate) {
            return Ok(candidate);
        }
    }
    Err("could not find an available remote target name".into())
}

fn validate_remote_search_query(query: &str) -> Result<String, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("search query is required".into());
    }
    if query.contains('\0') {
        return Err("search query cannot contain NUL bytes".into());
    }
    Ok(query.to_string())
}

fn remote_name_matches_query(name: &str, query: &str) -> bool {
    name.to_lowercase().contains(&query.trim().to_lowercase())
}

fn collect_remote_search(
    sftp: &ssh2::Sftp,
    dir: &str,
    query: &str,
    limit: usize,
    out: &mut Vec<SftpDirEntry>,
) -> Result<(), String> {
    if out.len() >= limit {
        return Ok(());
    }
    let entries = sftp.readdir(Path::new(dir)).map_err(|e| e.to_string())?;
    for (entry_path, stat) in entries {
        if out.len() >= limit {
            break;
        }
        let Some(name) = entry_path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if name.contains('/') || name.contains('\\') || name.contains('\0') {
            continue;
        }
        let path = entry_path.to_string_lossy().replace('\\', "/");
        let kind = entry_kind_from_stat(&stat);
        if remote_name_matches_query(name, query) {
            out.push(SftpDirEntry {
                name: name.to_string(),
                path: path.clone(),
                kind: kind.clone(),
                size: stat.size.unwrap_or(0),
                mtime: stat.mtime.unwrap_or(0) * 1000,
                permissions: stat.perm.map(format_permissions),
            });
        }
        if matches!(kind, SftpEntryKind::Dir) && !remote_is_symlink_stat(&stat) {
            collect_remote_search(sftp, &path, query, limit, out)?;
        }
    }
    Ok(())
}

fn entry_kind_from_stat(stat: &ssh2::FileStat) -> SftpEntryKind {
    if stat.is_dir() {
        SftpEntryKind::Dir
    } else if stat.is_file() {
        SftpEntryKind::File
    } else if stat.file_type().is_symlink() {
        SftpEntryKind::Symlink
    } else {
        SftpEntryKind::Other
    }
}

fn split_name_extension(name: &str) -> (&str, &str) {
    let Some(idx) = name.rfind('.') else {
        return (name, "");
    };
    if idx == 0 {
        return (name, "");
    }
    (&name[..idx], &name[idx..])
}

fn resume_offset(total: u64, partial_size: Option<u64>) -> u64 {
    match partial_size {
        Some(size) if size < total => size,
        _ => 0,
    }
}

fn run_upload(
    app: AppHandle,
    transfers: TransferCancelMap,
    session: ManagedSftpSession,
    meta: TransferMeta,
    local: PathBuf,
    cancel: Arc<AtomicBool>,
) {
    let total = std::fs::metadata(&local).map(|m| m.len()).unwrap_or(0);
    let result = (|| -> Result<(), String> {
        emit_transfer(
            &app,
            meta.event(0, total, SftpTransferStatus::Running, None),
        );
        let temp_remote = remote_partial_path(&meta.target)?;
        let mut local_file = std::fs::File::open(&local).map_err(|e| e.to_string())?;
        let guard = session.session.lock().map_err(|e| e.to_string())?;
        let sftp = guard.sftp().map_err(|e| e.to_string())?;
        if !meta.overwrite && sftp.stat(Path::new(&meta.target)).is_ok() {
            return Err(format!("remote target already exists: {}", meta.target));
        }
        if meta.overwrite
            && sftp
                .lstat(Path::new(&meta.target))
                .is_ok_and(|stat| remote_is_dir_stat(&stat))
        {
            return Err(format!("remote target is a directory: {}", meta.target));
        }
        let offset = resume_offset(
            total,
            sftp.lstat(Path::new(&temp_remote))
                .ok()
                .and_then(|stat| stat.size),
        );
        let mut remote_file = if offset > 0 {
            let mut file = sftp
                .open_mode(
                    Path::new(&temp_remote),
                    OpenFlags::WRITE,
                    0o644,
                    OpenType::File,
                )
                .map_err(|e| e.to_string())?;
            file.seek(SeekFrom::Start(offset))
                .map_err(|e| e.to_string())?;
            local_file
                .seek(SeekFrom::Start(offset))
                .map_err(|e| e.to_string())?;
            file
        } else {
            sftp.create(Path::new(&temp_remote))
                .map_err(|e| e.to_string())?
        };
        let mut done = offset;
        let mut buf = vec![0; TRANSFER_CHUNK_SIZE];
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err("canceled".into());
            }
            let read = local_file.read(&mut buf).map_err(|e| e.to_string())?;
            if read == 0 {
                break;
            }
            remote_file
                .write_all(&buf[..read])
                .map_err(|e| e.to_string())?;
            done += read as u64;
            emit_transfer(
                &app,
                meta.event(done, total, SftpTransferStatus::Running, None),
            );
        }
        remote_file.flush().map_err(|e| e.to_string())?;
        drop(remote_file);
        if meta.overwrite {
            rename_remote_with_overwrite(&sftp, Path::new(&temp_remote), Path::new(&meta.target))?;
        } else {
            rename_remote_without_overwrite(
                &sftp,
                Path::new(&temp_remote),
                Path::new(&meta.target),
            )?;
        }
        Ok(())
    })();
    finish_transfer(app, transfers, meta, total, result);
}

fn run_download(
    app: AppHandle,
    transfers: TransferCancelMap,
    session: ManagedSftpSession,
    meta: TransferMeta,
    local: PathBuf,
    cancel: Arc<AtomicBool>,
) {
    let mut total = 0;
    let result = (|| -> Result<(), String> {
        let guard = session.session.lock().map_err(|e| e.to_string())?;
        let sftp = guard.sftp().map_err(|e| e.to_string())?;
        total = sftp
            .stat(Path::new(&meta.source))
            .map_err(|e| e.to_string())?
            .size
            .unwrap_or(0);
        emit_transfer(
            &app,
            meta.event(0, total, SftpTransferStatus::Running, None),
        );
        if !meta.overwrite && local.exists() {
            return Err(format!("local target already exists: {}", local.display()));
        }
        let mut remote_file = sftp
            .open(Path::new(&meta.source))
            .map_err(|e| e.to_string())?;
        let partial = local_partial_path(&local)?;
        let offset = resume_offset(total, fs::metadata(&partial).ok().map(|meta| meta.len()));
        let mut tmp = if offset > 0 {
            remote_file
                .seek(SeekFrom::Start(offset))
                .map_err(|e| e.to_string())?;
            fs::OpenOptions::new()
                .append(true)
                .open(&partial)
                .map_err(|e| e.to_string())?
        } else {
            fs::File::create(&partial).map_err(|e| e.to_string())?
        };
        let mut done = offset;
        let mut buf = vec![0; TRANSFER_CHUNK_SIZE];
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err("canceled".into());
            }
            let read = remote_file.read(&mut buf).map_err(|e| e.to_string())?;
            if read == 0 {
                break;
            }
            tmp.write_all(&buf[..read]).map_err(|e| e.to_string())?;
            done += read as u64;
            emit_transfer(
                &app,
                meta.event(done, total, SftpTransferStatus::Running, None),
            );
        }
        tmp.sync_all().map_err(|e| e.to_string())?;
        drop(tmp);
        if meta.overwrite {
            if let Ok(existing) = fs::symlink_metadata(&local) {
                if existing.is_dir() && !existing.file_type().is_symlink() {
                    return Err(format!("local target is a directory: {}", local.display()));
                }
                fs::remove_file(&local).map_err(|e| e.to_string())?;
            }
            fs::rename(&partial, &local).map_err(|e| e.to_string())?;
        } else {
            fs::rename(&partial, &local).map_err(|e| e.to_string())?;
        }
        Ok(())
    })();
    finish_transfer(app, transfers, meta, total, result);
}

fn finish_transfer(
    app: AppHandle,
    transfers: TransferCancelMap,
    meta: TransferMeta,
    total: u64,
    result: Result<(), String>,
) {
    let (status, error) = match result {
        Ok(()) => (SftpTransferStatus::Done, None),
        Err(err) if err == "canceled" => (SftpTransferStatus::Canceled, None),
        Err(err) => (SftpTransferStatus::Failed, Some(redact_error(&err))),
    };
    emit_transfer(&app, meta.event(total, total, status, error));
    if let Ok(mut map) = transfers.lock() {
        map.remove(&meta.id);
    }
}

fn spawn_transfer(job: impl FnOnce() + Send + 'static) -> Result<(), String> {
    std::thread::Builder::new()
        .name("kite-sftp-transfer".into())
        .spawn(job)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn new_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("{prefix}-{nanos}-{}", std::process::id())
}

fn format_permissions(perm: u32) -> String {
    let kind = match perm & 0o170000 {
        0o040000 => 'd',
        0o120000 => 'l',
        _ => '-',
    };
    let mut out = String::with_capacity(10);
    out.push(kind);
    for shift in [6, 3, 0] {
        let bits = (perm >> shift) & 0o7;
        out.push(if bits & 0o4 != 0 { 'r' } else { '-' });
        out.push(if bits & 0o2 != 0 { 'w' } else { '-' });
        out.push(if bits & 0o1 != 0 { 'x' } else { '-' });
    }
    out
}

fn redact_error(error: &str) -> String {
    let lower = error.to_lowercase();
    if lower.contains("password") || lower.contains("passphrase") {
        "SFTP credential error".into()
    } else {
        error.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_format_matches_remote_table_display() {
        assert_eq!(format_permissions(0o040755), "drwxr-xr-x");
        assert_eq!(format_permissions(0o100600), "-rw-------");
        assert_eq!(format_permissions(0o120777), "lrwxrwxrwx");
    }

    #[test]
    fn remote_rename_flags_never_allow_overwrite() {
        for flags in non_overwriting_rename_flags() {
            assert!(!flags.contains(RenameFlags::OVERWRITE));
        }
    }

    #[test]
    fn remote_create_dir_path_rejects_root() {
        assert!(validate_remote_create_dir_path("/home/new-folder").is_ok());
        assert!(validate_remote_create_dir_path("/").is_err());
    }

    #[test]
    fn delete_strategy_does_not_recurse_symlinked_directory() {
        assert_eq!(
            delete_strategy_from_perm(0o040755),
            DeleteStrategy::Directory
        );
        assert_eq!(delete_strategy_from_perm(0o120777), DeleteStrategy::Unlink);
    }

    #[test]
    fn conflict_rename_candidate_keeps_extension() {
        let exists = |path: &str| matches!(path, "/home/app.tar.gz" | "/home/app.tar (1).gz");
        assert_eq!(
            next_remote_conflict_path("/home/app.tar.gz", exists).unwrap(),
            "/home/app.tar (2).gz"
        );
    }

    #[test]
    fn redact_error_hides_credential_words() {
        assert_eq!(redact_error("bad password"), "SFTP credential error");
        assert_eq!(redact_error("missing passphrase"), "SFTP credential error");
        assert_eq!(redact_error("connection refused"), "connection refused");
    }

    #[test]
    fn resume_offset_uses_partial_only_when_it_is_smaller_than_total() {
        assert_eq!(resume_offset(100, Some(25)), 25);
        assert_eq!(resume_offset(100, Some(100)), 0);
        assert_eq!(resume_offset(100, Some(125)), 0);
        assert_eq!(resume_offset(100, None), 0);
    }

    #[test]
    fn remote_search_query_is_case_insensitive_and_trimmed() {
        assert!(remote_name_matches_query(
            "release-2026.tar.gz",
            " RELEASE "
        ));
        assert!(remote_name_matches_query("app.log", "log"));
        assert!(!remote_name_matches_query("app.log", "zip"));
    }

    #[test]
    fn remote_search_query_validation_rejects_empty_and_nul() {
        assert_eq!(validate_remote_search_query(" deploy ").unwrap(), "deploy");
        assert!(validate_remote_search_query("   ").is_err());
        assert!(validate_remote_search_query("bad\0query").is_err());
    }
}
