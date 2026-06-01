import { useEffect, useRef, useState } from 'react'
import { ZONES, INTENT_OBJECT_STORE } from '../data/zones'
import Zone from './Zone'
import NodeCard from './NodeCard'
import IntentStoreCard from './IntentStoreCard'
import ArrowOverlay from './ArrowOverlay'
import { scrollIntoUpperThird } from '../lib/scroll'

// How long the reveal spotlight stays lit before it auto-clears. Kept in sync
// with the `.is-highlighted` pulse in index.css (reveal-pulse-* runs 1.3s × 2),
// so the highlight clears exactly when the animation finishes.
const SPOTLIGHT_MS = 1300 * 2

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
  activeStep,
  onSelectStep,
  highlightId,
  onClearHighlight,
}) {
  const canvasRef = useRef(null)
  const [expandedStoreId, setExpandedStoreId] = useState(null)
  const stepNums = buildStepNumMap(activeEvent)
  const hasActive = activeComponentIds && activeComponentIds.size > 0

  // Spotlight a component requested from elsewhere (e.g. a detail popup's
  // location badge): expand its intent store if it lives in one, scroll the
  // target into the upper third of the viewport, and clear the highlight once
  // its pulse animation has had time to play.
  useEffect(() => {
    if (!highlightId) return
    const storeId = INTENT_OBJECT_STORE[highlightId]
    if (storeId) setExpandedStoreId(storeId)
    // Two frames so the scroll measures the post-expand layout when a store
    // had to open to reveal the target.
    let raf2
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        scrollIntoUpperThird(document.getElementById(highlightId))
      })
    })
    const clear = setTimeout(() => onClearHighlight?.(), SPOTLIGHT_MS)
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      clearTimeout(clear)
    }
  }, [highlightId, onClearHighlight])

  // Trace-only zones (e.g. the external Client) stay hidden until an active
  // trace flow actually references a node inside them.
  const visibleZones = ZONES.filter(zone =>
    !zone.traceOnly ||
    collectZoneNodeIds(zone).some(id => activeComponentIds?.has?.(id))
  )

  function renderNode(node, zone) {
    const isActive = activeComponentIds?.has?.(node.id)
    // Nodes carrying intent objects (the etcd "intent store") render as an
    // expandable card instead of a plain box.
    if (node.intentObjects) {
      return (
        <IntentStoreCard
          key={node.id}
          node={node}
          color={zone.color}
          stepNum={stepNums.get(node.id)}
          isActive={isActive}
          isDimmed={hasActive && !isActive}
          isHighlighted={node.id === highlightId}
          highlightId={highlightId}
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
        isActive={isActive}
        isDimmed={hasActive && !isActive}
        isHighlighted={node.id === highlightId}
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
        isHighlighted={zone.componentId ? zone.componentId === highlightId : false}
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
    <>
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
        <ArrowOverlay
          activeEvent={activeEvent}
          canvasRef={canvasRef}
          activeStep={activeStep}
          onSelectStep={onSelectStep}
        />
      </div>
      {/* Tail spacer: a little room to scroll past the last object, growing by
          the height of whichever bottom panel is open — the hop inspector
          (--hop-inset) or a resized detail sheet in peek mode (--peek-inset) —
          so the bottom objects can always be scrolled clear of that fixed panel.
          Extends whichever scroller owns the overview — the window on desktop,
          the pane in the compact swipe pager. */}
      <div aria-hidden style={{ height: 'calc(2rem + var(--hop-inset, 0px) + var(--peek-inset, 0px))' }} />
    </>
  )
}
