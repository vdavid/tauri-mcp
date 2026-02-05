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

    // Use JSON serialization for proper escaping of special characters
    let filter_arg = filter.map_or_else(
        || "null".to_string(),
        |f| serde_json::to_string(f).unwrap_or_else(|_| "null".to_string()),
    );
    let since_arg = since.map_or_else(
        || "null".to_string(),
        |s| serde_json::to_string(s).unwrap_or_else(|_| "null".to_string()),
    );

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

    // Validate snapshot type
    if snapshot_type != "accessibility" && snapshot_type != "structure" {
        return Err(format!(
            "Invalid snapshot type: '{snapshot_type}'. Use 'accessibility' or 'structure'."
        ));
    }

    let selector = args.get("selector").and_then(|v| v.as_str());

    let script = include_str!("../scripts/dom-snapshot.js");
    // Use JSON serialization for proper escaping of special characters in selector
    let selector_arg = selector.map_or_else(
        || "null".to_string(),
        |s| serde_json::to_string(s).unwrap_or_else(|_| "null".to_string()),
    );

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

/// Interval for fallback polling in milliseconds
const FALLBACK_POLL_INTERVAL_MS: u64 = 50;

/// Evaluate JavaScript and retrieve the result via Tauri events
async fn eval_with_result<R: Runtime>(
    window: &WebviewWindow<R>,
    script: &str,
    timeout_secs: u64,
) -> Result<Value, String> {
    let exec_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel::<Value>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    // Set up event listener for the result
    let unlisten = setup_result_listener(window, &exec_id, Arc::clone(&tx));

    // Create and execute the wrapped script
    let prepared_script = prepare_script(script);
    let wrapped_script = create_wrapped_script(&exec_id, &prepared_script);

    if let Err(e) = window.eval(&wrapped_script) {
        window.unlisten(unlisten);
        return Err(format!("Script execution failed: {e}"));
    }

    // Wait for result with timeout and fallback polling
    let timeout = std::time::Duration::from_secs(timeout_secs);
    let poll_interval = std::time::Duration::from_millis(FALLBACK_POLL_INTERVAL_MS);
    let result = wait_for_result_with_polling(window, rx, &exec_id, timeout, poll_interval).await;

    // Clean up
    window.unlisten(unlisten);
    let cleanup = format!(r"if (window.__tauriMcpResults) {{ delete window.__tauriMcpResults['{exec_id}']; }}");
    let _ = window.eval(&cleanup);

    // Extract the actual result or error
    match result {
        Ok(value) => {
            if value.get("success").and_then(Value::as_bool).unwrap_or(false) {
                Ok(value.get("data").cloned().unwrap_or(Value::Null))
            } else {
                let error = value
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("Unknown error")
                    .to_string();
                Err(format!("Script error: {error}"))
            }
        }
        Err(e) => Err(e),
    }
}

/// Set up the event listener for script results
fn setup_result_listener<R: Runtime>(
    window: &WebviewWindow<R>,
    exec_id: &str,
    tx: Arc<Mutex<Option<oneshot::Sender<Value>>>>,
) -> tauri::EventId {
    let exec_id_clone = exec_id.to_string();
    window.listen("__tauri_mcp_script_result", move |event| {
        let payload_str = event.payload();
        if let Ok(payload) = serde_json::from_str::<ScriptResultPayload>(payload_str) {
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

                let tx = tx.clone();
                tokio::spawn(async move {
                    let mut guard = tx.lock().await;
                    if let Some(sender) = guard.take() {
                        let _ = sender.send(result);
                    }
                });
            }
        }
    })
}

/// Create the wrapped JavaScript that stores results and emits events
fn create_wrapped_script(exec_id: &str, prepared_script: &str) -> String {
    format!(
        r"
        (function() {{
            window.__tauriMcpResults = window.__tauriMcpResults || {{}};

            function __storeResult(success, data, error) {{
                window.__tauriMcpResults['{exec_id}'] = {{ success: success, data: data, error: error }};
                setTimeout(function() {{
                    if (window.__tauriMcpResults) {{ delete window.__tauriMcpResults['{exec_id}']; }}
                }}, 10000);
            }}

            function __sendResult(success, data, error) {{
                __storeResult(success, data, error);
                const payload = {{ exec_id: '{exec_id}', success: success, data: data, error: error }};

                if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emit) {{
                    window.__TAURI__.event.emit('__tauri_mcp_script_result', payload);
                    return;
                }}
                if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {{
                    window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {{
                        event: '__tauri_mcp_script_result',
                        payload: payload
                    }});
                    return;
                }}
                console.warn('[tauri-mcp] Event emission unavailable, using fallback polling');
            }}

            (async () => {{
                try {{
                    const __executeScript = async () => {{ {prepared_script} }};
                    const __result = await __executeScript();
                    const __finalResult = __result instanceof Promise ? await __result : __result;
                    __sendResult(true, __finalResult !== undefined ? __finalResult : null, null);
                }} catch (error) {{
                    __sendResult(false, null, error.message || String(error));
                }}
            }})().catch(function(error) {{
                __sendResult(false, null, error.message || String(error));
            }});
        }})();
        "
    )
}

/// Wait for result via event channel with fallback polling
async fn wait_for_result_with_polling<R: Runtime>(
    window: &WebviewWindow<R>,
    mut rx: oneshot::Receiver<Value>,
    exec_id: &str,
    timeout: std::time::Duration,
    poll_interval: std::time::Duration,
) -> Result<Value, String> {
    let start = std::time::Instant::now();

    loop {
        // Check if we've exceeded the timeout
        if start.elapsed() >= timeout {
            return Err(format!("Script execution timeout after {}s", timeout.as_secs()));
        }

        // Try to receive from the event channel (non-blocking check)
        match rx.try_recv() {
            Ok(result) => return Ok(result),
            Err(oneshot::error::TryRecvError::Closed) => {
                return Err("Script execution failed: result channel closed".to_string());
            }
            Err(oneshot::error::TryRecvError::Empty) => {
                // No result yet, try fallback polling
            }
        }

        // Fallback: poll the result store via eval
        // Note: window.eval() doesn't return values directly, so we inject a script
        // that stores the poll result in a known location, then re-emits it as an event
        let poll_result_key = format!("__poll_{exec_id}");
        let poll_check_script = format!(
            r"(function() {{
                var result = null;
                if (window.__tauriMcpResults && window.__tauriMcpResults['{exec_id}']) {{
                    result = window.__tauriMcpResults['{exec_id}'];
                }}
                window['{poll_result_key}'] = result;
            }})()"
        );

        if window.eval(&poll_check_script).is_ok() {
            // Give a tiny bit of time for the eval to complete
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;

            // Now check if we can retrieve the poll result
            let retrieve_script = format!(
                r"(function() {{
                    var r = window['{poll_result_key}'];
                    delete window['{poll_result_key}'];
                    if (r) {{
                        // Send via event since we found a result
                        var payload = {{
                            exec_id: '{exec_id}',
                            success: r.success,
                            data: r.data,
                            error: r.error
                        }};
                        if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emit) {{
                            window.__TAURI__.event.emit('__tauri_mcp_script_result', payload);
                        }} else if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {{
                            window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {{
                                event: '__tauri_mcp_script_result',
                                payload: payload
                            }});
                        }}
                    }}
                }})()"
            );

            let _ = window.eval(&retrieve_script);
        }

        // Wait for the poll interval before trying again
        let remaining = timeout.saturating_sub(start.elapsed());
        let sleep_duration = poll_interval.min(remaining);
        if sleep_duration.is_zero() {
            return Err(format!("Script execution timeout after {}s", timeout.as_secs()));
        }

        // Use tokio::select! to wait for either the event or the poll interval
        tokio::select! {
            result = &mut rx => {
                match result {
                    Ok(value) => return Ok(value),
                    Err(_) => return Err("Script execution failed: result channel closed".to_string()),
                }
            }
            () = tokio::time::sleep(sleep_duration) => {
                // Continue to next iteration for polling
            }
        }
    }
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
