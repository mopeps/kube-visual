# CLAUDE.md — kube-visual

## Project Overview

**kube-visual** is a frontend-only, static React web app that visualises an OpenShift cluster as a nested containment diagram and traces event-driven data flows across layers — from Kubernetes control plane objects down to Linux kernel primitives (namespaces, cgroups, veth pairs).

The app is deployed to GitHub Pages via a CI workflow that triggers on every push to `main`.

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 19 | UI & state |
| Vite | 8 | Dev server & build |
| Tailwind CSS | 3 | Utility styling |
| PostCSS + Autoprefixer | — | CSS processing |
| react-xarrows | 2 | Listed as a dep; arrows are implemented with a custom SVG overlay instead |

No routing library. No backend. No test suite currently exists.

---

## Development Commands

```bash
npm install       # install deps
npm run dev       # start Vite dev server (http://localhost:5173)
npm run build     # production build → ./dist
npm run preview   # serve the dist build locally
```

The build output is `./dist` (relative paths; `vite.config.js` sets `base: './'` for GitHub Pages compatibility).

---

## Repository Structure

```
kube-visual/
├── index.html                  # Vite entry point (loads Google Fonts)
├── vite.config.js              # Vite config — React plugin, base: './'
├── tailwind.config.js          # Custom design tokens (see Design System)
├── postcss.config.js           # Tailwind + Autoprefixer
├── src/
│   ├── main.jsx                # ReactDOM.createRoot → <App />
│   ├── App.jsx                 # Root: wires Sidebar + Canvas via useEventState
│   ├── index.css               # Global CSS vars, animations, scrollbars
│   ├── components/
│   │   ├── Canvas.jsx          # Main workspace — hierarchy layout + sub-components
│   │   ├── Sidebar.jsx         # Event list + flow steps panel
│   │   ├── ComponentBox.jsx    # Clickable node chip (highlight/dim/select states)
│   │   ├── PodLayer.jsx        # Pod boundary — expand toggle → KernelPrimitives
│   │   ├── KernelPrimitives.jsx # netns / cgroups / PID 1 — shown only when pod expanded
│   │   ├── ArrowOverlay.jsx    # SVG layer drawn over canvas; quadratic bezier arrows
│   │   ├── InspectorPanel.jsx  # Right slide-out; metadata + terminal commands
│   │   └── Breadcrumb.jsx      # Path nav shown when pods are expanded
│   ├── hooks/
│   │   └── useEventState.js    # Central state hook (event, component, pods)
│   └── data/
│       ├── events.json         # Event definitions + ordered steps
│       └── components.json     # Per-component metadata for InspectorPanel
├── .github/
│   └── workflows/deploy.yml   # GitHub Pages deploy on push to main
├── PROMPT_INSTRUCTIONS.md      # Original AI prompts used to scaffold the project
└── README.md
```

---

## Architecture & Data Flow

### State management — `useEventState`

All interactive state lives in one hook (`src/hooks/useEventState.js`):

| State | Type | Description |
|---|---|---|
| `activeEvent` | `object \| null` | The currently selected event from `events.json` |
| `activeComponentId` | `string \| null` | The component clicked by the user (opens InspectorPanel) |
| `expandedPods` | `Set<string>` | Which pod IDs have their KernelPrimitives layer visible |
| `activeComponentIds` | `Set<string>` | Derived — union of all source/target IDs in the active event's steps |

`activeComponentIds` is derived (not stored) — computed from `activeEvent.steps` on every render. Do not store it as separate state.

Selecting an event auto-expands **all pods** (`app-pod`, `router-pod`). Toggling a pod manually via `onTogglePod` adds/removes it from `expandedPods` independently.

### Component hierarchy (visual containment)

```
<App>
 ├── <Sidebar>          (left, 288px, slide-over on mobile)
 │    ├── EventCard[]   (clicks call selectEvent)
 │    └── FlowSteps     (shown when activeEvent is set)
 └── <Canvas>           (flex-1, scrollable)
      ├── Toolbar        (breadcrumb, event badge, clear)
      ├── Breadcrumb     (visible only when expandedPods.size > 0)
      ├── [Cluster boundary div]
      │    ├── LayerBoundary "Management Layer"
      │    │    └── ComponentBox × 5
      │    └── [Infrastructure Node div]
      │         ├── LayerBoundary "Namespace · app"
      │         │    └── PodLayer id="app-pod"
      │         │         └── KernelPrimitives (3 boxes, hidden by default)
      │         ├── LayerBoundary "Namespace · router"
      │         │    └── PodLayer id="router-pod"
      │         │         └── KernelPrimitives (same 3 component IDs)
      │         └── LayerBoundary "Host Networking"
      │              └── ComponentBox × 2
      ├── [External client section]
      │    └── ComponentBox id="external-client"
      ├── ArrowOverlay   (absolute SVG, pointer-events: none)
      └── InspectorPanel (conditional, fixed/absolute right panel)
```

### Arrow rendering — `ArrowOverlay`

Arrows are **not** from react-xarrows. The component uses a custom SVG layer:

1. On `activeEvent` or `expandedPods` change, `useLayoutEffect` runs.
2. For each step, it finds source/target elements by DOM `id` (`document.getElementById`).
3. Computes center coordinates relative to `#canvas-root` (accounting for scroll).
4. Renders quadratic bezier `<path>` elements with a step-number badge at the midpoint.
5. Animations use CSS (`arrow-path` keyframe in `index.css`; staggered via `animationDelay`).

**Critical**: Every `ComponentBox` must have its `id` prop matching the `componentId` used in `events.json` steps, otherwise arrows will silently skip the step (the `flatMap` returns `[]` for missing elements).

---

## Data Model

### `src/data/events.json`

Array of event objects. Each drives the arrow trace and sidebar flow steps.

```jsonc
{
  "eventId": "route-ingress-traffic",   // unique key; also used for EVENT_THEMES in Sidebar
  "eventName": "External Ingress Traffic Flow",
  "description": "Short blurb shown in the event card.",
  "steps": [
    {
      "step": 1,                          // 1-based; used as arrow badge label
      "sourceComponentId": "external-client",   // must match a DOM id on the canvas
      "targetComponentId": "ingress-router-haproxy",
      "description": "Shown in the FlowSteps list in the sidebar."
    }
  ]
}
```

Current events (3 total):
- `route-ingress-traffic` — External Ingress Traffic Flow (5 steps)
- `pod-spawning` — Pod Spawning lifecycle (5 steps)
- `pod-to-pod-ovn` — Pod-to-Pod OVN Traffic (5 steps)

### `src/data/components.json`

Array of component metadata objects. Loaded by `InspectorPanel` when a box is clicked.

```jsonc
{
  "componentId": "pod-netns",            // must match the DOM id on the canvas
  "displayName": "Linux Network Namespace (netns)",
  "layer": "Linux Kernel Primitives",    // controls color badge (see LAYER_CONFIG in InspectorPanel)
  "problemSolved": "...",
  "interactions": ["...", "..."],
  "explorationCommands": ["# comment\noc command ..."]
}
```

Valid `layer` values and their accent colors:
| Layer string | Color |
|---|---|
| `"External"` | `#00f0ff` (cyan) |
| `"Management Layer"` | `#33c8ff` (sky) |
| `"Host Networking Subsystem"` | `#39ff88` (green) |
| `"Linux Kernel Primitives"` | `#39ff88` (green) |

Any unknown layer falls back to `#94a3b8` (slate).

---

## All Component IDs

These string IDs must stay consistent across: DOM `id` attributes, `events.json` step references, and `components.json` entries.

| ID | Location on canvas | Layer |
|---|---|---|
| `external-client` | External section | External |
| `api-server` | Management Layer | Management Layer |
| `scheduler` | Management Layer | Management Layer |
| `kubelet` | Management Layer | Management Layer |
| `crio` | Management Layer | Management Layer |
| `ingress-router-haproxy` | Management Layer | Management Layer |
| `app-pod` | Namespace · app > PodLayer | (pod boundary, no inspector entry) |
| `router-pod` | Namespace · router > PodLayer | (pod boundary, no inspector entry) |
| `pod-netns` | KernelPrimitives (inside both pods) | Linux Kernel Primitives |
| `pod-cgroups` | KernelPrimitives (inside both pods) | Linux Kernel Primitives |
| `container-process` | KernelPrimitives (inside both pods) | Linux Kernel Primitives |
| `ovs-bridge-br-int` | Host Networking | Host Networking Subsystem |
| `host-veth-pair` | Host Networking | Host Networking Subsystem |

Note: `pod-netns`, `pod-cgroups`, and `container-process` are rendered twice on the canvas (once inside each `PodLayer`) but share the same `id`. The arrow overlay picks whichever DOM element the browser finds first. When adding new events that target these, test arrow placement with both pods expanded.

---

## Design System

### Color tokens

Defined as CSS custom properties in `src/index.css` and mirrored as Tailwind tokens in `tailwind.config.js` (prefixed `k-`).

```
Background layers:  --c-base (#05070f)  --c-s1  --c-s2  --c-s3
Borders:            --c-bd-dim  --c-bd  --c-bd-hi
Text:               --c-tx-dim  --c-tx-mut  --c-tx  --c-tx-br  --c-tx-wh
Neon accents:       --c-cyan (#00f0ff)  --c-teal (#2dffd5)  --c-amber (#ffcb33)
                    --c-orange (#ff8a2a)  --c-green (#39ff88)  --c-purple (#c084fc)
                    --c-sky (#33c8ff)  --c-pink (#ff5fbf)  --c-red (#ff5470)
```

Use `k-*` Tailwind classes (e.g. `text-k-cyan`, `bg-k-base`) in JSX. Use `var(--c-*)` in inline `style` props or CSS files.

### Typography

| Font family | Tailwind class | Usage |
|---|---|---|
| Inter | `font-sans` | Body text (default) |
| Space Grotesk | `font-display` | Headings, labels, names |
| JetBrains Mono | `font-mono` / `font-code` | Monospace text, badges, commands |

### Visual conventions for layer boundaries

`LayerBoundary` in `Canvas.jsx` accepts a `color` hex and produces consistent bordered containers. Pass `dashed={true}` for namespace-level boxes (the "Logical Project Boundary" semantic). Avoid hardcoding these styled `div`s outside of `Canvas.jsx`; use the `LayerBoundary` component or `PodLayer` for consistent depth cueing.

### ComponentBox states

`ComponentBox` manages three mutually exclusive display states via `accentColor`:

| State | Condition | Visual |
|---|---|---|
| Active/selected | `activeComponentId === id` | Full neon border + ring + glow; scale 1.02 |
| Highlighted | `activeComponentIds.has(id)` | Glow + shimmer animation; full opacity |
| Dimmed | Event active but not in set | `opacity: 0.32` |
| Default | No event active | Subtle border; `opacity: 1` |

---

## Adding a New Event

1. Add an entry to `src/data/events.json` with a unique `eventId`, `eventName`, `description`, and `steps[]`. Each step's `sourceComponentId` and `targetComponentId` must be valid DOM IDs from the table above.

2. Add a theme entry to the `EVENT_THEMES` map in `Sidebar.jsx`:
   ```js
   'your-event-id': { hue: '#hex', label: 'Category' },
   ```

3. If the event uses kernel primitives, the pods auto-expand when any event is selected (see `useEventState.selectEvent` — it sets `expandedPods` to `{ app-pod, router-pod }`). No additional changes needed.

4. If the event involves a **new component** not on the canvas, you must:
   - Add a `ComponentBox` with the new `id` in `Canvas.jsx`.
   - Add an entry to `src/data/components.json` for the inspector.

---

## Adding a New Component

1. Add a `ComponentBox` in `Canvas.jsx` inside the appropriate `LayerBoundary`. Give it a unique `id` string and an appropriate `accentColor` matching the layer color convention.

2. Add a matching entry to `src/data/components.json` with the same `componentId`.

3. If the component participates in existing events, update `events.json` steps accordingly.

---

## CI / Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on every push to `main`:

1. Checks out source.
2. Installs deps with `npm ci`.
3. Runs `npm run build` → `./dist`.
4. Deploys `./dist` to the `github-pages` environment.

There is no staging environment. Changes merged to `main` deploy immediately.

---

## Key Constraints & Gotchas

- **No test suite.** Verify changes manually in the browser with `npm run dev`.
- **Duplicate DOM IDs** — `pod-netns`, `pod-cgroups`, `container-process` appear inside both `PodLayer` instances. This is a known trade-off. Arrow placement may be ambiguous. Don't add more duplicate IDs.
- **ArrowOverlay uses `useLayoutEffect`** — arrow positions are measured after paint. If DOM IDs are missing, arrows silently drop those steps; check the browser console for any issues and validate IDs match.
- **`react-xarrows` is listed as a dependency but is not used.** The arrow rendering is a custom SVG. Do not import or use react-xarrows; remove it from `package.json` if cleaning up deps.
- **Sidebar is a mobile drawer** — on `lg:` and above, it is always visible as a fixed left column. On smaller viewports, it slides in from the left and requires an overlay backdrop click or the X button to close.
- **Canvas min-width is 980px** — the inner cluster grid sets `min-w-[980px]` to prevent layout collapse; the canvas itself is `overflow-auto`.
- **`base: './'` in vite.config.js** — required for GitHub Pages subdirectory hosting. Do not change to `/` without updating the Pages deployment configuration.
