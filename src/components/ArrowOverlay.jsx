import { useState, useLayoutEffect, useEffect, useRef } from 'react'
import { COMPONENT_COLOR } from '../data/zones'

function buildPath(srcEl, tgtEl, canvasEl) {
  const canvasRect = canvasEl.getBoundingClientRect()
  const sr = srcEl.getBoundingClientRect()
  const tr = tgtEl.getBoundingClientRect()

  const sx = sr.left + sr.width / 2 - canvasRect.left
  const sy = sr.top + sr.height / 2 - canvasRect.top
  const tx = tr.left + tr.width / 2 - canvasRect.left
  const ty = tr.top + tr.height / 2 - canvasRect.top

  // S-curve cubic bezier whose control points follow the flow's dominant axis.
  // The zones stack top-to-bottom, so most hops are vertical: bias the handles
  // along Y there (depart/arrive vertically) for a smooth descent. For the rare
  // horizontal-dominant hop, bias along X instead.
  const dx = tx - sx
  const dy = ty - sy
  let cx1, cy1, cx2, cy2
  if (Math.abs(dy) >= Math.abs(dx)) {
    cx1 = sx;            cy1 = sy + dy * 0.5
    cx2 = tx;            cy2 = ty - dy * 0.5
  } else {
    cx1 = sx + dx * 0.5; cy1 = sy
    cx2 = tx - dx * 0.5; cy2 = ty
  }

  const midX = (sx + tx) / 2
  const midY = (sy + ty) / 2

  return { d: `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`, midX, midY }
}

export default function ArrowOverlay({ activeEvent, canvasRef, activeStep, onSelectStep }) {
  const [paths, setPaths] = useState([])
  const rafRef = useRef(0)

  function measure() {
    const canvas = canvasRef.current
    if (!activeEvent || !canvas) { setPaths([]); return }

    const newPaths = []
    for (const step of activeEvent.steps) {
      const srcEl = document.getElementById(step.sourceComponentId)
      const tgtEl = document.getElementById(step.targetComponentId)
      if (!srcEl || !tgtEl) continue
      const color = COMPONENT_COLOR[step.targetComponentId] || 'var(--k-cyan)'
      newPaths.push({ step: step.step, color, ...buildPath(srcEl, tgtEl, canvas) })
    }
    setPaths(newPaths)
  }

  // Coalesce bursts of scroll/resize events into at most one measure per frame.
  // measure() does a getBoundingClientRect per step plus a setState, so running
  // it on every raw scroll tick would force layout + re-render many times per
  // frame; one rAF-batched pass keeps the arrows pinned without the jank. The
  // single deferred frame also lets the DOM settle after event selection.
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
  }, [activeEvent])

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
  }, [activeEvent])

  if (!paths.length) return null

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
            id={`arrow-${p.step}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={p.color} opacity="0.85" />
          </marker>
        ))}
        <filter id="arrow-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paths.map(p => {
        const isSelected = activeStep === p.step
        // When a hop is selected, fade the others so the chosen one stands out.
        const dimmed = activeStep != null && !isSelected
        return (
          <g key={p.step} opacity={dimmed ? 0.28 : 1} style={{ transition: 'opacity 0.2s' }}>
            {/* glow layer */}
            <path
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={isSelected ? 6 : 4}
              strokeOpacity={isSelected ? 0.32 : 0.18}
              filter="url(#arrow-glow)"
            />
            {/* main connector */}
            <path
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={isSelected ? 2.4 : 1.5}
              strokeOpacity={isSelected ? 1 : 0.75}
              strokeDasharray="6 3"
              markerEnd={`url(#arrow-${p.step})`}
            />
            {/* step badge — clickable to inspect this hop */}
            <g
              style={{ cursor: onSelectStep ? 'pointer' : 'default', pointerEvents: 'auto' }}
              onClick={onSelectStep ? () => onSelectStep(p.step) : undefined}
            >
              {/* enlarged transparent hit target for easier tapping on mobile */}
              <circle cx={p.midX} cy={p.midY} r="16" fill="transparent" />
              <circle
                cx={p.midX}
                cy={p.midY}
                r={isSelected ? 13 : 11}
                fill="var(--bg-2)"
                stroke={p.color}
                strokeWidth={isSelected ? 2.2 : 1.5}
                strokeOpacity={isSelected ? 1 : 0.8}
              />
              <text
                x={p.midX}
                y={p.midY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fontWeight="700"
                fill={p.color}
                style={{ fontFamily: 'var(--font-mono, monospace)' }}
              >
                {p.step}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}
