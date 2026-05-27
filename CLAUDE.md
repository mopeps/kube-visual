# kube-visual

Frontend-only React app that visualises an OpenShift cluster as a nested containment diagram and traces event-driven data flows down to Linux kernel primitives. Deployed to GitHub Pages on every push to `main`.

## Tech Stack

| | |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS 3 + custom `k-*` design tokens |
| Arrows | Custom SVG overlay (react-xarrows listed but unused) |
| Data | Static JSON — `src/data/events.json`, `src/data/components.json` |

## Commands

```bash
npm install       # install deps
npm run dev       # dev server → http://localhost:5173
npm run build     # production build → ./dist
npm run preview   # serve dist locally
```

## Development Guidelines

Skills auto-load when your request matches their trigger words. You can also load them explicitly.

| Skill | Load when working on… |
|---|---|
| `.claude/skills/tailwind-styling` | Colors, typography, Tailwind classes, animations, glow effects |
| `.claude/skills/component-patterns` | Any component in `src/components/` — props, states, conventions |
| `.claude/skills/state-management` | `useEventState`, event/component/pod selection, prop drilling |
| `.claude/skills/arrow-overlay` | SVG trace arrows — adding, debugging, animating |
| `.claude/skills/data-model` | `events.json` or `components.json` — schemas, adding entries |

Heavy reference data (all component IDs, event step matrix) is in `.claude/references/component-ids.md`.

## Critical Gotchas

- **Duplicate DOM IDs** — `pod-netns`, `pod-cgroups`, `container-process` render inside both `PodLayer` instances. `getElementById` always hits the first (app-pod). Do not add more.
- **`react-xarrows` is unused** — arrows are a custom SVG in `ArrowOverlay.jsx`. Do not import it.
- **`base: './'` in vite.config.js** — required for GitHub Pages. Do not change to `/`.
- **No test suite** — verify changes manually with `npm run dev`.
