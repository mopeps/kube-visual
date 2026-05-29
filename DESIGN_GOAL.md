# kube-visual · Design Goal

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
2. **Inside each zone, nodes flow with `flex-wrap`.** A node has
   `min-width: 160px; max-width: 280px` so a narrow window gives one column,
   a wide window gives three or four columns — the boxes reflow naturally
   to fill available width.
3. **Arrow rows live between zones**, not floating above them. Each arrow
   step is a numbered chip with a one-line description of what happens at
   that hop.
4. **The detail panel slides in from the right** when a node is clicked.
   It is never inline — the diagram stays put.

## Interaction model

- **Click a node** → slide-in detail panel with `problemSolved`, `interactions`,
  and copy-paste exploration commands. `ESC` closes it.
- **Pick an event** → relevant nodes get the packet outline and a `01`, `02`
  step badge; relevant arrow rows highlight; the Step-by-Step tab populates
  with the hop list.
- **Switch tabs** to see the same components from three angles:
  1. **Architecture Overview** — the zoned diagram.
  2. **Step-by-Step Packet Flow** — the active event's hops as an expandable
     vertical list.
  3. **K8s Object Map** — a flat table mapping every component to its layer
     and underlying Linux primitive.

## Non-goals

- No tmux/CRT chrome anymore — the terminal aesthetic of the previous design
  is replaced.
- No animated curved SVG arrows between arbitrary nodes — arrows are
  zone-to-zone arrow rows. The step ordering lives in the data, not in
  arbitrary screen geometry.
- No sidebar event buffer — events are picked from a horizontal selector
  at the top of the page; the canvas stays uncluttered.

## Source of inspiration

The layout, color treatment, and arrow-row pattern are adapted from the
`HCP on KubeVirt — Network Flow` reference HTML provided alongside the
redesign brief.
