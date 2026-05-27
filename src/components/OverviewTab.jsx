import { ZONES, ARROW_ROWS } from '../data/zones'
import Zone from './Zone'
import NodeCard from './NodeCard'
import ArrowRow from './ArrowRow'

// Map componentId → step number it first appears in the active event.
function stepNumMap(activeEvent) {
  const map = new Map()
  if (!activeEvent) return map
  activeEvent.steps.forEach(s => {
    if (!map.has(s.sourceComponentId)) map.set(s.sourceComponentId, s.step)
    if (!map.has(s.targetComponentId)) map.set(s.targetComponentId, s.step)
  })
  return map
}

// Which static arrow-step numbers should glow when an event is active?
// Heuristic: any arrow row whose `between` zones contain a source→target hop
// of the active event lights all of its steps.
function activeArrowSteps(activeEvent, activeComponentIds) {
  const set = new Set()
  if (!activeEvent) return set
  // gather zones touched by the event
  const touchedZones = new Set()
  ZONES.forEach(z => {
    if (z.nodes.some(n => activeComponentIds.has(n.id))) {
      touchedZones.add(z.id)
    }
  })
  ARROW_ROWS.forEach(row => {
    const [a, b] = row.between
    if (touchedZones.has(a) && touchedZones.has(b)) {
      row.steps.forEach(s => set.add(s.n))
    }
  })
  return set
}

export default function OverviewTab({
  activeEvent,
  activeComponentIds,
  onSelectComponent,
}) {
  const steps = stepNumMap(activeEvent)
  const hasActive = activeComponentIds && activeComponentIds.size > 0
  const arrowActive = activeArrowSteps(activeEvent, activeComponentIds || new Set())

  return (
    <div
      className="border border-border-w rounded-lg overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.2)' }}
    >
      {ZONES.map((zone, idx) => (
        <div key={zone.id}>
          <Zone label={zone.label} color={zone.color}>
            {zone.nodes.map(node => {
              const isHighlighted = activeComponentIds?.has?.(node.id)
              return (
                <NodeCard
                  key={node.id}
                  id={node.id}
                  title={node.title}
                  subtitle={node.subtitle}
                  badges={node.badges}
                  color={zone.color}
                  stepNum={steps.get(node.id)}
                  isActive={isHighlighted}
                  isDimmed={hasActive && !isHighlighted}
                  onClick={onSelectComponent}
                />
              )
            })}
          </Zone>
          {idx < ZONES.length - 1 && (
            <ArrowRow
              steps={ARROW_ROWS[idx].steps}
              activeStepNums={arrowActive}
            />
          )}
        </div>
      ))}
    </div>
  )
}
