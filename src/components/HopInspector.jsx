import { useEffect, useRef } from 'react'
import componentsData from '../data/components.json'
import { COMPONENT_COLOR } from '../data/zones'
import TypeIcon from './TypeIcon'

function findComponent(id) {
  return componentsData.find(c => c.componentId === id)
}

// A compact, NON-modal hop inspector docked at the bottom of the viewport.
// Unlike AncestryModal it does not dim the page, does not lock scrolling, and
// stays short — so the architecture view behind it remains visible and you keep
// your spatial bearings while reading about a single hop.
export default function HopInspector({ activeEvent, activeStep, onSelectStep, onClose }) {
  const panelRef = useRef(null)

  // Esc closes the inspector, ← / → walk between hops.
  useEffect(() => {
    if (!activeEvent || activeStep == null) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') goto(1)
      else if (e.key === 'ArrowLeft') goto(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent, activeStep])

  // The inspector is fixed to the bottom of the viewport, so at max scroll the
  // overview's last objects stay pinned behind it. Publish the inspector's height
  // (it varies with the description / step) as the --hop-inset CSS variable; the
  // overview's tail spacer reserves that much extra room so every object can be
  // scrolled clear of the panel. A variable (rather than padding a fixed
  // scroller) lets it work for both the window scroll and the compact pane
  // scroll. A ResizeObserver keeps it in step as the panel grows or shrinks.
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
  }, [activeEvent, activeStep])

  if (!activeEvent || activeStep == null) return null

  const steps = activeEvent.steps
  const idx = steps.findIndex(s => s.step === activeStep)
  if (idx === -1) return null
  const step = steps[idx]

  const source = findComponent(step.sourceComponentId)
  const target = findComponent(step.targetComponentId)
  const color = COMPONENT_COLOR[step.targetComponentId] || 'var(--k-cyan)'

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
            <TypeIcon typePrefix={source?.typePrefix} className="type-icon" title={source?.typePrefix} />
            {source?.displayName || step.sourceComponentId}
          </span>
          <span className="hop-inspector-arrow">→</span>
          <span className="hop-inspector-node" style={{ color }}>
            <TypeIcon typePrefix={target?.typePrefix} className="type-icon" title={target?.typePrefix} />
            {target?.displayName || step.targetComponentId}
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

      {(source?.layer || target?.layer) && (
        <div className="hop-inspector-layers">
          <span>{source?.layer || ''}</span>
          <span className="hop-inspector-arrow">→</span>
          <span style={{ color }}>{target?.layer || ''}</span>
        </div>
      )}

      <p className="hop-inspector-desc">{step.description}</p>
    </div>
  )
}
