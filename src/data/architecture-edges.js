// The Architecture lens's horizontal relationship graph — the analogue of
// network-internals.js's buildNetworkEdges, but for control-plane relationships
// instead of the datapath. Source: the packet-flow steps in events.json, the only
// place a component-to-component edge is named with both endpoints. Each unique
// source→target pair becomes one edge, anchored — like the network edges — to a
// specific INTERFACE primitive of each endpoint when that endpoint is a drillable
// runtime (a Pod's eth0 / a VMI's tap0), else to the component as a whole.
//
// Rendered exactly like the network relationships: ConnectionChips docked at the
// interface (OverviewTab.connectionsAt) + a ReconLoopOverlay wire between the two
// interfaces. The chips/wires only appear once a component is opened to its
// primitives (its interface enters the DOM), so the resting canvas stays calm.

import events from './events.json'
import { findComponent } from './components-index.js'
import { firstKnownVerb } from './interaction-kinds.js'

// The interface sub-box (buildPrimitiveInternals local id) a runtime's edges
// anchor to — a Pod's veth (eth0) / a VMI's tap0. Everything else (systemd,
// Services, CRs) has no primitive interface → anchors at the component level.
const IFACE_BY_TYPE = {
  Pod: 'pod-veth',
  'Static Pod': 'pod-veth',
  VirtualMachineInstance: 'vmi-tap',
}

// interaction-kinds verb kind → the edge's colour var (bare name for ReconLoopOverlay).
const KIND_ACCENT = {
  declare: 'k-amber', observe: 'k-amber', inbound: 'k-green', outbound: 'k-cyan',
  create: 'k-orange', manage: 'k-purple', note: 'k-sky',
}

// A logical endpoint string: `${component}__${iface}` when the component exposes a
// primitive interface, else the bare component id (the card-level fallback).
// OverviewTab namespaces these to DOM ids per column.
const endpointOf = (componentId) => {
  const iface = IFACE_BY_TYPE[findComponent(componentId)?.typePrefix]
  return iface ? `${componentId}__${iface}` : componentId
}

const nameOf = (id) => findComponent(id)?.displayName || id

export function buildArchitectureEdges() {
  const seen = new Map()
  for (const ev of events) {
    for (const s of ev.steps) {
      const from = s.sourceComponentId
      const to = s.targetComponentId
      if (!from || !to || from === to) continue
      const key = `${from}__${to}`
      if (seen.has(key)) continue // first hop for a pair wins the label
      const v = firstKnownVerb(s.description)
      const label = v ? v.verb : 'calls'
      seen.set(key, {
        id: `arch-${key}`,
        from: endpointOf(from),
        to: endpointOf(to),
        // kindLabel drives the chip's mechanism word + the wire chip; the verb is
        // the relationship ("watches", "resolves", "persists", "binds"…).
        label,
        kindLabel: label,
        accent: v ? KIND_ACCENT[v.kind] : 'k-sky',
        step: '', solid: true, quiet: true,
        title: `${nameOf(from)} → ${nameOf(to)}`,
        detail: {
          role: 'RELATIONSHIP',
          summary: s.description,
          sections: [{ heading: `In “${ev.eventName}”`, bullets: [s.description] }],
        },
      })
    }
  }
  return [...seen.values()]
}
