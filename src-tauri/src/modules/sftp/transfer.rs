use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SftpTransferDirection {
    Upload,
    Download,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SftpTransferStatus {
    Queued,
    Running,
    Done,
    Failed,
    Canceled,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpTransferEvent {
    pub id: String,
    pub connection_id: String,
    pub direction: SftpTransferDirection,
    pub source: String,
    pub target: String,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub status: SftpTransferStatus,
    pub error: Option<String>,
}

pub const SFTP_TRANSFER_EVENT: &str = "sftp:transfer";

pub fn emit_transfer(app: &AppHandle, event: SftpTransferEvent) {
    let _ = app.emit(SFTP_TRANSFER_EVENT, event);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transfer_status_serializes_lowercase() {
        let event = SftpTransferEvent {
            id: "t1".into(),
            connection_id: "c1".into(),
            direction: SftpTransferDirection::Upload,
            source: "a".into(),
            target: "b".into(),
            bytes_done: 1,
            bytes_total: 2,
            status: SftpTransferStatus::Running,
            error: None,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"direction\":\"upload\""));
        assert!(json.contains("\"status\":\"running\""));
        assert!(json.contains("\"bytesDone\":1"));
    }
}
