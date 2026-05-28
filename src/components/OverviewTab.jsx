import { useRef, useState } from 'react'
import { ZONES } from '../data/zones'
import Zone from './Zone'
import NodeCard from './NodeCard'
import IntentStoreCard from './IntentStoreCard'
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

// All node ids within a zone subtree (used to decide trace-only visibility).
function collectZoneNodeIds(zone, ids = []) {
  zone.nodes?.forEach(n => ids.push(n.id))
  zone.zones?.forEach(z => collectZoneNodeIds(z, ids))
  return ids
}

export default function OverviewTab({
  activeEvent,
  activeComponentIds,
  onSelectComponent,
}) {
  const canvasRef = useRef(null)
  const [expandedStoreId, setExpandedStoreId] = useState(null)
  const stepNums = buildStepNumMap(activeEvent)
  const hasActive = activeComponentIds && activeComponentIds.size > 0

  // Trace-only zones (e.g. the external Client) stay hidden until an active
  // trace flow actually references a node inside them.
  const visibleZones = ZONES.filter(zone =>
    !zone.traceOnly ||
    collectZoneNodeIds(zone).some(id => activeComponentIds?.has?.(id))
  )

  function renderNode(node, zone) {
    const isHighlighted = activeComponentIds?.has?.(node.id)
    // Nodes carrying intent objects (the etcd "intent store") render as an
    // expandable card instead of a plain box.
    if (node.intentObjects) {
      return (
        <IntentStoreCard
          key={node.id}
          node={node}
          color={zone.color}
          stepNum={stepNums.get(node.id)}
          isActive={isHighlighted}
          isDimmed={hasActive && !isHighlighted}
          isExpanded={expandedStoreId === node.id}
          onToggle={() => setExpandedStoreId(prev => prev === node.id ? null : node.id)}
          onSelectComponent={onSelectComponent}
        />
      )
    }
    return (
      <NodeCard
        key={node.id}
        id={node.id}
        title={node.title}
        typePrefix={node.typePrefix}
        color={zone.color}
        stepNum={stepNums.get(node.id)}
        isActive={isHighlighted}
        isDimmed={hasActive && !isHighlighted}
        onClick={onSelectComponent}
      />
    )
  }

  function renderZone(zone, depth = 0) {
    return (
      <Zone
        key={zone.id}
        label={zone.label}
        color={zone.color}
        dashed={zone.dashed}
        depth={depth}
        // A zone may double as a component (e.g. the VM); wire up its identity
        // so it can anchor arrows, highlight, and open the detail panel.
        componentId={zone.componentId}
        stepNum={zone.componentId ? stepNums.get(zone.componentId) : undefined}
        isActive={zone.componentId ? activeComponentIds?.has?.(zone.componentId) : false}
        onClick={onSelectComponent}
      >
        {/* Nodes in this zone */}
        {zone.nodes?.map(node => renderNode(node, zone))}
        {/* Child zones */}
        {zone.zones?.map(child => renderZone(child, depth + 1))}
      </Zone>
    )
  }

  return (
    <div
      ref={canvasRef}
      className="border border-border-w rounded-lg overflow-visible overview-canvas"
      style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}
    >
      {visibleZones.flatMap(zone =>
        zone.hideWrapper
          ? [
              // Wrapper hidden: surface its own nodes and child zones directly
              // so neither is silently dropped.
              ...(zone.nodes ?? []).map(node => renderNode(node, zone)),
              ...(zone.zones ?? []).map(child => renderZone(child)),
            ]
          : [renderZone(zone)]
      )}
      <ArrowOverlay activeEvent={activeEvent} canvasRef={canvasRef} />
    </div>
  )
}
