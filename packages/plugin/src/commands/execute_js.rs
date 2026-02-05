//! JavaScript execution commands

use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;
use tauri::{Listener, Runtime, WebviewWindow};
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

/// Default timeout for script execution in seconds
const DEFAULT_TIMEOUT_SECS: u64 = 5;

/// Payload for script result events from JavaScript
#[derive(Debug, Clone, Deserialize)]
struct ScriptResultPayload {
    exec_id: String,
    success: bool,
    data: Option<Value>,
    error: Option<String>,
}

/// Execute arbitrary JavaScript in the webview
pub async fn execute<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    let script = args
        .get("script")
        .and_then(|v| v.as_str())
        .ok_or("Missing required 'script' argument")?;

    let timeout_secs = args
        .get("timeout")
        .and_then(Value::as_u64)
        .unwrap_or(DEFAULT_TIMEOUT_SECS);

    eval_with_result(window, script, timeout_secs).await
}

/// Get console logs from the webview
pub async fn console_logs<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    let filter = args.get("filter").and_then(|v| v.as_str());
    let since = args.get("since").and_then(|v| v.as_str());
    let clear = args.get("clear").and_then(Value::as_bool).unwrap_or(false);

    let filter_arg = filter.map_or_else(|| "null".to_string(), |f| format!("'{f}'"));
    let since_arg = since.map_or_else(|| "null".to_string(), |s| format!("'{s}'"));

    let script = format!(
        r"
        (function() {{
            if (!window.__tauriMcpConsole) {{
                return {{ error: 'Console capture not initialized' }};
            }}
            const logs = window.__tauriMcpConsole.getLogs({filter_arg}, {since_arg});
            {clear_code}
            return logs;
        }})()
        ",
        clear_code = if clear { "window.__tauriMcpConsole.clear();" } else { "" }
    );

    eval_with_result(window, &script, DEFAULT_TIMEOUT_SECS).await
}

/// Get DOM snapshot
pub async fn dom_snapshot<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    let snapshot_type = args.get("type").and_then(|v| v.as_str()).unwrap_or("accessibility");

    let selector = args.get("selector").and_then(|v| v.as_str());

    let script = include_str!("../scripts/dom-snapshot.js");
    let selector_arg = selector.map_or_else(|| "null".to_string(), |s| format!("'{s}'"));

    let full_script = format!(
        r"
        {script}
        window.__tauriMcpDomSnapshot('{snapshot_type}', {selector_arg})
        "
    );

    eval_with_result(window, &full_script, DEFAULT_TIMEOUT_SECS).await
}

/// Perform UI interaction
pub async fn interact<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    // Validate action is present (used in the JS script)
    let _action = args
        .get("action")
        .and_then(|v| v.as_str())
        .ok_or("Missing required 'action' argument")?;

    let script = include_str!("../scripts/interact.js");
    let args_json = serde_json::to_string(args).map_err(|e| e.to_string())?;

    let full_script = format!(
        r"
        {script}
        window.__tauriMcpInteract({args_json})
        "
    );

    eval_with_result(window, &full_script, DEFAULT_TIMEOUT_SECS).await
}

/// Wait for a condition
pub async fn wait_for<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    // wait_for can have longer timeouts, use the timeout from args or default
    let timeout_secs = args
        .get("timeout")
        .and_then(Value::as_u64)
        .map_or(DEFAULT_TIMEOUT_SECS, |ms| (ms / 1000).max(1));

    let script = include_str!("../scripts/wait-for.js");
    let args_json = serde_json::to_string(args).map_err(|e| e.to_string())?;

    let full_script = format!(
        r"
        {script}
        window.__tauriMcpWaitFor({args_json})
        "
    );

    // Add extra time for the JS-level timeout
    eval_with_result(window, &full_script, timeout_secs + 2).await
}

/// Evaluate JavaScript and retrieve the result via Tauri events
async fn eval_with_result<R: Runtime>(
    window: &WebviewWindow<R>,
    script: &str,
    timeout_secs: u64,
) -> Result<Value, String> {
    // Generate unique execution ID
    let exec_id = Uuid::new_v4().to_string();

    // Create oneshot channel for the result
    let (tx, rx) = oneshot::channel::<Value>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    // Set up event listener for the result
    let exec_id_clone = exec_id.clone();
    let tx_clone = Arc::clone(&tx);

    let unlisten = window.listen("__tauri_mcp_script_result", move |event| {
        let payload_str = event.payload();

        // Try to parse the payload
        if let Ok(payload) = serde_json::from_str::<ScriptResultPayload>(payload_str) {
            // Check if this is our execution
            if payload.exec_id == exec_id_clone {
                let result = if payload.success {
                    serde_json::json!({
                        "success": true,
                        "data": payload.data.unwrap_or(Value::Null)
                    })
                } else {
                    serde_json::json!({
                        "success": false,
                        "error": payload.error.unwrap_or_else(|| "Unknown error".to_string())
                    })
                };

                // Send result through the channel
                let tx = tx_clone.clone();
                tokio::spawn(async move {
                    let mut guard = tx.lock().await;
                    if let Some(sender) = guard.take() {
                        let _ = sender.send(result);
                    }
                });
            }
        }
    });

    // Prepare the script with appropriate return handling
    let prepared_script = prepare_script(script);

    // Create wrapped script that uses event emission for result communication
    let wrapped_script = format!(
        r"
        (function() {{
            // Helper to send result back - tries multiple methods
            function __sendResult(success, data, error) {{
                const payload = {{
                    exec_id: '{exec_id}',
                    success: success,
                    data: data,
                    error: error
                }};

                // Try using __TAURI__ API (available when @tauri-apps/api is used)
                if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emit) {{
                    window.__TAURI__.event.emit('__tauri_mcp_script_result', payload);
                    return;
                }}

                // Try using __TAURI_INTERNALS__ (available in Tauri v2 webviews)
                if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {{
                    window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {{
                        event: '__tauri_mcp_script_result',
                        payload: payload
                    }});
                    return;
                }}

                // Fallback: log error (result will time out)
                console.error('[tauri-mcp] Cannot emit event: no Tauri API available');
            }}

            // Execute the user script
            (async () => {{
                try {{
                    // Create function to execute user script
                    const __executeScript = async () => {{
                        {prepared_script}
                    }};

                    // Execute and get result
                    const __result = await __executeScript();

                    // Handle promises
                    const __finalResult = __result instanceof Promise ? await __result : __result;

                    __sendResult(true, __finalResult !== undefined ? __finalResult : null, null);
                }} catch (error) {{
                    __sendResult(false, null, error.message || String(error));
                }}
            }})().catch(function(error) {{
                // Catch any unhandled promise rejections
                __sendResult(false, null, error.message || String(error));
            }});
        }})();
        "
    );

    // Execute the wrapped script
    if let Err(e) = window.eval(&wrapped_script) {
        window.unlisten(unlisten);
        return Err(format!("Script execution failed: {e}"));
    }

    // Wait for result with timeout
    let timeout = std::time::Duration::from_secs(timeout_secs);
    let result = match tokio::time::timeout(timeout, rx).await {
        Ok(Ok(result)) => {
            // Extract the actual result or error
            if result.get("success").and_then(Value::as_bool).unwrap_or(false) {
                Ok(result.get("data").cloned().unwrap_or(Value::Null))
            } else {
                let error = result
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("Unknown error")
                    .to_string();
                Err(format!("Script error: {error}"))
            }
        }
        Ok(Err(_)) => {
            // Channel was dropped
            Err("Script execution failed: result channel closed".to_string())
        }
        Err(_) => {
            // Timeout
            Err(format!("Script execution timeout after {timeout_secs}s"))
        }
    };

    // Clean up event listener
    window.unlisten(unlisten);

    result
}

/// Prepare script by adding return statement if needed
fn prepare_script(script: &str) -> String {
    let trimmed = script.trim();

    // Already has explicit return
    if trimmed.starts_with("return ") {
        return script.to_string();
    }

    // Check if it's a multi-statement script that shouldn't get auto-return
    let has_real_semicolons = trimmed.strip_suffix(';').map_or_else(
        || trimmed.contains(';'),
        |without_trailing| without_trailing.contains(';'),
    );

    let is_multi_statement = has_real_semicolons
        || trimmed.starts_with("const ")
        || trimmed.starts_with("let ")
        || trimmed.starts_with("var ")
        || trimmed.starts_with("if ")
        || trimmed.starts_with("for ")
        || trimmed.starts_with("while ")
        || trimmed.starts_with("function ")
        || trimmed.starts_with("class ")
        || trimmed.starts_with("try ");

    // Single expression patterns that should get auto-return
    let is_single_expression = trimmed.starts_with("await ")
        || trimmed.starts_with('(')
        || trimmed.starts_with("JSON.")
        || trimmed.starts_with('{')
        || trimmed.starts_with('[')
        || trimmed.ends_with(")()")
        || trimmed.starts_with("document.")
        || trimmed.starts_with("window.")
        || trimmed.starts_with("new ");

    if is_single_expression || !is_multi_statement {
        format!("return {trimmed}")
    } else {
        script.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prepare_script_adds_return_to_expression() {
        assert_eq!(prepare_script("document.title"), "return document.title");
        assert_eq!(prepare_script("1 + 2"), "return 1 + 2");
        assert_eq!(prepare_script("'hello'"), "return 'hello'");
    }

    #[test]
    fn prepare_script_adds_return_to_object_literal() {
        assert_eq!(prepare_script("{ foo: 'bar' }"), "return { foo: 'bar' }");
    }

    #[test]
    fn prepare_script_adds_return_to_array_literal() {
        assert_eq!(prepare_script("[1, 2, 3]"), "return [1, 2, 3]");
    }

    #[test]
    fn prepare_script_adds_return_to_await() {
        assert_eq!(prepare_script("await fetch('/api')"), "return await fetch('/api')");
    }

    #[test]
    fn prepare_script_adds_return_to_iife() {
        assert_eq!(prepare_script("(function() {})()"), "return (function() {})()");
    }

    #[test]
    fn prepare_script_preserves_explicit_return() {
        assert_eq!(prepare_script("return 42"), "return 42");
    }

    #[test]
    fn prepare_script_no_return_for_const() {
        let script = "const x = 1; x + 1";
        assert_eq!(prepare_script(script), script);
    }

    #[test]
    fn prepare_script_no_return_for_let() {
        let script = "let x = 1; x++; x";
        assert_eq!(prepare_script(script), script);
    }

    #[test]
    fn prepare_script_no_return_for_if() {
        let script = "if (true) { return 1; }";
        assert_eq!(prepare_script(script), script);
    }

    #[test]
    fn prepare_script_no_return_for_function_def() {
        let script = "function foo() { return 1; }";
        assert_eq!(prepare_script(script), script);
    }

    #[test]
    fn prepare_script_adds_return_to_json_stringify() {
        assert_eq!(
            prepare_script("JSON.stringify({ a: 1 })"),
            "return JSON.stringify({ a: 1 })"
        );
    }

    #[test]
    fn prepare_script_adds_return_to_new_expression() {
        assert_eq!(prepare_script("new Date()"), "return new Date()");
    }

    #[test]
    fn prepare_script_adds_return_to_window_access() {
        assert_eq!(prepare_script("window.location.href"), "return window.location.href");
    }

    #[test]
    fn prepare_script_trims_whitespace() {
        assert_eq!(prepare_script("  document.title  "), "return document.title");
    }
}
