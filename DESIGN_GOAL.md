# kube-weird-visualizer · Design Goal

## Core Philosophy: The No-Abstractions Rule

This visualizer exists to make infrastructure *concrete*. Four principles are
non-negotiable and override every other choice in this document — the first
governs everything else:

1. **Say it straight, show it first.** This is the principle the other three
   serve. Lead with the diagram; keep prose terse and direct. Explain the real
   mechanism in the fewest words that still hit the heart of it — no hedging, no
   padding, no detours into analogy. If an explanation swerves around the point
   instead of landing on it, cut it down until it lands.
2. **Zero abstract cloud metaphors.** No clouds, no faceless "managed service"
   boxes, no logos standing in for real systems. Every box is a thing that
   actually runs — a `[Pod]`, a `[systemd]` service, a `[VirtualMachineInstance]`,
   a `[Service]`, a `[NetworkPolicy]` — labeled with its exact API/system kind.
3. **Immediate depth, zero clutter.** The full nested topology is visible at a
   glance — scan once, see where every piece lives — but the idle canvas stays
   quiet: components dimmed, no floating connectors, no intent-only records
   crowding the real workloads. Depth is *present*, not *noisy*; detail is
   summoned on demand, never dumped up front.
4. **Progressive disclosure to the metal.** Every interaction drills *down toward
   the kernel*, never sideways into more abstraction. Detail modals expose the
   raw Linux primitives behind a component — the `cgroups` slice path, the
   network-namespace (`netns`) identity, the host-side `veth`/`tap` tags — plus
   copy-paste exploration commands (`nsenter`, `crictl`, …) to see the same thing
   on a live cluster.

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
| Zone accents | A cool-to-green gradient that descends the stack — Cyan `#00e5ff` (external client) → Blue `#3b82f6` (bare metal master node) → lighter Blue `#60a5fa` (bare metal worker node) → Sky `#38bdf8` (guest control plane namespace) → Teal `#14b8a6` (KubeVirt launcher) → Green `#22c55e` (guest worker VMI). Used for borders, badges, and zone labels. The two bare-metal nodes take two shades of the same blue so the physical layer still reads as one band while master and worker stay distinguishable. (Three further accents — `--k-purple`, `--k-amber`, `--k-orange` — exist as CSS variables for incidental use.) |
| Packet accent | Red-pink `#ff4d6d` — only for the active trace (nodes, arrow steps, highlighted hop) |
| Borders | 1px solid + dashed inner separators, no rounded "card" feel beyond a soft 8px radius |

## Layout rules

1. **Zones are full-width horizontal rows.** Each zone carries a small
   uppercase label across the top (in its zone accent, underlined by a thin
   border) with the content area below it; nested child zones repeat the same
   label-on-top pattern inside a bordered (or dashed) containment box.
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
5. **Tab navigation adapts to width.** On touch / narrow screens (≤1023px) the
   two views are a horizontally swipeable pager. On mid-width desktop they are
   a classic single-column tab strip. On wide desktop (≥1280px) a *Dock flow*
   toggle pins the Step-by-Step Packet Flow as a sticky side panel next to the
   Architecture Overview, so the trace and the diagram are read together (the
   preference persists in `localStorage`). When docked, Packet Flow drops out of
   the tab strip so it never lives in two places at once.

## Interaction model

- **Click a node** → detail sheet that descends from intent to kernel: a
  "why it exists" callout (`problemSolved` + role badge), classified
  `interactions` rows (each tagged with a relationship icon), a
  collapsed-by-default **Manifest → Kernel pipeline** (showing the object's K8s
  runtime form and the Linux primitive it bottoms out in), the raw **Linux
  kernel primitives** behind the component (netns identity, cgroups slice path,
  host-side veth/tap tags), and copy-paste **exploration commands** (`nsenter`,
  `crictl`, …). Object names in the prose are lifted into clickable chips that
  jump to the referenced node. `ESC` (or tap-outside / swipe-down on mobile)
  closes it.
- **Pick a trace flow** → done from inside the **Packet Flow** view: an
  EventGallery of flow cards when nothing is selected, collapsing to an inline
  pill switcher once one is. Selecting a flow transitions its nodes to full
  opacity with the packet outline and `01`, `02` step badges; numbered SVG
  connectors are drawn between them; the hop list populates; and a bottom-docked
  hop inspector reads out the selected hop on the Overview tab.
- **Switch tabs** to see the same components from two angles:
  1. **Architecture Overview** — the zoned diagram.
  2. **Step-by-Step Packet Flow** — the active event's hops as an expandable
     vertical list.

## Non-goals

- No tmux/CRT chrome anymore — the terminal aesthetic of the previous design
  is replaced.
- No floating connectors on the idle canvas — connectors appear only while a
  trace is active, and their step ordering comes from `events.json`, not from
  hand-placed geometry.
- No sidebar event buffer — flows are picked from within the Packet Flow view
  (a gallery of flow cards that collapses to an inline pill switcher once one is
  active), not a persistent event log; the canvas stays uncluttered.

## Source of inspiration

The layout, color treatment, and arrow-row pattern are adapted from the
`HCP on KubeVirt — Network Flow` reference HTML provided alongside the
redesign brief.
