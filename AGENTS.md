# Cmdr

`tauri-mcp` is a Model Context Protocol (MCP) server that enables AI assistants to inspect, debug, and automate Tauri v2 applications. It provides screenshots, DOM inspection, JavaScript execution, and UI interaction capabilities.

## Common tasks and reminders

- Adding new dependencies: NEVER rely on your training data! ALWAYS use pnpm/ncu, or another source to find the latest
  versions of libraries. Check out their GitHub, too, and see if they are active. Check Google/Reddit for the latest
  best solutions!
- ALWAYS read the [full style guide](docs/style-guide.md) before touching the repo!
- Always cover your code with tests until you're confident in your implementation, but don't add excessive tests!

## Things to avoid

- ❌ Don't use classes in TypeScript (use functional components/modules)
- ❌ Don't add JSDoc that just repeats types or obvious function names
- ❌ Don't use `any` type (ESLint will error)
- ❌ Don't ignore linter warnings (fix them or justify with a comment)

## Development

Always do a last round of checks before wrapping up each milestone:

1. Run ALL of rustfmt, clippy, cargo-audit, cargo-deny, cargo-udeps, jscpd, and tests via some convenience script!
2. Commit at least after each milestone! Use atomic commits, 50char+bullets, no Co-authored-by!
3. Looking back at this work, do you think this will be convenient to maintain this later?
4. Will this lead to superb UX for the end-user AI agent, without overloading its context?
5. Is this as fast as possible?

## Useful references

- [Style guide](docs/style-guide.md) - Keep this in mind! Especially "Sentence case" for titles and labels!

Happy coding! 🦀✨
