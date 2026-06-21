import { useState, useEffect, useRef } from 'react'
import { findComponent } from '../data/components-index'
import events from '../data/events.json'
import { COMPONENT_COLOR } from '../data/zones'
import { hopPoints } from '../data/hop-kinds'
import ObjectSelect from './ObjectSelect'
import ObjectText from './ObjectText'
import ExploreCommands from './ExploreCommands'
import { TypeGlyph, hasTypeGlyph } from './TypeIcon'
import HopIcon from './HopIcon'
import AuthChip from './AuthChip'
import CategorizedIndex from './CategorizedIndex'
import FlowGlyph from './FlowGlyph'

const hopCount = (n) => `${n} hop${n === 1 ? '' : 's'}`
const FLOW_CATEGORIES = [
  { id: 'traffic', label: 'Traffic paths' },
  { id: 'lifecycle', label: 'Provisioning & scale' },
  { id: 'failure', label: 'Failure & reconciliation' },
  { id: 'state', label: 'Configuration & storage' },
  { id: 'observability', label: 'Health & observability' },
]

// One route endpoint — its type glyph in a bordered chip (matching the bullet
// glyph chips so every glyph on the card reads the same way) followed by the
// node's name. A node whose type has no glyph just shows its name.
function RouteNode({ component, fallbackId }) {
  return (
    <span className="hop-route-node">
      {hasTypeGlyph(component?.typePrefix) && (
        <span className="hop-route-ic" aria-hidden>
          <TypeGlyph typePrefix={component.typePrefix} />
        </span>
      )}
      {component?.displayName || fallbackId}
    </span>
  )
}

// The source → target route line, each node fronted by its boxed type glyph (the
// same backbone glyphs the Object Map and Hop Inspector use). When `onJump` is
// set the whole route is a button that reveals the target on the overview canvas.
function HopRoute({ step, source, target, color, sourceColor, onJump }) {
  const inner = (
    <>
      <span style={{ color: sourceColor }}>
        <RouteNode component={source} fallbackId={step.sourceComponentId} />
      </span>
      <span className="hop-route-arrow" aria-hidden>→</span>
      <span style={{ color }}>
        <RouteNode component={target} fallbackId={step.targetComponentId} />
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
// Interactions section and the systemd deep-dive popups: the step number and the
// source → target route head the card (no left rail / indent), and the detail is
// a short list of glyph + keyword bullets — one per sentence of the step, each
// classified into its action (Resolves / Routes / Terminates …) — instead of one
// long paragraph. Object references throughout lift into the shared inline chips,
// so a named component is one click from its own detail popup.
function Hop({ step, isOpen, isSelected, onToggle, onJump, onSelectComponent }) {
  const target = findComponent(step.targetComponentId)
  const source = findComponent(step.sourceComponentId)
  const color = COMPONENT_COLOR[step.targetComponentId] || 'var(--k-cyan)'
  const sourceColor = COMPONENT_COLOR[step.sourceComponentId] || 'var(--k-cyan)'
  const points = hopPoints(step.description)
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
        <HopRoute step={step} source={source} target={target} color={color} sourceColor={sourceColor} onJump={onJump} />
        {hasCommands && (
          <span className={`hop-card-chevron ${isOpen ? 'is-open' : ''}`} aria-hidden>⌄</span>
        )}
      </div>

      <ul className="hop-points">
        {points.map((p, i) => (
          <li key={i} className="hop-point">
            <span
              className="hop-point-ic"
              style={{ color: p.accent, borderColor: `color-mix(in srgb, ${p.accent} 55%, transparent)` }}
              aria-hidden
            >
              <HopIcon name={p.icon} />
            </span>
            <span className="hop-point-text">
              <span className="hop-point-kw" style={{ color: p.accent }}>{p.label} </span>
              <ObjectText
                text={p.text}
                onSelectComponent={onSelectComponent}
              />
            </span>
          </li>
        ))}
      </ul>

      {step.auth && <AuthChip authId={step.auth} color={color} />}

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
  const options = events.map((event) => ({
    id: event.eventId,
    title: event.eventName,
    meta: hopCount(event.steps.length),
    category: event.category,
    accent: 'var(--packet)',
    icon: <FlowGlyph name={event.glyph} />,
    event,
  }))
  return (
    <div>
      <div className="mb-3">
        <div className="font-display text-[1.1rem] font-semibold mb-0.5">
          Choose a trace flow
        </div>
        <p className="text-[0.75rem]" style={{ color: 'var(--tx-muted)' }}>
          Pick a flow to step through every hop from external client to PID&nbsp;1.
        </p>
      </div>
      <CategorizedIndex
        categories={FLOW_CATEGORIES}
        options={options}
        onSelect={(option) => onSelectEvent(option.event)}
      />
    </div>
  )
}

// Always-available switcher: jump straight to any other flow, or clear back to
// the gallery. This carries the trace-picking that used to live in the header
// dropdown, so the tab is self-sufficient. Styled as an "open an object" popover
// (ObjectSelect), keyed to the packet accent that identifies the trace theme.
function FlowSwitcher({ activeEvent, onSelectEvent, onClearEvent }) {
  const options = events.map(e => ({
    id: e.eventId,
    title: e.eventName,
    meta: hopCount(e.steps.length),
    accent: 'var(--packet)',
    icon: <FlowGlyph name={e.glyph} />,
    event: e,
  }))
  return (
    <div className="obj-select-row">
      <ObjectSelect
        label="Trace flow"
        accent="var(--packet)"
        value={activeEvent ? { title: activeEvent.eventName, meta: hopCount(activeEvent.steps.length), icon: <FlowGlyph name={activeEvent.glyph} /> } : null}
        placeholder="Choose a trace flow"
        options={options}
        activeId={activeEvent?.eventId}
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
          <div className="packet-flow-title font-display text-[1.05rem] font-semibold leading-tight">
            <FlowGlyph name={activeEvent.glyph} />
            {activeEvent.eventName}
          </div>
          <span
            className="text-[0.75rem] whitespace-nowrap"
            style={{ color: 'var(--tx-muted)' }}
          >
            {activeEvent.steps.length} hop{activeEvent.steps.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-[0.75rem] mt-0.5 leading-snug" style={{ color: 'var(--tx-muted)' }}>
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
