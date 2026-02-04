# tauri-mcp implementation tasks

See [spec.md](spec.md) for full details.

## Milestone 1: Project setup

- [ ] Initialize monorepo structure with `packages/plugin`, `packages/server`, `packages/test-app`
- [ ] Set up Rust workspace for plugin (`Cargo.toml` with proper metadata)
- [ ] Set up TypeScript project for server (`package.json`, `tsconfig.json`, ESLint, Prettier)
- [ ] Create LICENSE-MIT and LICENSE-APACHE files
- [ ] Create root README.md with project overview and quick start
- [ ] Clone mcp-server-tauri to `related-repos/mcp-server-tauri` for reference
- [ ] Verify `cargo build` works for plugin (empty lib.rs)
- [ ] Verify `pnpm build` works for server (empty index.ts)

## Milestone 2: Rust plugin core

- [ ] Implement WebSocket server with tokio-tungstenite (`websocket.rs`)
- [ ] Add connection keep-alive (ping every 30s)
- [ ] Implement request/response protocol (JSON-RPC-like)
- [ ] Add plugin initialization (`lib.rs` with `init()` and `Builder`)
- [ ] Implement `js_init_script` for console capture injection
- [ ] Add window resolution helper (find window by label or use default)
- [ ] Write unit tests for protocol parsing
- [ ] Test WebSocket server starts and accepts connections

## Milestone 3: Screenshot (macOS)

- [ ] Implement `screenshot/macos.rs` using WKWebView.takeSnapshot
- [ ] Add `screenshot/mod.rs` with platform dispatch
- [ ] Add stubs for `screenshot/windows.rs` and `screenshot/linux.rs` (return "not implemented")
- [ ] Wire screenshot command to WebSocket handler
- [ ] Test screenshot returns valid PNG data
- [ ] Test screenshot with JPEG format and quality parameter
- [ ] Test error case: window minimized or not visible

## Milestone 4: JavaScript execution

- [ ] Implement `execute_js` command using window.eval()
- [ ] Add timeout handling (5s default, configurable)
- [ ] Handle async scripts (detect and await promises)
- [ ] Return JSON-serialized results
- [ ] Test simple expression: `document.title`
- [ ] Test async script: `await fetch(...)`
- [ ] Test error case: syntax error in script
- [ ] Test error case: script timeout

## Milestone 5: Console log capture

- [ ] Implement console capture script (inject via js_init_script)
- [ ] Store logs in memory (last 1000 entries)
- [ ] Implement `console_logs` command with filter/since/clear options
- [ ] Test logs are captured for all levels (log, warn, error, debug, info)
- [ ] Test filter by regex
- [ ] Test clear functionality

## Milestone 6: Window management

- [ ] Implement `window_list` command
- [ ] Implement `window_info` command (size, position, title, focused, visible)
- [ ] Implement `window_resize` command
- [ ] Test with single window app
- [ ] Test with multi-window app
- [ ] Test error case: window not found

## Milestone 7: DOM snapshot

- [ ] Implement `dom-snapshot.js` script for accessibility tree
- [ ] Implement `dom-snapshot.js` script for structure tree
- [ ] Wire to `dom_snapshot` command
- [ ] Test accessibility snapshot on test-app
- [ ] Test structure snapshot on test-app
- [ ] Test with selector scoping

## Milestone 8: UI interaction

- [ ] Implement `interact.js` script (click, double_click, type, scroll)
- [ ] Wire to `interact` command
- [ ] Test click by selector
- [ ] Test click by coordinates
- [ ] Test type into input
- [ ] Test scroll
- [ ] Test error case: element not found

## Milestone 9: Wait functionality

- [ ] Implement `wait-for.js` script
- [ ] Wire to `wait_for` command with timeout
- [ ] Test wait for selector to appear
- [ ] Test wait for text content
- [ ] Test wait for element to be visible/hidden
- [ ] Test timeout error

## Milestone 10: TypeScript MCP server

- [ ] Implement MCP server entry point with @modelcontextprotocol/sdk
- [ ] Define all 9 tools with Zod schemas
- [ ] Implement WebSocket client with connection pooling
- [ ] Implement session management (start/stop/status)
- [ ] Wire each tool to corresponding WebSocket command
- [ ] Test MCP protocol: tools/list returns all 9 tools
- [ ] Test MCP protocol: tools/call works for each tool

## Milestone 11: Test app

- [ ] Create minimal Tauri app with Svelte frontend
- [ ] Implement todo list UI (input, list, checkboxes, delete)
- [ ] Add second window (settings or about)
- [ ] Add some async operations (simulated API calls)
- [ ] Verify test-app builds and runs
- [ ] Verify plugin loads in test-app

## Milestone 12: Integration tests

- [ ] Set up Vitest for integration tests
- [ ] Write test harness that launches test-app and connects
- [ ] Write integration test for each tool (happy path)
- [ ] Write integration tests for error cases
- [ ] Write integration tests for multi-window scenarios
- [ ] All integration tests pass

## Milestone 13: Documentation & polish

- [ ] Write packages/plugin/README.md with installation and usage
- [ ] Write packages/server/README.md with installation and usage
- [ ] Add JSDoc comments to public TypeScript APIs
- [ ] Add rustdoc comments to public Rust APIs
- [ ] Update root README.md with complete documentation
- [ ] Run clippy and fix all warnings
- [ ] Run ESLint/Prettier and fix all issues
- [ ] Review error messages for clarity and actionability

## Milestone 14: External validation

- [ ] Test against Cmdr (../cmdr) manually
- [ ] Verify screenshot works on Cmdr's complex UI
- [ ] Verify DOM snapshot captures Cmdr's two-pane layout
- [ ] Verify interact can click Cmdr's file list items
- [ ] Fix any issues discovered
- [ ] Final review: maintainability, UX, performance (see spec.md goals)

## Milestone 15: Release preparation

- [ ] Ensure all tests pass
- [ ] Version packages (0.1.0)
- [ ] Prepare npm publish configuration
- [ ] Prepare crates.io publish configuration
- [ ] Write CHANGELOG.md
- [ ] Tag release in git
