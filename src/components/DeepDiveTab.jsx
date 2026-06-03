import { useState, useEffect, useMemo, useCallback } from 'react'
import { DEEP_DIVES, findDeepDive, indexTopicBoxes } from '../data/deep-dives'
import DeepDiveCanvas from './DeepDiveCanvas'
import DeepDiveModal from './DeepDiveModal'
import ObjectSelect from './ObjectSelect'
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

const hops = (n) => `${n} hop${n === 1 ? '' : 's'}`

// Topic picker — jump to any other deep dive, or clear to the index. Styled as
// an "open an object" popover (ObjectSelect), echoing the etcd intent store.
function TopicSelect({ activeTopic, topic, onSelectTopic, onClearTopic }) {
  const options = DEEP_DIVES.map((t) => ({
    id: t.topicId,
    title: t.title,
    desc: t.tagline,
    meta: `${countBoxes(t)} boxes`,
    accent: accent(t.colorVar),
  }))
  return (
    <ObjectSelect
      label="Deep dive"
      accent={accent(topic.colorVar)}
      value={{ title: topic.title, meta: `${countBoxes(topic)} boxes` }}
      options={options}
      activeId={activeTopic}
      onSelect={(opt) => { if (opt.id !== activeTopic) onSelectTopic(opt.id) }}
      clear={{ label: '← All deep dives', onClear: onClearTopic }}
    />
  )
}

// Flow picker — only for topics that declare `flows`. Picking a flow lights up
// its hops on the canvas (arrows + step badges); the bottom hop reader opens
// when a badge/hop is clicked. Clearing drops to the static (no-trace) view.
function FlowSelect({ topic, activeFlow, onSelectFlow, onClearFlow }) {
  if (!topic.flows?.length) return null
  const options = topic.flows.map((f) => ({
    id: f.flowId,
    title: f.flowName,
    desc: f.description,
    meta: hops(f.steps.length),
    accent: accent(topic.colorVar),
    flow: f,
  }))
  return (
    <ObjectSelect
      label="Trace flow"
      accent={accent(topic.colorVar)}
      value={activeFlow ? { title: activeFlow.flowName, meta: hops(activeFlow.steps.length) } : null}
      placeholder="Static view (no trace)"
      options={options}
      activeId={activeFlow?.flowId}
      onSelect={(opt) => { if (opt.id !== activeFlow?.flowId) onSelectFlow(opt.flow) }}
      clear={activeFlow ? { label: '× Static view (no trace)', onClear: onClearFlow } : undefined}
    />
  )
}

export default function DeepDiveTab({
  activeTopic,
  onSelectTopic,
  onClearTopic,
  activeFlow,
  activeFlowStep,
  onSelectFlow,
  onClearFlow,
  onSelectFlowStep,
}) {
  const [selectedBoxId, setSelectedBoxId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)

  const topic = activeTopic ? findDeepDive(activeTopic) : null
  const boxIndex = useMemo(() => (topic ? indexTopicBoxes(topic) : {}), [topic])
  const colorOf = useCallback((boxId) => boxIndex[boxId]?.accent || 'var(--k-cyan)', [boxIndex])

  // The reconciliation loop's connector edges carry their own clickable detail
  // (systemd topic only) — index them so a clicked chip resolves to its popup.
  const edgeIndex = useMemo(() => {
    const out = {}
    for (const e of topic?.reconciliation?.edges || []) out[e.id] = e
    return out
  }, [topic])

  // Switching topics drops any open popup.
  useEffect(() => { setSelectedBoxId(null); setSelectedEdgeId(null) }, [activeTopic])

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

  // Only one popup at a time — opening a box closes any open edge and vice versa.
  const selectBox = useCallback((id) => { setSelectedEdgeId(null); setSelectedBoxId(id) }, [])
  const selectEdge = useCallback((edge) => { setSelectedBoxId(null); setSelectedEdgeId(edge.id) }, [])
  const closeBox = useCallback(() => { setSelectedBoxId(null); setSelectedEdgeId(null) }, [])

  if (!topic) {
    return <TopicIndex onSelectTopic={onSelectTopic} />
  }

  const selected = selectedBoxId ? boxIndex[selectedBoxId] : null
  const selectedEdge = selectedEdgeId ? edgeIndex[selectedEdgeId] : null
  const content = selected
    ? {
        id: selected.box.id,
        title: selected.box.title,
        typePrefix: selected.box.typePrefix,
        accent: selected.accent,
        detail: selected.box.detail,
      }
    : selectedEdge
      ? {
          id: selectedEdge.id,
          title: selectedEdge.title || selectedEdge.label?.replace(/\n/g, ' '),
          accent: `var(--${selectedEdge.accent || 'k-cyan'})`,
          detail: selectedEdge.detail,
        }
      : null

  return (
    <div className="deep-dive">
      <div className="obj-select-row">
        <TopicSelect
          activeTopic={activeTopic}
          topic={topic}
          onSelectTopic={onSelectTopic}
          onClearTopic={onClearTopic}
        />
        <FlowSelect
          topic={topic}
          activeFlow={activeFlow}
          onSelectFlow={onSelectFlow}
          onClearFlow={onClearFlow}
        />
      </div>

      <div className="mb-4">
        <div className="font-display text-[1.05rem] font-semibold leading-tight" style={{ color: accent(topic.colorVar) }}>
          {topic.title}
        </div>
        <p className="text-[0.74rem] mt-1 leading-snug" style={{ color: 'var(--tx-muted)' }}>
          {activeFlow ? activeFlow.description : topic.tagline}
        </p>
      </div>

      <DeepDiveCanvas
        topic={topic}
        onSelectBox={selectBox}
        onSelectEdge={selectEdge}
        activeFlow={activeFlow}
        activeFlowStep={activeFlowStep}
        onSelectFlowStep={onSelectFlowStep}
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
