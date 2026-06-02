import { Show, createMemo, type ComponentProps, splitProps } from "solid-js"

export interface BranchIndicatorProps extends ComponentProps<"div"> {
  branchName: string
  branchCount: number
  status?: "running" | "completed" | "failed" | "archived"
  depth: number
  onClick?: () => void
}

export function BranchIndicator(props: BranchIndicatorProps) {
  const [split, rest] = splitProps(props, ["branchName", "branchCount", "status", "depth", "onClick", "class", "classList", "children"])

  const statusColor = createMemo(() => {
    switch (split.status) {
      case "running": return "var(--icon-interactive-base)"
      case "completed": return "var(--icon-success-base)"
      case "failed": return "var(--icon-critical-base)"
      case "archived": return "var(--icon-subtle-base)"
      default: return "var(--icon-interactive-base)"
    }
  })

  return (
    <div
      {...rest}
      data-component="branch-indicator"
      data-status={split.status || "active"}
      data-depth={split.depth}
      classList={{
        ...split.classList,
        [split.class ?? ""]: !!split.class,
      }}
      onClick={split.onClick}
    >
      <span data-slot="branch-indicator-dot" style={{ "background-color": statusColor() }} />
      <span data-slot="branch-indicator-name">{split.branchName}</span>
      <Show when={split.branchCount > 1}>
        <span data-slot="branch-indicator-count">{split.branchCount} branches</span>
      </Show>
    </div>
  )
}
