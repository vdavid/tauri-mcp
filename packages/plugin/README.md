# tauri-mcp

A Tauri v2 plugin that enables AI assistants to inspect, debug, and automate Tauri applications through the Model Context Protocol (MCP).

This plugin runs a WebSocket server inside your Tauri app that accepts commands for screenshots, JavaScript execution, DOM inspection, and UI interaction.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
tauri-mcp = "0.1"
```

## Usage

Register the plugin in your `main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_mcp::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Custom configuration

```rust
fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_mcp::Builder::new()
                .port(9224)              // Custom port (default: 9223)
                .host("0.0.0.0")         // Allow remote connections (default: localhost)
                .build()
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Security note

By default, the WebSocket server binds to `localhost` only. If you use `.host("0.0.0.0")` to allow remote connections, be aware that **anyone on the network can execute arbitrary JavaScript** in your app. Only bind to 0.0.0.0 on trusted networks or behind a firewall.

## Features

The plugin exposes a WebSocket server that accepts commands for:

| Command | Description |
|---------|-------------|
| `screenshot` | Capture the webview as PNG or JPEG (macOS only) |
| `execute_js` | Run JavaScript in the webview context |
| `console_logs` | Get captured console output with filtering |
| `dom_snapshot` | Get accessibility or structure tree of the DOM |
| `window_list` | List all windows with labels and titles |
| `window_info` | Get window size, position, and state |
| `window_resize` | Resize a window to specific dimensions |
| `interact` | Click, type, or scroll in the webview |
| `wait_for` | Wait for selectors, text, or visibility changes |

## WebSocket protocol

Commands use a JSON-RPC-like format over WebSocket.

### Request

```json
{
  "id": "req_123",
  "command": "screenshot",
  "args": { "format": "png" }
}
```

### Response

```json
{
  "id": "req_123",
  "success": true,
  "data": "data:image/png;base64,...",
  "windowContext": {
    "windowLabel": "main",
    "totalWindows": 1
  }
}
```

### Error response

```json
{
  "id": "req_123",
  "success": false,
  "error": "Window 'settings' not found. Available: main, about"
}
```

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `TAURI_MCP_PORT` | `9223` | WebSocket server port |
| `TAURI_MCP_HOST` | `localhost` | WebSocket server bind address |

## Platform support

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Screenshot | Yes | Stub | Stub |
| All other commands | Yes | Yes | Yes |

Screenshot capture uses `WKWebView.takeSnapshot` on macOS. Windows and Linux support will be added in a future release.

## Using with the MCP server

This plugin is designed to work with the `@vdavid/tauri-mcp` MCP server, which translates MCP tool calls into WebSocket commands. See the [main project README](../../README.md) for setup instructions.

## License

MIT OR Apache-2.0
