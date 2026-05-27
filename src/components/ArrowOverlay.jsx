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
  const mx = (start.x + end.x) / 2
  const my = (start.y + end.y) / 2
  const dx = end.x - start.x
  const dy = end.y - start.y
  const cpx = mx - dy * 0.2
  const cpy = my + dx * 0.2
  const markerId = `arrow-head-${stepNum}`

  return (
    <g>
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#ff4d6d" />
        </marker>
      </defs>
      <path
        d={`M ${start.x} ${start.y} Q ${cpx} ${cpy} ${end.x} ${end.y}`}
        fill="none"
        stroke="#ff4d6d"
        strokeWidth={1.5}
        strokeDasharray="4 2"
        markerEnd={`url(#${markerId})`}
        opacity={0.8}
      />
      <foreignObject x={cpx - 11} y={cpy - 11} width={22} height={22}>
        <div
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'rgba(255,77,109,0.15)',
            border: '1px solid #ff4d6d',
            color: '#ff4d6d',
            fontSize: '10px',
            fontWeight: '700',
            fontFamily: 'Syne, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {stepNum}
        </div>
      </foreignObject>
    </g>
  )
}

export default function ArrowOverlay({ activeEvent, expandedPods }) {
  const [arrows, setArrows] = useState([])

  useLayoutEffect(() => {
    if (!activeEvent) {
      setArrows([])
      return
    }

    const container = document.getElementById('canvas-root')
    if (!container) return

    const newArrows = activeEvent.steps.flatMap(step => {
      const startEl = document.getElementById(step.sourceComponentId)
      const endEl = document.getElementById(step.targetComponentId)
      if (!startEl || !endEl) return []
      return [{
        start: getCenterRelativeTo(startEl, container),
        end: getCenterRelativeTo(endEl, container),
        step: step.step,
      }]
    })

    setArrows(newArrows)
  }, [activeEvent, expandedPods])

  if (!activeEvent || arrows.length === 0) return null

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
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
