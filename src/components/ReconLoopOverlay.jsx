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

// A generous box the label chip is centred within (the chip itself auto-sizes
// to its text; this is only the foreignObject canvas + the half-offsets used to
// centre it on the curve point).
const CHIP_W = 240
const CHIP_H = 72

// Evaluate a cubic bezier at parameter t — used to drop the label chip exactly
// on the curve (so it tracks the bow), and to slide parallel edges' chips apart.
function bezier(t, p0, p1, p2, p3) {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

// Anchor on the box *edges* (not centres) so an arrowhead never lands hidden
// under the target box. Picks the side from the boxes' relative position and
// bows the curve sideways by `bias` so parallel vertical edges don't overlap.
// `labelT` slides the label chip along the curve (0 = source … 1 = target) so two
// edges sharing the same gap can park their chips at different points.
function buildEdge(srcEl, tgtEl, canvasEl, bias, labelT = 0.5) {
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

  // Drop the label chip on the curve itself at labelT — for vertical edges that
  // lands it squarely in the inter-zone gap; for horizontal edges, in the gap
  // between the two boxes it spans.
  const labelX = bezier(labelT, sx, cx1, cx2, tx)
  const labelY = bezier(labelT, sy, cy1, cy2, ty)

  return { d: `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`, labelX, labelY }
}

export default function ReconLoopOverlay({ edges, canvasRef, activeEdgeId, signal }) {
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
        ...buildEdge(srcEl, tgtEl, canvas, edge.bias, edge.labelT),
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

  const signalPath = signal ? paths.find((p) => p.id === signal.edgeId) : null

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
        const live = activeEdgeId && p.id === activeEdgeId
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
            {/* The "little box" the user asked for: a solid step-numbered chip
                that sits on the curve (in the gap), so the label never blends
                into a box underneath it. foreignObject lets it auto-size to the
                text and pick up the page's chip styling. CHIP_W/H is just a
                generous canvas the flex wrapper centres the chip within. */}
            <foreignObject
              x={p.labelX - CHIP_W / 2}
              y={p.labelY - CHIP_H / 2}
              width={CHIP_W}
              height={CHIP_H}
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <div className="recon-edge-chip-wrap">
                <span className={`recon-edge-chip ${live ? 'is-live' : ''}`} style={{ '--edge-color': p.color }}>
                  <span className="recon-edge-chip-num">{p.step}</span>
                  <span className="recon-edge-chip-label">
                    {lines.map((ln, i) => (
                      <span key={i} className="recon-edge-chip-line">{ln}</span>
                    ))}
                  </span>
                </span>
              </div>
            </foreignObject>
          </g>
        )
      })}

      {/* The travelling signal — a token that animates along the active edge's
          path (replacing the old side-docked courier), so a crossing signal
          like SIGCHLD or fork()/execve() visibly moves between the two boxes it
          connects. Keyed so it replays whenever the step changes. */}
      {signalPath && (
        <g key={signal.key} className="recon-signal">
          <g>
            <circle r="5" fill={signalPath.color} />
            {/* paint-order:stroke draws a thick bg-coloured halo behind the
                glyphs so the moving signal stays readable over any box. */}
            <text
              x="0" y="-9" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={signalPath.color}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3.5, strokeLinejoin: 'round',
              }}
            >
              {signal.label}
            </text>
            <animateMotion dur="1.15s" begin="0s" fill="freeze" path={signalPath.d} rotate="0" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.82;1" dur="1.15s" begin="0s" fill="freeze" />
          </g>
        </g>
      )}
    </svg>
  )
}
