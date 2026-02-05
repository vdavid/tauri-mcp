//! Command handlers for MCP requests.
//!
//! Each command corresponds to a tool in the MCP server:
//! - `screenshot` - Capture webview screenshot
//! - `execute_js` - Run JavaScript in the webview
//! - `console_logs` - Get captured console output
//! - `dom_snapshot` - Get DOM tree as YAML
//! - `interact` - Click, type, scroll
//! - `wait_for` - Wait for conditions
//! - `window_list` / `window_info` / `window_resize` - Window management

mod execute_js;
mod screenshot;
mod window;

use serde_json::Value;
use tauri::{Manager, Runtime};

use crate::websocket::{Request, WindowContext};

/// Route a request to the appropriate command handler.
///
/// Returns the result data and window context on success, or an error message.
pub async fn execute<R: Runtime>(
    app: &tauri::AppHandle<R>,
    request: Request,
) -> Result<(Value, Option<WindowContext>), String> {
    let window_label = request.args.get("windowId").and_then(|v| v.as_str()).map(String::from);

    let window = resolve_window(app, window_label.as_deref())?;
    let context = Some(WindowContext {
        window_label: window.label().to_string(),
        total_windows: app.webview_windows().len(),
    });

    let result = match request.command.as_str() {
        "screenshot" => screenshot::execute(&window, &request.args),
        "execute_js" => execute_js::execute(&window, &request.args).await,
        "console_logs" => execute_js::console_logs(&window, &request.args).await,
        "dom_snapshot" => execute_js::dom_snapshot(&window, &request.args).await,
        "interact" => execute_js::interact(&window, &request.args).await,
        "wait_for" => execute_js::wait_for(&window, &request.args).await,
        "window_list" => window::list(app),
        "window_info" => window::info(&window),
        "window_resize" => window::resize(&window, &request.args),
        _ => Err(format!(
            "Unknown command: '{}'. Available: screenshot, execute_js, console_logs, dom_snapshot, interact, wait_for, window_list, window_info, window_resize",
            request.command
        )),
    }?;

    Ok((result, context))
}

/// Resolve a window by label or get the focused/first window
#[allow(clippy::option_if_let_else)]
fn resolve_window<R: Runtime>(
    app: &tauri::AppHandle<R>,
    label: Option<&str>,
) -> Result<tauri::WebviewWindow<R>, String> {
    let windows = app.webview_windows();

    if windows.is_empty() {
        return Err("No windows available".to_string());
    }

    if let Some(label) = label {
        windows.get(label).cloned().ok_or_else(|| {
            let available: Vec<&str> = windows.keys().map(String::as_str).collect();
            format!("Window '{label}' not found. Available: {}", available.join(", "))
        })
    } else {
        // Try to find focused window, fall back to first
        windows
            .values()
            .find(|w| w.is_focused().unwrap_or(false))
            .or_else(|| windows.values().next())
            .cloned()
            .ok_or_else(|| "No window available".to_string())
    }
}
