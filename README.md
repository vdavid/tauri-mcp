# tauri-mcp

A Model Context Protocol (MCP) server that enables AI assistants to inspect, debug, and automate Tauri v2 applications. Provides screenshots, DOM inspection, JavaScript execution, and UI interaction capabilities.

## Overview

tauri-mcp consists of two packages:

- **`tauri-mcp`** (Rust): A Tauri v2 plugin that exposes a WebSocket server inside your app
- **`@vdavid/tauri-mcp`** (TypeScript): An MCP server that connects AI assistants to the plugin

```
┌─────────────────────┐    MCP (stdio)    ┌─────────────────────┐
│   AI Assistant      │ ◄───────────────► │   MCP Server (TS)   │
│  (Claude, Cursor)   │                   │  @vdavid/tauri-mcp  │
└─────────────────────┘                   └──────────┬──────────┘
                                                     │
                                          WebSocket (port 9223)
                                                     │
                                          ┌──────────▼──────────┐
                                          │    Tauri App        │
                                          │  tauri-mcp plugin   │
                                          └─────────────────────┘
```

## Quick start

### 1. Add the plugin to your Tauri app

In your app's `Cargo.toml`:

```toml
[dependencies]
tauri-mcp = "0.1"
```

In your `main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_mcp::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2. Install the MCP server

```bash
npm install -g @vdavid/tauri-mcp
```

### 3. Configure your MCP client

Add to your MCP client configuration (for example, Claude Desktop or Cursor):

```json
{
  "mcpServers": {
    "tauri": {
      "command": "tauri-mcp"
    }
  }
}
```

### 4. Start using it

1. Launch your Tauri app (with the plugin enabled)
2. In your AI assistant, use `tauri_session` with action `start` to connect
3. Use the other tools to inspect and interact with your app

## Available tools

| Tool | Description |
|------|-------------|
| `tauri_session` | Start, stop, or check connection to a Tauri app |
| `tauri_screenshot` | Capture webview screenshot (PNG or JPEG). **macOS only.** |
| `tauri_dom_snapshot` | Get DOM tree (accessibility or structure) |
| `tauri_execute_js` | Run JavaScript in the webview |
| `tauri_console_logs` | Get captured console output |
| `tauri_window_list` | List all windows |
| `tauri_window_info` | Get window details (size, position, state) |
| `tauri_window_resize` | Resize a window |
| `tauri_interact` | Click, type, scroll |
| `tauri_wait_for` | Wait for selectors, text, or visibility |

> **Note:** Screenshots are only supported on macOS. Windows and Linux return an error.

## Tool examples

### Connect to your app

```
tauri_session({ action: "start" })
→ "Connected to My App (localhost:9223)"
```

### Take a screenshot

```
tauri_screenshot({ format: "png" })
→ [image data]
```

### Inspect the DOM

```
tauri_dom_snapshot({ type: "accessibility" })
→ YAML format:
  - tag: button
    role: button
    name: Submit
    selector: "#submit-btn"

tauri_dom_snapshot({ type: "structure" })
→ Tree format:
  div.app
  ├─ header
  │  └─ h1
  └─ main#content
     ├─ form
     └─ button.submit-btn
```

### Execute JavaScript

```
tauri_execute_js({ script: "document.title" })
→ "My App"

tauri_execute_js({ script: "await fetch('/api/data').then(r => r.json())" })
→ { ... }
```

### Interact with the UI

```
tauri_interact({ action: "click", selector: "#submit-btn" })
→ "Clicked #submit-btn"

tauri_interact({ action: "type", selector: "input[name=email]", text: "user@example.com" })
→ "Typed into input[name=email]"
```

### Wait for conditions

```
tauri_wait_for({ type: "selector", value: ".loading-complete", timeout: 5000 })
→ "Found element matching '.loading-complete'"
```

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAURI_MCP_HOST` | `localhost` | WebSocket server host |
| `TAURI_MCP_PORT` | `9223` | WebSocket server port |
| `TAURI_MCP_TIMEOUT` | `10000` | Command timeout in milliseconds |

### Plugin configuration (Rust)

```rust
// Default configuration
tauri_mcp::init()

// Custom port and host
tauri_mcp::Builder::new()
    .port(9224)
    .host("0.0.0.0")  // Allow remote connections
    .build()
```

### Security note

By default, the WebSocket server binds to `localhost` only. If you use `.host("0.0.0.0")` to allow remote connections, be aware that **anyone on the network can execute arbitrary JavaScript** in your app. Only bind to 0.0.0.0 on trusted networks or behind a firewall.

## Platform support

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Screenshot | Yes | Stub | Stub |
| JavaScript execution | Yes | Yes | Yes |
| Console logs | Yes | Yes | Yes |
| DOM snapshot | Yes | Yes | Yes |
| Window management | Yes | Yes | Yes |
| UI interaction | Yes | Yes | Yes |

Screenshots on Windows and Linux will return a "not implemented" error. Other features work on all platforms.

## Limitations

### DOM snapshot depth

The DOM snapshot has a maximum depth of 20 levels. Deeper nesting is truncated without warning. This prevents performance issues on deeply nested DOMs.

### No iframe support

The `interact`, `wait_for`, and `dom_snapshot` commands only work on the main document. They cannot access elements inside `<iframe>` elements due to browser security restrictions.

### JavaScript execution requirements

The plugin uses Tauri's event system to return JavaScript execution results. This works automatically in most cases through two mechanisms:

1. **`window.__TAURI__.event`** - Available when `withGlobalTauri: true` in your `tauri.conf.json`
2. **`window.__TAURI_INTERNALS__`** - Always available in Tauri v2 webviews (internal API)

If neither is available, JavaScript execution will time out. If you encounter timeouts, add this to your `tauri.conf.json`:

```json
{
  "app": {
    "withGlobalTauri": true
  }
}
```

This exposes Tauri's JavaScript API globally. It's safe for apps that only run trusted code (most Tauri apps), but avoid it if your app loads untrusted third-party content.

## Architecture

The plugin creates a WebSocket server (default port 9223) that accepts JSON-RPC-like commands. The MCP server translates MCP tool calls into WebSocket commands and returns the results.

Key design decisions:

- **No fallback chains**: If something fails, it fails clearly with an actionable error message
- **Keep-alive**: WebSocket connection uses ping/pong every 30 seconds
- **Single connection**: One WebSocket connection per session, reused for all commands
- **Native screenshots**: Uses `WKWebView.takeSnapshot` on macOS for fast, reliable captures

## Packages

- [`packages/plugin`](./packages/plugin) - Rust Tauri plugin
- [`packages/server`](./packages/server) - TypeScript MCP server
- [`packages/test-app`](./packages/test-app) - Test application for development

## Development

```bash
# Install dependencies
pnpm install

# Build everything
cargo build
pnpm -r build

# Run tests
./scripts/check-all.sh
```

## License

MIT OR Apache-2.0
