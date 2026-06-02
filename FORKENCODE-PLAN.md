# ForkEncode Migration Plan

## Transforming OpenCode into a Context-Inheriting Conversational Fork System

---

# 1. Executive Summary

OpenCode is a sophisticated AI coding assistant built on a linear conversation model. Sessions have a parentID (creating a tree), but messages within a session are strictly sequential. Conversation forking exists as a manual "clone session" operation — not as a first-class reasoning primitive.

ForkEncode reimagines every conversation as a **directed acyclic graph (DAG)** of branches. The AI autonomously decides when to fork, what context to inherit, when to merge, and how to synthesize findings. The user interacts with a visual branch graph, not a linear chat.

The migration preserves OpenCode's excellent foundations — Effect-based services, Drizzle ORM, SolidJS UI, AI SDK integration, tool system, and plugin architecture — while replacing the conversation model at its core.

---

# 2. Current State Analysis

## What Exists (and Works Well)

| Component | Status | Notes |
|-----------|--------|-------|
| Session CRUD | Strong | `packages/opencode/src/session/session.ts` — create, list, fork, remove, etc. |
| Linear Message Storage | Strong | `MessageTable`, `PartTable` (legacy), `SessionMessageTable` (v2) |
| Session Forking | Weak | Simple clone with `parentID`, no graph awareness, no merge support |
| Event System | Strong | `EventV2` pub/sub with projectors |
| Agent Definitions | Strong | Built-in agents with permissions and prompts |
| Agent Loop | Strong | `prompt.ts` `runLoop()` — system prompt construction, tool resolution, LLM streaming |
| Subagent System | Moderate | `task` tool creates child sessions — closest existing concept to forking |
| Processor | Strong | `processor.ts` — stream handling, event dispatch, tool call management |
| Database | Strong | SQLite via Drizzle ORM, Effect-wrapped |
| UI (Message Timeline) | Strong | Virtualized row rendering, SolidJS reactivity |
| UI (Fork Dialog) | Exists | `dialog-fork.tsx` — lists user messages, user picks one to fork from |
| Tool System | Strong | `Tool.define()`, registry, permissions, MCP bridging |

## What Must Change

| Gap | Impact |
|-----|--------|
| No `Branch` entity | Branches are the core ForkEncode primitive; they don't exist |
| No `Merge` entity | Merging branches is impossible without merge records |
| No `Checkpoint` entity | State snapshots for context inheritance don't exist |
| No `ContextSnapshot` entity | No record of what context a branch inherited |
| No `ForkPlan` entity | No record of *why* a fork was created |
| No graph traversal | Linear `session.parentID` gives a tree, not a DAG |
| No branch visualization | UI shows one conversation at a time |
| No autonomous forking | Agent has no awareness that it *can* fork |
| No merge engine | No logic to resolve concurrent branch outputs |
| No branch awareness in agent loop | The agent loop assumes one linear sequence |
| No branch runtime | No isolated execution context per branch |

## Fork Taxonomy

The system must not hardcode fork types but should define them as a registry.

## Key File Inventory

### Core Session (packages/core/src/session/)
| File | Purpose |
|------|---------|
| `schema.ts` | SessionSchema.Info (parentID exists) |
| `sql.ts` | SessionTable, MessageTable, PartTable, SessionMessageTable |
| `message.ts` | SessionMessage.Message union type |
| `event.ts` | Session events (prompted, step, tool, text, reasoning, shell, compaction) |
| `legacy.ts` | Legacy message/part types (used by production agent loop) |
| `projector.ts` | SessionProjector — listens to events and writes to tables |
| `message-updater.ts` | Message-update helpers |
| `prompt.ts` | Prompt schema (text, files, agents, references) |

### Opencode Session (packages/opencode/src/session/)
| File | Purpose |
|------|---------|
| `session.ts` | Session.Service — CRUD, fork, messages, diff, permissions |
| `prompt.ts` | runLoop() — main agent loop |
| `processor.ts` | Stream processing, event handling |
| `llm.ts` | LLM streaming orchestration |
| `llm/ai-sdk.ts` | AI SDK → LLMEvent adapter |
| `llm/native-runtime.ts` | Native LLM runtime |
| `tools.ts` | Tool resolution for agent |
| `message-v2.ts` | Message management helpers |
| `compaction.ts` | Context window compaction |
| `run-state.ts` | Per-session running state |

### UI (packages/app/src/)
| File | Purpose |
|------|---------|
| `pages/session.tsx` | Main session page (1850 lines) |
| `pages/session/message-timeline.tsx` | Virtualized timeline (1614 lines) |
| `pages/session/message-timeline.data.ts` | Timeline row types |
| `components/dialog-fork.tsx` | Fork dialog |
| `components/prompt-input/` | Prompt input module |
| `context/sync.tsx` | Session-level state (messages, parts) |
| `context/server-sync.tsx` | Global state (projects, config) |
| `context/layout.tsx` | Layout, sidebar, sessions, tabs |

### Agent System (packages/opencode/src/)
| File | Purpose |
|------|---------|
| `agent/agent.ts` | Agent definitions, built-in agents |
| `agent/subagent-permissions.ts` | Permission derivation for subagents |
| `tool/task.ts` | Subagent tool |
| `tool/tool.ts` | Tool.define() |

---

# 3. Target Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    ForkEncode Architecture                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ ForkPlanner │  │ BranchManager│  │ MergeEngine      │    │
│  │ (decides    │──│ (CRUD for    │──│ (resolves        │    │
│  │  when/why   │  │  branches)   │  │  merges)         │    │
│  │  to fork)   │  └──────┬───────┘  └────────┬─────────┘    │
│  └──────┬──────┘         │                    │              │
│         │                │                    │              │
│  ┌──────▼────────────────▼────────────────────▼──────────┐   │
│  │               ConversationGraph                       │   │
│  │  (DAG over branches: parent → child, merge → parent)  │   │
│  └─────────────────────────┬─────────────────────────────┘   │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │           ContextInheritanceEngine                     │  │
│  │  (FULL_CONTEXT / RELEVANT_CONTEXT / MINIMAL_CONTEXT)  │  │
│  └─────────────────────────┬─────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │            BranchExecutionRuntime                      │  │
│  │  (isolated context per branch, shared tool system)     │  │
│  └─────────────────────────┬─────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │           GraphPersistenceLayer                        │  │
│  │  (Drizzle SQLite: Branch, Merge, Checkpoint, etc.)    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  UI: BranchGraphView | MergeVisualization | Inspector  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### ConversationGraph
- The central DAG structure. Every conversation is a graph of branches.
- Provides graph traversal: ancestors, descendants, siblings, paths to root.
- Records parent-child relationships AND merge relationships.
- Replaces the simple `session.parentID` tree.
- **Location**: `packages/core/src/conversation-graph/`

### BranchManager
- CRUD for branches within a conversation graph.
- Each branch has: id, parentID, fork purpose, inheritance mode, status, timeline.
- Branches share the conversation's project, model, and agent configuration.
- **Location**: `packages/core/src/branch/`

### MergeEngine
- Handles branch-to-parent merges.
- Merge strategies: Consensus, Weighted, Contradiction, Best Candidate, Hybrid.
- Produces Merge records with provenance data (what each branch contributed).
- **Location**: `packages/core/src/merge/`

### ContextInheritanceEngine
- Reads a branch's ancestors and produces the inherited context.
- Three modes: FULL_CONTEXT (all ancestors), RELEVANT_CONTEXT (filtered by relevance), MINIMAL_CONTEXT (summaries only).
- Produces a `ContextSnapshot` that records what was passed.
- **Location**: `packages/core/src/context-inheritance/`

### BranchExecutionRuntime
- Executes an agent within a branch's context.
- Isolates tool execution per branch.
- Manages branch lifecycle: running, paused, completed, failed, archived.
- **Location**: `packages/opencode/src/branch-runtime/`

### ForkPlanner
- The AI-driven orchestrator that decides when/why to fork.
- Sits *above* the agent loop. The agent loop calls ForkPlanner at decision points.
- Evaluates: complexity, ambiguity, number of approaches, risk.
- Creates fork plans: "I will fork into research + implementation + critique".
- **Location**: `packages/opencode/src/fork-planner/`

### GraphPersistenceLayer
- Database access layer for all graph entities.
- Graph traversal queries (ancestors, descendants, merge graph).
- **Location**: `packages/core/src/graph-persistence/`

---

# 4. New Entity Model

## 4.1 Branch

A branch is a single path of reasoning within a conversation graph.

```typescript
// Branch ID: "brn_<timestamp><random>"
export const BranchID = Schema.String.pipe(
  Schema.brand("BranchID"),
  withStatics((s) => ({
    make: () => s("brn_" + Identifier.descending()),
  })),
)

export class BranchInfo extends Schema.Class<BranchInfo>("Branch.Info")({
  id: BranchID,
  conversationID: ConversationID,          // belongs to one conversation graph
  parentID: BranchID.pipe(optionalOmitUndefined),  // parent branch (can be root)
  purpose: Schema.String,                   // WHY this branch was created
  forkType: Schema.String.pipe(optionalOmitUndefined),  // free-form type tag
  inheritanceMode: Schema.Literals(["full", "relevant", "minimal"]),
  status: Schema.Literals(["running", "completed", "failed", "archived"]),
  messages: Schema.Array(BranchMessageID),  // ordered message IDs in this branch
  summary: Schema.String.pipe(optionalOmitUndefined),
  confidence: Schema.Finite.pipe(optionalOmitUndefined),  // AI's confidence in this branch
  agent: Schema.String.pipe(optionalOmitUndefined),
  model: ModelV2.Ref.pipe(optionalOmitUndefined),
  tokenBudget: Schema.Finite.pipe(optionalOmitUndefined),
  depth: NonNegativeInt,                    // depth in graph (0 = root)
  time: {
    created: V2Schema.DateTimeUtcFromMillis,
    updated: V2Schema.DateTimeUtcFromMillis,
    archived: V2Schema.DateTimeUtcFromMillis.pipe(Schema.optional),
  },
}) {}
```

## 4.2 Conversation

A conversation is a collection of branches forming a DAG.

```typescript
export const ConversationID = Schema.String.pipe(
  Schema.brand("ConversationID"),
  withStatics((s) => ({
    make: () => "conv_" + Identifier.descending(),
  })),
)

export class ConversationInfo extends Schema.Class<ConversationInfo>("Conversation.Info")({
  id: ConversationID,
  projectID: ProjectV2.ID,
  rootBranchID: BranchID,                   // the first/root branch
  title: Schema.String,
  agent: Schema.String.pipe(optionalOmitUndefined),
  model: ModelV2.Ref.pipe(optionalOmitUndefined),
  metadata: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.optional),
  time: {
    created: V2Schema.DateTimeUtcFromMillis,
    updated: V2Schema.DateTimeUtcFromMillis,
    archived: V2Schema.DateTimeUtcFromMillis.pipe(Schema.optional),
  },
}) {}
```

## 4.3 BranchMessage (wraps SessionMessage)

Messages belong to a branch, not directly to a session.

```typescript
export class BranchMessage extends Schema.Class<BranchMessage>("Branch.Message")({
  id: SessionMessage.ID,                    // reuse existing message ID scheme
  branchID: BranchID,
  type: SessionMessage.Message.fields.type,
  data: SessionMessage.Message,             // the full message data
  timeCreated: V2Schema.DateTimeUtcFromMillis,
}) {}
```

## 4.4 Merge

A merge records the unification of one or more branches back into a parent.

```typescript
export const MergeID = Schema.String.pipe(
  Schema.brand("MergeID"),
  withStatics((s) => ({
    make: () => "mrg_" + Identifier.descending(),
  })),
)

export class MergeInfo extends Schema.Class<MergeInfo>("Merge.Info")({
  id: MergeID,
  targetBranchID: BranchID,                 // the branch being merged INTO
  sourceBranchIDs: Schema.Array(BranchID),  // the branches being merged FROM
  strategy: Schema.Literals(["consensus", "weighted", "contradiction", "best_candidate", "hybrid"]),
  explanation: Schema.String,               // AI writes what each branch found and why merge was done
  resolution: Schema.String,                // the synthesized resolution text
  confidence: Schema.Finite,
  status: Schema.Literals(["pending", "completed", "conflicted", "rejected"]),
  time: {
    created: V2Schema.DateTimeUtcFromMillis,
    completed: V2Schema.DateTimeUtcFromMillis.pipe(Schema.optional),
  },
}) {}
```

## 4.5 Checkpoint

A snapshot of branch state at a point in time (for context inheritance).

```typescript
export const CheckpointID = Schema.String.pipe(
  Schema.brand("CheckpointID"),
  withStatics((s) => ({
    make: () => "chk_" + Identifier.descending(),
  })),
)

export class CheckpointInfo extends Schema.Class<CheckpointInfo>("Checkpoint.Info")({
  id: CheckpointID,
  branchID: BranchID,
  messageID: SessionMessage.ID,             // message at which checkpoint was taken
  snapshot: Schema.String,                  // serialized state
  summary: Schema.String,                   // what was happening
  time: V2Schema.DateTimeUtcFromMillis,
}) {}
```

## 4.6 ContextSnapshot

Records what context was inherited when a branch was created.

```typescript
export class ContextSnapshotInfo extends Schema.Class<ContextSnapshotInfo>("ContextSnapshot.Info")({
  id: CheckpointID,                         // reuses checkpoint ID
  branchID: BranchID,
  sourceBranchID: BranchID,                 // where context was inherited from
  inheritanceMode: Schema.Literals(["full", "relevant", "minimal"]),
  includedMessageCount: NonNegativeInt,
  totalTokenEstimate: NonNegativeInt,
  summary: Schema.String,                   // what the context contained
  time: V2Schema.DateTimeUtcFromMillis,
}) {}
```

## 4.7 ForkPlan

A plan created by the AI describing how it intends to fork.

```typescript
export class ForkPlanInfo extends Schema.Class<ForkPlanInfo>("ForkPlan.Info")({
  id: CheckpointID,                         // reuses checkpoint ID
  conversationID: ConversationID,
  sourceBranchID: BranchID,
  plannedForks: Schema.Array(
    Schema.Struct({
      purpose: Schema.String,
      forkType: Schema.String.pipe(Schema.optional),
      inheritanceMode: Schema.Literals(["full", "relevant", "minimal"]),
      agent: Schema.String.pipe(Schema.optional),
    })
  ),
  rationale: Schema.String,                 // why this fork plan was chosen
  status: Schema.Literals(["planned", "executing", "completed", "abandoned"]),
  time: V2Schema.DateTimeUtcFromMillis,
}) {}
```

---

# 5. Database Migration

## 5.1 New Tables

### conversation

```sql
CREATE TABLE "conversation" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "project"(id),
  "root_branch_id" text NOT NULL,
  "title" text NOT NULL,
  "agent" text,
  "model" text,
  "metadata" text,  -- JSON
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  "time_archived" integer
);
CREATE INDEX "conv_project_idx" ON "conversation"("project_id");
```

### branch

```sql
CREATE TABLE "branch" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "conversation"(id),
  "parent_id" text REFERENCES "branch"(id),
  "purpose" text NOT NULL,
  "fork_type" text,
  "inheritance_mode" text NOT NULL DEFAULT 'full',
  "status" text NOT NULL DEFAULT 'running',
  "summary" text,
  "confidence" real,
  "agent" text,
  "model" text,
  "token_budget" integer,
  "depth" integer NOT NULL DEFAULT 0,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  "time_archived" integer
);
CREATE INDEX "branch_conversation_idx" ON "branch"("conversation_id");
CREATE INDEX "branch_parent_idx" ON "branch"("parent_id");
```

### branch_message

```sql
CREATE TABLE "branch_message" (
  "id" text PRIMARY KEY,
  "branch_id" text NOT NULL REFERENCES "branch"(id),
  "type" text NOT NULL,
  "data" text NOT NULL,  -- JSON
  "time_created" integer NOT NULL
);
CREATE INDEX "bm_branch_idx" ON "branch_message"("branch_id");
CREATE INDEX "bm_time_idx" ON "branch_message"("time_created");
```

### merge

```sql
CREATE TABLE "merge" (
  "id" text PRIMARY KEY,
  "target_branch_id" text NOT NULL REFERENCES "branch"(id),
  "source_branch_ids" text NOT NULL,  -- JSON array
  "strategy" text NOT NULL,
  "explanation" text NOT NULL,
  "resolution" text NOT NULL,
  "confidence" real NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "time_created" integer NOT NULL,
  "time_completed" integer
);
CREATE INDEX "merge_target_idx" ON "merge"("target_branch_id");
```

### checkpoint

```sql
CREATE TABLE "checkpoint" (
  "id" text PRIMARY KEY,
  "branch_id" text NOT NULL REFERENCES "branch"(id),
  "message_id" text NOT NULL,
  "snapshot" text NOT NULL,
  "summary" text NOT NULL,
  "time" integer NOT NULL
);
CREATE INDEX "checkpoint_branch_idx" ON "checkpoint"("branch_id");
```

### context_snapshot

```sql
CREATE TABLE "context_snapshot" (
  "id" text PRIMARY KEY,
  "branch_id" text NOT NULL REFERENCES "branch"(id),
  "source_branch_id" text NOT NULL REFERENCES "branch"(id),
  "inheritance_mode" text NOT NULL,
  "included_message_count" integer NOT NULL,
  "total_token_estimate" integer NOT NULL,
  "summary" text NOT NULL,
  "time" integer NOT NULL
);
```

### fork_plan

```sql
CREATE TABLE "fork_plan" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "conversation"(id),
  "source_branch_id" text NOT NULL REFERENCES "branch"(id),
  "planned_forks" text NOT NULL,  -- JSON
  "rationale" text NOT NULL,
  "status" text NOT NULL DEFAULT 'planned',
  "time" integer NOT NULL
);
```

## 5.2 Migration Path

The existing `SessionTable`, `MessageTable`, `PartTable`, and `SessionMessageTable` are preserved during a transition period. The new graph tables exist alongside them.

**Phase 1 (Parallel):** New branches store messages in `branch_message`. Existing sessions continue using `MessageTable`/`PartTable`. A `BranchManager.bootstrap()` creates a `conversation` and `branch` for each existing `SessionTable` row.

**Phase 2 (Migration):** When a session is actively used, its messages are mirrored to `branch_message`. The system reads from `branch_message` for new queries.

**Phase 3 (Cutover):** The old `MessageTable`/`PartTable` are no longer written to. Historical data remains queryable via the `branch_message` mirror.

## 5.3 Indexing for Graph Traversal

```sql
-- Enable efficient ancestor/descendant queries
CREATE INDEX "branch_depth_conversation_idx" ON "branch"("conversation_id", "depth");
CREATE INDEX "branch_parent_status_idx" ON "branch"("parent_id", "status");
CREATE INDEX "merge_source_idx" ON "merge"("source_branch_ids");
```

For full DAG traversal (multi-parent merges), a `branch_relationship` table provides efficient closure-table-style queries:

```sql
CREATE TABLE "branch_relationship" (
  "ancestor_id" text NOT NULL REFERENCES "branch"(id),
  "descendant_id" text NOT NULL REFERENCES "branch"(id),
  "depth" integer NOT NULL,
  PRIMARY KEY ("ancestor_id", "descendant_id")
);
```

This is rebuilt after each merge via a recursive traversal.

---

# 6. Core Service Implementation

## 6.1 ConversationGraph Service (`packages/core/src/conversation-graph/`)

```typescript
export interface Interface {
  readonly create: (input: { projectID: ProjectV2.ID; title: string }) => Effect.Effect<ConversationInfo>
  readonly get: (id: ConversationID) => Effect.Effect<ConversationInfo>
  readonly addBranch: (conversationID: ConversationID, branch: BranchInfo) => Effect.Effect<void>
  readonly getBranch: (branchID: BranchID) => Effect.Effect<BranchInfo>
  readonly getBranches: (conversationID: ConversationID) => Effect.Effect<Array<BranchInfo>>
  readonly getAncestors: (branchID: BranchID) => Effect.Effect<Array<BranchInfo>>
  readonly getDescendants: (branchID: BranchID) => Effect.Effect<Array<BranchInfo>>
  readonly getSiblings: (branchID: BranchID) => Effect.Effect<Array<BranchInfo>>
  readonly getMergeGraph: (branchID: BranchID) => Effect.Effect<Array<MergeInfo>>
  readonly addMerge: (merge: MergeInfo) => Effect.Effect<void>
}
```

**Key design decisions:**
- The `ConversationGraph.Service` wraps the `Database.Service` for persistence.
- Graph traversal uses SQL (branch_relationship table) rather than in-memory recursion for deep graphs.
- Branch order is maintained by `time_created`; there is no explicit ordering field.

## 6.2 BranchManager Service (`packages/core/src/branch/`)

```typescript
export interface Interface {
  readonly create: (input: {
    conversationID: ConversationID
    parentID: BranchID
    purpose: string
    forkType?: string
    inheritanceMode: "full" | "relevant" | "minimal"
    agent?: string
    model?: ModelV2.Ref
    tokenBudget?: number
  }) => Effect.Effect<BranchInfo>

  readonly get: (id: BranchID) => Effect.Effect<BranchInfo>
  readonly update: (id: BranchID, update: Partial<BranchInfo>) => Effect.Effect<void>
  readonly addMessage: (branchID: BranchID, message: BranchMessage) => Effect.Effect<void>
  readonly getMessages: (branchID: BranchID, options?: { offset?: number; limit?: number }) => Effect.Effect<Array<BranchMessage>>
  readonly setStatus: (branchID: BranchID, status: BranchInfo["status"]) => Effect.Effect<void>
  readonly archive: (branchID: BranchID) => Effect.Effect<void>
  readonly setSummary: (branchID: BranchID, summary: string) => Effect.Effect<void>
}
```

**Key design decisions:**
- Branch creation auto-calculates `depth` from parent.
- Messages are stored in `branch_message` table, not in the old message tables.
- The `addMessage` method publishes a `BranchEvent.MessageAdded` event so the UI can react.

## 6.3 ContextInheritanceEngine (`packages/core/src/context-inheritance/`)

```typescript
export type InheritanceMode = "full" | "relevant" | "minimal"

export interface InheritedContext {
  readonly messages: Array<BranchMessage>     // messages to include in LLM context
  readonly tokenEstimate: number
  readonly summary: string                    // summary of inherited context
  readonly contextSnapshotID: CheckpointID
}

export interface Interface {
  readonly inherit: (branchID: BranchID, mode: InheritanceMode) => Effect.Effect<InheritedContext>
}
```

**Inheritance algorithms:**

- **FULL_CONTEXT**: Concatenate all messages from ancestors (traversing parents upward) plus this branch's messages. Produces the largest context snapshot.

- **RELEVANT_CONTEXT**: Walk ancestor messages, score each for relevance against the branch's `purpose`. Include messages above a relevance threshold. Uses simple TF-IDF or embedding similarity (future). Produces a filtered context.

- **MINIMAL_CONTEXT**: Only include ancestor summaries (from checkpoints) and the most recent 1-2 user messages. Produces the smallest context snapshot.

**Key design decisions:**
- The engine always produces a `ContextSnapshot` record for auditability.
- The agent loop calls `inherit()` before starting execution in a branch.
- The inherited messages are injected into the LLM prompt as conversation history.

## 6.4 MergeEngine (`packages/core/src/merge/`)

```typescript
export type MergeStrategy = "consensus" | "weighted" | "contradiction" | "best_candidate" | "hybrid"

export interface MergeInput {
  readonly targetBranchID: BranchID
  readonly sourceBranchIDs: Array<BranchID>
  readonly strategy: MergeStrategy
}

export interface MergeOutput {
  readonly merge: MergeInfo
  readonly residualIssues: Array<string>  // unresolved contradictions
}

export interface Interface {
  readonly merge: (input: MergeInput) => Effect.Effect<MergeOutput>
  readonly getMerge: (id: MergeID) => Effect.Effect<MergeInfo>
  readonly getMergesForBranch: (branchID: BranchID) => Effect.Effect<Array<MergeInfo>>
}
```

**Merge strategies:**

- **Consensus**: Branches agree → output the agreement. Branches disagree → flag the contradiction.
- **Weighted**: Each branch has a `confidence` score. Higher confidence gets more weight in the output.
- **Contradiction**: Preserve all viewpoints, tag as unresolvable, let the user decide.
- **Best Candidate**: Pick the branch with the highest confidence/success and output its result.
- **Hybrid**: Use consensus when possible, fall back to best candidate for unresolved portions.

**Implementation approach:**
- The merge engine does NOT execute the merge itself. It orchestrates a merge prompt to the AI.
- The engine creates a special "merge message" that contains:
  1. Each branch's summary
  2. Each branch's key findings
  3. A synthesis request to the AI
- The AI's response becomes the `resolution` field.

## 6.5 ForkPlanner (`packages/opencode/src/fork-planner/`)

The ForkPlanner is the core intelligence that decides when to fork.

```typescript
export interface ForkSuggestion {
  readonly purpose: string
  readonly forkType?: string
  readonly inheritanceMode: "full" | "relevant" | "minimal"
  readonly agent?: string
  readonly rationale: string
}

export interface ForkPlan {
  readonly suggestions: Array<ForkSuggestion>
  readonly rationale: string
}

export interface Interface {
  readonly evaluate: (branchID: BranchID) => Effect.Effect<ForkPlan | null>
  readonly planForks: (branchID: BranchID, suggestions: Array<ForkSuggestion>) => Effect.Effect<ForkPlanInfo>
  readonly executePlan: (plan: ForkPlanInfo) => Effect.Effect<Array<BranchInfo>>
}
```

**Decision triggers (evaluated by the agent loop):**

| Trigger | Condition |
|---------|-----------|
| Complexity | User request involves 3+ distinct areas of concern |
| Ambiguity | User request has multiple valid interpretations |
| Risk | Change affects critical system (auth, data, payments) |
| Tradeoffs | Architecture decisions with competing priorities |
| Investigation | Bug report with unclear root cause |
| Alternatives | Feature request with multiple implementation approaches |

**The ForkPlanner prompt:**
The ForkPlanner is itself an AI prompt that receives the current conversation state and outputs a structured fork plan. It runs before the main agent in the decision loop.

```
You are analyzing the current state of a conversation with the user.
Consider whether to create forks (parallel reasoning branches).
A fork is an independent line of inquiry that inherits context from this point.

Current conversation summary: {summary}
User's latest request: {latestMessage}

Should you fork?
If yes, describe each fork's purpose and what context it should inherit.
```

## 6.6 BranchExecutionRuntime (`packages/opencode/src/branch-runtime/`)

```typescript
export interface Interface {
  readonly execute: (branchID: BranchID) => Effect.Effect<void>
  readonly cancel: (branchID: BranchID) => Effect.Effect<void>
  readonly getStatus: (branchID: BranchID) => Effect.Effect<BranchRuntimeStatus>
  readonly pause: (branchID: BranchID) => Effect.Effect<void>
  readonly resume: (branchID: BranchID) => Effect.Effect<void>
}

type BranchRuntimeStatus = "idle" | "running" | "paused" | "completed" | "failed"
```

**Key design decisions:**
- Each branch gets its own execution scope (Effect Scope).
- The runtime reuses the existing processor/LLM/tool pipeline, but scoped to the branch.
- Multiple branches can execute concurrently.
- Tools are shared across branches, but each branch has its own tool call context.
- Branch execution is isolated: one branch crashing does not affect others.

**Implementation:**
The `BranchExecutionRuntime` wraps the existing `SessionPrompt.runLoop()` and `SessionProcessor`. Instead of operating on a `Session`, it operates on a `Branch`. The key difference is context construction: instead of loading all messages from a session, it calls `ContextInheritanceEngine.inherit()`.

```typescript
const executeBranch = Effect.fn("BranchRuntime.execute")(function* (branchID: BranchID) {
  const branch = yield* BranchManager.get(branchID)
  const context = yield* ContextInheritanceEngine.inherit(branchID, branch.inheritanceMode)

  // Build the agent loop input from inherited context
  const input: SessionPrompt.Input = {
    messages: context.messages,
    system: buildSystemPrompt(branch),
    tools: yield* ToolRegistry.resolve(branch.agent),
    // ... standard agent loop params
  }

  // Run the existing agent loop, scoped to this branch
  const result = yield* SessionPrompt.run(input).pipe(
    Scope.extend(yield* createBranchScope(branchID)),
  )

  yield* BranchManager.setStatus(branchID, "completed")
  yield* ForkPlanner.evaluate(branchID) // check if branches should fork further
})
```

---

# 7. Agent Orchestration Changes

## 7.1 Modified Agent Loop

The existing `runLoop()` in `packages/opencode/src/session/prompt.ts` is modified to include fork evaluation points.

**Before (OpenCode):**

```
runLoop():
  1. Fetch messages
  2. Check compaction
  3. Resolve agent
  4. Resolve tools
  5. Build system prompt
  6. Process (LLM stream)
  7. Repeat if continue
```

**After (ForkEncode):**

```
runLoop():
  1. Check if this is a branch (not root)
     → If yes, inherit context via ContextInheritanceEngine
  2. Fetch branch messages
  3. Check compaction
  4. Resolve agent
  5. Resolve tools
  6. Build system prompt
  7. Process (LLM stream)
  8. Evaluate for forking (call ForkPlanner.evaluate)
     → If fork plan returned, create branches and optionally execute them
  9. Check for pending merges
  10. Repeat if continue
```

## 7.2 Fork Tool (new)

A new tool that the AI can call directly to create a fork:

```typescript
Tool.define("fork", {
  description: "Create a parallel reasoning branch to explore an alternative approach, investigate independently, or critique the current solution. The branch inherits full context from this point.",
  parameters: {
    purpose: Schema.String,         // "What this branch should investigate"
    forkType: Schema.String.optional(),  // Optional type tag
    inheritanceMode: Schema.Literal("full", "relevant", "minimal").optional(),
  },
  execute: (args, ctx) => {
    // Create a new branch in the current conversation
    // Execute the branch (optionally in background)
    // Return the branch ID for later merging
  },
})
```

## 7.3 Merge Tool (new)

A new tool for merging branches:

```typescript
Tool.define("merge", {
  description: "Merge one or more branches back into the current conversation, synthesizing their findings.",
  parameters: {
    sourceBranchIDs: Schema.Array(Schema.String),
    strategy: Schema.Literal("consensus", "weighted", "contradiction", "best_candidate", "hybrid"),
  },
  execute: (args, ctx) => {
    // Call MergeEngine.merge()
    // Return the synthesized result
  },
})
```

## 7.4 Branch-Aware Subagent System

The existing `task` tool (`packages/opencode/src/tool/task.ts`) creates child sessions. This is refactored:

- `task` still creates child sessions for *isolated* subagent work (unrelated to the main conversation).
- A new `fork` tool creates branches *within* the same conversation.
- The key difference: forks share the conversation graph, inherit context, and can merge back. Subagents in new sessions do not.

## 7.5 Fork Budgets and Resource Management

To prevent branch explosion:

```typescript
export interface ForkBudget {
  maxActiveBranches: number      // default: 5
  maxDepth: number               // default: 3
  maxBranchesPerConversation: number  // default: 20
  tokenBudgetPerBranch: number   // default: varies by model
}

export class ForkBudgetManager {
  readonly canCreateBranch: (conversationID: ConversationID) => Effect.Effect<boolean>
  readonly getAvailableBudget: (conversationID: ConversationID) => Effect.Effect<ForkBudget>
  readonly prioritize: (branches: Array<BranchInfo>) => Effect.Effect<Array<BranchInfo>>
}
```

The ForkPlanner checks `ForkBudgetManager.canCreateBranch()` before suggesting forks.

---

# 8. UI Transformation

## 8.1 Architecture

The UI transformation adds graph-aware views alongside the existing linear message view. Both views can coexist.

```
Session Page (modified)
├── [New] BranchGraphView (collapsible top panel)
├── [New] BranchInspector (side panel, shown when a branch is selected)
├── MessageTimeline (modified to show current branch's messages)
│   ├── [New] BranchIndicator (shows which branch you're viewing)
│   └── [New] MergeAnnouncement (shows merge results as special messages)
├── SessionComposerRegion (modified)
│   └── [New] ForkButton (beside Submit)
└── SessionSidePanel (modified)
    └── [New] Branch Tab (list of branches in current conversation)
```

## 8.2 BranchGraphView Component

A visual DAG renderer showing branches as nodes and parent/merge relationships as edges.

**File**: `packages/app/src/components/branch-graph-view.tsx`

```tsx
// Data structure for the graph
interface BranchGraphNode {
  id: BranchID
  purpose: string
  status: BranchInfo["status"]
  depth: number
  confidence?: number
  summary?: string
}

interface BranchGraphEdge {
  source: BranchID
  target: BranchID
  type: "parent" | "merge"
}
```

**Layout strategy:**
- Root branch at top.
- Direct children one level below, arranged left-to-right.
- Merged branches shown with dashed lines flowing into the target.
- Active branch highlighted.
- Clicking a node switches the timeline to that branch's messages.
- The graph uses SVG or Canvas via a lightweight layout library.

**Alternative simpler approach (Phase 1):**
A tree/list view instead of a full graph renderer:

```
◉ main ──────────────────────────────────── [active]
├── ◉ research ── "Gather API docs" ──────── [completed]
├── ◉ critique ── "Review edge cases" ────── [completed]
│   └── ◉ counterexample ── "Find counter" ─ [running]
├── ◉ implementation ── "Build solution" ─── [running]
└── ◉ refactor ── "Clean up code" ────────── [planned]
     └── merged into main ✓
```

## 8.3 BranchInspector Component

**File**: `packages/app/src/components/branch-inspector.tsx`

Displays:
- **Purpose**: The reason this branch was created
- **Status**: Running / Completed / Failed / Archived
- **Confidence**: The AI's self-assessed confidence (0-1)
- **Inheritance**: What context mode was used (full/relevant/minimal)
- **Message count**: How many messages in this branch
- **Fork plan reference**: Link to the ForkPlan that created this branch
- **Timer**: How long the branch has been running
- **Merge history**: If merged, what the merge result was

## 8.4 Branch Timeline View

When the user clicks a branch node, the main `MessageTimeline` shows that branch's messages. The timeline header shows:

```
Branch: research ── "Gather API documentation"
← Back to main  │  Show all branches  │  Merge to parent
```

**Message filtering:**
- When viewing a branch, only that branch's messages appear.
- Inherited context messages are shown in a collapsed "Inherited context" section at the top.
- Merge announcements appear as special message types.

## 8.5 Conversation List Modification

The session list (sidebar) shows conversations with their branch count:

```
My Conversation                         3 branches
  ├── main                             (12 messages)
  ├── research                         (3 messages)
  └── implementation                   (8 messages)
```

## 8.6 Merge Visualization

When a merge occurs, a special merge message appears in the parent branch's timeline:

```
┌──────────────────────────────────────────────────────────┐
│ 🔀 Merge: research + critique → main                    │
│                                                         │
│ Research found: The API supports batch operations       │
│ Critique found: Edge case with empty responses          │
│                                                         │
│ Resolution: Use batch API with empty-response guard     │
│ Confidence: 0.85                                       │
│                                                         │
│ [View merged branches] [Revert merge]                   │
└──────────────────────────────────────────────────────────┘
```

## 8.7 UI State Management Changes

New stores are needed:

### BranchStore (`packages/app/src/context/branch.tsx`)

```typescript
interface BranchState {
  branches: Record<ConversationID, Array<BranchInfo>>
  activeBranchID: BranchID
  activeConversationID: ConversationID
  branchMessages: Record<BranchID, Array<BranchMessage>>
  merges: Record<BranchID, Array<MergeInfo>>
  graphLayout: BranchGraphLayout | null
}
```

### ConversationStore (`packages/app/src/context/conversation.tsx`)

```typescript
interface ConversationState {
  conversations: Record<ProjectID, Array<ConversationInfo>>
  activeConversationID: ConversationID | null
}
```

## 8.8 New UI Components — File Summary

| Component | File | Purpose |
|-----------|------|---------|
| BranchGraphView | `packages/app/src/components/branch-graph.tsx` | Visual DAG of branches |
| BranchInspector | `packages/app/src/components/branch-inspector.tsx` | Branch details panel |
| BranchTimeline | `packages/app/src/pages/session/branch-timeline.tsx` | Timeline scoped to branch |
| MergeAnnouncement | `packages/ui/src/components/merge-announcement.tsx` | Merge result display |
| BranchIndicator | `packages/ui/src/components/branch-indicator.tsx` | Current branch label |
| ForkButton | `packages/app/src/components/prompt-input/fork-button.tsx` | Manual fork trigger |
| BranchList | `packages/app/src/components/branch-list.tsx` | Sidebar branch list |
| MergeVisualization | `packages/app/src/components/merge-viz.tsx` | Animated merge flow |

---

# 9. Implementation Phases

## Phase 0: Foundation (Weeks 1-2)

**Goal**: Create the data model and persistence layer without changing any existing behavior.

1. **Define entities**: Branch, Conversation, Merge, Checkpoint, ContextSnapshot, ForkPlan schemas in `packages/core/src/`
2. **Create SQL tables**: New migration with all graph tables
3. **Implement ConversationGraph service**: CRUD + graph traversal
4. **Implement BranchManager service**: CRUD for branches
5. **Bootstrap existing sessions**: On startup, create `conversation` + root `branch` for each existing `session` row
6. **Write tests**: Verify graph traversal queries work correctly

**Files created:**
- `packages/core/src/conversation-graph/index.ts`
- `packages/core/src/branch/index.ts`
- `packages/core/src/conversation-graph/sql.ts`
- `packages/core/src/database/migration/001_conversation_graph.ts`

## Phase 1: Context Inheritance (Weeks 3-4)

**Goal**: Implement context inheritance without changing the agent loop.

1. **Implement ContextInheritanceEngine**
   - FULL_CONTEXT mode (simplest)
   - RELEVANT_CONTEXT mode (filter by purpose keywords)
   - MINIMAL_CONTEXT mode (summaries only)
2. **Create ContextSnapshot records** on inheritance
3. **Add checkpoint creation** at branch creation points
4. **Write tests**: Verify correct context is inherited for each mode

**Files created:**
- `packages/core/src/context-inheritance/index.ts`

## Phase 2: Autonomous Forking (Weeks 5-6)

**Goal**: The AI can autonomously decide to create forks during execution.

1. **Implement ForkPlanner service**
   - Create the fork-planning prompt
   - Integrate decision triggers
   - Implement `ForkBudgetManager`
2. **Modify the agent loop** in `prompt.ts`:
   - Add fork evaluation point after each step
   - `ForkPlanner.evaluate()` → if plan returned, execute it
3. **Implement the `fork` tool**
4. **Implement BranchExecutionRuntime**
   - Wire inherited context into the agent loop
   - Scope execution per branch
   - Handle concurrent branch execution
5. **Wire branch creation through the session API**

**Files created:**
- `packages/core/src/fork-planner/` (note: lives in core because it uses core types)
- `packages/opencode/src/fork-planner/` (opencode-specific: the AI prompt part)
- `packages/opencode/src/branch-runtime/`
- `packages/opencode/src/tool/fork.ts`
- `packages/opencode/src/tool/fork-budget.ts`

**Files modified:**
- `packages/opencode/src/session/prompt.ts` (add fork evaluation)
- `packages/opencode/src/tool/registry.ts` (register fork tool)

## Phase 3: Merge Engine (Weeks 7-8)

**Goal**: Branches can merge results back into parents.

1. **Implement MergeEngine service**
   - All 5 merge strategies
   - Conflict detection
   - Merge prompt orchestration
2. **Implement the `merge` tool**
3. **Create MergeAnnouncement message type** in `SessionMessage.Message`
4. **Update ConversationGraph** to record merge relationships
5. **Write tests**: Test all merge strategies with various inputs

**Files created:**
- `packages/core/src/merge/index.ts`
- `packages/opencode/src/tool/merge.ts`

**Files modified:**
- `packages/core/src/session/message.ts` (add MergeAnnouncement type)
- `packages/opencode/src/tool/registry.ts` (register merge tool)

## Phase 4: UI — Branch Views (Weeks 9-11)

**Goal**: Users can see and interact with branches.

1. **Create BranchGraphView component** (tree view first, then graph)
2. **Create BranchInspector component**
3. **Modify MessageTimeline** to be branch-aware
4. **Create BranchIndicator** in timeline header
5. **Update conversation list** in sidebar to show branch info
6. **Add ForkButton** to composer region
7. **Create MergeVisualization component**
8. **Implement BranchStore and ConversationStore** contexts
9. **Wire UI to backend** via the SDK

**Files created:**
- `packages/app/src/components/branch-graph.tsx`
- `packages/app/src/components/branch-inspector.tsx`
- `packages/app/src/pages/session/branch-timeline.tsx`
- `packages/app/src/context/branch.tsx`
- `packages/app/src/context/conversation.tsx`
- `packages/app/src/components/branch-list.tsx`
- `packages/app/src/components/merge-viz.tsx`
- `packages/app/src/components/prompt-input/fork-button.tsx`
- `packages/ui/src/components/merge-announcement.tsx`
- `packages/ui/src/components/branch-indicator.tsx`

## Phase 5: Polish and Optimization (Weeks 12-13)

**Goal**: Production hardening.

1. **Performance optimization**: Graph traversal caching, lazy branch loading
2. **Token budget enforcement**: Implement per-branch token limits
3. **Error recovery**: Handle branch crashes gracefully
4. **DAG consistency**: Validate no cycles on merge
5. **Concurrent branch execution**: Limit max concurrent branches
6. **Undo/redo for branches**: Allow archiving/restoring branches
7. **Keyboard shortcuts**: Branch navigation via keyboard
8. **Permissions**: Branch-aware permission system
9. **Tests for everything**

## Phase 6: Advanced Features (Weeks 14+)

**Goal**: Full ForkEncode vision.

1. **Simulation forks**: "What if I change X?" → creates test branch
2. **Automatic compression forks**: AI forks to compress context when needed
3. **Visual diff between branches**: Side-by-side branch comparison
4. **Branch templates**: Reusable fork patterns
5. **Merge preview**: Simulate a merge before executing it
6. **Branch search**: Full-text search across all branches in a conversation
7. **Replay branch**: Step through a branch's execution step by step
8. **Analytics**: Fork patterns, merge success rates, branch statistics

---

# 10. Risk Analysis and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Branch explosion | High | Medium | Strict budget enforcement, auto-archiving old branches |
| Context inheritance too large | High | Medium | RELEVANT_CONTEXT fallback, token accounting, compaction |
| Merge conflicts unresolvable | Medium | Medium | Contradiction merge strategy lets user decide |
| UI complexity overwhelms users | Medium | Medium | Progressive disclosure: branch view collapsed by default |
| Performance of graph queries | Low | Low | closure-table pattern for fast traversal |
| Migration from existing sessions breaks data | High | Low | Parallel tables, thorough test migrations |
| Concurrent branch execution races | Medium | Low | Effect's structured concurrency, isolated scopes |

---

# 11. Reuse vs. Replace Decision Matrix

| OpenCode Component | Decision | Rationale |
|-------------------|----------|-----------|
| Effect service system | **Reuse** | Excellent foundation for scoped, effectful services |
| Drizzle ORM + SQLite | **Reuse** | Add tables, don't replace |
| EventV2 pub/sub | **Reuse** | Perfect for branch lifecycle events |
| Agent definitions | **Reuse** | Add `fork` and `merge` to default agent's tools |
| Agent loop (runLoop) | **Modify** | Add fork evaluation points |
| Processor | **Reuse** | Stream/event handling is branch-agnostic |
| LLM service | **Reuse** | Branch runtime calls it unchanged |
| Tool system | **Reuse** | Add new tools, existing tools work unchanged |
| Tool registry | **Reuse** | Filter tools by branch context if needed |
| Session CRUD | **Reuse** | Add branch CRUD alongside; sessions become lightweight branch references |
| Message types | **Extend** | Add merge announcement type |
| Legacy MessageTable/PartTable | **Deprecate** | New code writes to branch_message |
| Permission system | **Reuse** | Branch-aware permission enforcement (no changes needed) |
| Plugin system | **Reuse** | Add branch lifecycle hooks |
| MCP system | **Reuse** | MCP tools work per-branch |
| Compaction | **Reuse** | Works per-branch naturally |
| Summary generation | **Reuse** | Works per-branch naturally |
| SolidJS UI framework | **Reuse** | Add new components |
| Message timeline | **Extend** | Make branch-aware, add branch header |
| Server sync context | **Extend** | Add branch/conversation states |
| SDK | **Extend** | Add branch and merge API endpoints |
| HTTP API | **Extend** | Add /conversations and /branches routes |
| Subagent task tool | **Retain** | Different purpose from fork tool |
| Background jobs | **Reuse** | Branch execution uses background job model |

---

# 12. Key Architectural Principles

1. **Branches are not subagents.** A branch is the *same* intelligence continuing along a different reasoning path. A subagent is a different agent with different capabilities.

2. **Context inheritance is explicitly recorded.** Every ContextSnapshot is a written record of what a branch knew when it started.

3. **Forks are reversible.** Any branch can be archived without data loss.

4. **The graph is append-only.** Once created, a BranchMessage is never deleted (only compacted like OpenCode today).

5. **Merge is not destructive.** Source branches continue to exist after a merge. The merge creates a new synthesis.

---

# 13. Backward Compatibility

All existing sessions work unchanged during and after the migration:

- Existing `SessionTable` rows are bootstrapped into `conversation` + root `branch` on first access.
- The root branch's `branch_message` table mirrors the session's messages (on-read migration).
- The API endpoints `GET /session/{id}` and `POST /session/{id}/fork` continue to work.
- New `/conversation/{id}` and `/branch/{id}` endpoints provide the graph interface.
- UI falls back to the linear view if no branches exist.
- Old SDK methods continue to function.

---

# 14. Conclusion

The ForkEncode transformation is achievable by:

1. **Adding** new entity types (Branch, Conversation, Merge, Checkpoint, ContextSnapshot, ForkPlan)
2. **Extending** the database with new tables and graph-traversal indexes
3. **Modifying** the agent loop to include fork evaluation and context inheritance
4. **Building** new services (ForkPlanner, MergeEngine, ContextInheritanceEngine, BranchExecutionRuntime)
5. **Creating** new UI components (BranchGraphView, BranchInspector, merge visualization)
6. **Adding** two new tools (fork, merge)
7. **Reusing** everything else (Effect stack, Drizzle ORM, tool system, LLM pipeline, event system, plugin system, UI framework, virtualized timeline)

The fundamental insight is that OpenCode already has most of what we need — it just organizes it linearly. Branching is a *view* over the same data, not a completely new system.

The migration is structured in 6 phases over approximately 13 weeks, with each phase being independently releasable. After Phase 1, ForkEncode already has functioning context inheritance. After Phase 3, it can autonomously fork and merge. After Phase 4, users can see and interact with the branch graph.

The key success metric: **the AI should be able to produce better solutions by exploring multiple paths in parallel than it could by exploring one path linearly.**
