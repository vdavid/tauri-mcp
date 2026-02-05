# @vdavid/tauri-mcp

MCP server for Tauri v2 app automation. Enables AI assistants to inspect, debug, and automate Tauri applications.

## Installation

```bash
npm install -g @vdavid/tauri-mcp
```

## Usage

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

## Requirements

Your Tauri app must have the `tauri-mcp` plugin installed and running. See the [main project README](../../README.md) for setup instructions.

## Tools

### Session management

#### `tauri_session`

Start, stop, or check connection status.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `action` | `"start" \| "stop" \| "status"` | required | Action to perform |
| `host` | `string` | `"localhost"` | WebSocket host |
| `port` | `number` | `9223` | WebSocket port |

```
tauri_session({ action: "start" })
→ "Connected to My App (localhost:9223)"

tauri_session({ action: "status" })
→ { "connected": true, "app": "My App", "host": "localhost", "port": 9223 }

tauri_session({ action: "stop" })
→ "Disconnected"
```

### Screenshots and inspection

#### `tauri_screenshot`

Capture a screenshot of the webview.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | `"png" \| "jpeg"` | `"png"` | Image format |
| `quality` | `number` | `80` | JPEG quality (0-100) |
| `windowId` | `string` | focused | Target window label |

```
tauri_screenshot({ format: "png" })
→ [base64 image data]
```

#### `tauri_dom_snapshot`

Get a structured snapshot of the DOM.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `"accessibility" \| "structure"` | required | Snapshot type |
| `selector` | `string` | whole page | CSS selector to scope the snapshot |
| `windowId` | `string` | focused | Target window label |

- **accessibility**: Roles, names, states, aria attributes. Good for understanding UI semantics.
- **structure**: Tag names, IDs, classes, data-testid. Good for writing selectors.

```
tauri_dom_snapshot({ type: "accessibility" })
→ "- document: My App\n  - main:\n    - button: Submit\n    ..."

tauri_dom_snapshot({ type: "structure", selector: "#main" })
→ "- div#main.container:\n  - form:\n    - input[name=email]:\n    ..."
```

### JavaScript execution

#### `tauri_execute_js`

Execute JavaScript in the webview context.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `script` | `string` | required | JavaScript code |
| `windowId` | `string` | focused | Target window label |

Return values must be JSON-serializable. Default timeout is 5 seconds.

```
tauri_execute_js({ script: "document.title" })
→ "My App"

tauri_execute_js({ script: "await fetch('/api/data').then(r => r.json())" })
→ { "items": [...] }
```

#### `tauri_console_logs`

Get captured console logs.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `filter` | `string` | none | Regex to filter messages |
| `since` | `string` | none | ISO timestamp to filter by time |
| `clear` | `boolean` | `false` | Clear logs after reading |
| `windowId` | `string` | focused | Target window label |

```
tauri_console_logs({})
→ "[2024-01-15T10:30:00Z] [log] Page loaded\n[2024-01-15T10:30:01Z] [error] API error: 404"

tauri_console_logs({ filter: "error", clear: true })
→ "[2024-01-15T10:30:01Z] [error] API error: 404"
```

### Window management

#### `tauri_window_list`

List all windows in the application.

```
tauri_window_list({})
→ [{ "label": "main", "title": "My App", "focused": true, "visible": true }]
```

#### `tauri_window_info`

Get detailed information about a window.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `windowId` | `string` | focused | Target window label |

```
tauri_window_info({ windowId: "main" })
→ {
    "label": "main",
    "title": "My App",
    "width": 1200,
    "height": 800,
    "x": 100,
    "y": 100,
    "focused": true,
    "visible": true,
    "minimized": false,
    "maximized": false,
    "fullscreen": false
  }
```

#### `tauri_window_resize`

Resize a window.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `width` | `number` | required | Width in pixels |
| `height` | `number` | required | Height in pixels |
| `windowId` | `string` | focused | Target window label |

```
tauri_window_resize({ width: 1024, height: 768 })
→ "Resized to 1024x768"
```

### UI interaction

#### `tauri_interact`

Perform UI interactions.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `action` | `"click" \| "double_click" \| "type" \| "scroll"` | required | Interaction type |
| `selector` | `string` | none | CSS selector for target |
| `x` | `number` | none | X coordinate (alternative to selector) |
| `y` | `number` | none | Y coordinate (alternative to selector) |
| `text` | `string` | none | Text to type (for `type` action) |
| `scrollX` | `number` | none | Horizontal scroll amount |
| `scrollY` | `number` | none | Vertical scroll amount |
| `windowId` | `string` | focused | Target window label |

```
tauri_interact({ action: "click", selector: "#submit-btn" })
→ "Clicked #submit-btn"

tauri_interact({ action: "type", selector: "input[name=email]", text: "user@example.com" })
→ "Typed into input[name=email]"

tauri_interact({ action: "scroll", scrollY: 500 })
→ "Scrolled by (0, 500)"
```

#### `tauri_wait_for`

Wait for a condition.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `"selector" \| "text" \| "visible" \| "hidden"` | required | Condition type |
| `value` | `string` | required | Selector or text to wait for |
| `timeout` | `number` | `5000` | Timeout in milliseconds |
| `windowId` | `string` | focused | Target window label |

```
tauri_wait_for({ type: "selector", value: ".loading-complete" })
→ "Found element matching '.loading-complete'"

tauri_wait_for({ type: "text", value: "Success!", timeout: 10000 })
→ "Found text 'Success!'"

tauri_wait_for({ type: "hidden", value: ".spinner" })
→ "Element '.spinner' is hidden"
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAURI_MCP_HOST` | `localhost` | WebSocket host |
| `TAURI_MCP_PORT` | `9223` | WebSocket port |
| `TAURI_MCP_TIMEOUT` | `10000` | Command timeout in milliseconds |

## License

MIT OR Apache-2.0
