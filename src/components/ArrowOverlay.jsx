import { useMemo } from 'react'
import { COMPONENT_COLOR } from '../data/zones'
import ArrowLines from './ArrowLines'

// Overview trace arrows: normalise the active event's hops into ArrowLines'
// generic step shape (DOM ids + per-hop colour) and let the shared core draw
// and measure them.
export default function ArrowOverlay({ activeEvent, canvasRef, activeStep, onSelectStep }) {
  const steps = useMemo(
    () => activeEvent
      ? activeEvent.steps.map(s => ({
          step: s.step,
          sourceId: s.sourceComponentId,
          targetId: s.targetComponentId,
          color: COMPONENT_COLOR[s.targetComponentId] || 'var(--k-cyan)',
        }))
      : [],
    [activeEvent],
  )

  return (
    <ArrowLines
      steps={steps}
      canvasRef={canvasRef}
      activeStep={activeStep}
      onSelectStep={onSelectStep}
      idPrefix="ov"
    />
  )
}
