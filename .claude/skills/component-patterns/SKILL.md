---
name: component-patterns
description: Use this skill when adding, modifying, or understanding any React component in this codebase. Trigger words: component, ComponentBox, LayerBoundary, PodLayer, InspectorPanel, KernelPrimitives, Sidebar, Canvas, Breadcrumb, props, onClick, highlight, dim, expand, collapse, inspector, chip, box, panel, sidebar.
---

# Skill: Component Patterns

Covers how the existing UI components in `src/components/` are structured, what props they accept, and conventions for extending them.

---

## ComponentBox — the core interactive chip

**File:** `src/components/ComponentBox.jsx`

Every clickable node in the diagram is a `ComponentBox`. It manages its own hover state and derives display state from props.

```jsx
<ComponentBox
  id="api-server"              // Required. Must match the DOM id AND events.json componentId
  label="API Server"           // Display text inside the chip
  activeComponentIds={set}     // Set<string> of IDs active in the current event
  activeComponentId={string}   // The single selected/inspected component ID
  onSelect={fn}                // Called with (id) when clicked
  accentColor="#33c8ff"        // Neon hex — controls all highlight colors for this chip
  className=""                 // Optional extra Tailwind classes
  children={null}              // Rarely used
/>
```

### Visual state logic (read before modifying)

| Priority | Condition | Visual outcome |
|---|---|---|
| 1 | `activeComponentId === id` | Selected: full ring + max glow + scale(1.02) |
| 2 | `activeComponentIds.has(id)` | Highlighted: glow + shimmer animation + full opacity |
| 3 | event active + not in set | Dimmed: `opacity: 0.32` |
| 4 | none of the above | Default: subtle border, full opacity |

Do not add extra opacity or glow logic outside this component — it owns its own visual states entirely.

### ID contract

The `id` prop is rendered as the HTML `id` attribute. `ArrowOverlay` calls `document.getElementById(id)` to position arrows. If the ID doesn't exist in the DOM at render time, the arrow step is silently dropped.

---

## LayerBoundary — visual containment box

**File:** `src/components/Canvas.jsx` (defined inline, not exported)

```jsx
<LayerBoundary
  label="Management Layer"     // Uppercase label shown at top-left
  sub="control plane"          // Optional mono subtitle
  color="#33c8ff"              // Accent hex — drives border + gradient + label color
  dashed={false}               // true = dashed border (use for Namespace/Project layers)
  className=""                 // Optional Tailwind overrides
>
  {/* ComponentBox children */}
</LayerBoundary>
```

Color-to-layer mapping used in `Canvas.jsx`:

| Layer | color |
|---|---|
| Management Layer | `#33c8ff` |
| Namespace / Project | `#c084fc` + `dashed={true}` |
| Host Networking | `#39ff88` |

Do not create ad-hoc styled `div`s for new boundary containers — use `LayerBoundary` to stay consistent.

---

## PodLayer — expandable pod with kernel drill-down

**File:** `src/components/PodLayer.jsx`

Wraps a `ComponentBox` (the pod itself) and a `KernelPrimitives` panel that collapses/expands.

```jsx
<PodLayer
  podId="app-pod"              // ID of the pod ComponentBox
  label="Pod · web-app"        // Label for the pod chip
  activeComponentIds={set}
  activeComponentId={string}
  onSelectComponent={fn}
  isExpanded={bool}            // Controlled by expandedPods Set in useEventState
  onToggleExpand={fn}          // Called with (podId)
/>
```

`KernelPrimitives` renders three fixed `ComponentBox` instances: `pod-netns`, `pod-cgroups`, `container-process`. Their IDs are hardcoded — the same IDs appear in both `app-pod` and `router-pod`. See the duplicate ID gotcha in CLAUDE.md.

Expand/collapse is a CSS `max-h` + `opacity` transition (300ms ease-out), not a mount/unmount — the elements stay in the DOM, which matters for arrow measurement.

---

## InspectorPanel — right slide-out metadata panel

**File:** `src/components/InspectorPanel.jsx`

Rendered conditionally by `Canvas` when `activeComponentId` is set. Looks up its data from `components.json` by `componentId`.

```jsx
<InspectorPanel
  componentId="pod-netns"      // Must match a componentId in components.json
  onClose={fn}                 // Clears activeComponentId in useEventState
/>
```

If `componentId` has no matching entry in `components.json`, the component returns `null` silently. Always add a `components.json` entry when adding a new `ComponentBox` that users can click.

The panel renders three sections in order:
1. **What it solves** — `problemSolved` string
2. **Interactions** — bulleted `interactions[]` array
3. **Explore in cluster** — `explorationCommands[]` with copy button

To add a new layer color badge, add an entry to `LAYER_CONFIG` in `InspectorPanel.jsx`.

---

## ArrowOverlay — SVG trace layer

**File:** `src/components/ArrowOverlay.jsx`

See the `arrow-overlay` skill for full details. From a component author's perspective:

- It is rendered as a sibling to the cluster boundary `div` inside `#canvas-root`.
- It is absolutely positioned, fills the parent, and has `pointerEvents: none`.
- It re-measures on every change to `activeEvent` or `expandedPods`.

---

## Breadcrumb — contextual path nav

**File:** `src/components/Breadcrumb.jsx`

Only visible when `expandedPods.size > 0`. Currently hardcoded to show `cluster-01 / node-01 / ns:app / pod:web / kernel`. If you add new namespaces or pods, update the path logic in this component to match.

---

## Sidebar — event list + flow steps

**File:** `src/components/Sidebar.jsx`

The `EVENT_THEMES` map controls the color badge shown per event card. When adding a new event, always add an entry here:

```js
const EVENT_THEMES = {
  'route-ingress-traffic': { hue: '#00f0ff', label: 'Ingress' },
  'pod-spawning':          { hue: '#c084fc', label: 'Lifecycle' },
  'pod-to-pod-ovn':        { hue: '#39ff88', label: 'Network' },
  // add new events here
  'your-event-id':         { hue: '#ffcb33', label: 'YourLabel' },
}
```

If an event ID is missing from `EVENT_THEMES`, it renders with a slate fallback `#94a3b8` — it still works but loses its color identity.

---

## Conventions for new components

1. **No class components.** Function components only.
2. **Inline state only when local.** Component hover (`useState`) is fine locally. Selection/event state belongs in `useEventState`.
3. **`e.stopPropagation()` on clickable children.** The canvas root has an `onClick` that clears `activeComponentId`. Any child click must stop propagation to avoid unintentional clearing.
4. **`accentColor` as hex string.** Always pass a 6-digit hex. The component appends 2-digit opacity suffixes (e.g., `${accentColor}40`). 8-digit hex or `rgba()` will break this pattern.
5. **No anonymous inline components.** If a sub-component is reused or has meaningful logic, extract it and name it (e.g., `LayerBoundary`, `FlowSteps`, `SectionHeader`).
