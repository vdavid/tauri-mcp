//! WebSocket server for MCP communication

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, RwLock};
use tokio::time::interval;
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, error, info};

use crate::commands;

/// Request from MCP server to plugin
#[derive(Debug, Deserialize)]
pub struct Request {
    pub id: String,
    pub command: String,
    #[serde(default)]
    pub args: serde_json::Value,
}

/// Response from plugin to MCP server
#[derive(Debug, Serialize)]
pub struct Response {
    pub id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "windowContext")]
    pub window_context: Option<WindowContext>,
}

/// Context about the window that handled the request
#[derive(Debug, Serialize)]
pub struct WindowContext {
    #[serde(rename = "windowLabel")]
    pub window_label: String,
    #[serde(rename = "totalWindows")]
    pub total_windows: usize,
}

/// Server state shared across connections
pub struct ServerState<R: Runtime> {
    pub app: AppHandle<R>,
}

const PING_INTERVAL: Duration = Duration::from_secs(30);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(10);

/// Start the WebSocket server
pub async fn start_server<R: Runtime>(
    app: AppHandle<R>,
    port: u16,
    host: &str,
    ready_tx: oneshot::Sender<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let addr = format!("{host}:{port}");
    let listener = TcpListener::bind(&addr).await?;
    info!("WebSocket server listening on {addr}");

    let state = Arc::new(ServerState { app });

    // Signal that we're ready
    let _ = ready_tx.send(());

    loop {
        match listener.accept().await {
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
    let result = tokio::time::timeout(COMMAND_TIMEOUT, commands::execute(&state.app, request)).await;

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
            error: Some(format!("Command timed out after {}s", COMMAND_TIMEOUT.as_secs())),
            window_context: None,
        },
    }
}
