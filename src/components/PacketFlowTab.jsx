import { useState } from 'react'
import componentsData from '../data/components.json'
import { COMPONENT_COLOR } from '../data/zones'

function findComponent(id) {
  return componentsData.find(c => c.componentId === id)
}

function Hop({ step, isOpen, onToggle, isFinal }) {
  const target = findComponent(step.targetComponentId)
  const source = findComponent(step.sourceComponentId)
  const color = COMPONENT_COLOR[step.targetComponentId] || 'var(--k-cyan)'
  const sourceColor = COMPONENT_COLOR[step.sourceComponentId] || color

  return (
    <div className="hop" onClick={onToggle}>
      <div className="hop-num-col">
        <div
          className="hop-num"
          style={{
            background: `${color}26`,
            border: `1px solid ${color}`,
            color,
          }}
        >
          {step.step}
        </div>
        {!isFinal && (
          <div
            className="hop-line"
            style={{ background: `linear-gradient(${color}, ${color}33)` }}
          />
        )}
      </div>
      <div className="hop-body" style={{ borderColor: `${color}40` }}>
        <h3>
          <span className="packet-dot" />
          <span>
            {source?.displayName || step.sourceComponentId}
            <span style={{ color: 'var(--tx-dim)', margin: '0 8px' }}>→</span>
            <span style={{ color }}>{target?.displayName || step.targetComponentId}</span>
          </span>
        </h3>
        <div className="hop-meta">
          <span style={{ color: sourceColor }}>{source?.layer || ''}</span>
          <span style={{ color: 'var(--tx-dim)' }}>→</span>
          <span style={{ color }}>{target?.layer || ''}</span>
        </div>
        <p>{step.description}</p>
        {target?.explorationCommands?.length > 0 && (
          <div className={`hop-detail ${isOpen ? 'is-open' : ''}`}>
            <div
              className="text-[0.6rem] uppercase tracking-[0.14em] mb-2"
              style={{ color: 'var(--tx-muted)' }}
            >
              Explore the target ({target.displayName})
            </div>
            {target.explorationCommands.map((cmd, i) => (
              <pre key={i} className="code-block mb-2">{cmd}</pre>
            ))}
          </div>
        )}
        <div
          className="text-[0.6rem] mt-3"
          style={{ color: 'var(--tx-dim)' }}
        >
          {isOpen ? '▾ click to collapse' : '▸ click to inspect target'}
        </div>
      </div>
    </div>
  )
}

export default function PacketFlowTab({ activeEvent }) {
  const [open, setOpen] = useState(new Set())

  if (!activeEvent) {
    return (
      <div
        className="border border-border-w rounded-lg p-10 text-center"
        style={{ background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="font-display text-[1.2rem] mb-2">No trace selected</div>
        <p className="text-[0.75rem]" style={{ color: 'var(--tx-muted)' }}>
          Pick a flow from the trace selector above to step through every hop
          from external client to PID&nbsp;1.
        </p>
      </div>
    )
  }

  const toggle = (n) => {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  return (
    <div>
      <div className="mb-5">
        <div className="font-display text-[1.35rem] font-semibold mb-1">
          {activeEvent.eventName}
        </div>
        <p className="text-[0.78rem]" style={{ color: 'var(--tx-muted)' }}>
          {activeEvent.description}
        </p>
      </div>
      <div>
        {activeEvent.steps.map((step, i) => (
          <Hop
            key={step.step}
            step={step}
            isOpen={open.has(step.step)}
            onToggle={() => toggle(step.step)}
            isFinal={i === activeEvent.steps.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
