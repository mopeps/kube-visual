// Builds the Manifest-to-Kernel band model for any component, so the pipeline
// tree can render for every object on the overview canvas — not just the two
// hand-authored workload pods.
//
// The kernel/OS/virtualisation rows are derived from the existing
// PRIMITIVES_BY_TYPE data (keyed by typePrefix), so Pods, Static Pods, systemd
// daemons, and VMIs all get a meaningful Linux-primitive layer for free.
// Workload pods additionally carry hand-authored ancestry / consumedResources /
// kernelRealization that enrich the upper bands.
//
// A band = { layerId, groups: [{ subhead?, nodes: [...] }] }.
// A node = { label, note?, color?, detail?, children? }.
// detail = { bullets?, kv?: [{k,v}], lines?, commands? }.

import { PRIMITIVES_BY_TYPE } from './primitives'

const PURPLE = 'var(--k-purple)'

// Trim a primitive's long description down to a one-line note.
function shortNote(text) {
  if (!text) return ''
  const sentence = text.split(/(?<=\.)\s/)[0]
  const clause = sentence.split(/\s[—–-]\s/)[0] // prefer text before an em/en dash
  const out = clause.length < sentence.length ? clause : sentence
  return out.length > 70 ? out.slice(0, 67).trimEnd() + '…' : out
}

// Short human label for a consumed resource's underlying kernel primitive.
function primitiveNote(p) {
  if (/tmpfs/i.test(p)) return 'tmpfs RAM-disk mount · volatile'
  if (/kernel mount/i.test(p)) return 'XFS/Ext4 block-device mount'
  return 'host-backed mount'
}

// Map PRIMITIVES_BY_TYPE items → tree rows (label + short note, full detail on expand).
function primitiveNodes(typePrefix) {
  const set = PRIMITIVES_BY_TYPE[typePrefix]
  if (!set) return null
  return set.items.map(it => ({
    label: it.label,
    note: shortNote(it.description),
    detail: {
      lines: [it.description],
      bullets: it.interactions,
      commands: it.commands,
    },
  }))
}

const KUBELET = {
  label: '[systemd] Kubelet',
  note: 'resolves the Pod spec into on-disk state',
  detail: {
    bullets: [
      'Listens to the Guest API Server for Pod assignment',
      'Creates local dir /var/lib/kubelet/pods/',
      'Resolves Secrets / ConfigMaps into RAM files',
      'Executes storage-plugin mount commands',
    ],
  },
}

const CRIO = {
  label: '[systemd] CRI-O',
  note: 'issues the kernel syscalls that build the sandbox',
  detail: {
    bullets: [
      'Receives low-level container runtime requests',
      'Issues clone() / unshare() / setns() syscalls',
    ],
    lines: ['via Unix socket /var/run/crio/crio.sock'],
  },
}

function podBands(component) {
  const t = component.typePrefix
  const { ancestry, consumedResources, kernelRealization } = component
  const cr = consumedResources || []
  const bands = []

  // 1 · Logical intent — from explicit ancestry, else the owning object, else omit.
  if (ancestry) {
    bands.push({
      layerId: 'logical-intent',
      groups: [{
        nodes: [
          ancestry.deployment && {
            label: `[Deployment] ${ancestry.deployment}`,
            note: 'defines replicas, strategy & pod template',
          },
          ancestry.replicaSet && {
            label: `[ReplicaSet] ${ancestry.replicaSet}`,
            note: 'stamps out unique pod-hash replicas',
          },
        ].filter(Boolean),
      }],
    })
  } else if (component.logicalContext?.associatedObject) {
    const proj = component.logicalContext.openShiftProject
    bands.push({
      layerId: 'logical-intent',
      groups: [{
        nodes: [{
          label: `[Owner] ${component.logicalContext.associatedObject}`,
          note: proj ? `declared in project ${proj}` : 'declares the desired Pod state',
        }],
      }],
    })
  }

  // 2 · API boundary — the Pod object, with consumed resources as children.
  const podName = ancestry?.podName || component.displayName
  bands.push({
    layerId: 'api-boundary',
    groups: [{
      nodes: [{
        label: `[${t}] ${podName}`,
        note: 'schedulable API object handed to the node',
        children: cr.map(r => ({
          color: PURPLE,
          label: r.apiObject,
          note: primitiveNote(r.linuxPrimitive),
          detail: {
            kv: [
              { k: 'host', v: r.hostPath },
              ...(r.linkedObject ? [{ k: 'backed by', v: r.linkedObject }] : []),
            ],
          },
        })),
      }],
    }],
  })

  // 3 · Translation engine — the universal kubelet → CRI-O path.
  bands.push({ layerId: 'translation-engine', groups: [{ nodes: [KUBELET, CRIO] }] })

  // 4 · Linux primitives — hand-authored realisation when present, else by type.
  const groups = []
  if (kernelRealization) {
    groups.push({
      subhead: '🧬 Isolation Boundaries',
      nodes: [
        kernelRealization.cgroupPath && {
          label: `[cgroup v2] ${kernelRealization.cgroupPath}`,
          note: 'throttles CPU / RAM limits',
        },
        kernelRealization.networkNamespace && {
          label: `[netns] ${kernelRealization.networkNamespace}`,
          note: 'isolates network sockets',
        },
        kernelRealization.mountNamespace && {
          label: `[mount ns] ${kernelRealization.mountNamespace}`,
          note: 'container-private VFS',
        },
      ].filter(Boolean),
    })
  }
  if (cr.length) {
    groups.push({
      subhead: '📁 File Footprint',
      nodes: cr.map(r => ({
        label: `${r.linuxPrimitive} ${r.hostPath}`,
        note: r.apiObject,
      })),
    })
  }
  if (!groups.length) {
    const pn = primitiveNodes('Pod')
    if (pn) groups.push({ nodes: pn })
  }
  bands.push({ layerId: 'linux-primitive', groups })

  return bands
}

function systemdBands(component) {
  const bands = [{
    layerId: 'logical-intent',
    groups: [{
      nodes: [{
        label: `[unit] ${component.displayName}`,
        note: 'declarative .service unit: start / stop / restart policy',
      }],
    }],
  }, {
    layerId: 'translation-engine',
    groups: [{
      nodes: [{
        label: '[systemd] PID 1',
        note: 'starts & supervises the unit per its .service file',
        detail: {
          bullets: [
            'Tracks unit state: activating → active → failed',
            'Applies Restart= / RestartSec= recovery policy',
            'Places the daemon in its own cgroup slice',
          ],
        },
      }],
    }],
  }]
  const pn = primitiveNodes('systemd')
  if (pn) bands.push({ layerId: 'linux-primitive', groups: [{ nodes: pn }] })
  return bands
}

function vmiBands(component) {
  const bands = [{
    layerId: 'api-boundary',
    groups: [{
      nodes: [{
        label: `[VirtualMachineInstance] ${component.displayName}`,
        note: 'KubeVirt API object describing the guest VM',
      }],
    }],
  }, {
    layerId: 'translation-engine',
    groups: [{
      nodes: [{
        label: '[Pod] virt-launcher',
        note: 'wraps QEMU and bridges KubeVirt to the host',
        detail: {
          bullets: [
            'virt-handler manages this process lifecycle',
            'QEMU hands CPU execution to /dev/kvm',
          ],
        },
      }],
    }],
  }]
  const pn = primitiveNodes('VirtualMachineInstance')
  if (pn) bands.push({ layerId: 'linux-primitive', groups: [{ nodes: pn }] })
  return bands
}

function customResourceBands(component) {
  return [{
    layerId: 'logical-intent',
    groups: [{
      nodes: [{
        label: `[CustomResource] ${component.displayName}`,
        note: 'declares desired state; reconciled by its operator into Pods',
      }],
    }],
  }]
}

// Returns { bands } for the component, or { bands: [] } when no meaningful
// pipeline applies (e.g. the external client or bare kernel-primitive nodes).
export function buildPipeline(component) {
  if (!component) return { bands: [] }
  const t = component.typePrefix
  if (t === 'Pod' || t === 'Static Pod') return { bands: podBands(component) }
  if (t === 'systemd') return { bands: systemdBands(component) }
  if (t === 'VirtualMachineInstance') return { bands: vmiBands(component) }
  if (t === 'Custom Resource') return { bands: customResourceBands(component) }
  return { bands: [] }
}
