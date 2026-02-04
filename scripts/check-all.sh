#!/bin/bash
# Comprehensive checks for tauri-mcp
# Run this before committing to ensure code quality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             tauri-mcp quality checks                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0

run_check() {
    local name="$1"
    local cmd="$2"

    printf "%-40s" "  $name..."

    if output=$(eval "$cmd" 2>&1); then
        echo -e "${GREEN}✓${NC}"
        ((passed++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        echo "$output" | head -20
        ((failed++))
        return 1
    fi
}

echo "┌────────────────────────────────────────────────────────────┐"
echo "│ Rust checks                                                 │"
echo "└────────────────────────────────────────────────────────────┘"

run_check "rustfmt (formatting)" "cargo fmt --all -- --check" || true
run_check "clippy (lints)" "cargo clippy --all-targets --all-features -- -D warnings" || true
run_check "cargo test" "cargo test --all" || true

# Optional checks - only run if tools are installed
if command -v cargo-audit &> /dev/null; then
    run_check "cargo-audit (security)" "cargo audit" || true
else
    echo -e "  cargo-audit...${YELLOW}skipped (not installed)${NC}"
fi

if command -v cargo-deny &> /dev/null; then
    run_check "cargo-deny (licenses/deps)" "cargo deny check" || true
else
    echo -e "  cargo-deny...${YELLOW}skipped (not installed)${NC}"
fi

if command -v cargo-udeps &> /dev/null; then
    # cargo-udeps requires nightly
    if rustup run nightly cargo --version &> /dev/null; then
        run_check "cargo-udeps (unused deps)" "cargo +nightly udeps --all-targets" || true
    else
        echo -e "  cargo-udeps...${YELLOW}skipped (nightly not installed)${NC}"
    fi
else
    echo -e "  cargo-udeps...${YELLOW}skipped (not installed)${NC}"
fi

echo ""
echo "┌────────────────────────────────────────────────────────────┐"
echo "│ Code duplication check                                      │"
echo "└────────────────────────────────────────────────────────────┘"

if command -v jscpd &> /dev/null; then
    run_check "jscpd (copy-paste detection)" "jscpd --config .jscpd.json packages/" || true
else
    echo -e "  jscpd...${YELLOW}skipped (not installed: npm i -g jscpd)${NC}"
fi

echo ""
echo "┌────────────────────────────────────────────────────────────┐"
echo "│ TypeScript checks                                           │"
echo "└────────────────────────────────────────────────────────────┘"

if [ -d "packages/server" ] && [ -f "packages/server/package.json" ]; then
    cd packages/server
    if [ -f "node_modules/.bin/tsc" ]; then
        run_check "TypeScript compile" "npx tsc --noEmit" || true
    else
        echo -e "  TypeScript...${YELLOW}skipped (run pnpm install first)${NC}"
    fi

    if [ -f "node_modules/.bin/eslint" ]; then
        run_check "ESLint" "npx eslint src --ext .ts" || true
    else
        echo -e "  ESLint...${YELLOW}skipped (run pnpm install first)${NC}"
    fi

    if [ -f "node_modules/.bin/vitest" ]; then
        run_check "Vitest" "npx vitest run" || true
    else
        echo -e "  Vitest...${YELLOW}skipped (run pnpm install first)${NC}"
    fi
    cd "$PROJECT_ROOT"
else
    echo -e "  TypeScript checks...${YELLOW}skipped (server not set up)${NC}"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC} ($passed checks)"
    exit 0
else
    echo -e "${RED}$failed check(s) failed${NC}, $passed passed"
    exit 1
fi
