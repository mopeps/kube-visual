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

// A clean, single-word relationship verb for the most-visible edges — the ones
// that surface as chips on the drillable app Pods / API server — where the
// auto-scanned verb reads off (a buried participle, or the wrong clause's verb).
// Keyed `${source}__${target}`; the verb always describes the SOURCE's action, so
// it reads right whether the chip docks on the source ("verb → peer") or the
// target ("verb ← peer", i.e. "peer verbs me").
const CURATED = {
  'frontend-application-pod__coredns-node': 'resolves',
  'frontend-application-pod__svc-backend': 'connects',
  'frontend-application-pod__cluster-monitoring': 'serves',
  'frontend-application-pod__kubelet-guest': 'answers',
  'frontend-application-pod__ovs-guest': 'sends',
  'svc-frontend__frontend-application-pod': 'routes',
  'crio-guest__frontend-application-pod': 'starts',
  'kubelet-guest__frontend-application-pod': 'probes',
  'cluster-monitoring__frontend-application-pod': 'scrapes',
  'netpol-ecommerce__backend-application-pod': 'admits',
  'guest-api-server__guest-etcd': 'persists',
  'guest-api-server__guest-controller-manager': 'notifies',
  'guest-api-server__guest-kube-scheduler': 'offers',
  'guest-api-server__konnectivity-server': 'tunnels',
}

// Normalise a scanned participle to its present-tense form so chips read as a
// live relationship ("resolves", not "resolved").
const PRESENT = {
  resolved: 'resolves', persisted: 'persists', configured: 'configures',
  terminated: 'terminates', required: 'requires', deployed: 'deploys',
  created: 'creates', bound: 'binds', mounted: 'mounts', evicted: 'evicts',
  answered: 'answers', returned: 'returns', forwarded: 'forwards',
  published: 'publishes', rendered: 'renders', realized: 'realizes',
  tracked: 'tracks', captured: 'captures', attached: 'attaches',
  allocated: 'allocates', assigned: 'assigns', merged: 'merges',
  spawned: 'spawns', provisioned: 'provisions', delegated: 'delegates',
}
const present = (verb) => (verb ? PRESENT[verb] || verb : null)

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
      const label = CURATED[key] || present(v?.verb) || 'calls'
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
