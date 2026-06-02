import * as Tool from "./tool"
import { Effect, Option, Schema } from "effect"
import { BranchManager, BranchID, ConversationID, type InheritanceMode } from "@forkencode/core/branch/branch"
import { ContextInheritanceEngine } from "@forkencode/core/context-inheritance/context-inheritance"
import { Session } from "@/session/session"

const id = "fork"

const DESCRIPTION = [
  "Create a parallel reasoning branch to explore an alternative approach, investigate independently, or critique the current solution.",
  "The branch inherits context from the current conversation point and can later be merged back.",
  "",
  "Use this when:",
  "- You want to explore multiple implementation approaches",
  "- You need to research something before committing to a direction",
  "- You want to critique or verify the current solution from a different angle",
  "- The task has multiple sub-problems that can be explored independently",
  "",
  "Each fork creates a separate branch that records its purpose and what context it inherited.",
  "After forks complete their reasoning, use the merge tool to synthesize findings back.",
].join("\n")

export const Parameters = Schema.Struct({
  purpose: Schema.String.annotate({
    description: "What this branch should investigate or accomplish",
  }),
  forkType: Schema.optional(Schema.String).annotate({
    description: "Optional type tag: research, critique, alternative, implementation, debug, etc.",
  }),
  inheritanceMode: Schema.optional(Schema.Literals(["full", "relevant", "minimal"])).annotate({
    description: "How much context to inherit from ancestors (default: relevant)",
  }),
})

export const ForkTool = Tool.define(
  id,
  Effect.gen(function* () {
    const branchManagerOpt = yield* Effect.serviceOption(BranchManager.Service)
    const contextEngineOpt = yield* Effect.serviceOption(ContextInheritanceEngine.Service)
    const sessions = yield* Session.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute(params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) {
        return Effect.gen(function* () {
          if (Option.isNone(branchManagerOpt) || Option.isNone(contextEngineOpt)) {
            return {
              title: "Fork unavailable",
              metadata: {
                branchID: "unavailable" as BranchID,
                conversationID: "unavailable" as ConversationID,
              },
              output: "Forking is not available — the conversation graph services are not loaded. Ensure BranchManager and ContextInheritanceEngine are provided in the application layer.",
            } satisfies Tool.ExecuteResult
          }
          const branchManager = branchManagerOpt.value
          const contextEngine = contextEngineOpt.value

          yield* ctx.ask({
            permission: id,
            patterns: [params.purpose],
            always: ["*"],
            metadata: {
              description: `Create fork: ${params.purpose}`,
              forkType: params.forkType ?? "general",
            },
          })

          const session = yield* sessions.get(ctx.sessionID).pipe(Effect.orDie)
          const convKey = "forkencode.conversationID"
          const branchKey = "forkencode.branchID"
          const metadata = (session.metadata ?? {}) as Record<string, unknown>

          const existingConvID = metadata[convKey] as string | undefined
          const existingBranchID = metadata[branchKey] as string | undefined

          const activeConversationID: ConversationID = yield* Effect.gen(function* () {
            if (existingConvID && existingBranchID) return existingConvID as ConversationID

            const conv = yield* branchManager.createConversation({
              projectID: session.projectID as string,
              title: session.title,
              agent: session.agent ?? undefined,
              model: session.model as unknown as undefined,
            })

            yield* sessions.setMetadata({
              sessionID: ctx.sessionID,
              metadata: {
                ...metadata,
                [convKey]: conv.id,
                [branchKey]: conv.rootBranchID,
              },
            })

            return conv.id
          })

          const parentID = (existingBranchID as BranchID) ??
            (yield* branchManager.getConversation(activeConversationID)).rootBranchID

          const branch = yield* branchManager.createBranch({
            conversationID: activeConversationID,
            parentID,
            purpose: params.purpose,
            forkType: params.forkType ?? "general",
            inheritanceMode: params.inheritanceMode ?? "relevant",
            agent: ctx.agent,
          })

          const inherited = yield* contextEngine.inherit(branch.id, params.inheritanceMode ?? "relevant")

          const output = [
            `<fork id="${branch.id}">`,
            `<purpose>${branch.purpose}</purpose>`,
            `<inheritance>${branch.inheritanceMode} — ${inherited.tokenEstimate} est. tokens from ${inherited.messages.length} messages</inheritance>`,
            `<status>created</status>`,
            `</fork>`,
          ].join("\n")

          return {
            title: `Fork: ${params.purpose}`,
            metadata: {
              branchID: branch.id,
              conversationID: activeConversationID,
            },
            output,
          } satisfies Tool.ExecuteResult
        })
      },
    }
  }),
)
