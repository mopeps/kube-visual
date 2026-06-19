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
// `axis: 'vertical' | 'horizontal'` overrides the side heuristic — a wide box
// fanning out to two columns (the OVN underlay) reads as vertical even when
// the sideways distance beats the drop.
// `spread` fans a vertical edge out of a wide source like a bus bar: the line
// leaves the source at the *target's* x (clamped inside the source box), so a
// full-width underlay drops a near-vertical line onto each node instead of
// diagonals that cross the zone labels.
function buildEdge(srcEl, tgtEl, canvasEl, bias, labelT = 0.5, axis, spread) {
  const c = canvasEl.getBoundingClientRect()
  const s = srcEl.getBoundingClientRect()
  const t = tgtEl.getBoundingClientRect()

  const sCx = s.left + s.width / 2 - c.left
  const sCy = s.top + s.height / 2 - c.top
  const tCx = t.left + t.width / 2 - c.left
  const tCy = t.top + t.height / 2 - c.top

  const vertical = axis
    ? axis === 'vertical'
    : Math.abs(tCy - sCy) >= Math.abs(tCx - sCx)
  const bow = bias === 'left' ? -64 : bias === 'right' ? 64 : 0

  const spreadX = spread
    ? Math.min(Math.max(tCx, s.left - c.left + 18), s.right - c.left - 18)
    : sCx

  let sx, sy, tx, ty
  if (vertical) {
    if (tCy >= sCy) { sx = spreadX; sy = s.bottom - c.top; tx = tCx; ty = t.top - c.top }
    else            { sx = spreadX; sy = s.top - c.top;    tx = tCx; ty = t.bottom - c.top }
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

// A "rail" edge (network mode) routes orthogonally down a column's right-hand
// gutter instead of cutting diagonally across the boxes: out of the source's
// right edge, along a vertical lane near the column edge, into the target's right
// edge. `lane` offsets parallel rails so they don't overlap. Rounded corners keep
// it reading as cable management rather than a hard L.
function buildRailEdge(srcEl, tgtEl, canvasEl, colEl, lane = 0) {
  const c = canvasEl.getBoundingClientRect()
  const s = srcEl.getBoundingClientRect()
  const t = tgtEl.getBoundingClientRect()
  const col = colEl.getBoundingClientRect()

  const railX = col.right - c.left - 7 - lane * 7
  const sx = s.right - c.left
  const sy = s.top + s.height / 2 - c.top
  const tx = t.right - c.left
  const ty = t.top + t.height / 2 - c.top
  const down = ty >= sy
  const r = Math.min(7, Math.abs(ty - sy) / 2)
  // M → horizontal to the rail (rounded) → vertical down/up the rail (rounded) →
  // horizontal back into the target.
  const d = [
    `M ${sx} ${sy}`,
    `L ${railX - r} ${sy}`,
    `Q ${railX} ${sy} ${railX} ${down ? sy + r : sy - r}`,
    `L ${railX} ${down ? ty - r : ty + r}`,
    `Q ${railX} ${ty} ${railX - r} ${ty}`,
    `L ${tx} ${ty}`,
  ].join(' ')
  return { d, labelX: railX, labelY: (sy + ty) / 2 }
}

// `idPrefix` namespaces the DOM lookups: the deep dives' boxes render as
// dd-<boxId> (the default), while the Overview's network overlay passes '' to
// connect raw ids — its own chips and real component cards alike.
export default function ReconLoopOverlay({ edges, canvasRef, activeEdgeId, signal, onSelectEdge, idPrefix = 'dd' }) {
  const [paths, setPaths] = useState([])
  const rafRef = useRef(0)

  function measure() {
    const canvas = canvasRef.current
    if (!edges?.length || !canvas) { setPaths([]); return }

    const next = []
    const railLanes = {}
    for (const edge of edges) {
      const srcEl = document.getElementById(idPrefix ? `${idPrefix}-${edge.from}` : edge.from)
      const tgtEl = document.getElementById(idPrefix ? `${idPrefix}-${edge.to}` : edge.to)
      if (!srcEl || !tgtEl) continue
      // Rail edges route down the owning column's gutter (network mode); fall back
      // to the normal bezier if the column can't be resolved.
      const colIdx = edge.rail ? (/nt-c(\d+)-/.exec(edge.from) || [])[1] : null
      const colEl = colIdx != null ? document.getElementById(`net-col-${colIdx}`) : null
      let built
      if (colEl) {
        // Cycle through a fixed set of lanes so the rails always fit the gutter
        // (rails in different vertical bands can safely share a lane).
        const n = (railLanes[colEl.id] = (railLanes[colEl.id] ?? -1) + 1)
        built = buildRailEdge(srcEl, tgtEl, canvas, colEl, n % 6)
      } else {
        built = buildEdge(srcEl, tgtEl, canvas, edge.bias, edge.labelT, edge.axis, edge.spread)
      }
      next.push({
        ...edge,
        color: `var(--${edge.accent || 'k-cyan'})`,
        ...built,
        // labelDX/labelDY: an explicit chip nudge, independent of the curve. Near
        // the endpoints (small/large labelT) the bow's sideways pull fades out, so
        // two chips parked in the same gap need this to separate horizontally.
        labelX: built.labelX + (edge.labelDX || 0),
        labelY: built.labelY + (edge.labelDY || 0),
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
        // Transient edges (e.g. the cleanup sweep) are part of no steady-state
        // loop — draw them only while they are the active edge.
        if (p.transient && !live) return null
        const lines = p.label ? p.label.split('\n') : []
        // Internal "memory" edges (an actor reading/writing its OWN data —
        // evaluate inside systemd, pin inside the kernel) are not real
        // communication, so they read as a faint dotted line. The syscall /
        // signal crossings stay a bolder dash. The kind tag on the chip names it.
        const internal = p.kind === 'memory'
        // Solid edges are structural wiring (the OVN topology's links): plain
        // continuous lines with no arrowhead, like a textbook diagram — the
        // relationship is bidirectional, direction comes from the trace flows.
        const solid = p.solid && !live
        // A chip is clickable when its edge carries detail and a handler exists —
        // then it opens the edge's popup (same affordance as clicking a box).
        const clickable = !!(p.detail && onSelectEdge)
        const open = () => { if (clickable) onSelectEdge(p) }
        // Network mode keeps every connector faint (`dim`) so the canvas reads
        // calmly; only the connectors of the box you hover light up (`active`).
        const netActive = p.active
        const netDim = p.dim && !p.active
        return (
          <g key={p.id} className={`recon-edge ${live ? 'is-live' : ''} ${netActive ? 'is-net-active' : ''}`}>
            <path
              className="recon-edge-line"
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={live ? 2.4 : netActive ? 2.1 : netDim ? 1 : solid ? 1.8 : internal ? 1.2 : 1.5}
              strokeOpacity={live ? 1 : netActive ? 0.95 : netDim ? 0.22 : solid ? 0.8 : internal ? 0.42 : 0.7}
              strokeDasharray={undefined}
              markerEnd={solid ? undefined : `url(#recon-arrow-${p.id})`}
            />
            {/* The "little box" the user asked for: a solid step-numbered chip
                that sits on the curve (in the gap), so the label never blends
                into a box underneath it. foreignObject lets it auto-size to the
                text and pick up the page's chip styling. CHIP_W/H is just a
                generous canvas the flex wrapper centres the chip within.
                The wrap re-enables pointer events (the SVG layer itself is
                transparent) so the chip can be clicked to open its detail. */}
            {/* An edge with nothing to say draws no chip at all — a plain line,
                like the unlabeled links of a textbook diagram. `showLabel` (network
                mode) further gates the chip so a descriptor only appears where it
                can't cover a box — rail edges, or the hovered box's edges. Deep
                dives leave it undefined → always labelled. */}
            {(p.showLabel ?? true) && (lines.length > 0 || p.kind || p.kindLabel || p.step !== '') && (
            <foreignObject
              x={p.labelX - CHIP_W / 2}
              y={p.labelY - CHIP_H / 2}
              width={CHIP_W}
              height={CHIP_H}
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <div className="recon-edge-chip-wrap" style={clickable ? { pointerEvents: 'auto' } : undefined}>
                <span
                  className={`recon-edge-chip ${p.quiet ? 'recon-edge-chip--quiet' : ''} ${p.mobileHide ? 'recon-edge-chip--mhide' : ''} ${live ? 'is-live' : ''} ${clickable ? 'is-clickable' : ''}`}
                  style={{ '--edge-color': p.color }}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable ? `${p.title || (p.label || '').replace(/\n/g, ' ')} — open details` : undefined}
                  onClick={open}
                  onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open() } }}
                >
                  {p.step !== '' && <span className="recon-edge-chip-num">{p.step}</span>}
                  <span className="recon-edge-chip-label">
                    {(p.kind || p.kindLabel) && (
                      <span className={`recon-edge-chip-kind ${p.kind ? `recon-edge-chip-kind--${p.kind}` : ''}`}>
                        {/* kindLabel overrides the systemd vocabulary so topology
                            edges can name their own link kind (patch, geneve…). */}
                        {p.kindLabel
                          ? p.kindLabel
                          : p.kind === 'memory' ? '⌑ memory' : p.kind === 'signal' ? '⚡ signal' : '↳ syscall'}
                      </span>
                    )}
                    {lines.map((ln, i) => (
                      <span key={i} className="recon-edge-chip-line">{ln}</span>
                    ))}
                  </span>
                  {clickable && !p.quiet && <span className="recon-edge-chip-go" aria-hidden>›</span>}
                </span>
              </div>
            </foreignObject>
            )}
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
              x="0" y="-10" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={signalPath.color}
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
