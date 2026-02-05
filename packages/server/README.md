# @vdavid/tauri-mcp

MCP server for Tauri v2 app automation. Enables AI assistants to inspect, debug, and automate Tauri applications.

## Installation

```bash
npm install -g @vdavid/tauri-mcp
```

## Usage

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "tauri": {
      "command": "tauri-mcp"
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `tauri_session` | Start/stop/status connection to Tauri app |
| `tauri_screenshot` | Capture webview screenshot |
| `tauri_dom_snapshot` | Get DOM tree (accessibility or structure) |
| `tauri_execute_js` | Run JavaScript in webview |
| `tauri_console_logs` | Get console output |
| `tauri_window_list` | List all windows |
| `tauri_window_info` | Get window details |
| `tauri_window_resize` | Resize a window |
| `tauri_interact` | Click, type, scroll |
| `tauri_wait_for` | Wait for conditions |

## Requirements

Your Tauri app must have the `tauri-mcp` plugin installed and running. See the main project README for setup instructions.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAURI_MCP_HOST` | `localhost` | WebSocket host |
| `TAURI_MCP_PORT` | `9223` | WebSocket port |
| `TAURI_MCP_TIMEOUT` | `10000` | Command timeout (ms) |

## License

MIT OR Apache-2.0
