import { useRef } from 'react'
import { ZONES } from '../data/zones'
import Zone from './Zone'
import NodeCard from './NodeCard'
import ArrowOverlay from './ArrowOverlay'

// Map componentId → step number it first appears in the active event.
function buildStepNumMap(activeEvent) {
  const map = new Map()
  if (!activeEvent) return map
  activeEvent.steps.forEach(s => {
    if (!map.has(s.sourceComponentId)) map.set(s.sourceComponentId, s.step)
    if (!map.has(s.targetComponentId)) map.set(s.targetComponentId, s.step)
  })
  return map
}

export default function OverviewTab({
  activeEvent,
  activeComponentIds,
  onSelectComponent,
}) {
  const canvasRef = useRef(null)
  const stepNums = buildStepNumMap(activeEvent)
  const hasActive = activeComponentIds && activeComponentIds.size > 0

  function renderZone(zone, depth = 0) {
    return (
      <Zone
        key={zone.id}
        label={zone.label}
        color={zone.color}
        dashed={zone.dashed}
        depth={depth}
      >
        {/* Nodes in this zone */}
        {zone.nodes?.map(node => {
          const isHighlighted = activeComponentIds?.has?.(node.id)
          return (
            <NodeCard
              key={node.id}
              id={node.id}
              title={node.title}
              typePrefix={node.typePrefix}
              badges={node.badges}
              color={zone.color}
              stepNum={stepNums.get(node.id)}
              isActive={isHighlighted}
              isDimmed={hasActive && !isHighlighted}
              onClick={onSelectComponent}
            />
          )
        })}
        {/* Child zones */}
        {zone.zones?.map(child => renderZone(child, depth + 1))}
      </Zone>
    )
  }

  return (
    <div
      ref={canvasRef}
      className="border border-border-w rounded-lg overflow-visible"
      style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}
    >
      {ZONES.map(zone => renderZone(zone))}
      <ArrowOverlay activeEvent={activeEvent} canvasRef={canvasRef} />
    </div>
  )
}
