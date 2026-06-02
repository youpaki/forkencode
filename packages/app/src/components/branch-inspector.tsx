import { Show, createMemo, type ComponentProps, splitProps } from "solid-js"

export interface BranchInspectorProps extends ComponentProps<"div"> {
  branch: {
    id: string
    purpose: string
    status: "running" | "completed" | "failed" | "archived"
    forkType?: string
    inheritanceMode: string
    depth: number
    confidence?: number
    summary?: string
    messageCount: number
    tokenEstimate?: number
    parentID?: string
    createdAt?: string
  } | null
  onClose?: () => void
}

export function BranchInspector(props: BranchInspectorProps) {
  const [split, rest] = splitProps(props, ["branch", "onClose", "class", "classList", "children"])

  const statusLabel = createMemo(() => {
    switch (split.branch?.status) {
      case "running": return "Running"
      case "completed": return "Completed"
      case "failed": return "Failed"
      case "archived": return "Archived"
      default: return "Unknown"
    }
  })

  return (
    <div
      {...rest}
      data-component="branch-inspector"
      classList={{
        ...split.classList,
        [split.class ?? ""]: !!split.class,
      }}
    >
      <Show
        when={split.branch}
        fallback={
          <div data-slot="branch-inspector-empty">
            Select a branch to inspect
          </div>
        }
      >
        {(branch) => (
          <>
            <div data-slot="branch-inspector-header">
              <span data-slot="branch-inspector-title">{branch().purpose}</span>
              <Show when={split.onClose}>
                <button data-slot="branch-inspector-close" onClick={split.onClose}>
                  x
                </button>
              </Show>
            </div>

            <div data-slot="branch-inspector-body">
              <InspectorField label="ID" value={branch().id} mono />
              <InspectorField label="Status" value={statusLabel()} badge={branch().status} />
              <Show when={branch().forkType}>
                <InspectorField label="Type" value={branch().forkType} />
              </Show>
              <InspectorField label="Inheritance" value={branch().inheritanceMode} />
              <InspectorField label="Depth" value={String(branch().depth)} />
              <InspectorField label="Messages" value={String(branch().messageCount)} />
              <Show when={branch().confidence != null}>
                <InspectorField label="Confidence" value={`${Math.round(branch().confidence! * 100)}%`} />
              </Show>
              <Show when={branch().tokenEstimate != null}>
                <InspectorField label="Est. Tokens" value={`~${branch().tokenEstimate}`} />
              </Show>
              <Show when={branch().summary}>
                <div data-slot="branch-inspector-field">
                  <span data-slot="branch-inspector-label">Summary</span>
                  <span data-slot="branch-inspector-value" data-multiline="true">
                    {branch().summary}
                  </span>
                </div>
              </Show>
              <Show when={branch().createdAt}>
                <InspectorField label="Created" value={branch().createdAt} />
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}

function InspectorField(props: {
  label: string
  value?: string
  mono?: boolean
  badge?: string
}) {
  return (
    <div data-slot="branch-inspector-field">
      <span data-slot="branch-inspector-label">{props.label}</span>
      <span
        data-slot="branch-inspector-value"
        data-mono={props.mono ? "true" : "false"}
        data-badge={props.badge ?? "none"}
      >
        {props.value}
      </span>
    </div>
  )
}
