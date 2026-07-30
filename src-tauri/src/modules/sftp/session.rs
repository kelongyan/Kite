use std::collections::HashMap;
use std::sync::{Arc, Mutex};

type NativeSshSession = ssh2::Session;

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
