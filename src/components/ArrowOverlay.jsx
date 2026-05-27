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
  const delay = `${(stepNum - 1) * 0.1}s`
  const accent = '#ffcb33'

  return (
    <g style={{ animationDelay: delay }}>
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 L2,4 Z" fill={accent} />
        </marker>
      </defs>
      {/* Outer glow */}
      <path
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke={accent}
        strokeWidth={10}
        opacity={0.15}
      />
      {/* Inner glow */}
      <path
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke={accent}
        strokeWidth={4}
        opacity={0.32}
      />
      {/* Main path */}
      <path
        className="arrow-path"
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="400"
        strokeDashoffset="400"
        markerEnd={`url(#${markerId})`}
        opacity={0.95}
        style={{ animationDelay: delay }}
      />
      {/* Step badge */}
      <circle
        cx={cpx}
        cy={cpy}
        r={11}
        fill="#0c1424"
        stroke={accent}
        strokeWidth={1.5}
        style={{ animation: `reveal-up 0.35s ease-out ${delay} both` }}
      />
      <text
        x={cpx}
        y={cpy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={accent}
        fontSize={10}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="600"
        style={{ animation: `reveal-up 0.35s ease-out ${delay} both` }}
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
