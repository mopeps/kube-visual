import { useState, useEffect, useMemo, useCallback } from 'react'
import { DEEP_DIVES, findDeepDive, indexTopicBoxes } from '../data/deep-dives'
import DeepDiveCanvas from './DeepDiveCanvas'
import DeepDiveModal from './DeepDiveModal'
import ObjectSelect from './ObjectSelect'
import { scrollIntoUpperThird } from '../lib/scroll'

const accent = (colorVar) => `var(--${colorVar || 'k-cyan'})`

// Default view (no topic selected): the Deep dive picker itself, expanded — so
// the dropdown of every in-depth page IS the landing view, rather than a
// separate card gallery.
function TopicIndex({ onSelectTopic }) {
  return (
    <div>
      <div className="mb-3">
        <div className="font-display text-[1.1rem] font-semibold mb-0.5">Deep dives</div>
        <p className="text-[0.72rem]" style={{ color: 'var(--tx-muted)' }}>
          Ground-up explainers one level below the topology — laid out like the
          overview: labelled zones of clickable boxes, each opening a detail popup.
          Pick one to open it.
        </p>
      </div>
      <div className="obj-select-row">
        <TopicSelect activeTopic={null} topic={null} onSelectTopic={onSelectTopic} defaultOpen />
      </div>
    </div>
  )
}

const hops = (n) => `${n} hop${n === 1 ? '' : 's'}`

// Topic picker — jump to any other deep dive, or clear to the index. Styled as
// an "open an object" popover (ObjectSelect), echoing the etcd intent store.
function TopicSelect({ activeTopic, topic, onSelectTopic, onClearTopic, defaultOpen }) {
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
      accent={accent(topic?.colorVar)}
      value={topic ? { title: topic.title, meta: `${countBoxes(topic)} boxes` } : null}
      placeholder="Choose a deep dive"
      options={options}
      activeId={activeTopic}
      defaultOpen={defaultOpen}
      onSelect={(opt) => { if (opt.id !== activeTopic) onSelectTopic(opt.id) }}
      clear={onClearTopic ? { label: '← All deep dives', onClear: onClearTopic } : undefined}
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

// Scenario picker — the "second dropdown" for the systemd topic, which has no
// trace flows but a reconciliation walkthrough instead. Picking an event (kill
// main, kill child, daemon-reload, stop) arms the loop; the step controls then
// dock to the bottom of the viewport (ReconControls). Clearing disarms it.
function ScenarioSelect({ loop, accentVar }) {
  if (!loop?.scenarios?.length) return null
  const acc = accent(accentVar)
  const options = loop.scenarios.map((s) => ({
    id: s.id,
    title: s.name,
    meta: s.meta,
    accent: acc,
  }))
  return (
    <ObjectSelect
      label="Scenario"
      accent={acc}
      value={loop.armed ? { title: loop.scenarioName } : null}
      placeholder="Pick an event to walk"
      options={options}
      activeId={loop.scenario}
      onSelect={(opt) => loop.arm(opt.id)}
      clear={loop.armed ? { label: '× Reset walkthrough', onClear: loop.reset } : undefined}
    />
  )
}

// Off-canvas context: the long topic blurb (and, for flow topics, the active
// flow's description) folded into a collapsed-by-default "About" disclosure so
// it no longer fills the top of the canvas as a wall of text.
function TopicAbout({ topic, activeFlow }) {
  const [open, setOpen] = useState(false)
  const text = activeFlow ? activeFlow.description : topic.tagline
  return (
    <div className="dd-about" style={{ '--dd-accent': accent(topic.colorVar) }}>
      <button
        type="button"
        className={`dd-about-toggle ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dd-about-icon" aria-hidden>ⓘ</span>
        About this deep dive
        <span className="dd-about-chev" aria-hidden>⌄</span>
      </button>
      {open && <p className="dd-about-body">{text}</p>}
    </div>
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
  loop,
  targetBoxId,        // a box id to auto-open (a search result landed here)
  onConsumeTarget,    // clear that request once honored
}) {
  const [selectedBoxId, setSelectedBoxId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)

  const topic = activeTopic ? findDeepDive(activeTopic) : null
  const boxIndex = useMemo(() => (topic ? indexTopicBoxes(topic) : {}), [topic])
  const colorOf = useCallback((boxId) => boxIndex[boxId]?.accent || 'var(--k-cyan)', [boxIndex])

  // Connector edges carry their own clickable detail — the systemd loop's
  // reconciliation edges and any topic's static topology edges (e.g. the OVN
  // logical wiring) — index them so a clicked chip resolves to its popup.
  const edgeIndex = useMemo(() => {
    const out = {}
    for (const e of topic?.reconciliation?.edges || []) out[e.id] = e
    for (const e of topic?.topology?.edges || []) out[e.id] = e
    return out
  }, [topic])

  // Switching topics drops any open popup.
  useEffect(() => { setSelectedBoxId(null); setSelectedEdgeId(null) }, [activeTopic])

  // A search result asked to open a specific box on this topic: honor it once
  // the topic (and its box index) are resolved, then clear the request so a
  // later manual close stays closed. Runs after the topic-change reset above,
  // so the requested box wins. Also scrolls it into view on the canvas.
  useEffect(() => {
    if (!targetBoxId || !boxIndex[targetBoxId]) return
    setSelectedEdgeId(null)
    setSelectedBoxId(targetBoxId)
    const raf = requestAnimationFrame(() => {
      scrollIntoUpperThird(document.getElementById(`dd-${targetBoxId}`))
    })
    onConsumeTarget?.()
    return () => cancelAnimationFrame(raf)
  }, [targetBoxId, boxIndex, onConsumeTarget])

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
        subtitle: selected.box.subtitle,
        accent: selected.accent,
        detail: selected.box.detail,
      }
    : selectedEdge
      ? {
          id: selectedEdge.id,
          title: selectedEdge.title || selectedEdge.label?.replace(/\n/g, ' '),
          accent: `var(--${selectedEdge.accent || 'k-cyan'})`,
          detail: selectedEdge.detail,
          // Arrow/edge popups open as a fixed ~1/3-height bottom sheet (the grip
          // still resizes it) instead of a short content-hugging modal.
          peekDefault: 0.34,
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
        {topic.reconciliation && <ScenarioSelect loop={loop} accentVar={topic.colorVar} />}
      </div>

      <TopicAbout topic={topic} activeFlow={activeFlow} />

      <DeepDiveCanvas
        topic={topic}
        loop={loop}
        onSelectBox={selectBox}
        onSelectEdge={selectEdge}
        selectedBoxId={selectedBoxId}
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
      n += z.boxes?.filter((b) => !b.spacer).length || 0
      if (z.zones) walk(z.zones)
    }
  }
  walk(topic.zones || [])
  return n
}
