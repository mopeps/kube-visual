import { useEffect } from 'react'
import { useDockPanel } from '../hooks/useDockPanel'
import { hopPoints } from '../data/hop-kinds'
import { TypeGlyph } from './TypeIcon'
import HopIcon from './HopIcon'
import ObjectText from './ObjectText'
import AuthChip from './AuthChip'

// One route endpoint — its type glyph in a bordered chip (matching the bullet
// glyph chips below) followed by the node's name. Mirrors the Packet Flow tab's
// RouteNode so the inspector route reads in the same vocabulary as the cards.
function RouteEnd({ typePrefix, name, color }) {
  return (
    <span className="hop-route-node" style={color ? { color } : undefined}>
      {typePrefix && (
        <span className="hop-route-ic" aria-hidden>
          <TypeGlyph typePrefix={typePrefix} />
        </span>
      )}
      <span>{name}</span>
    </span>
  )
}

// The shared bottom-docked hop reader used by both the Overview's HopInspector
// and the Deep-Dive trace inspector. A grip-resizable, non-modal panel (defaults
// to a third of the viewport) that keeps the canvas behind it visible. Layout:
//   • a drag grip,
//   • a bar with the step number and the prev/next/close controls,
//   • the source → target route on its own full-width row (so long names wrap
//     without crowding the controls — the mobile pain point), then
//   • the step's detail as a short list of glyph + keyword bullets (one per
//     sentence, classified by hop-kinds), instead of one long paragraph.
export default function HopInspectorShell({
  color,
  step,
  idx,
  total,
  source,
  target,
  description,
  auth,
  onPrev,
  onNext,
  onClose,
  onSelectComponent,
}) {
  const { panelRef, height, resizing, gripProps } = useDockPanel([step])

  // Esc closes, ← / → walk between hops.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      else if (e.key === 'ArrowRight') onNext?.()
      else if (e.key === 'ArrowLeft') onPrev?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNext, onPrev])

  const points = hopPoints(description)

  return (
    <div
      ref={panelRef}
      className={`hop-inspector animate-fade-in${resizing ? ' is-resizing' : ''}`}
      data-noswipe
      style={{ '--hop-accent': color, height: height != null ? `${height}px` : undefined }}
    >
      <div
        className="hop-inspector-grip"
        role="separator"
        aria-label="Drag to resize · double-click to reset"
        {...gripProps}
      >
        <span className="hop-inspector-grip-bar" />
      </div>

      <div className="hop-inspector-bar">
        <span className="hop-inspector-num" style={{ color }}>{step}</span>
        <div className="hop-inspector-controls">
          <span className="hop-inspector-count">{idx + 1} / {total}</span>
          <button
            type="button"
            className="hop-inspector-nav"
            onClick={onPrev}
            disabled={idx === 0}
            aria-label="Previous hop"
          >‹</button>
          <button
            type="button"
            className="hop-inspector-nav"
            onClick={onNext}
            disabled={idx === total - 1}
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

      <div className="hop-inspector-route">
        <RouteEnd typePrefix={source?.typePrefix} name={source?.name} />
        <span className="hop-inspector-arrow" aria-hidden>→</span>
        <RouteEnd typePrefix={target?.typePrefix} name={target?.name} color={color} />
      </div>

      <ul className="hop-points hop-inspector-points">
        {points.map((p, i) => (
          <li key={i} className="hop-point">
            <span
              className="hop-point-ic"
              style={{ color: p.accent, borderColor: `color-mix(in srgb, ${p.accent} 55%, transparent)` }}
              aria-hidden
            >
              <HopIcon name={p.icon} />
            </span>
            <span className="hop-point-text">
              <span className="hop-point-kw" style={{ color: p.accent }}>{p.label} </span>
              <ObjectText text={p.text} onSelectComponent={onSelectComponent} />
            </span>
          </li>
        ))}
      </ul>

      {auth && <AuthChip authId={auth} color={color} />}
    </div>
  )
}
