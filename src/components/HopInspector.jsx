import { findComponent } from '../data/components-index'
import { COMPONENT_COLOR } from '../data/zones'
import HopInspectorShell from './HopInspectorShell'

// A compact, NON-modal hop inspector docked at the bottom of the viewport.
// Unlike AncestryModal it does not dim the page or lock scrolling, so the
// architecture view behind it stays visible and you keep your spatial bearings
// while reading about a single hop. Resolves the hop's source/target
// architecture components and hands them to the shared HopInspectorShell, which
// owns the resizable panel, route row and glyph + keyword detail.
export default function HopInspector({ activeEvent, activeStep, onSelectStep, onClose, onSelectComponent }) {
  if (!activeEvent || activeStep == null) return null

  const steps = activeEvent.steps
  const idx = steps.findIndex(s => s.step === activeStep)
  if (idx === -1) return null
  const step = steps[idx]

  const source = findComponent(step.sourceComponentId)
  const target = findComponent(step.targetComponentId)
  const color = COMPONENT_COLOR[step.targetComponentId] || 'var(--k-cyan)'

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
      source={{ typePrefix: source?.typePrefix, name: source?.displayName || step.sourceComponentId }}
      target={{ typePrefix: target?.typePrefix, name: target?.displayName || step.targetComponentId }}
      description={step.description}
      auth={step.auth}
      onPrev={() => goto(-1)}
      onNext={() => goto(1)}
      onClose={onClose}
      onSelectComponent={onSelectComponent}
    />
  )
}
