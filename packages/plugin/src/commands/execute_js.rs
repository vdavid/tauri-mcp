//! JavaScript execution commands

use serde_json::Value;
use tauri::{Runtime, WebviewWindow};

/// Execute arbitrary JavaScript in the webview
pub fn execute<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    let script = args
        .get("script")
        .and_then(|v| v.as_str())
        .ok_or("Missing required 'script' argument")?;

    eval_with_result(window, script)
}

/// Get console logs from the webview
pub fn console_logs<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
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

    eval_with_result(window, &script)
}

/// Get DOM snapshot
pub fn dom_snapshot<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
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

    eval_with_result(window, &full_script)
}

/// Perform UI interaction
pub fn interact<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
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

    eval_with_result(window, &full_script)
}

/// Wait for a condition
pub fn wait_for<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    let script = include_str!("../scripts/wait-for.js");
    let args_json = serde_json::to_string(args).map_err(|e| e.to_string())?;

    let full_script = format!(
        r"
        {script}
        window.__tauriMcpWaitFor({args_json})
        "
    );

    eval_with_result(window, &full_script)
}

/// Evaluate JavaScript and parse the result
fn eval_with_result<R: Runtime>(window: &WebviewWindow<R>, script: &str) -> Result<Value, String> {
    // Wrap script to capture result as JSON
    let wrapped = format!(
        r"
        (async function() {{
            try {{
                const __result = await (async function() {{ {script} }})();
                return JSON.stringify({{ success: true, data: __result }});
            }} catch (e) {{
                return JSON.stringify({{ success: false, error: e.message || String(e) }});
            }}
        }})()
        "
    );

    let result = window.eval(&wrapped);

    match result {
        Ok(()) => {
            // For now, return success - actual result comes via different mechanism
            // TODO: Implement proper result retrieval
            Ok(Value::String("Script executed".to_string()))
        }
        Err(e) => Err(format!("Script execution failed: {e}")),
    }
}
