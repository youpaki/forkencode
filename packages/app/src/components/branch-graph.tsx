import { For, Show, createMemo, type ComponentProps, splitProps } from "solid-js"

export interface BranchGraphNode {
  id: string
  purpose: string
  status: "running" | "completed" | "failed" | "archived"
  depth: number
  confidence?: number
  children: BranchGraphNode[]
  isMergeTarget?: boolean
}

export interface BranchGraphProps extends ComponentProps<"div"> {
  nodes: BranchGraphNode[]
  activeBranchID?: string
  onSelect: (branchID: string) => void
}

export function BranchGraph(props: BranchGraphProps) {
  const [split, rest] = splitProps(props, ["nodes", "activeBranchID", "onSelect", "class", "classList", "children"])

  const roots = createMemo(() =>
    split.nodes.filter((n) => n.depth === 0),
  )

  return (
    <div
      {...rest}
      data-component="branch-graph"
      classList={{
        ...split.classList,
        [split.class ?? ""]: !!split.class,
      }}
    >
      <div data-slot="branch-graph-header">
        <span data-slot="branch-graph-title">Conversation Graph</span>
        <span data-slot="branch-graph-count">{split.nodes.length} branches</span>
      </div>
      <div data-slot="branch-graph-tree">
        <For each={roots()}>
          {(root) => (
            <GraphNode
              node={root}
              allNodes={split.nodes}
              activeBranchID={split.activeBranchID}
              onSelect={split.onSelect}
              depth={0}
            />
          )}
        </For>
      </div>
    </div>
  )
}

function GraphNode(props: {
  node: BranchGraphNode
  allNodes: BranchGraphNode[]
  activeBranchID?: string
  onSelect: (branchID: string) => void
  depth: number
}) {
  const isActive = createMemo(() => props.node.id === props.activeBranchID)
  const hasChildren = createMemo(() => props.node.children.length > 0)

  const statusColor = createMemo(() => {
    switch (props.node.status) {
      case "running": return "var(--icon-interactive-base)"
      case "completed": return "var(--icon-success-base)"
      case "failed": return "var(--icon-critical-base)"
      case "archived": return "var(--icon-subtle-base)"
      default: return "var(--icon-interactive-base)"
    }
  })

  const connector = createMemo(() => {
    if (props.depth === 0) return "\u2501\u2501" // ━━ for root
    return "\u251C\u2500" // ├─ for children
  })

  return (
    <div data-component="graph-node" data-depth={props.depth}>
      <button
        data-slot="graph-node-row"
        data-active={isActive() ? "true" : "false"}
        data-status={props.node.status}
        data-merge={props.node.isMergeTarget ? "true" : "false"}
        style={{ "padding-left": `${8 + props.depth * 20}px` }}
        onClick={() => props.onSelect(props.node.id)}
      >
        <span data-slot="graph-node-connector">{connector()}</span>
        <span data-slot="graph-node-dot" style={{ color: statusColor() }}>&#x25CF;</span>
        <span data-slot="graph-node-purpose">{props.node.purpose}</span>
        <Show when={props.node.isMergeTarget}>
          <span data-slot="graph-node-merge-badge">merged</span>
        </Show>
        <Show when={props.node.confidence != null}>
          <span data-slot="graph-node-confidence">{Math.round(props.node.confidence! * 100)}%</span>
        </Show>
      </button>
      <Show when={hasChildren()}>
        <For each={props.node.children}>
          {(child) => (
            <GraphNode
              node={child}
              allNodes={props.allNodes}
              activeBranchID={props.activeBranchID}
              onSelect={props.onSelect}
              depth={props.depth + 1}
            />
          )}
        </For>
      </Show>
    </div>
  )
}
