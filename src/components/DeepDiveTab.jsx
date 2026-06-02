import { useState, useEffect, useMemo, useCallback } from 'react'
import { DEEP_DIVES, findDeepDive, indexTopicBoxes } from '../data/deep-dives'
import DeepDiveCanvas from './DeepDiveCanvas'
import DeepDiveModal from './DeepDiveModal'
import { scrollIntoUpperThird } from '../lib/scroll'

const accent = (colorVar) => `var(--${colorVar || 'k-cyan'})`

// Default view: an index of every in-depth page so the tab is never empty.
function TopicIndex({ onSelectTopic }) {
  return (
    <div>
      <div className="mb-3">
        <div className="font-display text-[1.1rem] font-semibold mb-0.5">Deep dives</div>
        <p className="text-[0.72rem]" style={{ color: 'var(--tx-muted)' }}>
          Ground-up explainers one level below the topology — laid out like the
          overview: labelled zones of clickable boxes, each opening a detail popup.
        </p>
      </div>
      <div className="event-gallery">
        {DEEP_DIVES.map((t) => (
          <button
            key={t.topicId}
            type="button"
            className="event-card deep-card"
            style={{ '--deep-accent': accent(t.colorVar) }}
            onClick={() => onSelectTopic(t.topicId)}
          >
            <div className="event-card-title">{t.title}</div>
            <p className="event-card-desc">{t.tagline}</p>
            <div className="event-card-meta" style={{ color: accent(t.colorVar) }}>
              {countBoxes(t)} boxes →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Always-available switcher: jump to any other deep dive, or clear to the index.
function TopicSwitcher({ activeTopic, onSelectTopic, onClearTopic }) {
  return (
    <div className="flow-switcher">
      <span className="flow-switcher-label">Deep dive</span>
      {DEEP_DIVES.map((t) => (
        <button
          key={t.topicId}
          type="button"
          className={`event-pill ${activeTopic === t.topicId ? 'is-active' : ''}`}
          style={activeTopic === t.topicId ? { '--deep-accent': accent(t.colorVar) } : undefined}
          onClick={() => onSelectTopic(t.topicId)}
          title={t.title}
        >
          {t.title}
        </button>
      ))}
      {onClearTopic && (
        <button type="button" className="event-pill flow-switcher-clear" onClick={onClearTopic}>
          × Clear
        </button>
      )}
    </div>
  )
}

// The flow navigator: the Overview's trace-flow picker, on the deep-dive page.
// Only shown for topics that declare `flows`. Picking a flow lights up its hops
// on the canvas (arrows + step badges) and opens the bottom hop inspector.
function FlowNavigator({ topic, activeFlow, onSelectFlow, onClearFlow }) {
  if (!topic.flows?.length) return null
  return (
    <div className="mb-3">
      <div className="flow-switcher">
        <span className="flow-switcher-label">Trace flow</span>
        {topic.flows.map((f) => (
          <button
            key={f.flowId}
            type="button"
            className={`event-pill ${activeFlow?.flowId === f.flowId ? 'is-active' : ''}`}
            style={activeFlow?.flowId === f.flowId ? { '--deep-accent': accent(topic.colorVar) } : undefined}
            onClick={() => onSelectFlow(f)}
            title={f.description}
          >
            {f.flowName}
          </button>
        ))}
        {activeFlow && (
          <button type="button" className="event-pill flow-switcher-clear" onClick={onClearFlow}>
            × Clear
          </button>
        )}
      </div>
      <p className="text-[0.7rem] mt-1.5 leading-snug" style={{ color: 'var(--tx-muted)' }}>
        {activeFlow
          ? activeFlow.description
          : 'Pick a flow to trace its hops on the canvas, then click a numbered badge to read a hop.'}
      </p>
    </div>
  )
}

export default function DeepDiveTab({
  activeTopic,
  onSelectTopic,
  onClearTopic,
  activeFlow,
  activeFlowStep,
  activeBoxIds,
  onSelectFlow,
  onClearFlow,
  onSelectFlowStep,
}) {
  const [selectedBoxId, setSelectedBoxId] = useState(null)

  const topic = activeTopic ? findDeepDive(activeTopic) : null
  const boxIndex = useMemo(() => (topic ? indexTopicBoxes(topic) : {}), [topic])
  const colorOf = useCallback((boxId) => boxIndex[boxId]?.accent || 'var(--k-cyan)', [boxIndex])

  // Switching topics drops any open popup.
  useEffect(() => { setSelectedBoxId(null) }, [activeTopic])

  // Follow the trace: when a hop is focused, bring its target box into the upper
  // third of whatever scrolls the canvas (mirrors the Overview's trace-follow).
  useEffect(() => {
    if (activeFlowStep == null || !activeFlow) return
    const step = activeFlow.steps.find(s => s.step === activeFlowStep)
    if (!step) return
    const raf = requestAnimationFrame(() => {
      scrollIntoUpperThird(document.getElementById(`dd-${step.targetBoxId}`))
    })
    return () => cancelAnimationFrame(raf)
  }, [activeFlowStep, activeFlow])

  const selectBox = useCallback((id) => setSelectedBoxId(id), [])
  const closeBox = useCallback(() => setSelectedBoxId(null), [])

  if (!topic) {
    return <TopicIndex onSelectTopic={onSelectTopic} />
  }

  const selected = selectedBoxId ? boxIndex[selectedBoxId] : null
  const content = selected
    ? {
        id: selected.box.id,
        title: selected.box.title,
        typePrefix: selected.box.typePrefix,
        accent: selected.accent,
        detail: selected.box.detail,
      }
    : null

  return (
    <div className="deep-dive">
      <TopicSwitcher
        activeTopic={activeTopic}
        onSelectTopic={onSelectTopic}
        onClearTopic={onClearTopic}
      />
      <div className="mb-4">
        <div className="font-display text-[1.05rem] font-semibold leading-tight" style={{ color: accent(topic.colorVar) }}>
          {topic.title}
        </div>
        <p className="text-[0.74rem] mt-1 leading-snug" style={{ color: 'var(--tx-muted)' }}>
          {topic.tagline}
        </p>
      </div>

      <FlowNavigator
        topic={topic}
        activeFlow={activeFlow}
        onSelectFlow={onSelectFlow}
        onClearFlow={onClearFlow}
      />

      <DeepDiveCanvas
        topic={topic}
        onSelectBox={selectBox}
        activeFlow={activeFlow}
        activeFlowStep={activeFlowStep}
        onSelectFlowStep={onSelectFlowStep}
        activeBoxIds={activeBoxIds}
        colorOf={colorOf}
      />

      {/* Tail spacer so the bottom box can scroll clear of the fixed hop
          inspector when a flow hop is being inspected (--hop-inset). */}
      <div aria-hidden style={{ height: 'calc(1rem + var(--hop-inset, 0px))' }} />

      <DeepDiveModal content={content} onClose={closeBox} />
    </div>
  )
}

function countBoxes(topic) {
  let n = 0
  const walk = (zones) => {
    for (const z of zones) {
      n += z.boxes?.length || 0
      if (z.zones) walk(z.zones)
    }
  }
  walk(topic.zones || [])
  return n
}
