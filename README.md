# kube-weird-visualizer

https://mopeps.github.io/kube-visual/

A frontend-only React app that visualises an OpenShift **Hosted Control Plane (HCP)**
cluster as a nested, top-to-bottom stack of **zones** — from the external client,
down through the bare metal management cluster and the dedicated guest control-plane
namespace, into the KubeVirt launcher, and finally the guest worker VM and the Linux
kernel primitives that back each workload Pod.

Pick a **trace flow** and the page lights the participating nodes, overlays numbered
directional connectors between them, and lets you step through every hop. Click any
node to open a detail sheet with its problem statement, interactions, a
manifest-to-kernel pipeline, and copy-paste exploration commands.

> The intended topology, nomenclature, interaction model, and data schemas are
> specified in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** (source of truth). The
> visual brief lives in **[`DESIGN_GOAL.md`](./DESIGN_GOAL.md)**.

## Features

- **Zoned topology** — full-width horizontal zones nest to mirror real HCP ownership
  (Bare Metal Cluster → Master/Worker Node → Guest Control Plane Namespace → KubeVirt
  Launcher → Guest Worker VM). Nodes reflow with `flex-wrap` and compress two-up on
  mobile.
- **Event-driven tracing** — pick a flow from the trace selector to highlight the
  involved nodes, stamp them with `01`/`02` step badges, and draw numbered SVG
  connectors that auto-recompute on resize.
- **Three views** — *Deep Dive* (ground-up Linux, HCP, and OVN explainers),
  *Architecture Overview* (Architecture and Network lenses with one-pair/all-node
  scope), and *Packet Flow* (the active trace as an expandable hop list).
- **Etcd intent stores** — the Management and Guest etcd nodes expand in place to
  reveal the desired-state records they persist (Custom Resources / API objects),
  which deliberately have no card of their own on the canvas.
- **Detail inspector** — click a node for an `Esc`-dismissable sheet with its
  problem statement, classified interactions, a Manifest → Kernel pipeline tree, and
  copyable shell commands. Object references in the prose are clickable shortcuts to
  the nodes they name.

## Quick Start

**Requirements:** Node.js 20.19+ or 22.12+

```bash
git clone https://github.com/mopeps/kube-visual.git
cd kube-visual
npm install
npm run dev      # → http://localhost:5173
npm test         # validate component, topology, event, and deep-dive references
npm run check    # validation + production build
```

## Adding Events

Trace flows live in `src/data/events.json`. Each is an ordered list of source → target
hops:

```json
{
  "eventId": "my-event",
  "eventName": "My Event Name",
  "description": "Shown above the hop list when this trace is active.",
  "steps": [
    {
      "step": 1,
      "sourceComponentId": "external-client",
      "targetComponentId": "guest-api-server",
      "description": "What happens at this hop."
    }
  ]
}
```

`sourceComponentId` / `targetComponentId` must match a `componentId` that exists in the
zone tree — `ArrowOverlay` anchors connectors via `document.getElementById(id)`, so an
unknown or duplicate id silently drops that connector.

## Adding Component Metadata

Inspector data lives in `src/data/components.json`. See **"Adding a New Component"** in
`ARCHITECTURE.md` for the full checklist (it touches `components.json`, `zones.js`,
and optionally `events.json`, manifests, primitives, and network internals).

```json
{
  "componentId": "my-component",
  "displayName": "My Component",
  "typePrefix": "Pod",
  "layer": "Guest Control Plane",
  "problemSolved": "What this component does and why it exists.",
  "interactions": ["One interaction.", "Another interaction."],
  "explorationCommands": ["# comment\noc get pods -n <ns>"]
}
```

## Project Structure

```
src/
├── App.jsx                    # shell, tabs, lenses, modals, docked readers
├── index.css                  # design tokens and component/layout styles
├── data/
│   ├── components.json        # component metadata and detail content
│   ├── events.json            # ordered trace-flow hops
│   ├── zones.js               # recursive Overview topology and replica placement
│   ├── deep-dives.js          # Deep Dive topic trees
│   ├── ovn-topology.js        # shared OVN teaching topology
│   └── network-internals.js   # Network-lens primitives and connector edges
├── components/
│   ├── OverviewTab.jsx        # Architecture/Network canvas
│   ├── PacketFlowTab.jsx      # trace gallery and hop list
│   ├── DeepDiveTab.jsx        # topic picker and deep-dive canvas
│   ├── ArrowLines.jsx         # shared measured SVG connector core
│   ├── PrimitiveBoxCard.jsx   # in-place runtime/network internals
│   └── AncestryModal.jsx      # component detail sheet
└── hooks/
    ├── useEventState.js       # Overview trace/component state
    ├── useFlowState.js        # Deep Dive trace state
    └── useDialogFocus.js      # shared modal keyboard/focus contract
scripts/
└── validate-data.mjs          # graph/schema integrity checks used by CI
```

## Tech Stack

| Tool | Purpose |
|---|---|
| [Vite](https://vitejs.dev) | Build tool and dev server |
| [React 19](https://react.dev) | UI framework |
| [Tailwind CSS v3](https://tailwindcss.com) | Utility-first styling (+ CSS variables in `src/index.css`) |

Connectors are drawn by the hand-rolled `ArrowOverlay.jsx` (an absolutely-positioned
SVG that measures node bounding rects), **not** by a library.

## Build & Deploy

```bash
npm run build    # → ./dist
npm run check    # validate data, then build
npm run preview  # serve the production build locally
```

`vite.config.js` sets `base: './'` so the build works under the GitHub Pages subpath.
Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
