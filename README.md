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
- **Three views** — *Architecture Overview* (the zoned diagram), *Step-by-Step Packet
  Flow* (the active trace as an expandable hop list), and *K8s Object Map* (a flat
  table mapping every component to its K8s kind and backing Linux primitive).
- **Etcd intent stores** — the Management and Guest etcd nodes expand in place to
  reveal the desired-state records they persist (Custom Resources / API objects),
  which deliberately have no card of their own on the canvas.
- **Detail inspector** — click a node for an `Esc`-dismissable sheet with its
  problem statement, classified interactions, a Manifest → Kernel pipeline tree, and
  copyable shell commands. Object references in the prose are clickable shortcuts to
  the nodes they name.

## Quick Start

**Requirements:** Node.js 18+

```bash
git clone https://github.com/mopeps/kube-visual.git
cd kube-visual
npm install
npm run dev      # → http://localhost:5173
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
`ObjectMapTab.jsx`, and optionally `events.json`).

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
├── App.jsx                  # shell: header, legend, trace selector, tabs, modals
├── index.css                # design tokens + component styles
├── data/
│   ├── components.json       # per-component metadata (the inspector source)
│   ├── events.json           # ordered trace-flow step lists
│   ├── zones.js              # recursive ZONES tree + derived COMPONENT_* maps
│   ├── primitives.js         # kernel/OS/virt primitives keyed by typePrefix
│   ├── pipeline-layers.js    # the Manifest → Kernel band definitions
│   ├── pipeline-model.js     # builds a component's pipeline-tree band model
│   ├── interaction-kinds.js  # classifies interaction sentences for the inspector
│   ├── object-tags.js        # turns object names in prose into clickable chips
│   └── badge-glossary.js     # explanations shown when a badge chip is clicked
├── components/
│   ├── Tabs.jsx              # tab navigation
│   ├── EventSelector.jsx     # trace-flow dropdown
│   ├── OverviewTab.jsx       # renders the ZONES tree + ArrowOverlay
│   ├── Zone.jsx              # one labeled zone (recurses into child zones)
│   ├── NodeCard.jsx          # one box inside a zone
│   ├── IntentStoreCard.jsx   # an etcd node that expands to show its records
│   ├── ArrowOverlay.jsx      # SVG layer: numbered bezier connectors for a trace
│   ├── PacketFlowTab.jsx     # the active trace as an expandable hop list
│   ├── HopInspector.jsx      # bottom-docked single-hop reader (Overview tab)
│   ├── ObjectMapTab.jsx      # component → kind → Linux primitive table
│   ├── AncestryModal.jsx     # node detail sheet (portal)
│   ├── DetailSections.jsx    # tags, context, primitives, interactions, commands
│   ├── PipelineTree.jsx      # the Manifest → Kernel ASCII-style tree
│   ├── InteractionList.jsx   # classified interaction rows
│   ├── ObjectText.jsx        # prose with inline object-reference chips
│   └── ExploreCommands.jsx   # copyable shell-command blocks
└── hooks/
    └── useEventState.js      # active event / selected component / inspected hop
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
npm run preview  # serve the production build locally
```

`vite.config.js` sets `base: './'` so the build works under the GitHub Pages subpath.
Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
