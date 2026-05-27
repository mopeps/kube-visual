# kube-visual

Frontend-only React app that visualises an OpenShift cluster as a vertical
stack of **zones** (Client → Ingress → Mgmt Plane → Host.Net → Pod·Kernel) and
traces event-driven packet flows down to Linux kernel primitives.
Deployed to GitHub Pages on every push to `main`.

See `DESIGN_GOAL.md` for the visual brief and intent.

## Tech Stack

| | |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS 3 + CSS variables in `src/index.css` (`--k-cyan`, `--k-sky`, `--k-purple`, `--k-amber`, `--k-green`, `--packet`) |
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
    components.json          # one entry per componentId
    events.json              # ordered step lists (source → target hops)
    zones.js                 # ZONES, ARROW_ROWS, COMPONENT_COLOR, COMPONENT_ZONE
  hooks/useEventState.js     # active event + selected component state
  components/
    Tabs.jsx                 # tab nav
    EventSelector.jsx        # horizontal trace pills
    Zone.jsx                 # one labeled zone row, with flex-wrap children
    NodeCard.jsx             # one box inside a zone
    ArrowRow.jsx             # numbered hops between two zones
    OverviewTab.jsx          # assembles ZONES + ARROW_ROWS
    PacketFlowTab.jsx        # expandable hop list for active event
    LinuxInternalsTab.jsx    # layer cards for host-net + kernel primitives
    ObjectMapTab.jsx         # flat table mapping component → kind → linux primitive
    DetailPanel.jsx          # slide-in panel on the right when a node is clicked
```

## Critical Gotchas

- **`base: './'` in vite.config.js** — required for GitHub Pages. Do not change to `/`.
- **No test suite** — verify changes manually with `npm run dev`. The dev server build catches import / syntax errors but not visual regressions.
- **`react-xarrows` is in package.json but unused.** Do not import it. The current design uses static arrow rows between zones, not floating SVG paths.
- **Adding a new component** means three places: a new entry in
  `components.json`, a reference in the correct zone in `data/zones.js`, and
  ideally an icon mapping in `LinuxInternalsTab.jsx` / `ObjectMapTab.jsx` if
  it should appear in those tabs.
- **`.claude/skills/*` predates this redesign** and still references the
  previous tmux/Catppuccin design (`ComponentBox`, `PodLayer`, `ArrowOverlay`).
  Treat those skills as historical context until they are refreshed.
