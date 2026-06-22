import { useState, useEffect, useMemo, useCallback } from 'react'
import { indexTopicBoxes } from '../data/deep-dives'
import DeepDiveCanvas from './DeepDiveCanvas'
import DeepDiveModal from './DeepDiveModal'
import { scrollIntoUpperThird } from '../lib/scroll'

// The shared topic renderer: a deep-dive topic's zone/box tree drawn as an
// Overview-style canvas, with the box/edge popup selection it owns. Extracted
// from DeepDiveTab so the Network lens's Map altitude (LogicalLens) can reuse the
// exact same pipeline — the only difference is `idPrefix` ('dd' for the Deep Dive
// tab, 'lg' for the lens), which namespaces every box DOM id so the two never
// collide when the compact swipe pager mounts both panes at once.
//
// A box that IS a registered overview object (componentId, no own detail) opens
// the component's real AncestryModal via onSelectComponent instead of a deep-dive
// popup — so the same object is one object everywhere (the depth door).

// The lens shows OVN topics, which carry no reconciliation loop — so a stub loop
// keeps DeepDiveCanvas's unconditional `loop.overlays` read happy without the Deep
// Dive tab's useReconciliationLoop.
const EMPTY_LOOP = { overlays: {}, armed: false, procs: [] }

export default function TopicCanvas({
  topic,
  loop = EMPTY_LOOP,
  activeFlow,
  activeFlowStep,
  onSelectFlowStep,
  onSelectComponent,  // open a registered component's detail sheet (AncestryModal)
  targetBoxId,        // a box id to auto-open (a search result landed here)
  onConsumeTarget,    // clear that request once honored
  idPrefix = 'dd',
}) {
  const [selectedBoxId, setSelectedBoxId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)

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
  useEffect(() => { setSelectedBoxId(null); setSelectedEdgeId(null) }, [topic])

  // A search result asked to open a specific box on this topic: honor it once
  // the topic (and its box index) are resolved, then clear the request so a
  // later manual close stays closed. Runs after the topic-change reset above,
  // so the requested box wins. Also scrolls it into view on the canvas.
  useEffect(() => {
    if (!targetBoxId || !boxIndex[targetBoxId]) return
    setSelectedEdgeId(null)
    // Boxes that ARE a registered component (componentId, no own detail) open
    // the real component sheet instead of a deep-dive popup.
    const target = boxIndex[targetBoxId].box
    if (target.componentId && !target.detail) onSelectComponent?.(target.componentId)
    else setSelectedBoxId(targetBoxId)
    const raf = requestAnimationFrame(() => {
      scrollIntoUpperThird(document.getElementById(`${idPrefix}-${targetBoxId}`))
    })
    onConsumeTarget?.()
    return () => cancelAnimationFrame(raf)
  }, [targetBoxId, boxIndex, onConsumeTarget, onSelectComponent, idPrefix])

  // Follow the trace: when a hop is focused, bring its target box into the upper
  // third of whatever scrolls the canvas (mirrors the Overview's trace-follow).
  useEffect(() => {
    if (activeFlowStep == null || !activeFlow) return
    const step = activeFlow.steps.find(s => s.step === activeFlowStep)
    if (!step) return
    const raf = requestAnimationFrame(() => {
      scrollIntoUpperThird(document.getElementById(`${idPrefix}-${step.targetBoxId}`))
    })
    return () => cancelAnimationFrame(raf)
  }, [activeFlowStep, activeFlow, idPrefix])

  // Only one popup at a time — opening a box closes any open edge and vice versa.
  // A box that IS a registered overview object (componentId, no own detail) —
  // the OpenShift-machinery chips in the OVN views — opens the component's real
  // detail sheet (AncestryModal) instead of a deep-dive popup, so the same
  // object is one object everywhere.
  const selectBox = useCallback((id) => {
    setSelectedEdgeId(null)
    const box = boxIndex[id]?.box
    if (box?.componentId && !box.detail) {
      setSelectedBoxId(null)
      onSelectComponent?.(box.componentId)
      return
    }
    setSelectedBoxId(id)
  }, [boxIndex, onSelectComponent])
  const selectEdge = useCallback((edge) => { setSelectedBoxId(null); setSelectedEdgeId(edge.id) }, [])
  const closeBox = useCallback(() => { setSelectedBoxId(null); setSelectedEdgeId(null) }, [])

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
        componentId: selected.box.componentId,
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
    <>
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
        idPrefix={idPrefix}
      />

      {/* Tail spacer so the bottom box can scroll clear of the fixed hop
          inspector when a flow hop is being inspected (--hop-inset). */}
      <div aria-hidden style={{ height: 'calc(1rem + var(--hop-inset, 0px))' }} />

      <DeepDiveModal
        content={content}
        onClose={closeBox}
        onSelectComponent={onSelectComponent ? (id) => { closeBox(); onSelectComponent(id) } : null}
      />
    </>
  )
}
