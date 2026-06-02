import { Show, createMemo, For, type ComponentProps, splitProps } from "solid-js"

export interface MergeAnnouncementProps extends ComponentProps<"div"> {
  strategy: string
  sourceBranches: { name: string; summary?: string }[]
  resolution: string
  confidence: number
}

export function MergeAnnouncement(props: MergeAnnouncementProps) {
  const [split, rest] = splitProps(props, ["strategy", "sourceBranches", "resolution", "confidence", "class", "classList", "children"])

  const confidencePct = createMemo(() => Math.round(split.confidence * 100))

  return (
    <div
      {...rest}
      data-component="merge-announcement"
      data-strategy={split.strategy}
      classList={{
        ...split.classList,
        [split.class ?? ""]: !!split.class,
      }}
    >
      <div data-slot="merge-announcement-header">
        <span data-slot="merge-announcement-icon">&#x1F500;</span>
        <span data-slot="merge-announcement-title">
          Merge: {split.sourceBranches.length} branches merged via {split.strategy}
        </span>
      </div>

      <div data-slot="merge-announcement-sources">
        <For each={split.sourceBranches}>
          {(branch) => (
            <div data-slot="merge-announcement-source">
              <span data-slot="merge-announcement-source-name">{branch.name}</span>
              <Show when={branch.summary}>
                <span data-slot="merge-announcement-source-summary">{branch.summary}</span>
              </Show>
            </div>
          )}
        </For>
      </div>

      <div data-slot="merge-announcement-resolution">
        <span data-slot="merge-announcement-resolution-label">Resolution</span>
        <span data-slot="merge-announcement-resolution-text">{split.resolution}</span>
      </div>

      <div data-slot="merge-announcement-footer">
        <span data-slot="merge-announcement-confidence">
          Confidence: {confidencePct()}%
        </span>
      </div>
    </div>
  )
}
