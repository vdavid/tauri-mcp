# Testing tauri-mcp with Cmdr

This guide walks you through manually testing tauri-mcp against Cmdr, a real-world Tauri file manager with a complex two-pane UI.

## Prerequisites

- Cmdr source code at `../cmdr` (relative to this repo)
- Rust toolchain with Tauri v2 support
- Node.js and pnpm
- An MCP-capable AI assistant (Claude Desktop, Cursor, or similar)

## Step 1: Add tauri-mcp to Cmdr

### Update Cargo.toml

In `../cmdr/apps/desktop/src-tauri/Cargo.toml`, add the dependency:

```toml
[dependencies]
# ... existing dependencies ...
tauri-mcp = { path = "../../../../tauri-mcp/packages/plugin" }
```

### Update main.rs

In `../cmdr/apps/desktop/src-tauri/src/main.rs`, register the plugin:

```rust
fn main() {
    tauri::Builder::default()
        // ... existing plugins ...
        .plugin(tauri_mcp::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Build and run Cmdr

```bash
cd ../cmdr
pnpm install
pnpm dev
```

The WebSocket server should start on port 9223. Check the Rust logs for:

```
tauri-mcp WebSocket server listening on localhost:9223
```

## Step 2: Configure your MCP client

Add tauri-mcp to your MCP client configuration.

For Claude Desktop (`~/.config/claude/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "tauri": {
      "command": "node",
      "args": ["/path/to/tauri-mcp/packages/server/dist/index.js"]
    }
  }
}
```

Or if you've installed globally:

```json
{
  "mcpServers": {
    "tauri": {
      "command": "tauri-mcp"
    }
  }
}
```

## Step 3: Connect and verify

Start a session:

```
tauri_session({ action: "start" })
```

Expected response:
```
Connected to Cmdr (localhost:9223)
```

Check connection status:

```
tauri_session({ action: "status" })
```

Expected response:
```json
{
  "connected": true,
  "app": "Cmdr",
  "host": "localhost",
  "port": 9223
}
```

## Test cases

### Screenshot (Milestone 14 validation)

**Goal**: Verify screenshot works on Cmdr's complex UI with two panes, icons, and overlays.

```
tauri_screenshot({ format: "png" })
```

**What to verify**:
- Image captures both file panes
- Icons and file names are visible
- The title bar and function key bar appear
- No rendering artifacts or blank areas

**Test variations**:
- Resize window first, then screenshot
- Open a dialog (Cmd+Shift+P for command palette), then screenshot
- Switch to different directories with many files

### DOM snapshot (Milestone 14 validation)

**Goal**: Verify DOM snapshot captures Cmdr's two-pane layout correctly.

#### Accessibility snapshot

```
tauri_dom_snapshot({ type: "accessibility" })
```

**What to verify**:
- Output shows both panes with their file lists
- Interactive elements (buttons, inputs) have proper roles
- The command palette (if open) appears in the tree
- File list items are captured with meaningful names

#### Structure snapshot

```
tauri_dom_snapshot({ type: "structure" })
```

**What to verify**:
- Output shows the dual-pane layout structure
- CSS classes and IDs are present for major components
- The DOM tree is well-organized (not too deep, not too flat)

#### Scoped snapshot

```
tauri_dom_snapshot({ type: "structure", selector: ".file-pane" })
```

**What to verify**:
- Only the file pane subtree is returned
- Output is smaller than the full page snapshot

### Interact (Milestone 14 validation)

**Goal**: Verify interact can click Cmdr's file list items.

#### Click a file

First, get the DOM structure to find a clickable element:

```
tauri_dom_snapshot({ type: "structure" })
```

Then click on a file item. Cmdr uses virtual scrolling, so you'll need to find visible elements:

```
tauri_interact({ action: "click", selector: ".file-row" })
```

**What to verify**:
- The file gets selected (highlighted)
- Cursor position changes in the pane

#### Navigate into a folder

Double-click to open a folder:

```
tauri_interact({ action: "double_click", selector: ".file-row.is-directory" })
```

Or use coordinates:

```
tauri_interact({ action: "double_click", x: 200, y: 150 })
```

**What to verify**:
- Directory navigation occurs
- Path in breadcrumb updates

#### Type in search/filter

If Cmdr has a search or filter input:

```
tauri_interact({ action: "type", selector: "input", text: "test" })
```

#### Scroll the file list

```
tauri_interact({ action: "scroll", scrollY: 500 })
```

**What to verify**:
- File list scrolls down
- Virtual scrolling loads new items

### Window management

#### List windows

```
tauri_window_list({})
```

Expected: At least one window with label "main" and title "Cmdr".

#### Get window info

```
tauri_window_info({})
```

**What to verify**:
- Correct dimensions reported
- Position values are reasonable
- State flags (focused, visible) are accurate

#### Resize window

```
tauri_window_resize({ width: 1200, height: 800 })
```

**What to verify**:
- Window resizes to the specified dimensions
- Content reflows properly

### JavaScript execution

#### Get document title

```
tauri_execute_js({ script: "document.title" })
```

Expected: "Cmdr" (or the window title based on license status).

#### Query DOM

```
tauri_execute_js({ script: "document.querySelectorAll('.file-row').length" })
```

**What to verify**:
- Returns a number representing visible file rows
- Result matches what you see in the UI

#### Check state

```
tauri_execute_js({ script: "JSON.stringify({ path: location.pathname, ready: document.readyState })" })
```

### Console logs

```
tauri_console_logs({})
```

**What to verify**:
- Shows any console output from Cmdr
- Timestamps are present
- Log levels are captured (log, warn, error)

#### Filter logs

```
tauri_console_logs({ filter: "error" })
```

**What to verify**:
- Only error messages appear

### Wait for conditions

#### Wait for selector

```
tauri_wait_for({ type: "selector", value: ".file-pane", timeout: 5000 })
```

**What to verify**:
- Returns immediately since element exists
- Message confirms element was found

#### Wait for text

```
tauri_wait_for({ type: "text", value: "Documents", timeout: 5000 })
```

**What to verify**:
- Returns if "Documents" appears in the UI
- Times out if text isn't present

## Troubleshooting

### Connection refused

Check that:
1. Cmdr is running with the plugin enabled
2. No firewall is blocking port 9223
3. No other app is using port 9223

### Screenshot is blank or partial

This can happen if:
1. The window is minimized
2. The webview hasn't finished rendering
3. Try adding a small delay or using `wait_for` first

### Element not found

Cmdr uses virtual scrolling, so not all items are in the DOM. Scroll to make items visible first, or use coordinates.

### Timeout errors

Increase the timeout:

```
tauri_wait_for({ type: "selector", value: ".loading", timeout: 10000 })
```

Or check if the condition can ever be true.

## Cleanup

When you're done testing, disconnect:

```
tauri_session({ action: "stop" })
```

And remove the plugin from Cmdr's Cargo.toml if you don't want it permanently.
