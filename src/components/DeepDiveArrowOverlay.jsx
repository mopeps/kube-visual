import { useMemo } from 'react'
import ArrowLines from './ArrowLines'

// Deep-dive trace arrows: the Overview's ArrowOverlay, pointed at deep-dive
// boxes. Box DOM ids are `dd-<boxId>` (see DeepDiveCanvas), and the per-hop
// colour comes from the target box's zone accent via `colorOf`.
export default function DeepDiveArrowOverlay({ activeFlow, canvasRef, activeStep, onSelectStep, onSelectBox, colorOf }) {
  const steps = useMemo(
    () => {
      if (!activeFlow) return []
      const hops = activeFlow.steps.map(s => ({
        step: s.step,
        sourceId: `dd-${s.sourceBoxId}`,
        targetId: `dd-${s.targetBoxId}`,
        color: colorOf?.(s.targetBoxId) || 'var(--k-cyan)',
        // A reply hop retracing an earlier hop's edge (an ack, a granted vote)
        // can declare a bow so the two curves don't lie on top of each other.
        bow: s.bow || 0,
      }))
      // "Road not taken" edges: a refused attempt drawn dashed-red, bowed clear of
      // the journey spine, ending in a ⊘ cap. It is not a numbered hop, so it gets
      // a string key and opens a box popup (openBoxId) rather than the hop reader.
      const rejected = (activeFlow.rejectedEdges || []).map((e, i) => ({
        step: `rej-${i}`,
        sourceId: `dd-${e.sourceBoxId}`,
        targetId: `dd-${e.targetBoxId}`,
        color: 'var(--packet)',
        denied: true,
        bow: 66,
        label: e.label,
        onClick: onSelectBox && e.openBoxId ? () => onSelectBox(e.openBoxId) : undefined,
      }))
      return [...hops, ...rejected]
    },
    [activeFlow, colorOf, onSelectBox],
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
