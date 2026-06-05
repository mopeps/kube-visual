import { useState, useEffect, useRef } from 'react'
import { findComponent } from '../data/components-index'
import events from '../data/events.json'
import { COMPONENT_COLOR } from '../data/zones'
import { classifyHop } from '../data/hop-kinds'
import ObjectSelect from './ObjectSelect'
import ObjectText from './ObjectText'
import ExploreCommands from './ExploreCommands'
import TypeIcon from './TypeIcon'
import HopIcon from './HopIcon'

const hopCount = (n) => `${n} hop${n === 1 ? '' : 's'}`

// The source → target route line, with each node fronted by its type glyph (the
// same backbone glyphs the Object Map and Hop Inspector use). When `onJump` is
// set the whole route is a button that reveals the target on the overview canvas.
function HopRoute({ step, source, target, color, onJump }) {
  const inner = (
    <>
      <span className="hop-route-node">
        <TypeIcon typePrefix={source?.typePrefix} className="type-icon" title={source?.typePrefix} />
        {source?.displayName || step.sourceComponentId}
      </span>
      <span className="hop-route-arrow" aria-hidden>→</span>
      <span className="hop-route-node" style={{ color }}>
        <TypeIcon typePrefix={target?.typePrefix} className="type-icon" title={target?.typePrefix} />
        {target?.displayName || step.targetComponentId}
      </span>
    </>
  )
  if (!onJump) return <span className="hop-route is-static">{inner}</span>
  return (
    <button
      type="button"
      className="hop-route"
      onClick={(e) => { e.stopPropagation(); onJump(step.step) }}
      title="Reveal this object in the architecture overview"
    >
      {inner}
      <span className="hop-route-go" aria-hidden style={{ color }}>↗</span>
    </button>
  )
}

// One hop, rendered in the same icon+keyword language as the detail-modal
// Interactions section and the systemd deep-dive popups: the step number is
// baked into the card (no left rail / indent), an accent-tinted keyword chip
// with a glyph names what the hop *does* (Resolves / Routes / Terminates …),
// and the description lifts object references into the shared inline chips so a
// named component is one click from its own detail popup.
function Hop({ step, isOpen, isSelected, onToggle, onJump, onSelectComponent }) {
  const target = findComponent(step.targetComponentId)
  const source = findComponent(step.sourceComponentId)
  const color = COMPONENT_COLOR[step.targetComponentId] || 'var(--k-cyan)'
  const kind = classifyHop(step.description)
  const hasCommands = target?.explorationCommands?.length > 0

  return (
    <div
      className={`hop-card ${isSelected ? 'is-selected' : ''}`}
      data-step={step.step}
      style={{ '--hop-accent': color }}
      onClick={onToggle}
    >
      <div className="hop-card-head">
        <span className="hop-step">{step.step}</span>
        <span
          className="hop-kind"
          style={{ color: kind.accent, borderColor: `${kind.accent}55`, background: `${kind.accent}1a` }}
        >
          <span className="hop-kind-ic"><HopIcon name={kind.icon} /></span>
          {kind.label}
        </span>
        {hasCommands && (
          <span className={`hop-card-chevron ${isOpen ? 'is-open' : ''}`} aria-hidden>⌄</span>
        )}
      </div>

      <HopRoute step={step} source={source} target={target} color={color} onJump={onJump} />

      <p className="hop-card-desc">
        <ObjectText
          text={step.description}
          onSelectComponent={onSelectComponent}
          selfId={step.targetComponentId}
        />
      </p>

      {hasCommands && (
        <div className={`hop-card-detail ${isOpen ? 'is-open' : ''}`}>
          <div className="hop-card-detail-key">
            Explore the target ({target.displayName})
          </div>
          <ExploreCommands commands={target.explorationCommands} color={color} />
        </div>
      )}
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
  onSelectComponent,
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
        {activeEvent.steps.map((step) => (
          <Hop
            key={step.step}
            step={step}
            isOpen={open.has(step.step)}
            isSelected={activeStep === step.step}
            onToggle={() => toggle(step.step)}
            onJump={onJumpToStep}
            onSelectComponent={onSelectComponent}
          />
        ))}
      </div>
    </div>
  )
}
