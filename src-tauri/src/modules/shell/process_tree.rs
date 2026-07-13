use std::io;
use std::process::Command;
use std::sync::Arc;

use shared_child::SharedChild;

#[cfg(windows)]
use std::sync::Mutex;

/// Owns the operating-system primitive that contains a spawned shell and all
/// of its descendants. Killing or dropping the guard terminates the tree.
pub(super) struct ProcessTree {
    #[cfg(unix)]
    pgid: libc::pid_t,
    #[cfg(windows)]
    job: Mutex<Option<crate::modules::pty::job::PtyJob>>,
}

/// Spawns a child in an isolated process group / Job Object so later cleanup
/// cannot leave grandchildren (for example dev servers) running.
pub(super) fn spawn(cmd: &mut Command) -> io::Result<(Arc<SharedChild>, ProcessTree)> {
    configure_command(cmd);
    let child = Arc::new(SharedChild::spawn(cmd)?);
    match ProcessTree::attach(child.id()) {
        Ok(tree) => Ok((child, tree)),
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            Err(error)
        }
    }
}

#[cfg(unix)]
fn configure_command(cmd: &mut Command) {
    use std::os::unix::process::CommandExt;

    // Zero means "use the child's PID", yielding one process group per shell.
    cmd.process_group(0);
}

#[cfg(windows)]
fn configure_command(_cmd: &mut Command) {}

impl ProcessTree {
    #[cfg(unix)]
    fn attach(pid: u32) -> io::Result<Self> {
        let pgid = libc::pid_t::try_from(pid)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "child PID out of range"))?;
        Ok(Self { pgid })
    }

    #[cfg(windows)]
    fn attach(pid: u32) -> io::Result<Self> {
        let job = crate::modules::pty::job::PtyJob::create_for(pid)?;
        Ok(Self {
            job: Mutex::new(Some(job)),
        })
    }

    pub(super) fn kill(&self) -> io::Result<()> {
        #[cfg(unix)]
        {
            // Negative PID addresses the whole process group, including the
            // shell leader. ESRCH only means it already exited.
            if unsafe { libc::kill(-self.pgid, libc::SIGKILL) } == 0 {
                return Ok(());
            }
            let error = io::Error::last_os_error();
            if error.raw_os_error() == Some(libc::ESRCH) {
                Ok(())
            } else {
                Err(error)
            }
        }
        #[cfg(windows)]
        {
            // PtyJob uses KILL_ON_JOB_CLOSE. Taking and dropping the handle
            // terminates every process assigned to the job atomically.
            self.job
                .lock()
                .map_err(|_| io::Error::other("process-tree mutex poisoned"))?
                .take();
            Ok(())
        }
    }
}

impl Drop for ProcessTree {
    fn drop(&mut self) {
        let _ = self.kill();
    }
}
