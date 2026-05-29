# kube-visual

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
| Layout | Flex-wrap zones — nodes have `min-width 180px / max-width 300px` and reflow as the viewport resizes |
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
  App.jsx                    # shell: header, legend, event pills, tabs, detail panel
  index.css                  # design tokens, .zone, .node, .arrow-zone, .hop, .detail-panel
  data/
    components.json          # one entry per componentId (incl. typePrefix, logicalContext)
    events.json              # ordered step lists (source → target hops)
    zones.js                 # recursive ZONES tree, COMPONENT_COLOR, COMPONENT_ZONE
  hooks/useEventState.js     # active event + selected component state
  components/
    Tabs.jsx                 # tab nav
    EventSelector.jsx        # horizontal trace pills
    Zone.jsx                 # one labeled zone; renders nested child zones recursively
    NodeCard.jsx             # one box inside a zone (shows [typePrefix] label)
    ArrowOverlay.jsx         # SVG layer: bezier connectors between active step nodes
    OverviewTab.jsx          # recursively renders ZONES tree + ArrowOverlay
    PacketFlowTab.jsx        # expandable hop list for active event
    ObjectMapTab.jsx         # flat table mapping component → kind → linux primitive
    DetailPanel.jsx          # slide-up bottom sheet when a node is clicked
```

## Critical Gotchas

- **`base: './'` in vite.config.js** — required for GitHub Pages. Do not change to `/`.
- **No test suite** — verify changes manually with `npm run dev`. The dev server build catches import / syntax errors but not visual regressions.
- **`react-xarrows` is in package.json but unused.** Do not import it. Connectors are
  drawn by the hand-rolled `ArrowOverlay.jsx` (an absolutely-positioned SVG that
  measures node bounding rects and draws bezier paths), not by a library.
- **`ArrowOverlay` positions paths via `document.getElementById(componentId)`.** Every
  NodeCard renders its `id` as the DOM `id`, so each `componentId` must be unique in the
  DOM at render time or its connector step is silently dropped.
- **`.claude/skills/*` predates this redesign** and still references the
  previous tmux/Catppuccin design (`ComponentBox`, `PodLayer`, `ArrowOverlay`).
  Treat those skills as historical context until they are refreshed.

> Adding a new component? See **"Adding a New Component"** in `ARCHITECTURE.md` for the
> exact files and fields to touch.
