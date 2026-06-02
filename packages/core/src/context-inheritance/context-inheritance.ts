export * as ContextInheritanceEngine from "./context-inheritance"

import { Context, Effect, Layer, Schema } from "effect"
import { Database } from "../database/database"
import {
  BranchManager,
  BranchMessage,
  CheckpointID,
  InheritanceMode,
  type BranchID,
} from "../branch/branch"
import { CheckpointTable, ContextSnapshotTable } from "../branch/sql"
import { NonNegativeInt } from "../schema"

export interface InheritedContext {
  readonly messages: readonly BranchMessage[]
  readonly tokenEstimate: number
  readonly summary: string
  readonly contextSnapshotID: CheckpointID
}

export class InheritedContextClass extends Schema.Class<InheritedContextClass>("InheritedContext")({
  messages: Schema.Array(BranchMessage),
  tokenEstimate: NonNegativeInt,
  summary: Schema.String,
  contextSnapshotID: CheckpointID,
}) {}

export interface Interface {
  readonly inherit: (branchID: BranchID, mode: InheritanceMode) => Effect.Effect<InheritedContext>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ContextInheritanceEngine") {}

const TOKEN_ESTIMATE_PER_CHAR = 0.25

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKEN_ESTIMATE_PER_CHAR)
}

function buildMessageSummary(messages: readonly BranchMessage[]): string {
  if (messages.length === 0) return "No messages"
  const types = new Map<string, number>()
  let totalText = 0
  for (const msg of messages) {
    types.set(msg.type, (types.get(msg.type) ?? 0) + 1)
    if (msg.data && typeof msg.data === "object" && "text" in msg.data) {
      totalText += String(msg.data.text).length
    }
  }
  return `${messages.length} messages (${[...types.entries()].map(([k, v]) => `${v} ${k}`).join(", ")}), ~${estimateTokens(String(totalText))} est. tokens`
}

function messageRelevantTo(message: BranchMessage, purpose: string): boolean {
  const keywords = purpose.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (keywords.length === 0) return true
  const dataStr = JSON.stringify(message.data).toLowerCase()
  const typeStr = message.type.toLowerCase()
  return keywords.some((kw) => dataStr.includes(kw) || typeStr.includes(kw))
}

const nowMs = () => Date.now()

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = yield* Database.Service
    const branchManager = yield* BranchManager.Service

    return Service.of({
      inherit: Effect.fn("ContextInheritanceEngine.inherit")(function* (branchID, mode) {
        const branch = yield* branchManager.getBranch(branchID)
        const ancestors = yield* branchManager.getAncestors(branchID)
        const sourceBranchID = ancestors.length > 0 ? ancestors[0].id : branchID

        const allBranches = [branch, ...ancestors]
        const messageGroups = (yield* Effect.all(
          allBranches.map((b) => branchManager.getMessages(b.id)),
        )) as BranchMessage[][]

        let includedMessages: readonly BranchMessage[]

        switch (mode) {
          case "full": {
            includedMessages = messageGroups.flat()
            break
          }
          case "relevant": {
            includedMessages = messageGroups.flat().filter((msg) => messageRelevantTo(msg, branch.purpose))
            break
          }
          case "minimal": {
            const summaries: BranchMessage[] = allBranches
              .filter((b) => b.summary)
              .map(
                (b) =>
                  new BranchMessage({
                    id: `summary-${b.id}`,
                    branchID: b.id,
                    type: "summary",
                    data: { text: b.summary! },
                    timeCreated: b.time.updated,
                  }),
              )
            const recent = messageGroups.flat().filter((m) => m.type === "user").slice(-5)
            includedMessages = [...recent, ...summaries]
            break
          }
        }

        const tokenEstimate = includedMessages.reduce(
          (sum, m) => sum + estimateTokens(JSON.stringify(m.data)),
          0,
        )

        const summary = buildMessageSummary(includedMessages)
        const snapshotID = CheckpointID.descending()
        const time = nowMs()

        yield* db.db.insert(ContextSnapshotTable).values({
          id: snapshotID,
          branch_id: branchID,
          source_branch_id: sourceBranchID,
          inheritance_mode: mode,
          included_message_count: includedMessages.length,
          total_token_estimate: tokenEstimate,
          summary,
          time,
        }).run().pipe(Effect.orDie)

        yield* db.db.insert(CheckpointTable).values({
          id: snapshotID,
          branch_id: branchID,
          message_id: includedMessages[0]?.id ?? "none",
          snapshot: JSON.stringify({ mode, messageCount: includedMessages.length, tokenEstimate }),
          summary,
          time,
        }).run().pipe(Effect.orDie)

        return new InheritedContextClass({
          messages: includedMessages,
          tokenEstimate,
          summary,
          contextSnapshotID: snapshotID,
        })
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(BranchManager.defaultLayer), Layer.provide(Database.defaultLayer))
