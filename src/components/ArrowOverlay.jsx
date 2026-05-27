import { useState, useLayoutEffect } from 'react'

function getCenterRelativeTo(el, container) {
  const elRect = el.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return {
    x: elRect.left + elRect.width / 2 - containerRect.left + container.scrollLeft,
    y: elRect.top + elRect.height / 2 - containerRect.top + container.scrollTop,
  }
}

function ArrowPath({ start, end, stepNum, totalSteps }) {
  const mx  = (start.x + end.x) / 2
  const my  = (start.y + end.y) / 2
  const dx  = end.x - start.x
  const dy  = end.y - start.y
  const cpx = mx - dy * 0.22
  const cpy = my + dx * 0.22
  const markerId = `arrowhead-${stepNum}`
  const delay = `${(stepNum - 1) * 0.08}s`

  return (
    <g style={{ animationDelay: delay }}>
      <defs>
        <marker id={markerId} markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 7 3, 0 6" fill="#fb923c" />
        </marker>
      </defs>
      {/* Glow layer */}
      <path
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke="#fb923c"
        strokeWidth={4}
        opacity={0.12}
      />
      {/* Main path */}
      <path
        className="arrow-path"
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke="#fb923c"
        strokeWidth={1.5}
        strokeDasharray="300"
        strokeDashoffset="300"
        markerEnd={`url(#${markerId})`}
        opacity={0.9}
        style={{ animationDelay: delay }}
      />
      {/* Step badge */}
      <circle
        cx={cpx}
        cy={cpy}
        r={10}
        fill="rgba(251,146,60,0.12)"
        stroke="#fb923c"
        strokeWidth={1}
        style={{
          animation: `reveal-up 0.3s ease-out ${delay} both`,
        }}
      />
      <text
        x={cpx}
        y={cpy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fb923c"
        fontSize={9}
        fontFamily="'IBM Plex Mono', monospace"
        fontWeight="600"
        style={{
          animation: `reveal-up 0.3s ease-out ${delay} both`,
        }}
      >
        {stepNum}
      </text>
    </g>
  )
}

export default function ArrowOverlay({ activeEvent, expandedPods }) {
  const [arrows, setArrows] = useState([])

  useLayoutEffect(() => {
    if (!activeEvent) { setArrows([]); return }

    const container = document.getElementById('canvas-root')
    if (!container) return

    const newArrows = activeEvent.steps.flatMap(step => {
      const startEl = document.getElementById(step.sourceComponentId)
      const endEl   = document.getElementById(step.targetComponentId)
      if (!startEl || !endEl) return []
      return [{
        start: getCenterRelativeTo(startEl, container),
        end:   getCenterRelativeTo(endEl, container),
        step:  step.step,
      }]
    })

    setArrows(newArrows)
  }, [activeEvent, expandedPods])

  if (!activeEvent || arrows.length === 0) return null

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {arrows.map(a => (
        <ArrowPath key={a.step} start={a.start} end={a.end} stepNum={a.step} totalSteps={arrows.length} />
      ))}
    </svg>
  )
}
