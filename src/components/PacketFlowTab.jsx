import { useState, useEffect, useRef } from 'react'
import componentsData from '../data/components.json'
import events from '../data/events.json'
import { COMPONENT_COLOR } from '../data/zones'

function findComponent(id) {
  return componentsData.find(c => c.componentId === id)
}

function Hop({ step, isOpen, isSelected, onToggle, onJump, isFinal }) {
  const target = findComponent(step.targetComponentId)
  const source = findComponent(step.sourceComponentId)
  const color = COMPONENT_COLOR[step.targetComponentId] || 'var(--k-cyan)'
  const sourceColor = COMPONENT_COLOR[step.sourceComponentId] || color

  return (
    <div className={`hop ${isSelected ? 'is-selected' : ''}`} data-step={step.step} onClick={onToggle}>
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
      <div
        className="hop-body"
        style={{ borderColor: isSelected ? color : `${color}40` }}
      >
        <h3>
          {onJump ? (
            <button
              type="button"
              className="hop-link"
              onClick={(e) => { e.stopPropagation(); onJump(step.step) }}
              title="Reveal this object in the architecture overview"
            >
              <span className="hop-link-src">{source?.displayName || step.sourceComponentId}</span>
              <span style={{ color: 'var(--tx-dim)', margin: '0 8px' }}>→</span>
              <span className="hop-link-tgt" style={{ color }}>{target?.displayName || step.targetComponentId}</span>
              <span className="hop-link-go" aria-hidden style={{ color }}>↗</span>
            </button>
          ) : (
            <span>
              {source?.displayName || step.sourceComponentId}
              <span style={{ color: 'var(--tx-dim)', margin: '0 8px' }}>→</span>
              <span style={{ color }}>{target?.displayName || step.targetComponentId}</span>
            </span>
          )}
        </h3>
        <div className="hop-meta">
          <span style={{ color: sourceColor }}>{source?.layer || ''}</span>
          <span style={{ color: 'var(--tx-dim)' }}>→</span>
          <span style={{ color }}>{target?.layer || ''}</span>
        </div>
        <p>{step.description}</p>
        {target?.explorationCommands?.length > 0 && (
          <>
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
            <span className={`hop-chevron ${isOpen ? 'is-open' : ''}`} aria-hidden>⌄</span>
          </>
        )}
      </div>
    </div>
  )
}

// Shown when no trace is selected: a gallery of every available flow so the tab
// is never empty. Picking one promotes it to the active trace.
function EventGallery({ onSelectEvent }) {
  return (
    <div>
      <div className="mb-3">
        <div className="font-display text-[1.1rem] font-semibold mb-0.5">
          Choose a trace flow
        </div>
        <p className="text-[0.72rem]" style={{ color: 'var(--tx-muted)' }}>
          Pick a flow to step through every hop from external client to PID&nbsp;1.
        </p>
      </div>
      <div className="event-gallery">
        {events.map(e => (
          <button
            key={e.eventId}
            type="button"
            className="event-card"
            onClick={() => onSelectEvent(e)}
          >
            <div className="event-card-title">{e.eventName}</div>
            <p className="event-card-desc">{e.description}</p>
            <div className="event-card-meta">
              {e.steps.length} hop{e.steps.length === 1 ? '' : 's'} →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Always-available switcher: jump straight to any other flow, or clear back to
// the gallery. This carries the trace-picking that used to live in the header
// dropdown, so the tab is self-sufficient.
function FlowSwitcher({ activeEvent, onSelectEvent, onClearEvent }) {
  return (
    <div className="flow-switcher">
      <span className="flow-switcher-label">Trace flow</span>
      {events.map(e => (
        <button
          key={e.eventId}
          type="button"
          className={`event-pill ${activeEvent?.eventId === e.eventId ? 'is-active' : ''}`}
          onClick={() => onSelectEvent(e)}
          title={e.description}
        >
          {e.eventName}
        </button>
      ))}
      {onClearEvent && (
        <button
          type="button"
          className="event-pill flow-switcher-clear"
          onClick={onClearEvent}
        >
          × Clear
        </button>
      )}
    </div>
  )
}

export default function PacketFlowTab({
  activeEvent,
  onSelectEvent,
  onClearEvent,
  activeStep,
  onSelectStep,
  onJumpToStep,
  followSelected = false,
}) {
  const [open, setOpen] = useState(new Set())
  const listRef = useRef(null)

  // When the flow is docked beside the overview, the inspected hop is driven
  // from over there (arrow badges / hop inspector). Keep the matching hop card
  // scrolled into view so the event list follows along with the overview.
  useEffect(() => {
    if (!followSelected || activeStep == null || !listRef.current) return
    const el = listRef.current.querySelector(`[data-step="${activeStep}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [followSelected, activeStep])

  if (!activeEvent) {
    return <EventGallery onSelectEvent={onSelectEvent} />
  }

  const toggle = (n) => {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
    // In docked mode this also highlights the matching arrow in the overview.
    onSelectStep?.(n)
  }

  return (
    <div>
      <FlowSwitcher
        activeEvent={activeEvent}
        onSelectEvent={onSelectEvent}
        onClearEvent={onClearEvent}
      />
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-display text-[1.05rem] font-semibold leading-tight">
            {activeEvent.eventName}
          </div>
          <span
            className="text-[0.66rem] whitespace-nowrap"
            style={{ color: 'var(--tx-muted)' }}
          >
            {activeEvent.steps.length} hop{activeEvent.steps.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-[0.74rem] mt-0.5 leading-snug" style={{ color: 'var(--tx-muted)' }}>
          {activeEvent.description}
        </p>
      </div>
      <div ref={listRef}>
        {activeEvent.steps.map((step, i) => (
          <Hop
            key={step.step}
            step={step}
            isOpen={open.has(step.step)}
            isSelected={activeStep === step.step}
            onToggle={() => toggle(step.step)}
            onJump={onJumpToStep}
            isFinal={i === activeEvent.steps.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
