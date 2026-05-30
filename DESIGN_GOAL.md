# kube-weird-visualizer · Design Goal

## Intent

Visualize an OpenShift cluster as a **vertical stack of zones** — from the external
client at the top, down through the management plane, the host networking
subsystem, and finally the Linux kernel primitives that back each pod. A user
should be able to scan the page once and understand "where each piece lives"
without reading any docs.

When the user picks an event (e.g. *External Ingress Traffic*), the page should
make the involved hops obvious by lighting the relevant nodes and arrow rows
with a packet-trace accent, and offer a step-by-step expanded view of the same
flow.

## Visual language

| | |
|---|---|
| Surface | Deep navy `#070b14`, faint cyan grid overlay (`40px` cells) |
| Headings | `Syne` 600/800, tight tracking, gradient fills for the H1 |
| Body / labels | `JetBrains Mono`, uppercase mini-labels with `0.12em–0.18em` tracking |
| Zone accents | A cool-to-green gradient that descends the stack — Cyan (external client) → Blue (bare metal infra: cluster / master / worker) → Sky (guest control plane namespace) → Teal (KubeVirt launcher) → Green (guest worker VMI). Used for borders, badges, and zone labels. Bare-metal zones all share the one blue so the physical layer reads as a single unit. |
| Packet accent | Red-pink `#ff4d6d` — only for the active trace (nodes, arrow steps, highlighted hop) |
| Borders | 1px solid + dashed inner separators, no rounded "card" feel beyond a soft 8px radius |

## Layout rules

1. **Zones are full-width horizontal rows.** Each zone has a thin vertical
   label on the left (rotated text) and a content area on the right.
2. **Inside each zone, nodes flow with `flex-wrap`.** On desktop a node is a
   fixed `width: 128px`, so a wide zone packs several compact cards per row and
   a narrow one wraps them naturally. Under 640px the cards switch to a fluid
   two-up grid (`flex: 1 1 calc(50% - 4px)`) so at least two always sit
   side-by-side without clipping (see `.node` in `src/index.css`).
3. **Trace connectors are a numbered SVG overlay** drawn between the involved
   nodes when an event is active — not arrow rows wedged between zones. Each
   connector carries a clickable step badge (`①`, `②`, …); the overlay measures
   node bounding rects and recomputes on resize. The step *ordering* lives in the
   data (`events.json`), even though the geometry is screen-derived.
4. **The detail inspector opens as an overlay sheet** when a node is clicked —
   a centered modal on desktop, a full-height bottom sheet on mobile (swipe- or
   tap-outside to dismiss). It is never inline — the diagram stays put behind it.

## Interaction model

- **Click a node** → detail sheet with `problemSolved`, `interactions`, a
  Manifest → Kernel pipeline, and copy-paste exploration commands. `ESC` closes it.
- **Pick an event** → relevant nodes get the packet outline and a `01`, `02`
  step badge; numbered connectors are drawn between them; the Step-by-Step tab
  populates with the hop list, and a bottom-docked hop inspector reads out the
  selected hop on the Overview tab.
- **Switch tabs** to see the same components from two angles:
  1. **Architecture Overview** — the zoned diagram.
  2. **Step-by-Step Packet Flow** — the active event's hops as an expandable
     vertical list.
- **Click any node** to open its detail sheet, where the Manifest → Kernel
  pipeline shows that object's K8s runtime form and the Linux primitive it
  bottoms out in.

## Non-goals

- No tmux/CRT chrome anymore — the terminal aesthetic of the previous design
  is replaced.
- No floating connectors on the idle canvas — connectors appear only while a
  trace is active, and their step ordering comes from `events.json`, not from
  hand-placed geometry.
- No sidebar event buffer — events are picked from a trace selector at the top
  of the page; the canvas stays uncluttered.

## Source of inspiration

The layout, color treatment, and arrow-row pattern are adapted from the
`HCP on KubeVirt — Network Flow` reference HTML provided alongside the
redesign brief.
