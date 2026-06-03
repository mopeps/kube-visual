import { useMemo } from 'react'
import ArrowLines from './ArrowLines'

// Deep-dive trace arrows: the Overview's ArrowOverlay, pointed at deep-dive
// boxes. Box DOM ids are `dd-<boxId>` (see DeepDiveCanvas), and the per-hop
// colour comes from the target box's zone accent via `colorOf`.
export default function DeepDiveArrowOverlay({ activeFlow, canvasRef, activeStep, onSelectStep, colorOf }) {
  const steps = useMemo(
    () => activeFlow
      ? activeFlow.steps.map(s => ({
          step: s.step,
          sourceId: `dd-${s.sourceBoxId}`,
          targetId: `dd-${s.targetBoxId}`,
          color: colorOf?.(s.targetBoxId) || 'var(--k-cyan)',
        }))
      : [],
    [activeFlow, colorOf],
  )

  return (
    <ArrowLines
      steps={steps}
      canvasRef={canvasRef}
      activeStep={activeStep}
      onSelectStep={onSelectStep}
      idPrefix="dd"
      edgeAnchor
    />
  )
}
