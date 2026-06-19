import { useState, useLayoutEffect, useEffect, useRef } from 'react'

// The hand-rolled SVG arrow core, shared by the Overview (ArrowOverlay) and the
// Deep Dive (DeepDiveArrowOverlay). It takes a flat list of already-resolved
// steps and draws numbered bezier connectors between their DOM nodes, measuring
// live so the arrows stay pinned through scroll / resize / layout changes.
//
//   steps: [{ step, sourceId, targetId, color }]   // sourceId/targetId are DOM ids
//   idPrefix: namespaces the SVG <marker>/<filter> ids so two overlays can live
//             in the DOM at once (the compact swipe pager renders every pane).

// Evaluate a cubic bezier at parameter t — lets the step badge ride the actual
// curve (important once an edge is bowed sideways; for a straight S-curve this
// returns the plain midpoint, so non-bowed Overview/Deep-Dive edges are unchanged).
function bezier(t, p0, p1, p2, p3) {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

// `bow` bows the curve sideways by N px (perpendicular to its dominant axis) so a
// "road not taken" edge arcs clear of the straight journey spine. 0 = no bow.
export function buildPath(srcEl, tgtEl, canvasEl, edge = false, bow = 0) {
  const canvasRect = canvasEl.getBoundingClientRect()
  const sr = srcEl.getBoundingClientRect()
  const tr = tgtEl.getBoundingClientRect()

  const sCx = sr.left + sr.width / 2 - canvasRect.left
  const sCy = sr.top + sr.height / 2 - canvasRect.top
  const tCx = tr.left + tr.width / 2 - canvasRect.left
  const tCy = tr.top + tr.height / 2 - canvasRect.top

  const vertical = Math.abs(tCy - sCy) >= Math.abs(tCx - sCx)

  // Endpoints. `edge` mode anchors on the facing box edges so the connector and
  // its step badge ride the gap *between* boxes — never across their title text
  // (deep-dive rows pack boxes tight). The Overview keeps centre anchoring: its
  // hops span open zone gaps where a centre-to-centre curve reads cleanly.
  let sx, sy, tx, ty
  if (edge && vertical) {
    if (tCy >= sCy) { sx = sCx; sy = sr.bottom - canvasRect.top; tx = tCx; ty = tr.top - canvasRect.top }
    else            { sx = sCx; sy = sr.top - canvasRect.top;    tx = tCx; ty = tr.bottom - canvasRect.top }
  } else if (edge) {
    if (tCx >= sCx) { sx = sr.right - canvasRect.left; sy = sCy; tx = tr.left - canvasRect.left;  ty = tCy }
    else            { sx = sr.left - canvasRect.left;  sy = sCy; tx = tr.right - canvasRect.left; ty = tCy }
  } else {
    sx = sCx; sy = sCy; tx = tCx; ty = tCy
  }

  // S-curve cubic bezier whose control points follow the flow's dominant axis.
  // The zones stack top-to-bottom, so most hops are vertical: bias the handles
  // along Y there (depart/arrive vertically) for a smooth descent. For the rare
  // horizontal-dominant hop, bias along X instead.
  const dx = tx - sx
  const dy = ty - sy
  let cx1, cy1, cx2, cy2
  if (Math.abs(dy) >= Math.abs(dx)) {
    cx1 = sx + bow;      cy1 = sy + dy * 0.5
    cx2 = tx + bow;      cy2 = ty - dy * 0.5
  } else {
    cx1 = sx + dx * 0.5; cy1 = sy + bow
    cx2 = tx - dx * 0.5; cy2 = ty + bow
  }

  // Ride the actual curve so a bowed edge's badge follows the arc, not the chord.
  const midX = bezier(0.5, sx, cx1, cx2, tx)
  const midY = bezier(0.5, sy, cy1, cy2, ty)

  // Badge anchor. For an edge-anchored vertical hop (the deep-dive spine), the
  // geometric midpoint of a *cross-zone* hop lands on the next zone's header band
  // — its label would sit on top of the header text. So instead of the midpoint,
  // park the badge a short fixed distance down the curve from the source box
  // edge, which lands in the source zone's empty bottom padding. Short *in-zone*
  // hops keep the midpoint (the 0.5 cap), and non-edge curves (the Overview) are
  // unchanged.
  let badgeX = midX
  let badgeY = midY
  if (edge && vertical) {
    // A *fixed* offset below the source box edge — not a fraction of the hop —
    // so every cross-zone badge lands the same short distance into the source
    // zone's bottom padding, independent of how tall (1- vs 2-line) the next
    // zone's header is. Short in-zone hops fall back to the gap midpoint.
    const dir = ty >= sy ? 1 : -1
    const off = Math.min(11, Math.abs(ty - sy) / 2)
    badgeX = sx // bow is 0 for numbered hops, so the curve is vertical here
    badgeY = sy + dir * off
  }

  // Source point too — a denied edge anchors its ✕/label just below the box it
  // *departs* (where the refused connect() is attempted), which always sits in
  // an empty inter-zone gap, so it never collides with a box it bows past.
  return { d: `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`, midX, midY, badgeX, badgeY, sx, sy }
}

export default function ArrowLines({ steps, canvasRef, activeStep, onSelectStep, idPrefix = 'ov', edgeAnchor = false }) {
  const [paths, setPaths] = useState([])
  const rafRef = useRef(0)

  function measure() {
    const canvas = canvasRef.current
    if (!steps?.length || !canvas) { setPaths([]); return }

    const newPaths = []
    for (const s of steps) {
      const srcEl = document.getElementById(s.sourceId)
      const tgtEl = document.getElementById(s.targetId)
      if (!srcEl || !tgtEl) continue
      newPaths.push({
        step: s.step,
        color: s.color || 'var(--k-cyan)',
        // Carried through for "road not taken" edges (the deep-dive control path):
        // denied draws the refused styling, label/onClick make the badge a popup link.
        denied: s.denied,
        label: s.label,
        onClick: s.onClick,
        ...buildPath(srcEl, tgtEl, canvas, edgeAnchor, s.bow || 0),
      })
    }
    setPaths(newPaths)
  }

  // Coalesce bursts of scroll/resize events into at most one measure per frame.
  // measure() does a getBoundingClientRect per step plus a setState, so running
  // it on every raw scroll tick would force layout + re-render many times per
  // frame; one rAF-batched pass keeps the arrows pinned without the jank. The
  // single deferred frame also lets the DOM settle after a (de)selection.
  function scheduleMeasure() {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      measure()
    })
  }

  useLayoutEffect(() => {
    scheduleMeasure()
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(scheduleMeasure)
    ro.observe(canvas)
    // Capture phase so we also catch an inner scroll container (the compact
    // swipe pane), whose scroll events don't bubble to the window.
    window.addEventListener('scroll', scheduleMeasure, { passive: true, capture: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', scheduleMeasure, { capture: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps])

  if (!paths.length) return null

  const markerId = (step) => `arrow-${idPrefix}-${step}`
  const glowId = `arrow-glow-${idPrefix}`
  const blockedId = `arrow-blocked-${idPrefix}`

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <defs>
        {paths.map(p => (
          <marker
            key={`marker-${p.step}`}
            id={markerId(p.step)}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={p.color} opacity="0.85" />
          </marker>
        ))}
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* The denied edge ends in a ⊘ (circle-slash) cap instead of an arrowhead,
            so it reads as "blocked before arrival", never "delivered". */}
        <marker id={blockedId} markerWidth="13" markerHeight="13" refX="6.5" refY="6.5" orient="auto">
          <circle cx="6.5" cy="6.5" r="5" fill="var(--bg-2)" stroke="var(--packet)" strokeWidth="1.4" />
          <path d="M3.3,3.3 L9.7,9.7" stroke="var(--packet)" strokeWidth="1.4" />
        </marker>
      </defs>

      {paths.map(p => {
        const isSelected = activeStep === p.step
        // When a hop is selected, fade the others so the chosen one stands out.
        const dimmed = activeStep != null && !isSelected
        // The badge opens whatever the step wants: a denied edge points at a box
        // popup (its own onClick); a normal hop inspects itself via onSelectStep.
        const badgeClick = p.onClick || (onSelectStep ? () => onSelectStep(p.step) : undefined)
        // Denied edge: park the badge to the side, just below the source box (in
        // its zone's empty bottom padding). A normal hop badge rides the curve at
        // its gap-aware anchor (near the source edge for long cross-zone hops, the
        // midpoint for short in-zone ones) so it never lands on a zone header.
        const bx = p.denied ? p.sx + 40 : p.badgeX
        const by = p.denied ? p.sy + 14 : p.badgeY
        return (
          <g key={p.step} opacity={dimmed ? 0.4 : 1} style={{ transition: 'opacity 0.2s' }}>
            {/* glow layer — skipped for the denied edge so it reads as a thin,
                refused dashed line rather than a lit-up part of the flow. */}
            {!p.denied && (
              <path
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={isSelected ? 6 : 4}
                strokeOpacity={isSelected ? 0.32 : 0.18}
                filter={`url(#${glowId})`}
              />
            )}
            {/* main connector */}
            <path
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={p.denied ? 1.4 : isSelected ? 2.4 : 1.5}
              strokeOpacity={p.denied ? 0.85 : isSelected ? 1 : 0.75}
              strokeDasharray={undefined}
              markerEnd={p.denied ? `url(#${blockedId})` : `url(#${markerId(p.step)})`}
            />
            {/* badge — a numbered step, or a ✕ for the denied edge (with a short
                label so the refused route is legible without opening the popup). */}
            <g
              style={{ cursor: badgeClick ? 'pointer' : 'default', pointerEvents: 'auto' }}
              onClick={badgeClick}
            >
              {/* enlarged transparent hit target for easier tapping on mobile */}
              <circle cx={bx} cy={by} r="16" fill="transparent" />
              <circle
                cx={bx}
                cy={by}
                r={isSelected ? 13 : 11}
                fill="var(--bg-2)"
                stroke={p.color}
                strokeWidth={isSelected ? 2.2 : 1.5}
                strokeOpacity={isSelected ? 1 : 0.8}
              />
              <text
                x={bx}
                y={by}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={p.denied ? 11 : 9}
                fontWeight="700"
                fill={p.color}
                style={{ fontFamily: 'var(--font-mono, monospace)' }}
              >
                {p.denied ? '✕' : p.step}
              </text>
              {p.denied && p.label && (() => {
                const lines = p.label.split('\n')
                // Centre the label block vertically on the badge so a 2-line
                // descriptor straddles it inside the source zone's padding,
                // instead of dropping onto the next zone's header.
                return lines.map((ln, i) => (
                <text
                  key={i}
                  x={bx + 16}
                  y={by + (i - (lines.length - 1) / 2) * 12}
                  textAnchor="start"
                  dominantBaseline="central"
                  fontSize="8.5"
                  fontWeight="600"
                  fill={p.color}
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3, strokeLinejoin: 'round',
                  }}
                >
                  {ln}
                </text>
              ))
              })()}
            </g>
          </g>
        )
      })}
    </svg>
  )
}
