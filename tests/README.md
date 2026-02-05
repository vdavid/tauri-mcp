# Integration tests

Integration tests for tauri-mcp that run against the test-app.

## Prerequisites

These tests require the test-app to be running. The tests connect via WebSocket to port 9223.

## Running tests

### 1. Start the test-app

```bash
cd packages/test-app
pnpm install
pnpm tauri dev
```

Wait for the app window to appear.

### 2. Run the tests

In a new terminal:

```bash
cd tests
pnpm install
pnpm test
```

## Test behavior

- Tests automatically skip if the test-app isn't running
- Each test file tests a specific tool or feature
- Tests include both happy path and error cases

## Test files

| File | Tool | Description |
|------|------|-------------|
| `setup.ts` | - | Test harness, connection management |
| `screenshot.test.ts` | `tauri_screenshot` | PNG/JPEG capture |
| `execute-js.test.ts` | `tauri_execute_js` | JavaScript execution |
| `console.test.ts` | `tauri_console_logs` | Console log retrieval |
| `window.test.ts` | `window_list`, `window_info`, `window_resize` | Window management |
| `dom.test.ts` | `tauri_dom_snapshot` | DOM/accessibility snapshots |
| `interact.test.ts` | `tauri_interact` | Click, type, scroll |
| `wait-for.test.ts` | `tauri_wait_for` | Wait conditions |
| `multi-window.test.ts` | - | Multi-window scenarios |

## Configuration

Environment variables:

- `TAURI_MCP_HOST` - WebSocket host (default: `localhost`)
- `TAURI_MCP_PORT` - WebSocket port (default: `9223`)

## Notes

- Tests modify the test-app DOM temporarily (cleaned up after each test)
- Window resize tests restore original dimensions
- Timeout tests use short timeouts (1s) for faster execution
