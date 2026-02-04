# tauri-mcp: A fast, reliable MCP server for Tauri app automation

## Overview

`tauri-mcp` is a Model Context Protocol (MCP) server that enables AI assistants to inspect, debug, and automate Tauri v2 applications. It provides screenshots, DOM inspection, JavaScript execution, and UI interaction capabilities.


This is a simpler and better alternative of [mcp-server-tauri](https://github.com/hypothesi/mcp-server-tauri), focusing on reliability, performance, and a tight feature set. The linked one suffers from flaky WebSocket connections, screenshot timeouts, and overly complex fallback chains. This implementation prioritizes correctness over feature breadth.

It's cloned to this repo for a reference implementation. Make sure not to copy its structure or code! But feel free to get inspired from it if you'd like.

## Goals

1. **Reliability first**: No silent failures, no mysterious timeouts. Clear error messages that explain what went wrong.
2. **Blazing fast**: WebSocket with connection pooling and keep-alive. Minimal round trips.
3. **Tight scope**: 9 tools that do their job well. No bloat.
4. **Testable**: Comprehensive test suite against a real Tauri app, not just unit tests.

## Non-goals

- Multi-app support (connecting to multiple Tauri apps simultaneously)
- Mobile device listing
- IPC monitoring
- Cross-platform screenshots in v1.0 (macOS only, stubs for others)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Assistant                            │
│               (Claude Code, Cursor, etc.)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol (stdio)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 MCP Server (TypeScript)                     │
│                   @vdavid/tauri-mcp                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Tools: screenshot, execute_js, console_logs,       │    │
│  │         dom_snapshot, window_list, window_info,     │    │
│  │         window_resize, interact, wait_for           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ WebSocket (port 9223, keep-alive)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tauri Application                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           tauri-mcp plugin (Rust)                   │    │
│  │  - WebSocket server with connection pooling         │    │
│  │  - Native screenshot (WKWebView on macOS)           │    │
│  │  - JS execution via window.eval()                   │    │
│  │  - Window management via Tauri APIs                 │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 Webview (DOM/UI)                    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Package structure

```
tauri-mcp/
├── packages/
│   ├── plugin/                     # Rust Tauri plugin (tauri-mcp on crates.io)
│   │   ├── src/
│   │   │   ├── lib.rs              # Plugin entry point
│   │   │   ├── websocket.rs        # WebSocket server with keep-alive
│   │   │   ├── commands/           # Tauri command handlers
│   │   │   │   ├── mod.rs
│   │   │   │   ├── screenshot.rs   # Native screenshot capture
│   │   │   │   ├── execute_js.rs   # JavaScript execution
│   │   │   │   └── window.rs       # Window info/resize
│   │   │   └── screenshot/         # Platform-specific screenshot code
│   │   │       ├── mod.rs
│   │   │       ├── macos.rs        # WKWebView.takeSnapshot
│   │   │       ├── windows.rs      # Stub: "not implemented"
│   │   │       └── linux.rs        # Stub: "not implemented"
│   │   ├── Cargo.toml
│   │   └── README.md
│   │
│   ├── server/                     # TypeScript MCP server (@vdavid/tauri-mcp)
│   │   ├── src/
│   │   │   ├── index.ts            # MCP server entry point
│   │   │   ├── tools.ts            # Tool definitions (9 tools)
│   │   │   ├── client.ts           # WebSocket client with connection pooling
│   │   │   ├── session.ts          # Session management
│   │   │   └── scripts/            # Injected JS for DOM operations
│   │   │       ├── console-capture.js
│   │   │       ├── dom-snapshot.js
│   │   │       ├── interact.js
│   │   │       └── wait-for.js
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── test-app/                   # Minimal Tauri todo app for testing
│       ├── src/                    # Svelte frontend
│       ├── src-tauri/              # Rust backend
│       └── package.json
│
├── tests/
│   ├── unit/                       # Unit tests (no Tauri app needed)
│   ├── integration/                # Tests against test-app
│   └── fixtures/                   # Test data
│
├── related-repos/
│   └── mcp-server-tauri/           # Reference implementation (git clone)
│
├── spec.md                         # This file
├── tasks.md                        # Task list for implementation
├── LICENSE-MIT
├── LICENSE-APACHE
└── README.md
```

## Tools (9 total)

### Session management

#### `tauri_session`
Start, stop, or check status of the connection to a Tauri app.

```typescript
// Start session
{ action: "start", port?: number, host?: string }
// Response: "Connected to MyApp (localhost:9223)"

// Check status
{ action: "status" }
// Response: { connected: true, app: "MyApp", host: "localhost", port: 9223 }

// Stop session
{ action: "stop" }
// Response: "Disconnected"
```

### Screenshots & inspection

#### `tauri_screenshot`
Capture a screenshot of the webview using native platform APIs.

```typescript
{
  format?: "png" | "jpeg",  // Default: "png"
  quality?: number,         // 0-100, for jpeg only
  windowId?: string         // Target specific window
}
// Response: Image content (base64)
```

**Implementation notes**:
- macOS: Use `WKWebView.takeSnapshot` (native, fast, reliable)
- Windows/Linux: Return error "Screenshot not implemented on this platform yet"
- No fallback chain. If native fails, fail clearly.

#### `tauri_dom_snapshot`
Get a structured snapshot of the DOM for AI consumption.

```typescript
{
  type: "accessibility" | "structure",
  selector?: string,        // Scope to subtree
  windowId?: string
}
// Response: YAML representation of DOM/a11y tree
```

**Types**:
- `accessibility`: Roles, names, states, aria attributes. Good for understanding UI semantics.
- `structure`: Tag names, IDs, classes, data-testid. Good for writing selectors.

### JavaScript execution

#### `tauri_execute_js`
Execute JavaScript in the webview context.

```typescript
{
  script: string,           // JS code to execute
  windowId?: string
}
// Response: JSON-serialized result or error
```

**Implementation notes**:
- Use `window.eval()` directly, no complex wrapping
- 5 second timeout, configurable via env var
- Return value must be JSON-serializable

#### `tauri_console_logs`
Get captured console logs from the webview.

```typescript
{
  filter?: string,          // Regex to filter messages
  since?: string,           // ISO timestamp
  clear?: boolean,          // Clear logs after reading
  windowId?: string
}
// Response: Formatted log entries
```

**Implementation notes**:
- Console capture is initialized via `js_init_script` when plugin loads
- Stores last 1000 entries in memory (configurable)
- Includes timestamp, level, and message

### Window management

#### `tauri_window_list`
List all windows in the application.

```typescript
{}
// Response: [{ label: "main", title: "My App", focused: true }, ...]
```

#### `tauri_window_info`
Get detailed information about a window.

```typescript
{
  windowId?: string         // Default: focused window
}
// Response: { label, title, width, height, x, y, focused, visible, ... }
```

#### `tauri_window_resize`
Resize a window.

```typescript
{
  width: number,
  height: number,
  windowId?: string
}
// Response: "Resized to 1200x800"
```

### UI interaction

#### `tauri_interact`
Perform UI interactions (click, type, scroll).

```typescript
{
  action: "click" | "double_click" | "type" | "scroll",
  selector?: string,        // CSS selector
  x?: number, y?: number,   // Or coordinates
  text?: string,            // For type action
  scrollX?: number,         // For scroll action
  scrollY?: number,
  windowId?: string
}
// Response: "Clicked button#submit" or error
```

#### `tauri_wait_for`
Wait for a condition to be true.

```typescript
{
  type: "selector" | "text" | "visible" | "hidden",
  value: string,            // Selector or text to wait for
  timeout?: number,         // Default: 5000ms
  windowId?: string
}
// Response: "Found element matching '.loading'" or timeout error
```

## WebSocket protocol

Communication between MCP server and Tauri plugin uses a simple JSON-RPC-like protocol over WebSocket.

### Request format
```json
{
  "id": "req_abc123",
  "command": "screenshot",
  "args": { "format": "png" }
}
```

### Response format
```json
{
  "id": "req_abc123",
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
  "id": "req_abc123",
  "success": false,
  "error": "Window 'settings' not found. Available: main, about"
}
```

### Connection management

- **Keep-alive**: Ping every 30 seconds to detect dead connections
- **Reconnection**: On disconnect, wait 1s then retry up to 3 times
- **Timeout**: Commands timeout after 10 seconds (configurable)
- **Single connection**: One WebSocket connection per session, reused for all commands

## Testing strategy

### Level 1: Unit tests
Pure functions, no Tauri app needed.
- Script preparation (adding `return` statements)
- Response parsing
- Error formatting

### Level 2: Integration tests
Against the test-app (todo list).
- Each tool has at least one happy-path test
- Error cases (element not found, timeout, etc.)
- Multi-window scenarios

### Level 3: External tests (manual)
Against Cmdr (located at `../cmdr` relative to this repo).
- Complex real-world UI
- Performance testing
- Regression testing

### Test app requirements
A simple todo list app with:
- Text input for adding todos
- List of todos with checkboxes
- Delete buttons
- A second window (settings or about)
- Some async operations (for testing waits)

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAURI_MCP_PORT` | `9223` | WebSocket server port |
| `TAURI_MCP_HOST` | `localhost` | WebSocket server host |
| `TAURI_MCP_TIMEOUT` | `10000` | Command timeout in ms |
| `TAURI_MCP_LOG_LEVEL` | `info` | Logging level |

### Plugin configuration (Rust)

```rust
// Default: bind to localhost only
tauri_mcp::init()

// Custom configuration
tauri_mcp::Builder::new()
    .port(9224)
    .bind_address("0.0.0.0")  // For remote access
    .build()
```

## Error handling principles

1. **No silent failures**: Every error produces a clear message
2. **Context in errors**: "Element not found: .submit-btn" not just "Element not found"
3. **Actionable errors**: "Window 'foo' not found. Available: main, settings"
4. **No fallback chains**: If the primary method fails, fail clearly. Don't try 3 different screenshot methods and report a confusing combined error.
5. **Timeouts are errors**: "Timeout after 5000ms waiting for .loading to disappear"

## Performance targets

- Screenshot capture: < 200ms
- JS execution: < 50ms (excluding script runtime)
- DOM snapshot: < 100ms for typical page
- WebSocket round-trip: < 5ms

## Dependencies

### Rust plugin
- `tauri` 2.x
- `tokio` (async runtime)
- `tokio-tungstenite` (WebSocket)
- `serde` / `serde_json`
- `objc2` + `objc2-webkit` (macOS screenshot)

### TypeScript server
- `@modelcontextprotocol/sdk`
- `ws` (WebSocket client)
- `zod` (schema validation)

## License

MIT OR Apache-2.0 (dual license, user's choice)

## References

- [mcp-server-tauri source](./related-repos/mcp-server-tauri/) - Reference implementation
- [MCP specification](https://modelcontextprotocol.io/specification)
- [Tauri v2 docs](https://v2.tauri.app)
- [Cmdr](../cmdr/) - Real-world test fixture

## Open questions

None currently. All decisions made in planning phase.
