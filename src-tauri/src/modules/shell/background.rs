use std::io::Read;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::SystemTime;

use serde::Serialize;
use shared_child::SharedChild;

use super::process_tree::ProcessTree;
use super::ringbuffer::BoundedRingBuffer;
use crate::modules::workspace::{resolve_path, WorkspaceEnv};

const RING_CAP: usize = 4 * 1024 * 1024;

pub struct BackgroundProc {
    pub command: String,
    pub cwd: Option<String>,
    pub started_at_ms: u64,
    pub child: Arc<SharedChild>,
    tree: ProcessTree,
    pub buffer: Mutex<BoundedRingBuffer>,
    pub exited: AtomicBool,
    pub exit_code: AtomicI32,
    pub exit_unknown: AtomicBool,
}

#[derive(Serialize)]
pub struct BackgroundLogResponse {
    pub bytes: String,
    pub next_offset: u64,
    pub dropped: u64,
    pub exited: bool,
    pub exit_code: Option<i32>,
}

#[derive(Serialize)]
pub struct BackgroundProcInfo {
    pub handle: u32,
    pub command: String,
    pub cwd: Option<String>,
    pub started_at_ms: u64,
    pub exited: bool,
    pub exit_code: Option<i32>,
}

impl BackgroundProc {
    pub fn read_logs(&self, since: u64) -> BackgroundLogResponse {
        let (bytes, next_offset, dropped) = self.buffer.lock().unwrap().read_from(since);
        let exited = self.exited.load(Ordering::Acquire);
        let exit_code = if exited && !self.exit_unknown.load(Ordering::Acquire) {
            Some(self.exit_code.load(Ordering::Acquire))
        } else {
            None
        };
        BackgroundLogResponse {
            bytes: String::from_utf8_lossy(&bytes).into_owned(),
            next_offset,
            dropped,
            exited,
            exit_code,
        }
    }

    pub fn kill(&self) {
        let _ = self.tree.kill();
    }

    pub fn info(&self, handle: u32) -> BackgroundProcInfo {
        let exited = self.exited.load(Ordering::Acquire);
        let exit_code = if exited && !self.exit_unknown.load(Ordering::Acquire) {
            Some(self.exit_code.load(Ordering::Acquire))
        } else {
            None
        };
        BackgroundProcInfo {
            handle,
            command: self.command.clone(),
            cwd: self.cwd.clone(),
            started_at_ms: self.started_at_ms,
            exited,
            exit_code,
        }
    }
}

impl Drop for BackgroundProc {
    fn drop(&mut self) {
        self.kill();
    }
}

pub fn spawn(
    command: String,
    cwd: Option<String>,
    workspace: WorkspaceEnv,
) -> Result<Arc<BackgroundProc>, String> {
    let trimmed = command.trim().to_string();
    if trimmed.is_empty() {
        return Err("empty command".into());
    }
    if let Some(ref dir) = cwd {
        if !resolve_path(dir, &workspace).is_dir() {
            return Err(format!("cwd is not a directory: {dir}"));
        }
    }

    let mut cmd = super::build_oneshot_command(&trimmed, &workspace, cwd.as_deref())?;
    if let (WorkspaceEnv::Local, Some(ref dir)) = (&workspace, &cwd) {
        cmd.current_dir(dir);
    }
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::modules::proc::hide_console(&mut cmd);

    let (shared, tree) = super::process_tree::spawn(&mut cmd).map_err(|e| e.to_string())?;
    let kill_on_fail = || {
        let _ = tree.kill();
        let _ = shared.wait();
    };
    let stdout_pipe = shared.take_stdout().ok_or_else(|| {
        kill_on_fail();
        "no stdout pipe".to_string()
    })?;
    let stderr_pipe = shared.take_stderr().ok_or_else(|| {
        kill_on_fail();
        "no stderr pipe".to_string()
    })?;
    let child = shared;

    let started_at_ms = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let proc = Arc::new(BackgroundProc {
        command: trimmed,
        cwd,
        started_at_ms,
        child,
        tree,
        buffer: Mutex::new(BoundedRingBuffer::new(RING_CAP)),
        exited: AtomicBool::new(false),
        exit_code: AtomicI32::new(0),
        exit_unknown: AtomicBool::new(false),
    });

    {
        let proc_ref = proc.clone();
        let mut pipe = stdout_pipe;
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match pipe.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => proc_ref.buffer.lock().unwrap().push(&buf[..n]),
                    Err(_) => break,
                }
            }
        });
    }
    {
        let proc_ref = proc.clone();
        let mut pipe = stderr_pipe;
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match pipe.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => proc_ref.buffer.lock().unwrap().push(&buf[..n]),
                    Err(_) => break,
                }
            }
        });
    }
    {
        let proc_ref = proc.clone();
        let child_for_wait = proc.child.clone();
        thread::spawn(move || {
            match child_for_wait.wait() {
                Ok(status) => match status.code() {
                    Some(code) => proc_ref.exit_code.store(code, Ordering::Release),
                    None => proc_ref.exit_unknown.store(true, Ordering::Release),
                },
                Err(_) => proc_ref.exit_unknown.store(true, Ordering::Release),
            }
            // A shell can exit after launching a detached child. Tear down the
            // remaining tree before exposing `exited` to callers.
            let _ = proc_ref.tree.kill();
            proc_ref.exited.store(true, Ordering::Release);
        });
    }

    Ok(proc)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    fn wait_until(timeout: Duration, check: impl Fn() -> bool) -> bool {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if check() {
                return true;
            }
            thread::sleep(Duration::from_millis(20));
        }
        check()
    }

    #[test]
    fn kill_terminates_the_process_tree() {
        let dir = tempfile::tempdir().unwrap();
        let ready = dir.path().join("ready");
        let survived = dir.path().join("survived");
        let script = dir.path().join("child.ps1");
        let ps_quote = |path: &std::path::Path| path.to_string_lossy().replace('\'', "''");
        std::fs::write(
            &script,
            format!(
                "Set-Content -LiteralPath '{}' -Value ready\nStart-Sleep -Seconds 3\nSet-Content -LiteralPath '{}' -Value survived\n",
                ps_quote(&ready),
                ps_quote(&survived),
            ),
        )
        .unwrap();
        let command = format!("& powershell.exe -NoProfile -File '{}'", ps_quote(&script));
        let proc = spawn(command, None, WorkspaceEnv::Local).expect("spawn");

        assert!(
            wait_until(Duration::from_secs(5), || ready.exists()),
            "descendant must start before kill",
        );
        proc.kill();
        assert!(wait_until(Duration::from_secs(5), || {
            proc.read_logs(0).exited
        }));
        thread::sleep(Duration::from_secs(3));
        assert!(!survived.exists(), "background descendant survived kill");
    }

    #[test]
    fn leader_exit_terminates_the_remaining_process_tree() {
        let dir = tempfile::tempdir().unwrap();
        let ready = dir.path().join("ready");
        let survived = dir.path().join("survived");
        let script = dir.path().join("child.ps1");
        let ps_quote = |path: &std::path::Path| path.to_string_lossy().replace('\'', "''");
        std::fs::write(
            &script,
            format!(
                "Set-Content -LiteralPath '{}' -Value ready\nStart-Sleep -Seconds 3\nSet-Content -LiteralPath '{}' -Value survived\n",
                ps_quote(&ready),
                ps_quote(&survived),
            ),
        )
        .unwrap();
        let command = format!(
            "$p = Start-Process -PassThru -WindowStyle Hidden powershell.exe -ArgumentList @('-NoProfile', '-File', '{}'); while (-not (Test-Path -LiteralPath '{}')) {{ Start-Sleep -Milliseconds 20 }}",
            ps_quote(&script),
            ps_quote(&ready),
        );
        let proc = spawn(command, None, WorkspaceEnv::Local).expect("spawn");

        assert!(wait_until(Duration::from_secs(5), || {
            proc.read_logs(0).exited
        }));
        assert!(ready.exists(), "descendant must start before shell exit");
        thread::sleep(Duration::from_secs(3));
        assert!(!survived.exists(), "descendant survived shell exit");
    }
}
