# kube-weird-visualizer

Frontend-only React app that visualises an OpenShift **Hosted Control Plane (HCP)**
cluster as a nested stack of **zones** and traces event-driven flows down to Linux
kernel primitives. (Full topology lives in `ARCHITECTURE.md`.)
Deployed to GitHub Pages on every push to `main`.

## Reference docs (read these first)

- **`ARCHITECTURE.md`** — the source-of-truth spec for *what the app should be*:
  target topology, component hierarchy, `[Pod]`/`[systemd]`/`[VirtualMachineInstance]`
  nomenclature, interaction model, and the `components.json` / `events.json` schemas.
  When the app and this spec disagree, the spec is the intent — bring the app back in
  line with it (or change the spec deliberately).
- **`DESIGN_GOAL.md`** — the visual brief and intent (palette, fonts, what to avoid).

## Tech Stack

| | |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS 3 + CSS variables in `src/index.css` (`--k-*` zone accents, `--packet`) |
| Layout | Flex-wrap zones — node cards are a fixed `width: 128px` on desktop and reflow two-up (`flex: 1 1 calc(50% - 4px)`) under 640px (see `.node` in `src/index.css`) |
| Data | Static JSON — `src/data/events.json`, `src/data/components.json`, plus `src/data/zones.js` which maps components to zones + cosmetic metadata |

## Commands

```bash
npm install       # install deps
npm run dev       # dev server → http://localhost:5173
npm run build     # production build → ./dist
npm run preview   # serve dist locally
```

## File Map

```
src/
  App.jsx                    # shell: header (H1) + tabs (+ wide-desktop dock & network-overlay toggles), tab panels, modal, hop inspector
  index.css                  # design tokens, .zone, .node, .hop, .ancestry-modal, .pipeline-tree
  data/
    components.json          # one entry per componentId (incl. typePrefix, runtimeForm, linuxPrimitive, logicalContext)
    components-index.js      # O(1) componentId → entry Map (the shared findComponent lookup)
    events.json              # ordered step lists (source → target hops)
    zones.js                 # recursive ZONES tree (+ replicaNodes: condensed master-2/3, worker-2/3 network-plane zones), COMPONENT_COLOR / _ZONE / _BADGES
    primitives.js            # kernel/OS/virt primitives keyed by typePrefix
    manifests.js             # minimal example manifest (YAML) / systemd unit per componentId
    pipeline-layers.js       # Manifest → Kernel band definitions
    pipeline-kinds.js        # classifies pipeline-node actions into band-aware keyword chips
    deep-dives.js            # Deep Dive tab topics (systemd loop, Linux boot, HCP node boot, OVN topology…) as zone trees of clickable boxes (mirrors the ZONES shape)
    ovn-topology.js          # the ovn-topology deep-dive topic + its OVN teaching content (box/edge details, flows)
    network-topology.js      # Overview network-overlay model: SDN-layer chips + always-on labeled edges + the cross-layer packet trace
    pipeline-model.js        # builds a component's pipeline-tree band model
    interaction-kinds.js     # classifies interaction sentences (icon + accent)
    hop-kinds.js             # classifies a packet-flow step/sentence into an action keyword + glyph (Resolves/Routes/Terminates…); hopPoints() splits a step into per-sentence bullets
    object-tags.js           # turns object names in prose into clickable chips
    badge-glossary.js        # explanations shown when a badge chip is clicked
  hooks/
    useEventState.js         # active event + selected component + inspected hop state
    useFlowState.js          # Deep Dive trace-flow state (mirrors useEventState for a topic's flows)
    useMediaQuery.js         # subscribe to a CSS media query (compact / wide / reduced-motion)
    useReconciliationLoop.js # Deep Dive: systemd kill→SIGCHLD→UNIT_FAILED→restart step-through state machine
  lib/
    scroll.js                # scrollIntoUpperThird helper (window or inner swipe-pane scroller)
  components/
    Tabs.jsx                 # tab nav
    SwipeViews.jsx           # compact-mode horizontal pager between tabs (finger-tracking, per-pane scroll)
    Zone.jsx                 # one labeled zone; renders nested child zones recursively (layout: 'columns' | 'stack' variants)
    NodeCard.jsx             # one box inside a zone (shows [typePrefix] label)
    NetworkOverlay.jsx       # Overview overlay (wide desktop): OVN logical-topology chips + labeled edges over the real components, layer dimmer + packet trace
    TypeIcon.jsx             # glyph for a node's typePrefix ([Pod]/[systemd]/…)
    ServicePair.jsx          # stacks a Service over the in-zone target it `exposes`
    IntentStoreCard.jsx      # an etcd node that expands in place to show its records
    ControllerManagerCard.jsx # a controller-manager node that expands to show its control loops
    OperatorSetCard.jsx      # a CPO/CVO node that expands to show the operator Pods it owns
    ArrowLines.jsx           # the hand-rolled SVG arrow core: measures node rects + draws bezier connectors (shared)
    ArrowOverlay.jsx         # Overview adapter: maps event hops → ArrowLines steps
    DeepDiveArrowOverlay.jsx # Deep Dive adapter: maps flow hops (dd-<boxId>) → ArrowLines steps
    OverviewTab.jsx          # recursively renders ZONES tree + ArrowOverlay
    PacketFlowTab.jsx        # expandable hop cards for active event (number + route header, per-sentence glyph+keyword bullets, object chips)
    HopIcon.jsx              # monochrome line glyphs for the hop keywords (hop-kinds.js)
    DeepDiveTab.jsx          # Deep Dive tab: topic index + switcher → an Overview-style canvas; owns the box-popup selection
    DeepDiveCanvas.jsx       # renders a deep-dive topic's zone/box tree (reuses Zone/NodeCard) + the systemd reconciliation loop
    DeepDiveModal.jsx        # box detail popup — AncestryModal's gestures/CSS with generic content (prose, kv, commands, ASCII)
    ReconLoopOverlay.jsx     # SVG overlay for persistent labeled edges: the systemd loop (+ travelling signal token), deep-dive topology.edges, and the network overlay's wiring (idPrefix='')
    ReconControls.jsx        # bottom-docked play/step/reset navigator for the reconciliation loop (mounts at App root like HopInspector; scenario armed via the Deep Dive "Scenario" dropdown)
    UnitGallery.jsx          # systemd unit-file gallery for the systemd deep-dive
    HopInspector.jsx         # bottom-docked single-hop reader (Overview tab)
    DeepDiveHopInspector.jsx # the same bottom hop reader, for deep-dive trace flows
    AncestryModal.jsx        # node detail sheet (React portal); Esc / tap-outside closes
    DetailSections.jsx       # tags, context, primitives, interactions, commands
    PipelineTree.jsx         # the Manifest → Kernel ASCII-style tree
    Manifest.jsx             # [MANIFEST]/[UNIT] chip + copyable example-manifest code block
    InteractionList.jsx      # classified interaction rows
    InteractionRow.jsx       # a single classified interaction row (icon + accent + prose)
    ObjectText.jsx           # prose with inline object-reference chips
    ObjectSelect.jsx         # object/trace-flow dropdown selector
    ExploreCommands.jsx      # copyable shell-command blocks
    DocLinks.jsx             # "Official Docs" chip row (per-component docLinks)
```

## Critical Gotchas

- **`base: './'` in vite.config.js** — required for GitHub Pages. Do not change to `/`.
- **No test suite** — verify changes manually with `npm run dev`. The dev server build catches import / syntax errors but not visual regressions.
- **No arrow library.** Connectors are drawn by the hand-rolled `ArrowLines.jsx`
  (an absolutely-positioned SVG that measures node bounding rects and draws bezier
  paths). `ArrowOverlay` (Overview) and `DeepDiveArrowOverlay` (Deep Dive) are thin
  adapters that feed it resolved steps. Do not add `react-xarrows` or similar back.
- **`ArrowLines` positions paths via `document.getElementById(id)`.** Every NodeCard
  renders its `id` as the DOM `id`, so each id must be unique in the DOM at render time
  or its connector step is silently dropped. The lookup is document-wide and the compact
  swipe pager mounts every pane at once, so the Deep Dive namespaces its box ids as
  `dd-<boxId>` to avoid colliding with the Overview's raw `componentId` nodes.
- **`.claude/skills/*` predates this redesign** and still references the
  previous tmux/Catppuccin design (`ComponentBox`, `PodLayer`, `ArrowOverlay`).
  Treat those skills as historical context until they are refreshed.

> Adding a new component? See **"Adding a New Component"** in `ARCHITECTURE.md` for the
> exact files and fields to touch.
