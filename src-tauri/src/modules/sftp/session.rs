use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SftpBackendDecision {
    pub crate_name: &'static str,
    pub version_req: &'static str,
    pub auth_methods: &'static [&'static str],
    pub host_key_verification: &'static str,
    pub streaming_model: &'static str,
    pub notes: &'static str,
}

pub type NativeSshSession = ssh2::Session;

#[derive(Clone)]
pub struct ManagedSftpSession {
    pub profile_id: String,
    pub session: Arc<Mutex<NativeSshSession>>,
}

#[derive(Clone, Default)]
pub struct SftpState {
    pub sessions: Arc<Mutex<HashMap<String, ManagedSftpSession>>>,
    pub transfers: Arc<Mutex<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>>,
}

pub const SELECTED_BACKEND: SftpBackendDecision = SftpBackendDecision {
    crate_name: "ssh2",
    version_req: "0.9.6",
    auth_methods: &["password", "private-key-with-optional-passphrase"],
    host_key_verification: "block when no trusted fingerprint exists or when it changes",
    streaming_model: "stream local and remote files with std::io::Read and std::io::Write",
    notes: "libssh2 is mature and available on Windows, macOS, and Linux; Kite keeps it behind this module so a pure Rust backend can replace it later if needed.",
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selected_backend_records_p1_connection_requirements() {
        assert_eq!(SELECTED_BACKEND.crate_name, "ssh2");
        assert!(SELECTED_BACKEND.auth_methods.contains(&"password"));
        assert!(SELECTED_BACKEND
            .auth_methods
            .contains(&"private-key-with-optional-passphrase"));
        assert!(SELECTED_BACKEND
            .host_key_verification
            .contains("fingerprint"));
        assert!(SELECTED_BACKEND.streaming_model.contains("Read"));
        assert!(SELECTED_BACKEND.streaming_model.contains("Write"));
    }
}
