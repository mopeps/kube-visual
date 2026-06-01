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
  App.jsx                    # shell: header (H1) + tabs (+ wide-desktop dock toggle), tab panels, modal, hop inspector
  index.css                  # design tokens, .zone, .node, .hop, .ancestry-modal, .pipeline-tree
  data/
    components.json          # one entry per componentId (incl. typePrefix, runtimeForm, linuxPrimitive, logicalContext)
    events.json              # ordered step lists (source → target hops)
    zones.js                 # recursive ZONES tree, COMPONENT_COLOR / _ZONE / _BADGES
    primitives.js            # kernel/OS/virt primitives keyed by typePrefix
    manifests.js             # minimal example manifest (YAML) / systemd unit per componentId
    pipeline-layers.js       # Manifest → Kernel band definitions
    pipeline-model.js        # builds a component's pipeline-tree band model
    interaction-kinds.js     # classifies interaction sentences (icon + accent)
    object-tags.js           # turns object names in prose into clickable chips
    badge-glossary.js        # explanations shown when a badge chip is clicked
  hooks/useEventState.js     # active event + selected component + inspected hop state
  components/
    Tabs.jsx                 # tab nav
    EventSelector.jsx        # trace-flow dropdown
    Zone.jsx                 # one labeled zone; renders nested child zones recursively
    NodeCard.jsx             # one box inside a zone (shows [typePrefix] label)
    IntentStoreCard.jsx      # an etcd node that expands in place to show its records
    ControllerManagerCard.jsx # a controller-manager node that expands to show its control loops
    ArrowOverlay.jsx         # SVG layer: numbered bezier connectors between step nodes
    OverviewTab.jsx          # recursively renders ZONES tree + ArrowOverlay
    PacketFlowTab.jsx        # expandable hop list for active event
    HopInspector.jsx         # bottom-docked single-hop reader (Overview tab)
    AncestryModal.jsx        # node detail sheet (React portal); Esc / tap-outside closes
    DetailSections.jsx       # tags, context, primitives, interactions, commands
    PipelineTree.jsx         # the Manifest → Kernel ASCII-style tree
    Manifest.jsx             # [MANIFEST]/[UNIT] chip + copyable example-manifest code block
    InteractionList.jsx      # classified interaction rows
    ObjectText.jsx           # prose with inline object-reference chips
    ExploreCommands.jsx      # copyable shell-command blocks
    DocLinks.jsx             # "Official Docs" chip row (per-component docLinks)
```

## Critical Gotchas

- **`base: './'` in vite.config.js** — required for GitHub Pages. Do not change to `/`.
- **No test suite** — verify changes manually with `npm run dev`. The dev server build catches import / syntax errors but not visual regressions.
- **No arrow library.** Connectors are drawn by the hand-rolled `ArrowOverlay.jsx`
  (an absolutely-positioned SVG that measures node bounding rects and draws bezier
  paths). Do not add `react-xarrows` or similar back.
- **`ArrowOverlay` positions paths via `document.getElementById(componentId)`.** Every
  NodeCard renders its `id` as the DOM `id`, so each `componentId` must be unique in the
  DOM at render time or its connector step is silently dropped.
- **`.claude/skills/*` predates this redesign** and still references the
  previous tmux/Catppuccin design (`ComponentBox`, `PodLayer`, `ArrowOverlay`).
  Treat those skills as historical context until they are refreshed.

> Adding a new component? See **"Adding a New Component"** in `ARCHITECTURE.md` for the
> exact files and fields to touch.
