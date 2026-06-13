import { Children, useCallback, useEffect, useLayoutEffect, useRef } from 'react'

// A hand-rolled masonry for a zone's node cards (Overview only). A plain
// flex-wrap leaves a hole under any card shorter than its row-mate — most
// visibly beside a 2-tall stacked ServicePair or a store card's extra
// "▸ N objects" line. Masonry fixes that the Pinterest way: every card drops
// into whichever column is currently shortest, so it butts right up under the
// card above it and the grid has no gaps.
//
// Why hand-rolled (no library, no CSS multicol):
//   • CSS multicol balances + reorders cards and can't give one item a
//     full-width row — that combination caused the earlier expand "teleport".
//   • Native CSS `masonry` isn't reliably shipped (esp. iOS Safari).
//
// How it works: the cards are absolutely positioned inside a relative box. We
// measure each card's height at the column width, then walk them in source
// order placing each into the shortest column. An expanded store (its child
// carries `.intent-store-expanded`) is a full-width band: it spans every
// column and resets them all to its bottom, so it sits in place — roughly where
// it was — instead of being confined to one half-width column.
//
// Cards keep their DOM ids (ArrowLines anchors to those via
// getBoundingClientRect, which is layout-agnostic), and changing the container
// height resizes the canvas, which makes ArrowLines re-measure — so trace
// arrows stay pinned.
export default function Masonry({ minColWidth = 120, gap = 8, className = '', children }) {
  const ref = useRef(null)

  const layout = useCallback(() => {
    const el = ref.current
    if (!el) return
    const W = el.clientWidth
    if (!W) return // hidden / not laid out yet — skip, a later pass will run

    const items = Array.from(el.children)
    if (items.length === 0) { el.style.height = '0px'; return }

    const colCount = Math.max(1, Math.floor((W + gap) / (minColWidth + gap)))
    const colW = (W - (colCount - 1) * gap) / colCount

    // Phase 1: fix each card's width (a wide store spans the row) so heights
    // measure at their final width. Phase 2: read all heights in one pass.
    const wide = items.map((it) => !!it.querySelector('.intent-store-expanded'))
    items.forEach((it, i) => { it.style.width = wide[i] ? `${W}px` : `${colW}px` })
    const heights = items.map((it) => it.offsetHeight)

    // Phase 3: place each card into the shortest column; a wide card breaks the
    // band — it spans all columns and resets every column to its bottom.
    const cols = new Array(colCount).fill(0)
    items.forEach((it, i) => {
      if (wide[i]) {
        const y = Math.max(...cols)
        it.style.left = '0px'
        it.style.top = `${y}px`
        cols.fill(y + heights[i] + gap)
      } else {
        let c = 0
        for (let k = 1; k < colCount; k++) if (cols[k] < cols[c]) c = k
        it.style.left = `${c * (colW + gap)}px`
        it.style.top = `${cols[c]}px`
        cols[c] += heights[i] + gap
      }
    })
    el.style.height = `${Math.max(0, Math.max(...cols) - gap)}px`
  }, [gap, minColWidth])

  // Re-pack after every render (card heights change when a store expands, a step
  // badge appears, etc.) — runs before paint so there's no flash of overlap.
  useLayoutEffect(() => { layout() })

  // Re-pack when the container's width changes (orientation, breakpoint, dock).
  // Only width matters — guarding on it avoids a feedback loop, since layout()
  // writes the container's own height, which the observer would otherwise see.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let lastW = el.clientWidth
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w !== lastW) { lastW = w; layout() }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout])

  return (
    <div ref={ref} className={`zone-nodes-masonry ${className}`}>
      {Children.map(children, (child) => (
        <div className="masonry-item" key={child?.key ?? undefined}>{child}</div>
      ))}
    </div>
  )
}
