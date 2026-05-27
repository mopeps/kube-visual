# Skill: Arrow Overlay

Covers how the event trace arrows are rendered in `src/components/ArrowOverlay.jsx`. This is a custom SVG implementation — not react-xarrows (which is an unused dependency).

---

## How it works

1. `ArrowOverlay` is rendered as a sibling to the cluster layout `div` inside `#canvas-root`.
2. It is absolutely positioned (`position: absolute, top:0, left:0`) and fills the scroll container with `overflow: visible`.
3. `pointerEvents: none` — it never intercepts mouse events.
4. On every change to `activeEvent` or `expandedPods`, a `useLayoutEffect` re-measures all arrow positions.

---

## Arrow measurement

```js
useLayoutEffect(() => {
  if (!activeEvent) { setArrows([]); return }

  const container = document.getElementById('canvas-root')
  // For each step, find source and target DOM elements by their HTML id
  const newArrows = activeEvent.steps.flatMap(step => {
    const startEl = document.getElementById(step.sourceComponentId)
    const endEl   = document.getElementById(step.targetComponentId)
    if (!startEl || !endEl) return []   // silently skips missing elements
    return [{
      start: getCenterRelativeTo(startEl, container),
      end:   getCenterRelativeTo(endEl, container),
      step:  step.step,
    }]
  })
  setArrows(newArrows)
}, [activeEvent, expandedPods])
```

**Why `expandedPods` is a dependency:** KernelPrimitive boxes (`pod-netns`, `pod-cgroups`, `container-process`) are only in the DOM when a pod is expanded. The overlay must re-measure after expansion.

`getCenterRelativeTo(el, container)` returns the element's center in container-relative coordinates, accounting for `container.scrollLeft` and `container.scrollTop`.

---

## Arrow rendering — `ArrowPath`

Each step produces one `<g>` element containing:

1. **Outer glow path** — `strokeWidth: 10, opacity: 0.15` (soft ambient)
2. **Inner glow path** — `strokeWidth: 4, opacity: 0.32`
3. **Main path** — `strokeWidth: 1.5, opacity: 0.95` with draw animation
4. **Step badge** — `<circle>` + `<text>` at the bezier curve midpoint

The curve is a **quadratic bezier**:

```
control point:
  cpx = midX - dy * 0.22   (perpendicular offset)
  cpy = midY + dx * 0.22
```

This gives a gentle consistent curve. The 0.22 factor controls curvature. Increase it for sharper curves, decrease for flatter.

The arrowhead is an SVG `<marker>` — a filled polygon `M0,0 L8,4 L0,8 L2,4`. Each step gets a unique marker ID (`arrowhead-{stepNum}`) to avoid SVG marker conflicts.

---

## Animation

The main path uses the `arrow-path` CSS class from `index.css`:

```css
@keyframes draw-path {
  from { stroke-dashoffset: 400; opacity: 0; }
  to   { stroke-dashoffset: 0;   opacity: 0.9; }
}
.arrow-path {
  animation: draw-path 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
```

Each step is staggered with `animationDelay: (step - 1) * 0.1 + 's'`. The badge and background also use staggered `reveal-up` animation via inline `style`.

The `strokeDasharray: 400` is a fixed value. If you add very long arrow paths across a wide canvas, increase this value or the arrow may not fully draw.

---

## Color

All arrows use the amber accent: `#ffcb33`. This is hardcoded in `ArrowPath` as `const accent = '#ffcb33'`. There is no per-event theming of arrow color. If you want per-event arrow colors, derive the color from a prop (e.g., pass the event's theme hue down from `EVENT_THEMES` in the Sidebar).

---

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Arrow step missing entirely | `sourceComponentId` or `targetComponentId` not in DOM | Check the `id` prop on the relevant `ComponentBox` matches the event JSON |
| Arrow starts/ends at wrong position | Component not yet visible (pod collapsed) | Ensure `expandedPods` triggers re-measurement; check `useLayoutEffect` dep array |
| Arrow draws from (0,0) | Container scroll offset not accounted for | `getCenterRelativeTo` already handles scroll; verify container ID is `canvas-root` |
| Arrow animation doesn't play on re-select | Same event re-selected but arrows already computed | Arrows re-render because `activeEvent` reference changes on re-select (React state) |
| Arrows overlap badly | Multiple steps hitting same IDs (e.g., `host-veth-pair` source and target) | Expected for loopback flows; the quadratic offset naturally separates them slightly |

---

## Extending arrows

To add a custom stroke color per event, thread the event theme color:

```jsx
// In ArrowOverlay:
export default function ArrowOverlay({ activeEvent, expandedPods, accentColor = '#ffcb33' }) {
  // pass accentColor down to ArrowPath
}

// In Canvas.jsx, look up the theme and pass:
import { EVENT_THEMES } from './Sidebar'  // or extract to a shared const
<ArrowOverlay
  activeEvent={activeEvent}
  expandedPods={expandedPods}
  accentColor={activeEvent ? (EVENT_THEMES[activeEvent.eventId]?.hue ?? '#ffcb33') : '#ffcb33'}
/>
```

To change curve shape, adjust the `0.22` perpendicular offset factor in `ArrowPath`. Values around `0.15`–`0.35` give natural-looking curves.
