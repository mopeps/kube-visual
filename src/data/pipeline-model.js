// Builds the Manifest-to-Kernel band model for any component, so the pipeline
// tree can render for every object on the overview canvas — not just the two
// hand-authored workload pods.
//
// The kernel/OS/virtualisation rows are derived from the existing
// PRIMITIVES_BY_TYPE data (keyed by typePrefix), so Pods, Static Pods, systemd
// services, and VMIs all get a meaningful Linux-primitive layer for free.
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

function systemdBands() {
  // Host systemd services flatten to two bands — Logical Intent → Linux
  // Primitive. Unlike a Pod, where the kubelet and CRI-O genuinely *translate* an
  // abstract object into a concrete one (pulling images, resolving Secrets into
  // RAM files), a systemd service has no such resolution step: once the
  // MachineConfig's intent is bridged onto the host by Ignition at first boot,
  // the .service unit, its cgroup slice, and the running process are all just
  // Linux primitives that PID 1 supervises directly. So we skip the Runtime
  // Object and Translation Engine bands the Pod pipeline uses, and let the unit
  // file live in the Linux-primitive band as its single home (via the systemd
  // entry in PRIMITIVES_BY_TYPE, whose `systemd Unit` item also carries the PID-1
  // supervision detail the dropped Translation Engine band used to spell out).
  const bands = [{
    // 1 · Logical intent — a MachineConfig, the host plane's Deployment-equivalent.
    layerId: 'logical-intent',
    groups: [{
      nodes: [{
        label: '[MachineConfig] desired host state',
        note: 'units, drop-ins & kernel args reconciled by the MCO',
        detail: {
          bullets: [
            'Machine Config Operator renders pool MachineConfigs into one Ignition config',
            'Ignition applies it on first boot (HCP: served by the Ignition Server)',
            'Base units like crio.service / ovs also ship in the immutable RHCOS image',
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

// Find the Linux-primitive band, creating (and appending) an empty one if the
// builder produced none — Custom Resources, for instance, bottom out in an etcd
// record rather than a process, so they get no kernel band on their own.
function ensureKernelBand(bands) {
  let band = bands.find(b => b.layerId === 'linux-primitive')
  if (!band) {
    band = { layerId: 'linux-primitive', groups: [{ nodes: [] }] }
    bands.push(band)
  }
  if (!band.groups.length) band.groups.push({ nodes: [] })
  return band
}

// Fold a component's authored runtime form + Linux primitive (from
// components.json) into a rich builder's bands:
//   • runtimeForm  → subhead of the Runtime Object band (the concrete K8s form),
//                    or the kernel band for host systemd services, which have no
//                    Runtime Object band by design.
//   • linuxPrimitive → lead row of the kernel band, ahead of the generic
//                    type-derived rows, since it is the per-instance realisation
//                    (e.g. a Service is a MetalLB VIP, not a generic Pod netns).
function withForms(component, bands) {
  const { typePrefix: t, runtimeForm, linuxPrimitive } = component
  if (runtimeForm) {
    if (t === 'systemd') {
      ensureKernelBand(bands).groups[0].subhead = runtimeForm
    } else {
      const host =
        bands.find(b => b.layerId === 'api-boundary') ||
        bands.find(b => b.layerId === 'logical-intent')
      if (host) host.groups[0].subhead = runtimeForm
    }
  }
  if (linuxPrimitive) {
    ensureKernelBand(bands).groups[0].nodes.unshift({ label: linuxPrimitive })
  }
  return bands
}

// Components with no kubelet/CRI translation step — Services, workload API
// objects, NetworkPolicies, bare kernel primitives, the off-cluster client —
// still have a K8s form and/or a Linux realisation worth showing, so they get a
// minimal pipeline built straight from those two fields.
function simpleBands(component) {
  const { runtimeForm, linuxPrimitive, displayName, layer } = component
  const bands = []
  // A bare kernel primitive IS the realisation — collapse to one kernel band
  // whose row names the form and reveals the underlying syscall/mechanism.
  if (layer === 'Linux Kernel Primitives') {
    bands.push({
      layerId: 'linux-primitive',
      groups: [{ nodes: [{ label: runtimeForm || displayName, note: linuxPrimitive || undefined }] }],
    })
    return bands
  }
  // Everything else reaching here — Services, NetworkPolicies, and the workload
  // API Objects (Deployment/ReplicaSet/Secret/ConfigMap/PVC/PV/EndpointSlice) —
  // is a *declarative manifest*, not a Runtime Object. Band 2 (Runtime Object)
  // is reserved for the single concrete instance handed to a supervisor (a Pod
  // or VMI); a Service has no supervised process, it is desired state reconciled
  // by a controller. So its K8s form is Logical Intent (band 1), and its descent
  // skips straight to the kernel datapath (OVN LB flows / ACLs / an etcd record),
  // mirroring how host systemd services skip the Runtime Object band too.
  if (runtimeForm && runtimeForm !== 'n/a (off-cluster)') {
    bands.push({ layerId: 'logical-intent', groups: [{ nodes: [{ label: runtimeForm }] }] })
  }
  if (linuxPrimitive) {
    bands.push({ layerId: 'linux-primitive', groups: [{ nodes: [{ label: linuxPrimitive }] }] })
  }
  return bands
}

// Returns { bands } for the component. Rich builders (Pod, systemd, VMI, CR) are
// enriched with the authored runtime form + Linux primitive; everything else
// falls back to a minimal pipeline built from those same two fields.
export function buildPipeline(component) {
  if (!component) return { bands: [] }
  const t = component.typePrefix
  if (t === 'Pod' || t === 'Static Pod') return { bands: withForms(component, podBands(component)) }
  if (t === 'systemd') return { bands: withForms(component, systemdBands(component)) }
  if (t === 'VirtualMachineInstance') return { bands: withForms(component, vmiBands(component)) }
  if (t === 'Custom Resource') return { bands: withForms(component, customResourceBands(component)) }
  return { bands: simpleBands(component) }
}
