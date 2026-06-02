import * as Tool from "./tool"
import { DateTime, Effect, Option, Schema } from "effect"
import { BranchManager, BranchID, MergeID, MergeInfo } from "@forkencode/core/branch/branch"
import { Session } from "@/session/session"

const id = "merge"

const DESCRIPTION = [
  "Merge one or more parallel reasoning branches back into the current conversation, synthesizing their findings.",
  "",
  "Use this after forks have completed their exploration. The merge records:",
  "- Which branches were merged",
  "- The strategy used (consensus, weighted, contradiction, best_candidate, hybrid)",
  "- An explanation of what each branch discovered",
  "- A synthesized resolution that combines the findings",
  "",
  "Strategies:",
  "- consensus: Branches agree → output the agreement",
  "- weighted: Higher-confidence branches get more weight",
  "- contradiction: Preserve all viewpoints, flag unresolvable differences",
  "- best_candidate: Pick the highest-confidence branch result",
  "- hybrid: Use consensus where possible, fall back to best candidate",
  "",
  "After merging, the synthesized result becomes available in the parent branch.",
  "The source branches continue to exist for future reference.",
].join("\n")

export const Parameters = Schema.Struct({
  sourceBranchIDs: Schema.Array(Schema.String).annotate({
    description: "IDs of the branches to merge into the current conversation",
  }),
  strategy: Schema.Literals(["consensus", "weighted", "contradiction", "best_candidate", "hybrid"]).annotate({
    description: "How to resolve the merge",
  }),
  explanation: Schema.String.annotate({
    description: "What each branch discovered and why this merge decision was made",
  }),
  resolution: Schema.String.annotate({
    description: "The synthesized result combining the branches' findings",
  }),
  confidence: Schema.Number.annotate({
    description: "Confidence in this merge (0.0-1.0)",
  }),
})

export const MergeTool = Tool.define(
  id,
  Effect.gen(function* () {
    const branchManagerOpt = yield* Effect.serviceOption(BranchManager.Service)
    const sessions = yield* Session.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute(params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) {
        return Effect.gen(function* () {
          yield* ctx.ask({
            permission: id,
            patterns: params.sourceBranchIDs,
            always: ["*"],
            metadata: {
              description: `Merge ${params.sourceBranchIDs.length} branches via ${params.strategy}`,
            },
          })

          const branchManager = Option.getOrThrow(branchManagerOpt)

          const session = yield* sessions.get(ctx.sessionID).pipe(Effect.orDie)
          const convKey = "forkencode.conversationID"
          const branchKey = "forkencode.branchID"
          const metadata = (session.metadata ?? {}) as Record<string, unknown>

          const conversationID = metadata[convKey] as string | undefined
          const currentBranchID = metadata[branchKey] as string | undefined

          if (!conversationID || !currentBranchID) {
            return {
              title: "Merge failed",
              metadata: {
                mergeID: null as unknown as MergeID,
                targetBranchID: null as unknown as BranchID,
                sourceBranchIDs: [] as BranchID[],
              },
              output: "No active conversation found. Create a fork first before merging.",
            } satisfies Tool.ExecuteResult
          }

          const sourceIDs = params.sourceBranchIDs as BranchID[]
          const targetBranch = yield* branchManager.getBranch(currentBranchID as BranchID)
          const now = DateTime.makeUnsafe(Date.now())

          const merge = new MergeInfo({
            id: MergeID.descending(),
            targetBranchID: targetBranch.id,
            sourceBranchIDs: sourceIDs,
            strategy: params.strategy,
            explanation: params.explanation,
            resolution: params.resolution,
            confidence: params.confidence,
            status: "completed",
            time: { created: now, completed: now },
          } as never)

          yield* branchManager.addMerge(merge)

          const sourceBranches = yield* Effect.all(
            sourceIDs.map((sid) => branchManager.getBranch(sid)),
          )
          const sourceSummaries = (sourceBranches as Array<{ purpose: string; summary?: string }>)
            .map((b) => `- ${b.purpose}: ${b.summary ?? "no summary"}`)
            .join("\n")

          const output = [
            `<merge id="${merge.id}">`,
            `<strategy>${params.strategy}</strategy>`,
            `<sources>`,
            sourceSummaries,
            `</sources>`,
            `<resolution>${params.resolution}</resolution>`,
            `<confidence>${params.confidence}</confidence>`,
            `</merge>`,
          ].join("\n")

          return {
            title: `Merged ${sourceIDs.length} branches (${params.strategy})`,
            metadata: {
              mergeID: merge.id,
              targetBranchID: targetBranch.id,
              sourceBranchIDs: sourceIDs,
            },
            output,
          } satisfies Tool.ExecuteResult
        })
      },
    }
  }),
)
