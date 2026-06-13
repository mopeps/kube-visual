import { useRef } from 'react'
import Zone from './Zone'
import NodeCard from './NodeCard'
import ReconLoopOverlay from './ReconLoopOverlay'
import { NET_ZONES, NET_EDGES, NET_GUEST_IDS } from '../data/network-zones'

// The Overview's network-mode canvas: a focused OVN logical topology built from
// the real components (see network-zones.js). Replaces the full component stack
// while the "Network" toggle is on. Reuses Zone / NodeCard for the boxes and
// ReconLoopOverlay (idPrefix '') for the always-on structural wiring — the same
// machinery the OVN deep-dive topics use, so the two read alike.
//
// A box with `kind: 'chip'` is a synthetic logical object (switch / router): it
// opens the OVN teaching popup. Every other box is a real component and opens
// its true AncestryModal via `mirror`.

const accentOf = (box, zone) => `var(--${box?.colorVar || zone?.colorVar || 'k-cyan'})`

export default function NetworkCanvas({ layerFocus = 'both', onSelectComponent, onSelectChip, onSelectEdge }) {
  const stackRef = useRef(null)

  const isGuest = (id) => NET_GUEST_IDS.has(id)
  const dimmed = (id) => layerFocus !== 'both' && (layerFocus === 'guest') !== isGuest(id)

  const renderBox = (box, zone) => {
    const accent = accentOf(box, zone)
    const onClick = box.kind === 'chip'
      ? () => onSelectChip(box)
      : () => onSelectComponent(box.mirror || box.id)
    return (
      <NodeCard
        key={box.id}
        id={box.id}
        title={box.title}
        typePrefix={box.typePrefix}
        variant={box.variant}
        color={accent}
        subtitle={box.caption}
        isDimmed={dimmed(box.id)}
        onClick={onClick}
      />
    )
  }

  // Consecutive `inline` boxes share one row (the core's switch+router side by
  // side; the app pods two-up) — everything else stacks per the zone layout.
  const renderZoneBoxes = (zone) => {
    const out = []
    let row = null
    for (const box of zone.boxes ?? []) {
      if (box.inline) {
        if (!row) { row = []; out.push(row) }
        row.push(box)
      } else {
        row = null
        out.push(box)
      }
    }
    return out.map((entry) =>
      Array.isArray(entry) ? (
        <div key={`row-${entry[0].id}`} className="dd-box-row">
          {entry.map((box) => renderBox(box, zone))}
        </div>
      ) : (
        renderBox(entry, zone)
      )
    )
  }

  const renderZone = (zone, depth = 0) => (
    <Zone
      key={zone.id}
      label={zone.label}
      color={accentOf(null, zone)}
      dashed={zone.dashed}
      depth={depth}
      layout={zone.layout}
      bare={zone.bare}
    >
      {renderZoneBoxes(zone)}
      {zone.zones?.map((child) => renderZone(child, depth + 1))}
    </Zone>
  )

  // Dim a whole edge group by layer, like the boxes (so the focused SDN's
  // wiring stays the figure). One overlay per layer keeps the CSS opacity simple.
  const mgmtEdges = NET_EDGES.filter((e) => !isGuest(e.id))
  const guestEdges = NET_EDGES.filter((e) => isGuest(e.id))

  return (
    <div className="deep-dive-canvas">
      <div
        className="overview-canvas recon-stack recon-stack--topology recon-stack--netmode"
        ref={stackRef}
      >
        <div className={`net-edge-layer ${layerFocus === 'guest' ? 'is-dim' : ''}`}>
          <ReconLoopOverlay edges={mgmtEdges} canvasRef={stackRef} activeEdgeId={null} signal={null} onSelectEdge={onSelectEdge} idPrefix="" />
        </div>
        <div className={`net-edge-layer ${layerFocus === 'mgmt' ? 'is-dim' : ''}`}>
          <ReconLoopOverlay edges={guestEdges} canvasRef={stackRef} activeEdgeId={null} signal={null} onSelectEdge={onSelectEdge} idPrefix="" />
        </div>
        {NET_ZONES.map((zone) => renderZone(zone))}
      </div>
    </div>
  )
}
