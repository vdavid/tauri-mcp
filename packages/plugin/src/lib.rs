//! tauri-mcp: MCP server plugin for Tauri v2 app automation
//!
//! This plugin enables AI assistants to inspect, debug, and automate Tauri applications
//! through the Model Context Protocol (MCP).
//!
//! # Quick start
//!
//! ```rust,ignore
//! fn main() {
//!     tauri::Builder::default()
//!         .plugin(tauri_mcp::init())
//!         .run(tauri::generate_context!())
//!         .expect("error while running tauri application");
//! }
//! ```
//!
//! # Custom configuration
//!
//! ```rust,ignore
//! tauri_mcp::Builder::new()
//!     .port(9224)
//!     .host("0.0.0.0")
//!     .build()
//! ```

mod commands;
mod screenshot;
mod websocket;

use tauri::{plugin::TauriPlugin, Manager, RunEvent, Runtime};
use tokio::sync::oneshot;
use tracing::info;

pub use websocket::ShutdownHandle;

/// Default WebSocket server port
pub const DEFAULT_PORT: u16 = 9223;

/// Default WebSocket server host
pub const DEFAULT_HOST: &str = "localhost";

/// Default console log limit (protects against runaway scripts flooding logs)
pub const DEFAULT_CONSOLE_LOG_LIMIT: u32 = 25;

/// Plugin builder for customizing WebSocket server configuration.
///
/// # Example
///
/// ```rust,ignore
/// tauri_mcp::Builder::new()
///     .port(9224)          // Custom port
///     .host("0.0.0.0")     // Allow remote connections
///     .build()
/// ```
#[derive(Debug, Clone)]
pub struct Builder {
    port: u16,
    host: String,
    console_log_limit: u32,
}

impl Default for Builder {
    fn default() -> Self {
        Self::new()
    }
}

impl Builder {
    /// Create a new builder with default settings
    #[must_use]
    pub const fn new() -> Self {
        Self {
            port: DEFAULT_PORT,
            host: String::new(), // Will use DEFAULT_HOST
            console_log_limit: DEFAULT_CONSOLE_LOG_LIMIT,
        }
    }

    /// Set the WebSocket server port
    #[must_use]
    pub const fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    /// Set the WebSocket server bind address
    #[must_use]
    pub fn host(mut self, host: impl Into<String>) -> Self {
        self.host = host.into();
        self
    }

    /// Set the maximum number of console log entries to capture.
    ///
    /// A small default (25) protects against runaway scripts flooding logs.
    /// Increase if you need more debug history.
    #[must_use]
    pub const fn console_log_limit(mut self, limit: u32) -> Self {
        self.console_log_limit = limit;
        self
    }

    /// Build the Tauri plugin
    #[must_use]
    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        let host = if self.host.is_empty() {
            DEFAULT_HOST.to_string()
        } else {
            self.host
        };
        build_plugin(self.port, host, self.console_log_limit)
    }
}

/// Initialize the plugin with default settings (localhost:9223).
///
/// Use [`Builder`] for custom configuration.
#[must_use]
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new().build()
}

fn build_plugin<R: Runtime>(port: u16, host: String, console_log_limit: u32) -> TauriPlugin<R> {
    // Inject config into console capture script
    let console_script = format!(
        "window.__TAURI_MCP_CONFIG__ = {{ maxConsoleEntries: {} }};\n{}",
        console_log_limit,
        include_str!("console_capture.js")
    );

    tauri::plugin::Builder::new("mcp")
        .setup(move |app, _api| {
            let app_handle = app.clone();
            let (ready_tx, ready_rx) = oneshot::channel();
            let host_for_log = host.clone();

            // Create shutdown channel for graceful server termination
            let (shutdown_handle, shutdown_rx) = ShutdownHandle::new();

            // Store shutdown handle in app state for lifecycle management
            app.manage(shutdown_handle);

            // Start WebSocket server in background
            tauri::async_runtime::spawn(async move {
                if let Err(e) = websocket::start_server(app_handle, port, &host, ready_tx, shutdown_rx).await {
                    tracing::error!("WebSocket server error: {e}");
                }
            });

            // Wait for server to be ready (with timeout)
            tauri::async_runtime::spawn(async move {
                match tokio::time::timeout(std::time::Duration::from_secs(5), ready_rx).await {
                    Ok(Ok(())) => info!("tauri-mcp WebSocket server ready on {host_for_log}:{port}"),
                    Ok(Err(_)) => tracing::error!("WebSocket server startup cancelled"),
                    Err(_) => tracing::error!("WebSocket server startup timed out"),
                }
            });

            Ok(())
        })
        .on_event(|app, event| {
            if matches!(event, RunEvent::Exit) {
                // Trigger graceful shutdown when app exits
                if let Some(handle) = app.try_state::<ShutdownHandle>() {
                    info!("Triggering WebSocket server shutdown on app exit");
                    handle.shutdown();
                }
            }
        })
        .js_init_script(console_script)
        .build()
}
