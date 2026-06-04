import { useState, useEffect, useRef } from 'react'
import { findComponent } from '../data/components-index'
import events from '../data/events.json'
import { COMPONENT_COLOR } from '../data/zones'
import ObjectSelect from './ObjectSelect'

const hopCount = (n) => `${n} hop${n === 1 ? '' : 's'}`

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

// Shown when no trace is selected: the trace-flow picker itself, expanded — so
// the dropdown of every available flow IS the landing view, rather than a
// separate card gallery. Picking one promotes it to the active trace.
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
      <FlowSwitcher onSelectEvent={onSelectEvent} defaultOpen />
    </div>
  )
}

// Always-available switcher: jump straight to any other flow, or clear back to
// the gallery. This carries the trace-picking that used to live in the header
// dropdown, so the tab is self-sufficient. Styled as an "open an object" popover
// (ObjectSelect), keyed to the packet accent that identifies the trace theme.
function FlowSwitcher({ activeEvent, onSelectEvent, onClearEvent, defaultOpen }) {
  const options = events.map(e => ({
    id: e.eventId,
    title: e.eventName,
    meta: hopCount(e.steps.length),
    accent: 'var(--packet)',
    event: e,
  }))
  return (
    <div className="obj-select-row">
      <ObjectSelect
        label="Trace flow"
        accent="var(--packet)"
        value={activeEvent ? { title: activeEvent.eventName, meta: hopCount(activeEvent.steps.length) } : null}
        placeholder="Choose a trace flow"
        options={options}
        activeId={activeEvent?.eventId}
        defaultOpen={defaultOpen}
        onSelect={(opt) => { if (opt.id !== activeEvent?.eventId) onSelectEvent(opt.event) }}
        clear={onClearEvent ? { label: '× Clear — back to gallery', onClear: onClearEvent } : undefined}
      />
    </div>
  )
}

export default function PacketFlowTab({
  activeEvent,
  onSelectEvent,
  onClearEvent,
  activeStep,
  onFocusStep,
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
    // Focus (not toggle) so opening a hop's detail always lights up its arrow,
    // even when that hop was already selected from the overview side — toggling
    // here would clear the highlight at the moment the detail opens.
    onFocusStep?.(n)
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
