import HopInspectorShell from './HopInspectorShell'

// The Overview's HopInspector, reused for deep-dive trace flows. Same compact,
// non-modal bottom panel (via the shared HopInspectorShell), but it resolves
// source/target *boxes* from the topic's box index instead of architecture
// components. Mounted at App root — like the Overview inspector — so its
// `position: fixed` anchors to the viewport rather than a transformed swipe pane.
export default function DeepDiveHopInspector({ boxIndex, activeFlow, activeStep, onSelectStep, onClose }) {
  if (!activeFlow || activeStep == null) return null

  const steps = activeFlow.steps
  const idx = steps.findIndex(s => s.step === activeStep)
  if (idx === -1) return null
  const step = steps[idx]

  const source = boxIndex[step.sourceBoxId]
  const target = boxIndex[step.targetBoxId]
  const color = target?.accent || 'var(--k-cyan)'

  const goto = (dir) => {
    const next = steps[idx + dir]
    if (next) onSelectStep(next.step)
  }

  return (
    <HopInspectorShell
      color={color}
      step={step.step}
      idx={idx}
      total={steps.length}
      source={{ typePrefix: source?.box.typePrefix, name: source?.box.title || step.sourceBoxId }}
      target={{ typePrefix: target?.box.typePrefix, name: target?.box.title || step.targetBoxId }}
      description={step.description}
      onPrev={() => goto(-1)}
      onNext={() => goto(1)}
      onClose={onClose}
    />
  )
}
