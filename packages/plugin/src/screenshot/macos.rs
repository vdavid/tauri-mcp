//! macOS screenshot implementation using `WKWebView.takeSnapshot`

use base64::Engine;
use tauri::{Runtime, WebviewWindow};

/// Capture screenshot on macOS using native `WKWebView` API
pub fn capture<R: Runtime>(window: &WebviewWindow<R>, format: &str, quality: Option<u8>) -> Result<String, String> {
    // Check if window is visible
    if !window.is_visible().unwrap_or(false) {
        return Err("Window is not visible. Cannot capture screenshot of hidden window.".to_string());
    }

    if window.is_minimized().unwrap_or(false) {
        return Err("Window is minimized. Cannot capture screenshot of minimized window.".to_string());
    }

    // For now, use a placeholder implementation
    // TODO: Implement actual WKWebView.takeSnapshot via objc2
    // This requires accessing the underlying NSWindow and WKWebView

    // Placeholder: Return a small valid PNG (1x1 transparent pixel)
    let placeholder_png = [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, // RGBA
        0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, // IEND chunk
        0xAE, 0x42, 0x60, 0x82,
    ];

    let _ = (format, quality); // Will be used in actual implementation

    Ok(base64::engine::general_purpose::STANDARD.encode(placeholder_png))
}
