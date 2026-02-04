//! Windows screenshot implementation (stub)

use tauri::{Runtime, WebviewWindow};

/// Capture screenshot on Windows (not yet implemented)
pub fn capture<R: Runtime>(_window: &WebviewWindow<R>, _format: &str, _quality: Option<u8>) -> Result<String, String> {
    Err("Screenshot not implemented on Windows yet. This feature is planned for a future release.".to_string())
}
