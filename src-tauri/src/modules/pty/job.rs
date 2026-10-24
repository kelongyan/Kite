//! Windows Job Object with KILL_ON_JOB_CLOSE for ConPTY children.
//! Dropping the handle kills the whole tree — only reliable orphan guard
//! on Windows.

#![cfg(windows)]

use std::io;
use std::mem::{size_of, zeroed};

use windows_sys::Win32::Foundation::{CloseHandle, FALSE, HANDLE, INVALID_HANDLE_VALUE};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectBasicProcessIdList,
    JobObjectExtendedLimitInformation, QueryInformationJobObject,
    SetInformationJobObject, JOBOBJECT_BASIC_PROCESS_ID_LIST,
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};
use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE};

pub struct PtyJob {
    handle: HANDLE,
}

unsafe impl Send for PtyJob {}
unsafe impl Sync for PtyJob {}

impl PtyJob {
    pub fn create_for(pid: u32) -> io::Result<Self> {
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() || job == INVALID_HANDLE_VALUE {
                return Err(io::Error::last_os_error());
            }

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if ok == 0 {
                let e = io::Error::last_os_error();
                CloseHandle(job);
                return Err(e);
            }

            let process = OpenProcess(PROCESS_TERMINATE | PROCESS_SET_QUOTA, FALSE, pid);
            if process.is_null() {
                let e = io::Error::last_os_error();
                CloseHandle(job);
                return Err(e);
            }

            let assign = AssignProcessToJobObject(job, process);
            CloseHandle(process);
            if assign == 0 {
                let e = io::Error::last_os_error();
                CloseHandle(job);
                return Err(e);
            }

            Ok(Self { handle: job })
        }
    }

    /// Processes still assigned to the job — the whole spawned tree, not just
    /// direct children. The shell itself counts, so an idle shell reports 1
    /// and 0 once the tree is gone.
    pub fn process_count(&self) -> io::Result<usize> {
        // A modest fixed buffer: even when the pid list does not fit
        // (ERROR_MORE_DATA), the counts at the head of the struct are valid.
        let mut buf = [0u8; 4096];
        let ok = unsafe {
            QueryInformationJobObject(
                self.handle,
                JobObjectBasicProcessIdList,
                buf.as_mut_ptr().cast(),
                buf.len() as u32,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            let e = io::Error::last_os_error();
            if e.raw_os_error()
                != Some(windows_sys::Win32::Foundation::ERROR_MORE_DATA as i32)
            {
                return Err(e);
            }
        }
        let list = unsafe { &*buf.as_ptr().cast::<JOBOBJECT_BASIC_PROCESS_ID_LIST>() };
        Ok(list.NumberOfAssignedProcesses as usize)
    }
}

impl Drop for PtyJob {
    fn drop(&mut self) {
        if !self.handle.is_null() && self.handle != INVALID_HANDLE_VALUE {
            unsafe { CloseHandle(self.handle) };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use std::time::{Duration, Instant};

    #[test]
    fn create_for_invalid_pid_errors() {
        match PtyJob::create_for(0xFFFFFFFE) {
            Err(_) => {}
            Ok(_) => panic!("invalid pid must error"),
        }
    }

    #[test]
    fn drop_kills_assigned_process_tree() {
        let mut child = Command::new("cmd.exe")
            .args(["/C", "ping -n 30 127.0.0.1 > nul"])
            .spawn()
            .expect("spawn cmd.exe");

        let job = PtyJob::create_for(child.id()).expect("create job");
        drop(job);

        let deadline = Instant::now() + Duration::from_secs(3);
        loop {
            match child.try_wait().expect("try_wait") {
                Some(_) => break,
                None if Instant::now() >= deadline => {
                    let _ = child.kill();
                    panic!("child survived 3s after PtyJob drop");
                }
                None => std::thread::sleep(Duration::from_millis(50)),
            }
        }
    }

    #[test]
    fn process_count_tracks_the_assigned_tree() {
        // cmd spawns ping as a grandchild-level process in the job.
        let mut child = Command::new("cmd.exe")
            .args(["/C", "ping -n 30 127.0.0.1 > nul"])
            .spawn()
            .expect("spawn cmd.exe");

        let job = PtyJob::create_for(child.id()).expect("create job");
        let count = job.process_count().expect("process_count");
        assert!(count >= 1, "shell itself must be counted, got {count}");

        let _ = child.kill();
        let _ = child.wait();
        drop(job);

        // Once the tree exits, the job reports zero assigned processes (the
        // handle stays queryable until closed).
        let mut short = Command::new("cmd.exe")
            .args(["/C", "exit 0"])
            .spawn()
            .expect("spawn short cmd");
        let job2 = PtyJob::create_for(short.id()).expect("create job");
        let _ = short.wait();
        std::thread::sleep(Duration::from_millis(200));
        if let Ok(n) = job2.process_count() {
            assert_eq!(n, 0);
        }
    }
}
