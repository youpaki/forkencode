<p align="center">
  <a href="https://github.com/youpaki/forkencode">
    <picture>
      <source srcset="packages/web/src/assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/web/src/assets/logo-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/web/src/assets/logo-light.svg" alt="ForkEncode logo" width="400">
    </picture>
  </a>
</p>
<p align="center"><strong>The AI coding environment where intelligence branches.</strong></p>
<p align="center">
  <a href="https://github.com/youpaki/forkencode"><img alt="GitHub" src="https://img.shields.io/github/stars/youpaki/forkencode?style=flat-square" /></a>
</p>

---

## What is ForkEncode?

**ForkEncode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) that introduces **context-inheriting conversational forks** — a fundamentally new paradigm for AI coding.

### The Problem

Current AI coding assistants are linear. A conversation follows a single path: User → Assistant → User → Assistant. Even agent systems rely on isolated subagents receiving partial instructions.

### The Solution

ForkEncode treats every conversation as a **directed acyclic graph (DAG)**. The AI can:

- **Fork** into parallel reasoning branches (research, critique, alternative implementations)
- **Inherit** full context across branches (not just prompts to subagents)
- **Merge** findings back into the parent conversation with configurable strategies
- **Visualize** the branch graph for navigation and review

Think: Git branches for AI reasoning.

### How It Works

```
Main Conversation
├── Research Branch    → "Gather API documentation"
├── Critique Branch    → "Review for edge cases"
│   └── Counterexample → "Find a failing scenario"
├── Implementation A   → "Microservices approach"
├── Implementation B   → "Monolith approach"
└── → MERGE ←         → "Synthesize findings"
```

Each branch inherits context from its parent (full, relevant, or minimal) and records what was inherited. Branches can be merged back with five strategies: consensus, weighted, contradiction, best candidate, or hybrid.

### Current Status

| Feature | Status |
|---------|--------|
| Conversation Graph (DAG) | Database tables + service |
| Branch CRUD + Graph Traversal | Implemented |
| Context Inheritance (3 modes) | Implemented |
| Fork Tool (AI-callable) | Registered in tool registry |
| Merge Tool (5 strategies) | Registered in tool registry |
| Branch Graph View (UI) | Component created |
| Branch Inspector (UI) | Component created |
| Branch List (UI) | Component created |
| Merge Visualization (UI) | Component created |

---

## Quick Start

```bash
# Install
curl -fsSL https://opencode.ai/install | bash

# Or run from source
bun install
bun dev
```

---

## Development

```bash
bun install                    # Install dependencies
bun typecheck                  # Type-check all packages
bun --cwd packages/opencode dev # Start TUI
bun --cwd packages/app dev      # Start web app
```

---

## Architecture

```
packages/
├── core/           Schema definitions, database, BranchManager, ContextInheritanceEngine
├── opencode/       CLI, TUI, agent loop, tool system (fork, merge tools)
├── app/            SolidJS web UI (BranchGraph, BranchList, BranchInspector)
├── ui/             Shared UI component library (BranchIndicator, MergeAnnouncement)
└── ...
```

---

## License

MIT — forked from [OpenCode](https://github.com/anomalyco/opencode)
