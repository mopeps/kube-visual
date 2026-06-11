import { useEffect, useMemo, useRef, useState } from 'react'
import ReconLoopOverlay from './ReconLoopOverlay'
import { NET_CHIPS, NET_EDGES, NET_TRACE } from '../data/network-topology'

// The OVN logical topology drawn over the real Overview canvas (wide desktop
// only): synthetic chips for the logical objects (join switch, cluster router,
// node switches, gateway routers), anchored to the component cards that
// realize them, plus always-on labeled edges (ReconLoopOverlay with idPrefix
// '' so chips and real cards connect alike). The layer switch DIMS the
// non-focused SDN instead of unmounting it — most packets traverse both.
//
// Chips are positioned by measuring their anchor's rect relative to the
// canvas (the ArrowLines pattern: rAF-batched, ResizeObserver + scroll), and
// the edge layer re-measures whenever chip positions land (edges get a fresh
// array identity per measure tick).

const GLYPH = { switch: '⇄', router: '◆' }

function anchorPoint(rect, at) {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  switch (at) {
    case 'above': return { x: cx, y: rect.y }
    case 'below': return { x: cx, y: rect.y + rect.h }
    case 'left': return { x: rect.x, y: cy }
    case 'right': return { x: rect.x + rect.w, y: cy }
    default: return { x: cx, y: cy }
  }
}

export default function NetworkOverlay({ canvasRef, layerFocus, traceOn, onSelectChip, onSelectEdge }) {
  const [pos, setPos] = useState(null) // { chipId: { x, y } } — chip centres
  const [tick, setTick] = useState(0)
  const rafRef = useRef(0)

  function measure() {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getBoundingClientRect()
    const next = {}
    for (const chip of NET_CHIPS) {
      const el = document.getElementById(chip.anchor.to)
      if (!el) continue
      const r = el.getBoundingClientRect()
      const p = anchorPoint({ x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }, chip.anchor.at)
      next[chip.id] = { x: p.x + (chip.anchor.dx || 0), y: p.y + (chip.anchor.dy || 0) }
    }
    setPos(next)
    // New tick → fresh edges array identity → the edge overlays re-measure
    // against the freshly placed chips.
    setTick((t) => t + 1)
  }

  function scheduleMeasure() {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; measure() })
  }

  useEffect(() => {
    scheduleMeasure()
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ro = new ResizeObserver(scheduleMeasure)
    ro.observe(canvas)
    window.addEventListener('scroll', scheduleMeasure, { passive: true, capture: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', scheduleMeasure, { capture: true })
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // One edge list per layer (own wrapper → layer dimming via CSS opacity);
  // identity refreshed per measure tick so ReconLoopOverlay re-measures.
  const edgesByLayer = useMemo(() => {
    const groups = { mgmt: [], guest: [], cross: [] }
    for (const e of NET_EDGES) groups[e.layer]?.push({ ...e })
    return groups
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  const traceEdges = useMemo(
    () => (traceOn ? NET_TRACE.edges.map((e) => ({ ...e })) : null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [traceOn, tick],
  )

  if (!pos) return null

  const dimmed = (layer) =>
    (layerFocus !== 'both' && layer !== 'cross' && layer !== layerFocus) ||
    // While the packet trace runs, the static wiring recedes further.
    (traceOn && layer !== 'trace')

  return (
    <>
      {['mgmt', 'guest', 'cross'].map((layer) => (
        <div key={layer} className={`net-edge-layer ${dimmed(layer) ? 'is-dim' : ''}`}>
          <ReconLoopOverlay
            edges={edgesByLayer[layer]}
            canvasRef={canvasRef}
            activeEdgeId={null}
            signal={null}
            onSelectEdge={onSelectEdge}
            idPrefix=""
          />
        </div>
      ))}
      {traceEdges && (
        <div className="net-edge-layer net-edge-layer--trace">
          <ReconLoopOverlay
            edges={traceEdges}
            canvasRef={canvasRef}
            activeEdgeId={null}
            signal={null}
            onSelectEdge={onSelectEdge}
            idPrefix=""
          />
        </div>
      )}
      <div className="net-chip-layer">
        {NET_CHIPS.map((chip) => {
          const p = pos[chip.id]
          if (!p) return null
          return (
            <button
              key={chip.id}
              id={chip.id}
              type="button"
              className={`net-chip net-chip--${chip.layer} ${dimmed(chip.layer) ? 'is-dim' : ''}`}
              style={{ left: p.x, top: p.y }}
              onClick={(e) => { e.stopPropagation(); onSelectChip(chip) }}
              title={chip.detail.role}
            >
              <span className="net-chip-glyph" aria-hidden>{GLYPH[chip.kind]}</span>
              {chip.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
