//! Screenshot capture command

use serde_json::Value;
use tauri::{Runtime, WebviewWindow};

use crate::screenshot as screenshot_impl;

/// Execute screenshot command
pub fn execute<R: Runtime>(window: &WebviewWindow<R>, args: &Value) -> Result<Value, String> {
    let format = args.get("format").and_then(|v| v.as_str()).unwrap_or("png");

    let quality = args
        .get("quality")
        .and_then(Value::as_u64)
        .map(|q| u8::try_from(q.min(100)).unwrap_or(100));

    let data = screenshot_impl::capture(window, format, quality)?;

    let mime = match format {
        "jpeg" | "jpg" => "image/jpeg",
        _ => "image/png",
    };

    Ok(Value::String(format!("data:{mime};base64,{data}")))
}
