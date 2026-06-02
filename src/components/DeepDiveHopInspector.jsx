import { useEffect, useRef } from 'react'
import TypeIcon from './TypeIcon'

// The Overview's HopInspector, reused for deep-dive trace flows. Same compact,
// NON-modal panel docked at the bottom of the viewport (so the canvas behind it
// stays visible), but it resolves source/target *boxes* from the topic's box
// index instead of architecture components. Mounted at App root — like the
// Overview inspector — so its `position: fixed` anchors to the viewport rather
// than a transformed swipe pane.
export default function DeepDiveHopInspector({ boxIndex, activeFlow, activeStep, onSelectStep, onClose }) {
  const panelRef = useRef(null)

  // Esc closes the inspector, ← / → walk between hops.
  useEffect(() => {
    if (!activeFlow || activeStep == null) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') goto(1)
      else if (e.key === 'ArrowLeft') goto(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlow, activeStep])

  // Publish the panel height as --hop-inset so the canvas tail spacer reserves
  // room to scroll the bottom box clear of this fixed panel (mirrors HopInspector).
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const root = document.documentElement
    const apply = () => {
      root.style.setProperty('--hop-inset', `${Math.round(el.offsetHeight) + 24}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--hop-inset')
    }
  }, [activeFlow, activeStep])

  if (!activeFlow || activeStep == null) return null

  const steps = activeFlow.steps
  const idx = steps.findIndex(s => s.step === activeStep)
  if (idx === -1) return null
  const step = steps[idx]

  const source = boxIndex[step.sourceBoxId]
  const target = boxIndex[step.targetBoxId]
  const color = target?.accent || 'var(--k-cyan)'

  function goto(dir) {
    const next = steps[idx + dir]
    if (next) onSelectStep(next.step)
  }

  return (
    <div ref={panelRef} className="hop-inspector animate-fade-in" style={{ '--hop-accent': color }}>
      <div className="hop-inspector-bar">
        <span className="hop-inspector-num" style={{ color }}>{step.step}</span>
        <div className="hop-inspector-route">
          <span className="hop-inspector-node">
            <TypeIcon typePrefix={source?.box.typePrefix} className="type-icon" title={source?.box.typePrefix} />
            {source?.box.title || step.sourceBoxId}
          </span>
          <span className="hop-inspector-arrow">→</span>
          <span className="hop-inspector-node" style={{ color }}>
            <TypeIcon typePrefix={target?.box.typePrefix} className="type-icon" title={target?.box.typePrefix} />
            {target?.box.title || step.targetBoxId}
          </span>
        </div>
        <div className="hop-inspector-controls">
          <span className="hop-inspector-count">
            {idx + 1} / {steps.length}
          </span>
          <button
            type="button"
            className="hop-inspector-nav"
            onClick={() => goto(-1)}
            disabled={idx === 0}
            aria-label="Previous hop"
          >‹</button>
          <button
            type="button"
            className="hop-inspector-nav"
            onClick={() => goto(1)}
            disabled={idx === steps.length - 1}
            aria-label="Next hop"
          >›</button>
          <button
            type="button"
            className="hop-inspector-close"
            onClick={onClose}
            aria-label="Close (Esc)"
          >✕</button>
        </div>
      </div>

      {(source?.zone.label || target?.zone.label) && (
        <div className="hop-inspector-layers">
          <span>{source?.zone.label || ''}</span>
          <span className="hop-inspector-arrow">→</span>
          <span style={{ color }}>{target?.zone.label || ''}</span>
        </div>
      )}

      <p className="hop-inspector-desc">{step.description}</p>
    </div>
  )
}
