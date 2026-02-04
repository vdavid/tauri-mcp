# tauri-mcp

MCP server plugin for Tauri v2 app automation. Enables AI assistants to inspect, debug, and automate Tauri applications.

## Project status

**Milestone 1 complete.** The project structure and Rust plugin skeleton are in place. All quality checks pass.

### What's implemented
- WebSocket server skeleton (`packages/plugin/src/websocket.rs`)
- Command dispatch for all 9 tools (`packages/plugin/src/commands/`)
- Screenshot: macOS returns placeholder PNG, Windows/Linux return "not implemented"
- JS execution: Calls `window.eval()` but doesn't return results yet (TODO)
- Console capture: Injection script works, retrieval implemented
- DOM snapshot, interact, wait-for: JS scripts exist, wired to commands
- Window management: list/info/resize using Tauri APIs

### What needs work (Milestones 2-15)
See [tasks.md](tasks.md) for the full list. Key items:
- **Milestone 3**: Real macOS screenshot via `WKWebView.takeSnapshot` (objc2)
- **Milestone 4**: Proper JS result retrieval (current impl just returns "Script executed")
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
| `packages/plugin/src/screenshot/macos.rs` | macOS screenshot (needs real implementation) |
| `packages/plugin/src/commands/execute_js.rs` | JS execution (needs result retrieval) |
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
