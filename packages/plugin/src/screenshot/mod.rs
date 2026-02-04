//! Platform-specific screenshot capture

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;

use tauri::{Runtime, WebviewWindow};

/// Capture a screenshot of the webview
pub fn capture<R: Runtime>(window: &WebviewWindow<R>, format: &str, quality: Option<u8>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        macos::capture(window, format, quality)
    }

    #[cfg(target_os = "windows")]
    {
        windows::capture(window, format, quality)
    }

    #[cfg(target_os = "linux")]
    {
        linux::capture(window, format, quality)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (window, format, quality);
        Err("Screenshot not supported on this platform".to_string())
    }
}
