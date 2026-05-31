// Scroll helpers that work whether the page scrolls the window (mid-width /
// docked desktop) or an inner pane scrolls (the compact swipe pager, where each
// tab is its own `overflow-y:auto` container). Callers used to assume the window
// was always the scroller, which broke once tabs scrolled independently.

// Nearest ancestor that actually scrolls vertically, or null for the window.
export function getScrollParent(el) {
  let p = el?.parentElement
  while (p) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
    p = p.parentElement
  }
  return null
}

// Smoothly bring `el` into the upper third of whatever scrolls it, so the thing
// above it stays visible (handy for following a trace down the stack).
export function scrollIntoUpperThird(el) {
  if (!el) return
  const rect = el.getBoundingClientRect()
  const sp = getScrollParent(el)
  if (sp) {
    const box = sp.getBoundingClientRect()
    sp.scrollBy({ top: rect.top - box.top - box.height * 0.33, behavior: 'smooth' })
  } else {
    window.scrollBy({ top: rect.top - window.innerHeight * 0.33, behavior: 'smooth' })
  }
}
