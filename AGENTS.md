# tauri-mcp

MCP server plugin for Tauri v2 app automation. Enables AI assistants to inspect, debug, and automate Tauri applications.

## Project status

**Milestones 1-14 complete** (pending manual verification). The full implementation is in place: Rust plugin, TypeScript MCP server, test app, integration tests, documentation, and external validation guide.

### What's implemented

- **Rust plugin** (`packages/plugin/`)
  - WebSocket server with keep-alive (`src/websocket.rs`)
  - Command dispatch for all 9 tools (`src/commands/`)
  - Screenshot: macOS uses `WKWebView.takeSnapshot` via objc2, Windows/Linux return "not implemented"
  - JS execution with result retrieval via Tauri events, 5s default timeout
  - Console capture via injection script
  - DOM snapshot, interact, wait-for with JS scripts
  - Window management using Tauri APIs

- **TypeScript MCP server** (`packages/server/`)
  - MCP server entry point with @modelcontextprotocol/sdk
  - All 9 tools defined with Zod schemas
  - WebSocket client with connection pooling
  - Session management (start/stop/status)

- **Test app** (`packages/test-app/`)
  - Minimal Tauri app with Svelte frontend
  - Todo list UI for testing interactions
  - Settings window for multi-window testing

- **Integration tests** (`tests/integration/`)
  - Test harness that connects to test-app
  - Coverage for all tools

- **Documentation**
  - Package READMEs with installation and usage
  - Root README with quick start guide
  - Testing guide for Cmdr validation (`docs/testing-guide.md`)

### What needs work (Milestone 15)

See [tasks.md](tasks.md) for the full list:
- Version packages (0.1.0)
- Prepare npm/crates.io publish configuration
- Write CHANGELOG.md
- Tag release in git

### Manual verification pending

The testing guide at `docs/testing-guide.md` documents how to manually verify tauri-mcp against Cmdr. Key items to verify:
- Screenshot works on Cmdr's complex two-pane UI
- DOM snapshot captures the dual-pane layout
- Interact can click file list items

## Before you code

1. **Read [docs/style-guide.md](docs/style-guide.md)** - especially "Sentence case" and TypeScript rules
2. **Read [spec.md](spec.md)** - full technical specification
3. **Check latest dependency versions** - don't rely on training data

## Quality checks

**Run before every commit:**
```bash
./scripts/check-all.sh
```

This runs: rustfmt, clippy, cargo test, cargo-audit, cargo-deny, cargo-udeps, jscpd (if installed)

All checks must pass before committing.

## Key files

| File | Purpose |
|------|---------|
| `packages/plugin/src/lib.rs` | Plugin entry point, Builder pattern |
| `packages/plugin/src/websocket.rs` | WebSocket server, request/response handling |
| `packages/plugin/src/commands/mod.rs` | Command dispatch |
| `packages/plugin/src/screenshot/macos.rs` | macOS screenshot via WKWebView |
| `packages/plugin/src/commands/execute_js.rs` | JS execution with result retrieval via events |
| `packages/server/src/index.ts` | MCP server entry point |
| `packages/server/src/tools.ts` | Tool definitions with Zod schemas |
| `deny.toml` | Security/license config (gtk3-rs advisories ignored) |

## Commit guidelines

- 50 char first line + bullets for details
- No `Co-authored-by`
- Run `./scripts/check-all.sh` before committing
- Commit after each milestone

## Things to avoid

- Classes in TypeScript (use functional)
- JSDoc that repeats types
- `any` type
- Ignoring linter warnings
- Adding features beyond what's requested

## References

- [spec.md](spec.md) - Technical specification
- [tasks.md](tasks.md) - Implementation checklist
- [docs/style-guide.md](docs/style-guide.md) - Code style rules
- [docs/testing-guide.md](docs/testing-guide.md) - Manual testing with Cmdr
