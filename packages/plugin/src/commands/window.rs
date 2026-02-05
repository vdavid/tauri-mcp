//! Window management commands

use serde_json::{json, Value};
use tauri::{Manager, Runtime, WebviewWindow};

/// List all windows
#[allow(clippy::unnecessary_wraps)] // Keep Result for consistent command signature
pub fn list<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Value, String> {
    let windows = app.webview_windows();
    let mut result = Vec::new();

    for (label, window) in &windows {
        let title = window.title().unwrap_or_default();
        let focused = window.is_focused().unwrap_or(false);
        let visible = window.is_visible().unwrap_or(false);

        result.push(json!({
            "label": label,
            "title": title,
            "focused": focused,
            "visible": visible,
        }));
    }

    Ok(Value::Array(result))
}

/// Get detailed window info
pub fn info<R: Runtime>(window: &WebviewWindow<R>) -> Result<Value, String> {
    let label = window.label().to_string();
    let title = window.title().unwrap_or_default();

    let size = window.inner_size().map_err(|e| e.to_string())?;
    let position = window.outer_position().map_err(|e| e.to_string())?;

    let focused = window.is_focused().unwrap_or(false);
    let visible = window.is_visible().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);
    let maximized = window.is_maximized().unwrap_or(false);
    let fullscreen = window.is_fullscreen().unwrap_or(false);

    Ok(json!({
        "label": label,
        "title": title,
        "width": size.width,
        "height": size.height,
        "x": position.x,
        "y": position.y,
        "focused": focused,
        "visible": visible,
        "minimized": minimized,
        "maximized": maximized,
        "fullscreen": fullscreen,
    }))
}

/// Resize a window
#[allow(clippy::cast_possible_truncation)]
pub fn resize<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    let width = args.get("width").ok_or("Missing required 'width' argument")?;
    let width = width
        .as_u64()
        .ok_or_else(|| format!("'width' must be a positive integer, got: {width}"))? as u32;

    let height = args.get("height").ok_or("Missing required 'height' argument")?;
    let height = height
        .as_u64()
        .ok_or_else(|| format!("'height' must be a positive integer, got: {height}"))? as u32;

    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
        .map_err(|e| e.to_string())?;

    Ok(Value::String(format!("Resized to {width}x{height}")))
}
