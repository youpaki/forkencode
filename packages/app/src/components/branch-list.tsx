import { For, Show, createMemo, type ComponentProps, splitProps } from "solid-js"

export interface BranchItem {
  id: string
  purpose: string
  status: "running" | "completed" | "failed" | "archived"
  depth: number
  confidence?: number
  summary?: string
  messageCount: number
}

export interface BranchListProps extends ComponentProps<"div"> {
  branches: BranchItem[]
  activeBranchID?: string
  onBranchSelect: (branchID: string) => void
}

export function BranchList(props: BranchListProps) {
  const [split, rest] = splitProps(props, ["branches", "activeBranchID", "onBranchSelect", "class", "classList", "children"])

  const sorted = createMemo(() =>
    [...split.branches].sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth
      return a.purpose.localeCompare(b.purpose)
    }),
  )

  return (
    <div
      {...rest}
      data-component="branch-list"
      classList={{
        ...split.classList,
        [split.class ?? ""]: !!split.class,
      }}
    >
      <div data-slot="branch-list-header">
        <span data-slot="branch-list-title">Branches</span>
        <span data-slot="branch-list-count">{split.branches.length}</span>
      </div>

      <div data-slot="branch-list-items">
        <For each={sorted()}>
          {(branch) => (
            <BranchRow
              branch={branch}
              active={branch.id === split.activeBranchID}
              onBranchSelect={split.onBranchSelect}
            />
          )}
        </For>
      </div>
    </div>
  )
}

function BranchRow(props: { branch: BranchItem; active: boolean; onBranchSelect: (id: string) => void }) {
  const statusColor = createMemo(() => {
    switch (props.branch.status) {
      case "running": return "var(--icon-interactive-base)"
      case "completed": return "var(--icon-success-base)"
      case "failed": return "var(--icon-critical-base)"
      case "archived": return "var(--icon-subtle-base)"
      default: return "var(--icon-interactive-base)"
    }
  })

  const statusIcon = createMemo(() => {
    switch (props.branch.status) {
      case "running": return "\u25CF"
      case "completed": return "\u2713"
      case "failed": return "\u2717"
      case "archived": return "\u25CB"
      default: return "\u25CF"
    }
  })

  const confidencePct = createMemo(() =>
    props.branch.confidence != null ? Math.round(props.branch.confidence * 100) : null,
  )

  return (
    <button
      data-component="branch-row"
      data-active={props.active ? "true" : "false"}
      data-status={props.branch.status}
      data-depth={props.branch.depth}
      onClick={() => props.onBranchSelect(props.branch.id)}
      style={{ "padding-left": `${8 + props.branch.depth * 16}px` }}
    >
      <span data-slot="branch-row-dot" style={{ color: statusColor() }}>
        {statusIcon()}
      </span>
      <div data-slot="branch-row-content">
        <span data-slot="branch-row-purpose">{props.branch.purpose}</span>
        <div data-slot="branch-row-meta">
          <span data-slot="branch-row-messages">{props.branch.messageCount} msg</span>
          <Show when={confidencePct() != null}>
            <span data-slot="branch-row-confidence">{confidencePct()}%</span>
          </Show>
        </div>
      </div>
    </button>
  )
}
