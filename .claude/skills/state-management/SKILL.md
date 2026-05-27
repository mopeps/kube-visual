---
name: state-management
description: Use this skill when working with interactive state, event selection, component selection, or pod expansion. Trigger words: state, useState, hook, useEventState, activeEvent, activeComponentId, activeComponentIds, expandedPods, selectEvent, clearEvent, togglePod, prop drilling, callback, selection, selected, clear, toggle, derived state.
---

# Skill: State Management

Covers the `useEventState` hook — the single source of truth for all interactive state in this app. There is no external state library (no Redux, no Zustand, no Context).

---

## State architecture

All state lives in `src/hooks/useEventState.js` and is lifted to `App.jsx`, which passes slices down as props.

```
App
 ├── Sidebar  ← activeEvent, onSelectEvent
 └── Canvas   ← activeEvent, activeComponentIds, activeComponentId,
                expandedPods, onSelectComponent, onClearComponent,
                onTogglePod, onClearEvent
               └── InspectorPanel  ← activeComponentId
               └── ArrowOverlay    ← activeEvent, expandedPods
```

No component manages its own event/selection state. If you find yourself adding `useState` for selection or active IDs inside a component, move it to `useEventState` instead.

---

## State fields

### `activeEvent` — `object | null`

The full event object from `events.json` for the currently selected event. `null` when no event is active.

```js
// shape when set
{
  eventId: "route-ingress-traffic",
  eventName: "External Ingress Traffic Flow",
  description: "...",
  steps: [{ step, sourceComponentId, targetComponentId, description }, ...]
}
```

### `activeComponentId` — `string | null`

The `componentId` of the component the user last clicked. Opens `InspectorPanel`. `null` when nothing is selected.

Clicking the same component again toggles it off (returns `null`). Clicking canvas background clears it via `onClearComponent`.

### `expandedPods` — `Set<string>`

The set of pod IDs whose `KernelPrimitives` layer is visible. Currently the possible members are `'app-pod'` and `'router-pod'`.

Mutated by two paths:
- `selectEvent` — sets it to `new Set(['app-pod', 'router-pod'])` on event select, clears to `new Set()` on deselect.
- `togglePod` — adds or removes a single pod ID.

### `activeComponentIds` — `Set<string>` (derived)

Not stored in state. Computed fresh on each render:

```js
const activeComponentIds = activeEvent
  ? new Set(activeEvent.steps.flatMap(s => [s.sourceComponentId, s.targetComponentId]))
  : new Set()
```

This is the set that drives `ComponentBox` highlight/dim logic. Do not pass individual boolean flags to components — always pass this Set and let `ComponentBox` call `.has(id)`.

---

## Actions / callbacks

### `selectEvent(event)`

Toggles the active event. If the same event is clicked again, clears it. On select, auto-expands all pods.

```js
// Toggling behaviour:
if (activeEvent?.eventId === event.eventId) {
  setActiveEvent(null)
  setExpandedPods(new Set())
  return
}
setActiveEvent(event)
setExpandedPods(new Set(['app-pod', 'router-pod']))
```

If you add new pods to the canvas, update this line to include the new pod ID.

### `clearEvent()`

Resets `activeEvent` to `null` and `expandedPods` to empty. Called by the toolbar "clear" button and by sidebar event re-selection.

### `selectComponent(id)`

Toggles `activeComponentId`. Clicking the active component clears it.

### `clearComponent()`

Sets `activeComponentId` to `null`. Called on canvas background click and InspectorPanel close.

### `togglePod(podId)`

Adds `podId` to `expandedPods` if absent, removes it if present (immutable Set pattern).

---

## Prop drilling pattern

Props flow strictly top-down. The naming convention used throughout:

| Prop name pattern | Meaning |
|---|---|
| `activeEvent` | Current event object (read) |
| `activeComponentId` | Currently inspected component (read) |
| `activeComponentIds` | Set of highlighted IDs (read) |
| `expandedPods` | Set of expanded pod IDs (read) |
| `onSelectEvent` | Callback to select/toggle an event |
| `onClearEvent` | Callback to clear the active event |
| `onSelectComponent` | Callback to select/toggle a component |
| `onClearComponent` | Callback to clear the selected component |
| `onTogglePod` | Callback to expand/collapse a pod |
| `onOpenSidebar` | Callback to open the mobile sidebar drawer |

Follow this naming pattern when adding new callbacks. Do not rename these props on intermediate components — consistency matters for readability across the file tree.

---

## Adding new state

If you need new interactive state (e.g., a hovered step highlight, a zoom level):

1. Add it to `useEventState.js` as a new `useState` call.
2. Return it from the hook alongside its setter/callback.
3. Destructure it in `App.jsx` and pass it down to the relevant components.

Do not add state directly inside `Canvas.jsx` or other layout components for things that need to be shared across the tree.
