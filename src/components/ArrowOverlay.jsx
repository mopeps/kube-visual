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

  // S-curve cubic bezier: depart horizontally from source, arrive horizontally at target
  const dx = tx - sx
  const dy = ty - sy
  const cx1 = sx + dx * 0.5
  const cy1 = sy
  const cx2 = tx - dx * 0.5
  const cy2 = ty

  const midX = (sx + tx) / 2 + (dy > 0 ? 0 : 0)
  const midY = (sy + ty) / 2

  return { d: `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`, midX, midY }
}

export default function ArrowOverlay({ activeEvent, canvasRef }) {
  const [paths, setPaths] = useState([])
  const tickRef = useRef(0)

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

  useLayoutEffect(() => {
    tickRef.current += 1
    const t = tickRef.current
    // defer one frame so the DOM has settled after event selection
    const id = requestAnimationFrame(() => {
      if (t === tickRef.current) measure()
    })
    return () => cancelAnimationFrame(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(canvas)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', measure)
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

      {paths.map(p => (
        <g key={p.step}>
          {/* glow layer */}
          <path
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth="4"
            strokeOpacity="0.18"
            filter="url(#arrow-glow)"
          />
          {/* main connector */}
          <path
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth="1.5"
            strokeOpacity="0.75"
            strokeDasharray="6 3"
            markerEnd={`url(#arrow-${p.step})`}
          />
          {/* step badge */}
          <circle
            cx={p.midX}
            cy={p.midY}
            r="11"
            fill="var(--bg-2)"
            stroke={p.color}
            strokeWidth="1.5"
            strokeOpacity="0.8"
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
      ))}
    </svg>
  )
}
