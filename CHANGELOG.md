# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-05

### Added

- Initial release of tauri-mcp
- WebSocket-based communication between MCP server and Tauri plugin
- 9 tools for Tauri app automation:
  - `screenshot` - Capture webview as PNG/JPEG (macOS only for now)
  - `execute_js` - Run JavaScript in webview with result retrieval
  - `console_logs` - Capture and filter console output
  - `dom_snapshot` - Get accessibility or structure tree of DOM
  - `interact` - Click, type, scroll on elements
  - `wait_for` - Wait for elements or text to appear
  - `window_list` - List all app windows
  - `window_info` - Get window details (size, position, visibility)
  - `window_resize` - Resize windows
- macOS screenshot support via WKWebView.takeSnapshot
- Stubs for Windows/Linux screenshot (returns "not implemented")
- Test application with Svelte frontend for development and testing
- Integration test suite covering all tools
- Documentation including testing guide for external apps
