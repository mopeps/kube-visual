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

// One-line note for a `linuxPrimitive` realisation row that has no process detail
// of its own (a Service VIP, a NetworkPolicy's ACLs, a CR's etcd record, the VMI
// guest, the off-cluster client). Philosophy: name the concrete mechanism — the
// etcd record, the controller that acts on it, the actual datapath/kernel effect —
// in one tight clause. Grounded, never a paraphrase of the label. Matched
// most-specific first; an unrecognised value returns undefined so the row stays
// bare rather than gaining a hollow note.
function realisationNote(lp) {
  if (!lp) return undefined
  if (/encrypted at rest/i.test(lp))
    return 'An etcd key, not a process — encrypted at rest so a stolen disk reveals nothing.'
  if (/etcd record/i.test(lp))
    return 'Not a process — a key in etcd that controllers watch and reconcile into reality.'
  if (/router-default LB/i.test(lp))
    return "The guest can't provision an LB, so KubeVirt's CCM mirrors the Service onto the host to fulfil it."
  if (/MetalLB.*virt-launcher/i.test(lp))
    return 'A VIP MetalLB claims via ARP, DNATed by OVN to the virt-launcher Pods hosting the guest VMs.'
  if (/MetalLB/i.test(lp))
    return 'A VIP MetalLB claims via ARP on the LAN — a bare-metal substitute for a cloud LB.'
  if (/OVN ACL/i.test(lp))
    return 'Where NetworkPolicy intent becomes enforcement — OVS permits or drops each packet here.'
  if (/ClusterIP/i.test(lp))
    return 'A virtual IP no interface owns; OVN flows DNAT it to a live Pod, masking their shifting IPs.'
  if (/guest OS|RHCOS guest/i.test(lp))
    return "RHCOS booted inside the VM — where the guest node's kubelet and workloads actually run."
  if (/TCP socket/i.test(lp))
    return "An off-cluster client's libc socket — where the whole request flow begins."
  return undefined
}

// One-line note for a bare `logical-intent` manifest row (the declarative K8s
// object an API Object / Service / NetworkPolicy reduces to). Same philosophy as
// realisationNote: each is a desired-state record in etcd, so name the record, the
// controller/kubelet that acts on it, and the concrete effect. Keyed off the kind
// word that leads `runtimeForm`.
function manifestNote(form) {
  if (!form) return undefined
  if (/^Deployment/.test(form)) return 'Desired Pod template & replica count in etcd; its controller rolls them out via ReplicaSets.'
  if (/^ReplicaSet/.test(form)) return 'Holds the desired replica count in etcd; its controller adds or deletes Pods until actual matches.'
  if (/^ConfigMap/.test(form)) return 'Non-secret config in etcd; the kubelet projects it into the Pod as files or env vars.'
  if (/^Secret/.test(form)) return 'Sensitive data in etcd; the kubelet mounts it into the Pod as an in-memory tmpfs file.'
  if (/^PersistentVolumeClaim/.test(form)) return 'A storage request in etcd; once bound to a PersistentVolume the kubelet mounts it.'
  if (/^PersistentVolume/.test(form)) return 'A cluster-scoped etcd object mapping a PVC to real backing storage.'
  if (/^EndpointSlice/.test(form)) return "A list of a Service's live, ready Pod IPs in etcd, written by the EndpointSlice controller to steer traffic."
  if (/^Service \(LoadBalancer\)/.test(form)) return 'Declares an external entry point; a controller provisions the LB and writes its IP back.'
  if (/^Service/.test(form)) return 'Allocates a stable virtual IP in etcd; the datapath DNATs it to the selected Pods.'
  if (/^NetworkPolicy/.test(form)) return 'Declares allowed traffic for the selected Pods; OVN compiles it into datapath ACLs.'
  return undefined
}

// Map PRIMITIVES_BY_TYPE items → tree rows (label + short note, full detail on expand).
function primitiveNodes(typePrefix) {
  const set = PRIMITIVES_BY_TYPE[typePrefix]
  if (!set) return null
  return set.items.map(it => ({
    id: it.id,
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

// Find the Logical Intent band, creating (and prepending) an empty one if the
// builder produced none — a controller-managed Pod with no hand-authored
// ancestry has no intent band of its own, so its workload controller (the
// mover below) needs a home at the top of the descent.
function ensureIntentBand(bands) {
  let band = bands.find(b => b.layerId === 'logical-intent')
  if (!band) {
    band = { layerId: 'logical-intent', groups: [{ nodes: [] }] }
    bands.unshift(band)
  }
  if (!band.groups.length) band.groups.push({ nodes: [] })
  return band
}

// Workload-controller kinds are declarative desired state, so they belong in the
// Logical Intent band — not the Runtime Object band, which names the single
// supervised instance handed to a node. (A Static Pod / virt-launcher Pod / VMI
// form, by contrast, *is* that runtime object, so those stay on api-boundary.)
const CONTROLLER_KIND = /^(Deployment|DaemonSet|StatefulSet|ReplicaSet|Job|CronJob)\b/

// One-line note for a relocated controller row, matching the voice of the
// hand-authored ancestry rows in podBands.
function controllerNote(form) {
  if (/^DaemonSet/.test(form)) return 'runs one replica per eligible node'
  if (/^StatefulSet/.test(form)) return 'ordered, stable-identity replicas'
  if (/^ReplicaSet/.test(form)) return 'stamps out unique pod-hash replicas'
  return 'defines replicas, strategy & pod template' // Deployment / other
}

// Fold a component's authored runtime form + Linux primitive (from
// components.json) into a rich builder's bands:
//   • runtimeForm  → subhead of the Runtime Object band (the concrete K8s form),
//                    or the kernel band for host systemd services, which have no
//                    Runtime Object band by design. A workload-controller form
//                    (Deployment/DaemonSet/StatefulSet/…) is declarative intent,
//                    not a runtime object, so it moves up to the Logical Intent
//                    band instead (see CONTROLLER_KIND).
//   • linuxPrimitive → the per-instance realisation. For a type whose primitive
//                    set already has a process row (a Pod's PID-1 process, a
//                    systemd service's process), we fold the realisation into
//                    *that* row — "PID 1 · Process" becomes "PID 1 · CVO binary" —
//                    rather than stacking a near-duplicate lead row above it.
//                    Everything else (VMI guest OS, a CR's etcd record, a Service
//                    VIP) keeps it as the kernel band's lead row, since there is no
//                    process row that means the same thing.
const FOLD_PROCESS_ID = {
  Pod: 'container-process',
  'Static Pod': 'container-process',
  systemd: 'service-process',
}
function withForms(component, bands) {
  const { typePrefix: t, runtimeForm, linuxPrimitive } = component
  if (runtimeForm) {
    if (t === 'systemd') {
      ensureKernelBand(bands).groups[0].subhead = runtimeForm
    } else if (CONTROLLER_KIND.test(runtimeForm)) {
      ensureIntentBand(bands).groups[0].nodes.push({
        label: runtimeForm,
        note: controllerNote(runtimeForm),
      })
    } else {
      const host =
        bands.find(b => b.layerId === 'api-boundary') ||
        bands.find(b => b.layerId === 'logical-intent')
      if (host) host.groups[0].subhead = runtimeForm
    }
  }
  if (linuxPrimitive) {
    const foldId = FOLD_PROCESS_ID[t]
    let folded = false
    if (foldId) {
      const band = bands.find(b => b.layerId === 'linux-primitive')
      for (const g of band?.groups || []) {
        const proc = g.nodes.find(n => n.id === foldId)
        if (proc) {
          // Keep the row's primitive prefix ("PID 1", "systemd Process") and
          // swap its generic tail for the concrete realisation.
          proc.label = `${proc.label.split(' · ')[0]} · ${linuxPrimitive}`
          folded = true
          break
        }
      }
    }
    if (!folded) {
      ensureKernelBand(bands).groups[0].nodes.unshift({
        label: linuxPrimitive,
        note: realisationNote(linuxPrimitive),
      })
    }
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
    bands.push({
      layerId: 'logical-intent',
      groups: [{ nodes: [{ label: runtimeForm, note: manifestNote(runtimeForm) }] }],
    })
  }
  if (linuxPrimitive) {
    bands.push({
      layerId: 'linux-primitive',
      groups: [{ nodes: [{ label: linuxPrimitive, note: realisationNote(linuxPrimitive) }] }],
    })
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
