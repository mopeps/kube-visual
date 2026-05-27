import { useState, useLayoutEffect } from 'react'

function getCenterRelativeTo(el, container) {
  const elRect = el.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return {
    x: elRect.left + elRect.width / 2 - containerRect.left + container.scrollLeft,
    y: elRect.top + elRect.height / 2 - containerRect.top + container.scrollTop,
  }
}

function ArrowPath({ start, end, stepNum }) {
  const mx  = (start.x + end.x) / 2
  const my  = (start.y + end.y) / 2
  const dx  = end.x - start.x
  const dy  = end.y - start.y
  const cpx = mx - dy * 0.22
  const cpy = my + dx * 0.22
  const markerId = `arrowhead-${stepNum}`
  const delay = `${(stepNum - 1) * 0.1}s`
  // Catppuccin peach — single warm accent across all trace strokes
  const accent = '#fab387'
  const badgeFill = '#11111b'

  return (
    <g style={{ animationDelay: delay }}>
      <defs>
        <marker id={markerId} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 L2,4.5 Z" fill={accent} />
        </marker>
      </defs>
      {/* Soft outer halo */}
      <path
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke={accent}
        strokeWidth={8}
        opacity={0.10}
      />
      {/* Mid glow */}
      <path
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke={accent}
        strokeWidth={3}
        opacity={0.22}
      />
      {/* Main path — drawn-on */}
      <path
        className="arrow-path"
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke={accent}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeDasharray="6 3"
        strokeDashoffset="400"
        markerEnd={`url(#${markerId})`}
        opacity={0.95}
        style={{ animationDelay: delay }}
      />
      {/* Step badge — square, terminal-character feel */}
      <rect
        x={cpx - 10}
        y={cpy - 10}
        width={20}
        height={20}
        fill={badgeFill}
        stroke={accent}
        strokeWidth={1.25}
        style={{ animation: `reveal-up 0.35s ease-out ${delay} both` }}
      />
      <text
        x={cpx}
        y={cpy + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fill={accent}
        fontSize={10.5}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="700"
        letterSpacing="0.5"
        style={{ animation: `reveal-up 0.35s ease-out ${delay} both` }}
      >
        {String(stepNum).padStart(2, '0')}
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
        <ArrowPath key={a.step} start={a.start} end={a.end} stepNum={a.step} />
      ))}
    </svg>
  )
}
