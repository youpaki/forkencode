import { Context, Effect, Layer, Schema, DateTime } from "effect"
import { and, eq, desc, sql } from "drizzle-orm"
import { Database } from "../database/database"
import { V2Schema } from "../v2-schema"
import { Identifier } from "../util/identifier"
import { NonNegativeInt, withStatics } from "../schema"
import { ModelV2 } from "../model"
import { ProjectV2 } from "../project"
import {
  BranchMessageTable,
  BranchRelationshipTable,
  BranchTable,
  ConversationTable,
  MergeTable,
} from "./sql"

export * as Branch from "./branch"
export * as BranchManager from "./branch"
export * as Conversation from "./branch"
export * as Merge from "./branch"
export * as Checkpoint from "./branch"
export * as ForkPlan from "./branch"

export const BranchID = Schema.String.pipe(
  Schema.brand("BranchID"),
  withStatics((s) => ({
    descending: () => s.make("brn_" + Identifier.descending()),
  })),
)
export type BranchID = typeof BranchID.Type

export const ConversationID = Schema.String.pipe(
  Schema.brand("ConversationID"),
  withStatics((s) => ({
    descending: () => s.make("cnv_" + Identifier.descending()),
  })),
)
export type ConversationID = typeof ConversationID.Type

export const MergeID = Schema.String.pipe(
  Schema.brand("MergeID"),
  withStatics((s) => ({
    descending: () => s.make("mrg_" + Identifier.descending()),
  })),
)
export type MergeID = typeof MergeID.Type

export const CheckpointID = Schema.String.pipe(
  Schema.brand("CheckpointID"),
  withStatics((s) => ({
    descending: () => s.make("chk_" + Identifier.descending()),
  })),
)
export type CheckpointID = typeof CheckpointID.Type

export const ForkPlanID = CheckpointID
export type ForkPlanID = typeof ForkPlanID.Type

export const InheritanceMode = Schema.Literals(["full", "relevant", "minimal"])
export type InheritanceMode = typeof InheritanceMode.Type

export const BranchStatus = Schema.Literals(["running", "completed", "failed", "archived"])
export type BranchStatus = typeof BranchStatus.Type

export const MergeStrategy = Schema.Literals(["consensus", "weighted", "contradiction", "best_candidate", "hybrid"])
export type MergeStrategy = typeof MergeStrategy.Type

export const MergeStatus = Schema.Literals(["pending", "completed", "conflicted", "rejected"])
export type MergeStatus = typeof MergeStatus.Type

export const ForkPlanStatus = Schema.Literals(["planned", "executing", "completed", "abandoned"])
export type ForkPlanStatus = typeof ForkPlanStatus.Type

export class BranchInfo extends Schema.Class<BranchInfo>("Branch.Info")({
  id: BranchID,
  conversationID: ConversationID,
  parentID: BranchID.pipe(Schema.optional),
  purpose: Schema.String,
  forkType: Schema.String.pipe(Schema.optional),
  inheritanceMode: InheritanceMode,
  status: BranchStatus,
  summary: Schema.String.pipe(Schema.optional),
  confidence: Schema.Finite.pipe(Schema.optional),
  agent: Schema.String.pipe(Schema.optional),
  model: ModelV2.Ref.pipe(Schema.optional),
  tokenBudget: Schema.Finite.pipe(Schema.optional),
  depth: NonNegativeInt,
  time: Schema.Struct({
    created: V2Schema.DateTimeUtcFromMillis,
    updated: V2Schema.DateTimeUtcFromMillis,
    archived: V2Schema.DateTimeUtcFromMillis.pipe(Schema.optional),
  }),
}) {}

export class ConversationInfo extends Schema.Class<ConversationInfo>("Conversation.Info")({
  id: ConversationID,
  projectID: ProjectV2.ID,
  rootBranchID: BranchID,
  title: Schema.String,
  agent: Schema.String.pipe(Schema.optional),
  model: ModelV2.Ref.pipe(Schema.optional),
  metadata: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.optional),
  time: Schema.Struct({
    created: V2Schema.DateTimeUtcFromMillis,
    updated: V2Schema.DateTimeUtcFromMillis,
    archived: V2Schema.DateTimeUtcFromMillis.pipe(Schema.optional),
  }),
}) {}

export class MergeInfo extends Schema.Class<MergeInfo>("Merge.Info")({
  id: MergeID,
  targetBranchID: BranchID,
  sourceBranchIDs: Schema.Array(BranchID),
  strategy: MergeStrategy,
  explanation: Schema.String,
  resolution: Schema.String,
  confidence: Schema.Finite,
  status: MergeStatus,
  time: Schema.Struct({
    created: V2Schema.DateTimeUtcFromMillis,
    completed: V2Schema.DateTimeUtcFromMillis.pipe(Schema.optional),
  }),
}) {}

export class CheckpointInfo extends Schema.Class<CheckpointInfo>("Checkpoint.Info")({
  id: CheckpointID,
  branchID: BranchID,
  messageID: Schema.String,
  snapshot: Schema.String,
  summary: Schema.String,
  time: V2Schema.DateTimeUtcFromMillis,
}) {}

export class ContextSnapshotInfo extends Schema.Class<ContextSnapshotInfo>("ContextSnapshot.Info")({
  id: CheckpointID,
  branchID: BranchID,
  sourceBranchID: BranchID,
  inheritanceMode: InheritanceMode,
  includedMessageCount: NonNegativeInt,
  totalTokenEstimate: NonNegativeInt,
  summary: Schema.String,
  time: V2Schema.DateTimeUtcFromMillis,
}) {}

export class ForkPlanInfo extends Schema.Class<ForkPlanInfo>("ForkPlan.Info")({
  id: ForkPlanID,
  conversationID: ConversationID,
  sourceBranchID: BranchID,
  plannedForks: Schema.Array(
    Schema.Struct({
      purpose: Schema.String,
      forkType: Schema.String.pipe(Schema.optional),
      inheritanceMode: InheritanceMode,
      agent: Schema.String.pipe(Schema.optional),
    }),
  ),
  rationale: Schema.String,
  status: ForkPlanStatus,
  time: V2Schema.DateTimeUtcFromMillis,
}) {}

export class BranchMessage extends Schema.Class<BranchMessage>("Branch.Message")({
  id: Schema.String,
  branchID: BranchID,
  type: Schema.String,
  data: Schema.Record(Schema.String, Schema.Unknown),
  timeCreated: V2Schema.DateTimeUtcFromMillis,
}) {}

export interface Interface {
  readonly createConversation: (input: {
    projectID: string
    title: string
    agent?: string
    model?: ModelV2.Ref
  }) => Effect.Effect<ConversationInfo>

  readonly getConversation: (id: ConversationID) => Effect.Effect<ConversationInfo>

  readonly listConversations: (
    projectID: string,
    options?: { includeArchived?: boolean },
  ) => Effect.Effect<ConversationInfo[]>

  readonly archiveConversation: (id: ConversationID) => Effect.Effect<void>

  readonly createBranch: (input: {
    conversationID: ConversationID
    parentID: BranchID
    purpose: string
    forkType?: string
    inheritanceMode: InheritanceMode
    agent?: string
    model?: ModelV2.Ref
    tokenBudget?: number
  }) => Effect.Effect<BranchInfo>

  readonly getBranch: (id: BranchID) => Effect.Effect<BranchInfo>

  readonly getBranches: (conversationID: ConversationID) => Effect.Effect<BranchInfo[]>

  readonly setBranchStatus: (id: BranchID, status: BranchStatus) => Effect.Effect<void>

  readonly setBranchSummary: (id: BranchID, summary: string) => Effect.Effect<void>

  readonly archiveBranch: (id: BranchID) => Effect.Effect<void>

  readonly addMessage: (message: BranchMessage) => Effect.Effect<void>

  readonly getMessages: (
    branchID: BranchID,
    options?: { limit?: number },
  ) => Effect.Effect<BranchMessage[]>

  readonly getAncestors: (branchID: BranchID) => Effect.Effect<BranchInfo[]>

  readonly getDescendants: (branchID: BranchID) => Effect.Effect<BranchInfo[]>

  readonly getSiblings: (branchID: BranchID) => Effect.Effect<BranchInfo[]>

  readonly addMerge: (merge: MergeInfo) => Effect.Effect<void>

  readonly getMergesForBranch: (branchID: BranchID) => Effect.Effect<MergeInfo[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/BranchManager") {}

function branchRowToInfo(row: typeof BranchTable.$inferSelect): BranchInfo {
  return new BranchInfo({
    id: row.id,
    conversationID: row.conversation_id as ConversationID,
    parentID: row.parent_id ?? undefined,
    purpose: row.purpose,
    forkType: row.fork_type ?? undefined,
    inheritanceMode: row.inheritance_mode as InheritanceMode,
    status: row.status as BranchStatus,
    summary: row.summary ?? undefined,
    confidence: row.confidence ?? undefined,
    agent: row.agent ?? undefined,
    model: (row.model as ModelV2.Ref) ?? undefined,
    tokenBudget: row.token_budget ?? undefined,
    depth: row.depth,
    time: {
      created: DateTime.makeUnsafe(row.time_created),
      updated: DateTime.makeUnsafe(row.time_updated),
      archived: row.time_archived != null ? DateTime.makeUnsafe(row.time_archived) : undefined,
    },
  })
}

function conversationRowToInfo(row: typeof ConversationTable.$inferSelect): ConversationInfo {
  return new ConversationInfo({
    id: row.id,
    projectID: row.project_id as ProjectV2.ID,
    rootBranchID: row.root_branch_id as BranchID,
    title: row.title,
    agent: row.agent ?? undefined,
    model: (row.model as ModelV2.Ref) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    time: {
      created: DateTime.makeUnsafe(row.time_created),
      updated: DateTime.makeUnsafe(row.time_updated),
      archived: row.time_archived != null ? DateTime.makeUnsafe(row.time_archived) : undefined,
    },
  })
}

const now = () => Date.now()

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = yield* Database.Service

    const svc: Interface = {
      createConversation: Effect.fn("BranchManager.createConversation")(function* (input) {
        const id = ConversationID.descending()
        const rootBranchID = BranchID.descending()
        const time = now()

        yield* db.db.insert(ConversationTable).values({
          id: id,
          project_id: input.projectID as string,
          root_branch_id: rootBranchID as BranchID,
          title: input.title,
          agent: input.agent ?? null,
          model: input.model ?? null,
          metadata: null,
          time_created: time,
          time_updated: time,
          time_archived: null,
        }).run().pipe(Effect.orDie)

        yield* db.db.insert(BranchTable).values({
          id: rootBranchID,
          conversation_id: id,
          parent_id: null,
          purpose: "Root conversation",
          fork_type: null,
          inheritance_mode: "full",
          status: "running",
          summary: null,
          confidence: null,
          agent: input.agent ?? null,
          model: input.model ?? null,
          token_budget: null,
          depth: 0,
          time_created: time,
          time_updated: time,
          time_archived: null,
        }).run().pipe(Effect.orDie)

        return new ConversationInfo({
          id: id,
          projectID: input.projectID as ProjectV2.ID,
          rootBranchID: rootBranchID,
          title: input.title,
          agent: input.agent,
          model: input.model,
          metadata: undefined,
          time: { created: DateTime.makeUnsafe(time), updated: DateTime.makeUnsafe(time), archived: undefined },
        })
      }),

      getConversation: Effect.fn("BranchManager.getConversation")(function* (id) {
        const row = yield* db.db
          .select()
          .from(ConversationTable)
          .where(eq(ConversationTable.id, id))
          .get()
          .pipe(Effect.orDie)
        return conversationRowToInfo(row!)
      }),

      listConversations: Effect.fn("BranchManager.listConversations")(function* (projectID, options) {
        const rows = yield* db.db
          .select()
          .from(ConversationTable)
          .where(
            options?.includeArchived
              ? eq(ConversationTable.project_id, projectID)
              : and(eq(ConversationTable.project_id, projectID), sql`${ConversationTable.time_archived} IS NULL`),
          )
          .orderBy(desc(ConversationTable.time_updated))
          .all()
          .pipe(Effect.orDie)
        return rows.map(conversationRowToInfo)
      }),

      archiveConversation: Effect.fn("BranchManager.archiveConversation")(function* (id) {
        const time = now()
        yield* db.db
          .update(ConversationTable)
          .set({ time_archived: time, time_updated: time })
          .where(eq(ConversationTable.id, id))
          .run()
          .pipe(Effect.orDie)
      }),

      createBranch: Effect.fn("BranchManager.createBranch")(function* (input) {
        const parent = yield* svc.getBranch(input.parentID)
        const id = BranchID.descending()
        const time = now()
        const depth = parent.depth + 1

        yield* db.db.insert(BranchTable).values({
          id: id,
          conversation_id: input.conversationID,
          parent_id: input.parentID,
          purpose: input.purpose,
          fork_type: input.forkType ?? null,
          inheritance_mode: input.inheritanceMode,
          status: "running",
          summary: null,
          confidence: null,
          agent: input.agent ?? null,
          model: input.model ?? null,
          token_budget: input.tokenBudget ?? null,
          depth: depth,
          time_created: time,
          time_updated: time,
          time_archived: null,
        }).run().pipe(Effect.orDie)

        yield* db.db.insert(BranchRelationshipTable).values({
          ancestor_id: input.parentID,
          descendant_id: id,
          depth: 1,
        }).run().pipe(Effect.orDie)

        const ancestorRows = yield* db.db
          .select()
          .from(BranchRelationshipTable)
          .where(eq(BranchRelationshipTable.descendant_id, input.parentID))
          .all()
          .pipe(Effect.orDie)

        if (ancestorRows.length > 0) {
          yield* db.db.insert(BranchRelationshipTable).values(
            ancestorRows.map((r) => ({
              ancestor_id: r.ancestor_id,
              descendant_id: id,
              depth: r.depth + 1,
            })),
          ).run().pipe(Effect.orDie)
        }

        return new BranchInfo({
          id: id,
          conversationID: input.conversationID,
          parentID: input.parentID,
          purpose: input.purpose,
          forkType: input.forkType,
          inheritanceMode: input.inheritanceMode,
          status: "running",
          summary: undefined,
          confidence: undefined,
          agent: input.agent,
          model: input.model,
          tokenBudget: input.tokenBudget,
          depth: depth,
          time: { created: DateTime.makeUnsafe(time), updated: DateTime.makeUnsafe(time), archived: undefined },
        })
      }),

      getBranch: Effect.fn("BranchManager.getBranch")(function* (id) {
        const row = yield* db.db
          .select()
          .from(BranchTable)
          .where(eq(BranchTable.id, id))
          .get()
          .pipe(Effect.orDie)
        return branchRowToInfo(row!)
      }),

      getBranches: Effect.fn("BranchManager.getBranches")(function* (conversationID) {
        const rows = yield* db.db
          .select()
          .from(BranchTable)
          .where(eq(BranchTable.conversation_id, conversationID))
          .orderBy(BranchTable.depth, desc(BranchTable.time_created))
          .all()
          .pipe(Effect.orDie)
        return rows.map(branchRowToInfo)
      }),

      setBranchStatus: Effect.fn("BranchManager.setBranchStatus")(function* (id, status) {
        yield* db.db
          .update(BranchTable)
          .set({
            status: status as typeof BranchTable.$inferInsert.status,
            time_updated: now(),
          })
          .where(eq(BranchTable.id, id))
          .run()
          .pipe(Effect.orDie)
      }),

      setBranchSummary: Effect.fn("BranchManager.setBranchSummary")(function* (id, summary) {
        yield* db.db
          .update(BranchTable)
          .set({ summary, time_updated: now() })
          .where(eq(BranchTable.id, id))
          .run()
          .pipe(Effect.orDie)
      }),

      archiveBranch: Effect.fn("BranchManager.archiveBranch")(function* (id) {
        const time = now()
        yield* db.db
          .update(BranchTable)
          .set({ status: "archived", time_updated: time, time_archived: time })
          .where(eq(BranchTable.id, id))
          .run()
          .pipe(Effect.orDie)
      }),

      addMessage: Effect.fn("BranchManager.addMessage")(function* (message) {
        yield* db.db.insert(BranchMessageTable).values({
          id: message.id,
          branch_id: message.branchID as BranchID,
          type: message.type,
          data: message.data as Record<string, unknown>,
          time_created: DateTime.toEpochMillis(message.timeCreated),
        }).run().pipe(Effect.orDie)
      }),

      getMessages: Effect.fn("BranchManager.getMessages")(function* (branchID, options) {
        const baseQuery = db.db
          .select()
          .from(BranchMessageTable)
          .where(eq(BranchMessageTable.branch_id, branchID))
          .orderBy(BranchMessageTable.time_created)

        const rows = yield* (options?.limit != null
          ? baseQuery.limit(options.limit).all()
          : baseQuery.all()
        ).pipe(Effect.orDie)
        return rows.map(
          (row) =>
            new BranchMessage({
              id: row.id,
              branchID: row.branch_id as BranchID,
              type: row.type,
              data: row.data as Record<string, unknown>,
              timeCreated: DateTime.makeUnsafe(row.time_created),
            }),
        )
      }),

      getAncestors: Effect.fn("BranchManager.getAncestors")(function* (branchID) {
        const rows = yield* db.db
          .select()
          .from(BranchTable)
          .innerJoin(BranchRelationshipTable, eq(BranchTable.id, BranchRelationshipTable.ancestor_id))
          .where(eq(BranchRelationshipTable.descendant_id, branchID))
          .orderBy(desc(BranchRelationshipTable.depth))
          .all()
          .pipe(Effect.orDie)
        return rows.map(({ branch }) => branchRowToInfo(branch))
      }),

      getDescendants: Effect.fn("BranchManager.getDescendants")(function* (branchID) {
        const rows = yield* db.db
          .select()
          .from(BranchTable)
          .innerJoin(BranchRelationshipTable, eq(BranchTable.id, BranchRelationshipTable.descendant_id))
          .where(eq(BranchRelationshipTable.ancestor_id, branchID))
          .orderBy(BranchRelationshipTable.depth)
          .all()
          .pipe(Effect.orDie)
        return rows.map(({ branch }) => branchRowToInfo(branch))
      }),

      getSiblings: Effect.fn("BranchManager.getSiblings")(function* (branchID) {
        const branch = yield* svc.getBranch(branchID)
        if (!branch.parentID) return []
        const rows = yield* db.db
          .select()
          .from(BranchTable)
          .where(
            and(eq(BranchTable.parent_id, branch.parentID), sql`${BranchTable.id} != ${branchID}`),
          )
          .all()
          .pipe(Effect.orDie)
        return rows.map(branchRowToInfo)
      }),

      addMerge: Effect.fn("BranchManager.addMerge")(function* (merge) {
        const time = now()
        yield* db.db.insert(MergeTable).values({
          id: merge.id as string,
          target_branch_id: merge.targetBranchID,
          source_branch_ids: merge.sourceBranchIDs as unknown as string[],
          strategy: merge.strategy,
          explanation: merge.explanation,
          resolution: merge.resolution,
          confidence: merge.confidence,
          status: merge.status,
          time_created: time,
          time_completed: merge.time.completed != null ? DateTime.toEpochMillis(merge.time.completed) : null,
        } as typeof MergeTable.$inferInsert).run().pipe(Effect.orDie)

        for (const sourceID of merge.sourceBranchIDs) {
          const relRows = yield* db.db
            .select()
            .from(BranchRelationshipTable)
            .where(eq(BranchRelationshipTable.descendant_id, sourceID))
            .all()
            .pipe(Effect.orDie)

          if (relRows.length > 0) {
            yield* db.db.insert(BranchRelationshipTable).values(
              relRows.map((r) => ({
                ancestor_id: r.ancestor_id,
                descendant_id: merge.targetBranchID,
                depth: r.depth + 1,
              })),
            ).run().pipe(Effect.orDie)
          }

          yield* db.db.insert(BranchRelationshipTable).values({
            ancestor_id: sourceID,
            descendant_id: merge.targetBranchID,
            depth: 1,
          }).run().pipe(Effect.orDie)
        }
      }),

      getMergesForBranch: Effect.fn("BranchManager.getMergesForBranch")(function* (branchID) {
        const rows = yield* db.db
          .select()
          .from(MergeTable)
          .where(eq(MergeTable.target_branch_id, branchID))
          .orderBy(desc(MergeTable.time_created))
          .all()
          .pipe(Effect.orDie)
        return rows.map(
          (row) =>
            new MergeInfo({
              id: row.id as MergeID,
              targetBranchID: row.target_branch_id,
              sourceBranchIDs: row.source_branch_ids as BranchID[],
              strategy: row.strategy as MergeStrategy,
              explanation: row.explanation,
              resolution: row.resolution,
              confidence: row.confidence,
              status: row.status as MergeStatus,
              time: {
                created: DateTime.makeUnsafe(row.time_created),
                completed: row.time_completed != null ? DateTime.makeUnsafe(row.time_completed) : undefined,
              },
            }),
        )
      }),
    }

    return svc
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
