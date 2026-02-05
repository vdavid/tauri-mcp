//! WebSocket server for MCP communication.
//!
//! Handles JSON-RPC-like requests from the MCP server and routes them to command handlers.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, oneshot, RwLock};
use tokio::time::interval;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info};

use crate::commands;

/// Incoming request from the MCP server.
///
/// Uses a JSON-RPC-like format with an ID for request/response matching.
#[derive(Debug, Deserialize)]
pub struct Request {
    /// Unique request identifier for response matching
    pub id: String,
    /// Command name (`screenshot`, `execute_js`, `window_list`, etc.)
    pub command: String,
    /// Command-specific arguments
    #[serde(default)]
    pub args: serde_json::Value,
}

/// Response sent back to the MCP server.
#[derive(Debug, Serialize)]
pub struct Response {
    /// Matches the request ID
    pub id: String,
    /// Whether the command succeeded
    pub success: bool,
    /// Command result (on success)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    /// Error message (on failure)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Info about the window that handled the request
    #[serde(skip_serializing_if = "Option::is_none", rename = "windowContext")]
    pub window_context: Option<WindowContext>,
}

/// Metadata about the window that handled the request.
///
/// Included in successful responses to help identify which window was used.
#[derive(Debug, Serialize)]
pub struct WindowContext {
    /// Label of the window that handled the request
    #[serde(rename = "windowLabel")]
    pub window_label: String,
    /// Total number of windows in the application
    #[serde(rename = "totalWindows")]
    pub total_windows: usize,
}

/// Server state shared across connections
pub struct ServerState<R: Runtime> {
    pub app: AppHandle<R>,
}

const PING_INTERVAL: Duration = Duration::from_secs(30);
const DEFAULT_COMMAND_TIMEOUT_SECS: u64 = 10;

/// Get command timeout from `TAURI_MCP_TIMEOUT` env var (in ms) or default to 10s
fn get_command_timeout() -> Duration {
    std::env::var("TAURI_MCP_TIMEOUT")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .map_or(Duration::from_secs(DEFAULT_COMMAND_TIMEOUT_SECS), Duration::from_millis)
}

/// Handle for shutting down the WebSocket server gracefully.
///
/// When dropped or when `shutdown()` is called, signals the server to stop
/// accepting new connections.
#[derive(Clone)]
pub struct ShutdownHandle {
    sender: broadcast::Sender<()>,
}

impl ShutdownHandle {
    /// Create a new shutdown handle and receiver pair.
    #[must_use]
    pub fn new() -> (Self, broadcast::Receiver<()>) {
        let (sender, receiver) = broadcast::channel(1);
        (Self { sender }, receiver)
    }

    /// Signal the server to shut down gracefully.
    pub fn shutdown(&self) {
        // Ignore error if no receivers (server already stopped)
        let _ = self.sender.send(());
    }
}

impl Default for ShutdownHandle {
    fn default() -> Self {
        Self::new().0
    }
}

/// Start the WebSocket server
pub async fn start_server<R: Runtime>(
    app: AppHandle<R>,
    port: u16,
    host: &str,
    ready_tx: oneshot::Sender<()>,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let addr = format!("{host}:{port}");
    let listener = TcpListener::bind(&addr).await?;
    info!("WebSocket server listening on {addr}");

    let state = Arc::new(ServerState { app });

    // Signal that we're ready
    let _ = ready_tx.send(());

    loop {
        tokio::select! {
            // Handle incoming connections
            accept_result = listener.accept() => {
                match accept_result {
                    Ok((stream, peer)) => {
                        let state = Arc::clone(&state);
                        tokio::spawn(async move {
                            if let Err(e) = handle_connection(stream, peer, state).await {
                                error!("Connection error from {peer}: {e}");
                            }
                        });
                    }
                    Err(e) => {
                        error!("Failed to accept connection: {e}");
                    }
                }
            }

            // Handle shutdown signal
            _ = shutdown_rx.recv() => {
                info!("WebSocket server received shutdown signal, stopping accept loop");
                break;
            }
        }
    }

    info!("WebSocket server shut down gracefully");
    Ok(())
}

async fn handle_connection<R: Runtime>(
    stream: TcpStream,
    peer: SocketAddr,
    state: Arc<ServerState<R>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("New connection from {peer}");

    let ws_stream = tokio_tungstenite::accept_async(stream).await?;
    let (write, read) = ws_stream.split();
    let write = Arc::new(RwLock::new(write));

    // Ping task for keep-alive
    let write_ping = Arc::clone(&write);
    let ping_task = tokio::spawn(async move {
        let mut ticker = interval(PING_INTERVAL);
        loop {
            ticker.tick().await;
            let mut w = write_ping.write().await;
            if w.send(Message::Ping(vec![].into())).await.is_err() {
                break;
            }
        }
    });

    // Message handling
    let write_msg = Arc::clone(&write);
    let message_task = read.for_each(|msg| {
        let write = Arc::clone(&write_msg);
        let state = Arc::clone(&state);
        async move {
            match msg {
                Ok(Message::Text(text)) => {
                    debug!("Received: {text}");
                    let response = handle_request(&text, &state).await;
                    let response_text =
                        serde_json::to_string(&response).unwrap_or_else(|e| format!(r#"{{"error":"{e}"}}"#));
                    let mut w = write.write().await;
                    if let Err(e) = w.send(Message::Text(response_text.into())).await {
                        error!("Failed to send response: {e}");
                    }
                }
                Ok(Message::Pong(_)) => debug!("Received pong from {peer}"),
                Ok(Message::Close(_)) => info!("Client {peer} disconnected"),
                Err(e) => error!("WebSocket error: {e}"),
                _ => {}
            }
        }
    });

    message_task.await;
    ping_task.abort();

    info!("Connection closed from {peer}");
    Ok(())
}

async fn handle_request<R: Runtime>(text: &str, state: &ServerState<R>) -> Response {
    let request: Request = match serde_json::from_str(text) {
        Ok(r) => r,
        Err(e) => {
            return Response {
                id: String::new(),
                success: false,
                data: None,
                error: Some(format!("Invalid request JSON: {e}")),
                window_context: None,
            };
        }
    };

    let id = request.id.clone();

    // Execute command with timeout
    let timeout = get_command_timeout();
    let result = tokio::time::timeout(timeout, commands::execute(&state.app, request)).await;

    match result {
        Ok(Ok((data, context))) => Response {
            id,
            success: true,
            data: Some(data),
            error: None,
            window_context: context,
        },
        Ok(Err(e)) => Response {
            id,
            success: false,
            data: None,
            error: Some(e),
            window_context: None,
        },
        Err(_) => Response {
            id,
            success: false,
            data: None,
            error: Some(format!("Command timed out after {}ms", timeout.as_millis())),
            window_context: None,
        },
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use serde_json::json;

    // Request deserialization tests

    #[test]
    fn request_parses_minimal_fields() {
        let json = r#"{"id": "req_1", "command": "screenshot"}"#;
        let request: Request = serde_json::from_str(json).unwrap();

        assert_eq!(request.id, "req_1");
        assert_eq!(request.command, "screenshot");
        assert_eq!(request.args, json!(null));
    }

    #[test]
    fn request_parses_with_args() {
        let json = r#"{"id": "req_2", "command": "execute_js", "args": {"script": "document.title"}}"#;
        let request: Request = serde_json::from_str(json).unwrap();

        assert_eq!(request.id, "req_2");
        assert_eq!(request.command, "execute_js");
        assert_eq!(request.args["script"], "document.title");
    }

    #[test]
    fn request_parses_with_empty_args() {
        let json = r#"{"id": "req_3", "command": "window_list", "args": {}}"#;
        let request: Request = serde_json::from_str(json).unwrap();

        assert_eq!(request.id, "req_3");
        assert_eq!(request.command, "window_list");
        assert!(request.args.is_object());
    }

    #[test]
    fn request_parses_complex_args() {
        let json = r##"{
            "id": "req_4",
            "command": "interact",
            "args": {
                "action": "click",
                "selector": "#submit-btn",
                "x": 100,
                "y": 200
            }
        }"##;
        let request: Request = serde_json::from_str(json).unwrap();

        assert_eq!(request.command, "interact");
        assert_eq!(request.args["action"], "click");
        assert_eq!(request.args["selector"], "#submit-btn");
        assert_eq!(request.args["x"], 100);
        assert_eq!(request.args["y"], 200);
    }

    #[test]
    fn request_fails_on_missing_id() {
        let json = r#"{"command": "screenshot"}"#;
        let result: Result<Request, _> = serde_json::from_str(json);

        assert!(result.is_err());
    }

    #[test]
    fn request_fails_on_missing_command() {
        let json = r#"{"id": "req_1"}"#;
        let result: Result<Request, _> = serde_json::from_str(json);

        assert!(result.is_err());
    }

    #[test]
    fn request_fails_on_invalid_json() {
        let json = r#"{"id": "req_1", "command": screenshot"}"#;
        let result: Result<Request, _> = serde_json::from_str(json);

        assert!(result.is_err());
    }

    // Response serialization tests

    #[test]
    fn response_serializes_success() {
        let response = Response {
            id: "req_1".to_string(),
            success: true,
            data: Some(json!({"title": "My app"})),
            error: None,
            window_context: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed["id"], "req_1");
        assert_eq!(parsed["success"], true);
        assert_eq!(parsed["data"]["title"], "My app");
        assert!(parsed.get("error").is_none());
        assert!(parsed.get("windowContext").is_none());
    }

    #[test]
    fn response_serializes_error() {
        let response = Response {
            id: "req_2".to_string(),
            success: false,
            data: None,
            error: Some("Element not found: .submit-btn".to_string()),
            window_context: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed["id"], "req_2");
        assert_eq!(parsed["success"], false);
        assert!(parsed.get("data").is_none());
        assert_eq!(parsed["error"], "Element not found: .submit-btn");
    }

    #[test]
    fn response_serializes_with_window_context() {
        let response = Response {
            id: "req_3".to_string(),
            success: true,
            data: Some(json!("screenshot data")),
            error: None,
            window_context: Some(WindowContext {
                window_label: "main".to_string(),
                total_windows: 2,
            }),
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed["windowContext"]["windowLabel"], "main");
        assert_eq!(parsed["windowContext"]["totalWindows"], 2);
    }

    #[test]
    fn response_omits_none_fields() {
        let response = Response {
            id: "req_4".to_string(),
            success: true,
            data: None,
            error: None,
            window_context: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        // Only id and success should be present
        assert!(parsed.get("data").is_none());
        assert!(parsed.get("error").is_none());
        assert!(parsed.get("windowContext").is_none());
    }

    // WindowContext serialization tests

    #[test]
    fn window_context_uses_camel_case() {
        let context = WindowContext {
            window_label: "settings".to_string(),
            total_windows: 3,
        };

        let json = serde_json::to_string(&context).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        // Check camelCase field names
        assert!(parsed.get("windowLabel").is_some());
        assert!(parsed.get("totalWindows").is_some());
        // Snake_case should not exist
        assert!(parsed.get("window_label").is_none());
        assert!(parsed.get("total_windows").is_none());
    }

    // Round-trip tests

    #[test]
    fn request_response_ids_match() {
        let request_json = r#"{"id": "req_abc123", "command": "window_info"}"#;
        let request: Request = serde_json::from_str(request_json).unwrap();

        let response = Response {
            id: request.id,
            success: true,
            data: Some(json!({"width": 800, "height": 600})),
            error: None,
            window_context: None,
        };

        let response_json = serde_json::to_string(&response).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&response_json).unwrap();

        assert_eq!(parsed["id"], "req_abc123");
    }

    #[test]
    fn request_handles_unicode() {
        let json = r#"{
            "id": "req_unicode",
            "command": "execute_js",
            "args": {"script": "console.log('\u4e2d\u6587')"}
        }"#;
        let request: Request = serde_json::from_str(json).unwrap();

        assert_eq!(request.args["script"], "console.log('\u{4e2d}\u{6587}')");
    }

    #[test]
    fn response_handles_large_data() {
        let large_string = "x".repeat(100_000);
        let response = Response {
            id: "req_large".to_string(),
            success: true,
            data: Some(json!(large_string)),
            error: None,
            window_context: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.len() > 100_000);

        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["data"].as_str().unwrap().len(), 100_000);
    }
}
