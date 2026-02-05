# tauri-mcp

MCP server plugin for Tauri v2 app automation. Enables AI assistants to inspect, debug, and automate Tauri applications.

## Project status

**Milestones 1-4 complete.** The project structure, Rust plugin skeleton, macOS screenshot, and JS execution are in place. All quality checks pass.

### What's implemented
- WebSocket server skeleton (`packages/plugin/src/websocket.rs`)
- Command dispatch for all 9 tools (`packages/plugin/src/commands/`)
- Screenshot: macOS uses `WKWebView.takeSnapshot` via objc2, Windows/Linux return "not implemented"
- JS execution: Returns actual results via Tauri events, with 5s default timeout
- Console capture: Injection script works, retrieval implemented
- DOM snapshot, interact, wait-for: JS scripts exist, wired to commands
- Window management: list/info/resize using Tauri APIs

### What needs work (Milestones 5-15)
See [tasks.md](tasks.md) for the full list. Key items:
- **Milestone 10**: TypeScript MCP server (`packages/server/`)
- **Milestone 11**: Test app frontend (Svelte todo list)

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
| `deny.toml` | Security/license config (gtk3-rs advisories ignored) |

## Commit guidelines

- 50 char first line + bullets for details
- No `Co-authored-by`
- Run `./scripts/check-all.sh` before committing
- Commit after each milestone

## Things to avoid

- ❌ Classes in TypeScript (use functional)
- ❌ JSDoc that repeats types
- ❌ `any` type
- ❌ Ignoring linter warnings
- ❌ Adding features beyond what's requested

## References

- [spec.md](spec.md) - Technical specification
- [tasks.md](tasks.md) - Implementation checklist
- [docs/style-guide.md](docs/style-guide.md) - Code style rules
