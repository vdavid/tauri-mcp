# tauri-mcp

A Tauri v2 plugin that enables AI assistants to inspect, debug, and automate Tauri applications through the Model Context Protocol (MCP).

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
tauri-mcp = "0.1"
```

## Usage

```rust,ignore
fn main() {
    tauri::Builder::default()
        .plugin(tauri_mcp::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Custom configuration

```rust,ignore
fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_mcp::Builder::new()
                .port(9224)
                .host("0.0.0.0")  // Allow remote connections
                .build()
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Features

The plugin exposes a WebSocket server that accepts commands for:

- **Screenshot**: Capture screenshots of the webview (macOS only for now)
- **JavaScript execution**: Run arbitrary JS in the webview context
- **Console logs**: Capture and retrieve console output
- **DOM snapshot**: Get accessibility or structure tree of the page
- **Window management**: List, inspect, and resize windows
- **UI interaction**: Click, type, and scroll
- **Wait conditions**: Wait for selectors, text, or visibility changes

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `TAURI_MCP_PORT` | `9223` | WebSocket server port |
| `TAURI_MCP_HOST` | `localhost` | WebSocket server host |

## Protocol

The plugin uses a simple JSON-RPC-like protocol over WebSocket. See the [specification](../../spec.md) for details.

## License

MIT OR Apache-2.0
