import { useState, useLayoutEffect, useEffect, useRef } from 'react'

// Draws the systemd reconciliation loop directly on the Deep Dive canvas:
// labelled connector edges between the four pillar boxes (desired state / DAG,
// the engine, actual state / cgroup, kernel reality). This is the on-canvas
// replacement for the old "Architectural Blueprint" popup — the end-to-end loop
// now reads straight off the overview instead of an ASCII diagram in a modal.
//
// Like ArrowOverlay it measures DOM rects (boxes carry id="dd-<boxId>") and is a
// pointer-transparent SVG layer; unlike it these edges are a static structural
// map, with a light highlight on the edge that matches the live loop phase.

// Anchor on the box *edges* (not centres) so an arrowhead never lands hidden
// under the target box. Picks the side from the boxes' relative position and
// bows the curve sideways by `bias` so parallel vertical edges don't overlap.
function buildEdge(srcEl, tgtEl, canvasEl, bias) {
  const c = canvasEl.getBoundingClientRect()
  const s = srcEl.getBoundingClientRect()
  const t = tgtEl.getBoundingClientRect()

  const sCx = s.left + s.width / 2 - c.left
  const sCy = s.top + s.height / 2 - c.top
  const tCx = t.left + t.width / 2 - c.left
  const tCy = t.top + t.height / 2 - c.top

  const vertical = Math.abs(tCy - sCy) >= Math.abs(tCx - sCx)
  const bow = bias === 'left' ? -34 : bias === 'right' ? 34 : 0

  let sx, sy, tx, ty
  if (vertical) {
    if (tCy >= sCy) { sx = sCx; sy = s.bottom - c.top; tx = tCx; ty = t.top - c.top }
    else            { sx = sCx; sy = s.top - c.top;    tx = tCx; ty = t.bottom - c.top }
  } else {
    if (tCx >= sCx) { sx = s.right - c.left; sy = sCy; tx = t.left - c.left;  ty = tCy }
    else            { sx = s.left - c.left;  sy = sCy; tx = t.right - c.left; ty = tCy }
  }

  const dx = tx - sx
  const dy = ty - sy
  let cx1, cy1, cx2, cy2
  if (vertical) {
    cx1 = sx + bow; cy1 = sy + dy * 0.45
    cx2 = tx + bow; cy2 = ty - dy * 0.45
  } else {
    cx1 = sx + dx * 0.45; cy1 = sy + bow
    cx2 = tx - dx * 0.45; cy2 = ty + bow
  }

  // Label sits on the curve's midpoint (the bezier midpoint, with the bow).
  const labelX = (sx + tx) / 2 + (vertical ? bow : 0)
  const labelY = (sy + ty) / 2 + (vertical ? 0 : bow)

  return { d: `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`, labelX, labelY }
}

export default function ReconLoopOverlay({ edges, canvasRef, activePhase }) {
  const [paths, setPaths] = useState([])
  const rafRef = useRef(0)

  function measure() {
    const canvas = canvasRef.current
    if (!edges?.length || !canvas) { setPaths([]); return }

    const next = []
    for (const edge of edges) {
      const srcEl = document.getElementById(`dd-${edge.from}`)
      const tgtEl = document.getElementById(`dd-${edge.to}`)
      if (!srcEl || !tgtEl) continue
      next.push({
        ...edge,
        color: `var(--${edge.accent || 'k-cyan'})`,
        ...buildEdge(srcEl, tgtEl, canvas, edge.bias),
      })
    }
    setPaths(next)
  }

  // rAF-batch bursts of resize/scroll into one measure per frame (same rationale
  // as ArrowOverlay), and defer one frame so the canvas has laid out.
  function scheduleMeasure() {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; measure() })
  }

  useLayoutEffect(() => {
    scheduleMeasure()
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(scheduleMeasure)
    ro.observe(canvas)
    window.addEventListener('scroll', scheduleMeasure, { passive: true, capture: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', scheduleMeasure, { capture: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!paths.length) return null

  return (
    <svg
      className="recon-loop-svg"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 4 }}
    >
      <defs>
        {paths.map((p) => (
          <marker key={`m-${p.id}`} id={`recon-arrow-${p.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={p.color} opacity="0.9" />
          </marker>
        ))}
      </defs>

      {paths.map((p) => {
        const live = activePhase && p.phase === activePhase
        const lines = p.label.split('\n')
        return (
          <g key={p.id} className={`recon-edge ${live ? 'is-live' : ''}`}>
            <path
              className="recon-edge-line"
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={live ? 2.4 : 1.5}
              strokeOpacity={live ? 1 : 0.7}
              strokeDasharray="6 4"
              markerEnd={`url(#recon-arrow-${p.id})`}
            />
            {/* step badge + multi-line label, on a backing chip for legibility */}
            <g transform={`translate(${p.labelX} ${p.labelY})`}>
              <circle cx="0" cy="0" r={live ? 9.5 : 8.5} fill="var(--bg-2)" stroke={p.color} strokeWidth={live ? 2 : 1.4} />
              <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight="700" fill={p.color} style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                {p.step}
              </text>
              <text className="recon-edge-label" x="0" y={lines.length > 1 ? 17 : 16} textAnchor="middle" fill={p.color}>
                {lines.map((ln, i) => (
                  <tspan key={i} x="0" dy={i === 0 ? 0 : 10}>{ln}</tspan>
                ))}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}
