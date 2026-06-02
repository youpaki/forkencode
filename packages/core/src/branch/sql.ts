import { sqliteTable, text, integer, index, primaryKey, real } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../database/schema.sql"
import { ProjectTable } from "../project/sql"
import type { BranchID, ConversationID, MergeID, CheckpointID, ForkPlanID } from "./branch"

export const ConversationTable = sqliteTable(
  "conversation",
  {
    id: text().$type<ConversationID>().primaryKey(),
    project_id: text()
      .$type<string>()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    root_branch_id: text().$type<BranchID>().notNull(),
    title: text().notNull(),
    agent: text(),
    model: text({ mode: "json" }),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    ...Timestamps,
    time_archived: integer(),
  },
  (table) => [
    index("conv_project_idx").on(table.project_id),
    index("conv_root_branch_idx").on(table.root_branch_id),
  ],
)

export const BranchTable = sqliteTable(
  "branch",
  {
    id: text().$type<BranchID>().primaryKey(),
    conversation_id: text()
      .$type<ConversationID>()
      .notNull()
      .references(() => ConversationTable.id, { onDelete: "cascade" }),
    parent_id: text().$type<BranchID>(),
    purpose: text().notNull(),
    fork_type: text(),
    inheritance_mode: text().notNull().default("full"),
    status: text().notNull().default("running"),
    summary: text(),
    confidence: real(),
    agent: text(),
    model: text({ mode: "json" }),
    token_budget: integer(),
    depth: integer().notNull().default(0),
    ...Timestamps,
    time_archived: integer(),
  },
  (table) => [
    index("branch_conversation_idx").on(table.conversation_id),
    index("branch_parent_idx").on(table.parent_id),
    index("branch_depth_conversation_idx").on(table.conversation_id, table.depth),
  ],
)

export const BranchRelationshipTable = sqliteTable(
  "branch_relationship",
  {
    ancestor_id: text()
      .$type<BranchID>()
      .notNull()
      .references(() => BranchTable.id, { onDelete: "cascade" }),
    descendant_id: text()
      .$type<BranchID>()
      .notNull()
      .references(() => BranchTable.id, { onDelete: "cascade" }),
    depth: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ancestor_id, table.descendant_id] }),
    index("br_descendant_idx").on(table.descendant_id),
  ],
)

export const MergeTable = sqliteTable(
  "merge",
  {
    id: text().primaryKey(),
    target_branch_id: text()
      .$type<BranchID>()
      .notNull()
      .references(() => BranchTable.id, { onDelete: "cascade" }),
    source_branch_ids: text({ mode: "json" }).$type<BranchID[]>().notNull(),
    strategy: text().notNull(),
    explanation: text().notNull(),
    resolution: text().notNull(),
    confidence: real().notNull(),
    status: text().notNull().default("pending"),
    time_created: integer().notNull(),
    time_completed: integer(),
  },
  (table) => [index("merge_target_idx").on(table.target_branch_id)],
)

export const CheckpointTable = sqliteTable(
  "checkpoint",
  {
    id: text().$type<CheckpointID>().primaryKey(),
    branch_id: text()
      .$type<BranchID>()
      .notNull()
      .references(() => BranchTable.id, { onDelete: "cascade" }),
    message_id: text().notNull(),
    snapshot: text().notNull(),
    summary: text().notNull(),
    time: integer().notNull(),
  },
  (table) => [index("checkpoint_branch_idx").on(table.branch_id)],
)

export const ContextSnapshotTable = sqliteTable(
  "context_snapshot",
  {
    id: text().$type<CheckpointID>().primaryKey(),
    branch_id: text()
      .$type<BranchID>()
      .notNull()
      .references(() => BranchTable.id, { onDelete: "cascade" }),
    source_branch_id: text()
      .$type<BranchID>()
      .notNull()
      .references(() => BranchTable.id, { onDelete: "cascade" }),
    inheritance_mode: text().notNull(),
    included_message_count: integer().notNull(),
    total_token_estimate: integer().notNull(),
    summary: text().notNull(),
    time: integer().notNull(),
  },
  (table) => [index("cs_branch_idx").on(table.branch_id)],
)

export const BranchMessageTable = sqliteTable(
  "branch_message",
  {
    id: text().primaryKey(),
    branch_id: text()
      .$type<BranchID>()
      .notNull()
      .references(() => BranchTable.id, { onDelete: "cascade" }),
    type: text().notNull(),
    data: text({ mode: "json" }).notNull(),
    time_created: integer().notNull(),
  },
  (table) => [
    index("bmsg_branch_idx").on(table.branch_id),
    index("bmsg_time_idx").on(table.time_created),
  ],
)

export const ForkPlanTable = sqliteTable(
  "fork_plan",
  {
    id: text().$type<ForkPlanID>().primaryKey(),
    conversation_id: text()
      .$type<ConversationID>()
      .notNull()
      .references(() => ConversationTable.id, { onDelete: "cascade" }),
    source_branch_id: text()
      .$type<BranchID>()
      .notNull()
      .references(() => BranchTable.id, { onDelete: "cascade" }),
    planned_forks: text({ mode: "json" }).notNull(),
    rationale: text().notNull(),
    status: text().notNull().default("planned"),
    time: integer().notNull(),
  },
  (table) => [index("fp_conversation_idx").on(table.conversation_id)],
)
