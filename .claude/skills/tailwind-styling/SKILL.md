# Skill: Tailwind Styling

Applies to all JSX files in `src/`. This skill covers how to write styles consistently in this codebase.

---

## Rule 1: Use `k-*` Tailwind tokens for all colors

Never use Tailwind's built-in color palette (e.g., `text-blue-400`, `bg-gray-900`). Always use the project's custom `k-*` tokens defined in `tailwind.config.js`.

### Background layers (darkest → lightest)
```
bg-k-base   (#05070f)   — page background, outermost surface
bg-k-s1     (#0a1020)   — sidebar, panels
bg-k-s2     (#10182c)   — raised cards
bg-k-s3     (#16223e)   — inset / nested surfaces
```

### Text hierarchy
```
text-k-tx-dim  (#64748b)  — disabled, decorative
text-k-tx-mut  (#94a3b8)  — secondary labels, metadata
text-k-tx      (#cbd5e1)  — body text
text-k-tx-br   (#e2e8f0)  — emphasized body
text-k-tx-wh   (#f8fafc)  — headings, primary content
```

### Border tokens
```
border-k-bd-dim  — subtle dividers
border-k-bd      — standard borders (most common)
border-k-bd-hi   — high-contrast borders, active rings
```

### Neon accents (use via class OR CSS var)
```
k-cyan    #00f0ff   — External layer, pod boundaries
k-sky     #33c8ff   — Management Layer
k-purple  #c084fc   — Namespaces / Projects
k-orange  #ff8a2a   — Infrastructure Node boundary
k-green   #39ff88   — Host Networking, Kernel Primitives
k-amber   #ffcb33   — Arrow traces, active event badges
k-teal    #2dffd5   — Focus rings (:focus-visible)
k-pink    #ff5fbf   — Reserved
k-red     #ff5470   — Reserved / error states
```

---

## Rule 2: CSS vars in `style` props, Tailwind classes in `className`

Use `var(--c-*)` when you need a color inside an inline `style` prop (gradients, box-shadows, dynamic hex values). Use `text-k-*` / `bg-k-*` / `border-k-*` in `className`.

```jsx
// Correct
<div
  className="border border-k-bd text-k-tx-wh"
  style={{ boxShadow: `0 0 18px ${accentColor}70` }}
/>

// Wrong — don't mix tailwind color names into style props
<div style={{ color: '#cbd5e1' }} />  // use text-k-tx instead
```

---

## Rule 3: Typography classes

| Use case | Class |
|---|---|
| Headings, layer labels, component names | `font-display` (Space Grotesk) |
| Body descriptions, prose | `font-sans` (Inter, default) |
| Badges, step numbers, metadata chips | `font-mono` (JetBrains Mono) |
| Code/terminal blocks | `font-code` (JetBrains Mono) |

Common text-size patterns in this codebase:
- Layer labels: `text-[12px] font-display font-semibold tracking-wide uppercase`
- Component chip text: `text-[12px] font-medium tracking-tight`
- Badges / metadata: `font-mono text-[10px]` or `text-[11px]`
- Body descriptions: `text-[13px] leading-relaxed`
- Terminal commands: `text-[11.5px] font-code`

---

## Rule 4: Glow / neon effects use inline `style`, not Tailwind

Tailwind's `shadow-*` utilities do not produce neon glows. All glow effects are inline:

```jsx
// Standard neon glow pattern
style={{
  boxShadow: `0 0 18px ${color}70, 0 0 40px ${color}25`
}}

// Pulsing dot indicator
style={{
  boxShadow: '0 0 10px #39ff88, 0 0 4px #39ff88',
  animation: 'pulse-amber 2.4s ease-in-out infinite',
}}

// Text glow
style={{ textShadow: `0 0 10px ${color}80` }}
```

---

## Rule 5: Animations

Custom keyframes are defined in both `tailwind.config.js` (as Tailwind `animation` utilities) and `src/index.css` (for CSS-only animations).

| Class | Effect |
|---|---|
| `animate-slide-in` | Slides from right (+24px), fades in — InspectorPanel |
| `animate-slide-in-left` | Slides from left (−100%), fades in — mobile Sidebar |
| `animate-reveal-up` | Fades up (+6px) — arrow step badges |
| `animate-pulse-amber` | Opacity pulse — status dots |
| `animate-fade-in` | Simple fade — hints |
| `animate-blink` | Step-end blink |

The `arrow-path` and `active-shimmer` classes are CSS-only (in `index.css`) — do not try to use them as Tailwind utilities.

---

## Rule 6: Surface utility classes

Two reusable surface classes exist in `index.css`:

```css
.surface        /* bg-k-s1, standard border, rounded-lg */
.surface-raised /* bg-k-s2, border, drop-shadow, rounded-lg */
```

Use these for new panels or cards instead of repeating the gradient pattern manually.

---

## Rule 7: Responsive breakpoints

The layout uses `lg:` as the primary responsive breakpoint (1024px):
- Below `lg`: sidebar is a mobile drawer, canvas toolbar shows hamburger button.
- At `lg` and above: sidebar is always visible as a fixed left column.

Use `hidden sm:inline`, `hidden md:flex`, `lg:hidden` etc. matching the existing pattern. The canvas inner grid uses `xl:grid-cols-3` (1280px).
