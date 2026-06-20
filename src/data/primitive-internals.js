// ── Primitives-mode component internals (Overview v2) ───────────────────────
// In Primitives mode each runtime-instance box (a Pod / Static Pod, a [systemd]
// service, or a VirtualMachineInstance) opens *in place* to reveal the Linux
// kernel primitives behind it — but as a *containment tree*, not a flat list:
// the boxes nest the way the kernel objects actually nest, so the view teaches
// what-lives-inside-what rather than enumerating loose primitives.
//
//   • the Pod cgroup slice is the outer *constraint envelope* (the resource
//     ceiling for the whole Pod),
//   • the shared network namespace is the *containment* box every container
//     joins — the pod's eth0 is welded onto its rim as an interface port,
//   • each container is its own box where the PID-1 process lives, carrying its
//     listen socket and its per-container namespaces (mount/PID) + constraints
//     (cgroup, SELinux, seccomp, capabilities).
//
// The boxes are derived from:
//   • PRIMITIVES_BY_TYPE[typePrefix]   (src/data/primitives.js) — the per-type
//     kernel/OS/virt primitive set (id, label, description, interactions, commands)
//   • the component's `linuxPrimitive`  (components.json) — the per-instance
//     realisation, folded into the process box (matching pipeline-model.js)
//   • two synthetic grouping boxes authored here (the container box, the process
//     listen socket) that have no PRIMITIVES_BY_TYPE item of their own.
//
// Output shape matches PrimitiveBoxCard's `internal`:
//   { bands: [{ label?, boxes: [box] }] }  where each box may carry `children`,
// and a child with variant:'iface' peels onto its parent's rim as a port pill,
// variant:'socket' renders as a syscall jack — exactly like Network mode's
// hand-authored network-internals.js. detail = { role, summary, sections } —
// the shape DeepDiveModal renders.

import { PRIMITIVES_BY_TYPE } from './primitives'
import { findComponent } from './components-index'
import { podMounts, podListen } from './pod-internals'

const RUNTIME_TYPES = new Set(['Pod', 'Static Pod', 'systemd', 'VirtualMachineInstance'])

const typeOf = (node) => node?.typePrefix || findComponent(node?.id)?.typePrefix

// A node opens to its primitives only when it bottoms out in real kernel objects.
export const isRuntimeInstance = (node) => RUNTIME_TYPES.has(typeOf(node))

// Per-primitive presentation: a short execution-primitive tag (what runs here —
// never a desired-state kind) and an accent. `fold` marks the process box that
// carries the component's per-instance `linuxPrimitive` (the realisation, which
// the resting box would otherwise not show): 'title' rewrites the row to
// `PID 1 · <realisation>` (Pod / systemd, matching pipeline-model); 'caption'
// surfaces it as the box subtitle (VMI, no PID-1 row). The static descriptive
// subtitles are intentionally absent — that scope text lives in each box's popup.
const META = {
  'pod-netns':         { tag: 'netns',   colorVar: 'k-purple' },
  'pod-veth':          { tag: 'netdev',  colorVar: 'k-teal'   },
  'pod-ipcns':         { tag: 'ipcns',   colorVar: 'k-purple' },
  'pod-utsns':         { tag: 'utsns',   colorVar: 'k-purple' },
  'pod-cgroup-slice':  { tag: 'cgroup',  colorVar: 'k-purple' },
  'pod-mountns':       { tag: 'mountns', colorVar: 'k-purple' },
  'pod-pidns':         { tag: 'pidns',   colorVar: 'k-purple' },
  'pod-cgroups':       { tag: 'cgroup',  colorVar: 'k-orange' },
  'pod-selinux':       { tag: 'LSM',     colorVar: 'k-orange' },
  'pod-seccomp':       { tag: 'seccomp', colorVar: 'k-orange' },
  'pod-capabilities':  { tag: 'caps',    colorVar: 'k-orange' },
  'container-process': { tag: 'process', colorVar: 'k-green',  fold: 'title' },
  'systemd-unit':      { tag: 'unit',    colorVar: 'k-amber'  },
  'cgroup-slice':      { tag: 'cgroup',  colorVar: 'k-purple' },
  'service-process':   { tag: 'process', colorVar: 'k-green',  fold: 'title' },
  'kvm-vcpu':          { tag: 'KVM',     colorVar: 'k-purple' },
  'qemu-process':      { tag: 'process', colorVar: 'k-green',  fold: 'caption' },
  'vhost-net':         { tag: 'vhost',   colorVar: 'k-purple' },
  'vmi-tap':           { tag: 'netdev',  colorVar: 'k-teal'   },
}

// Synthetic boxes with no PRIMITIVES_BY_TYPE item — defined here so the change
// stays scoped to this view (no new primitives.js items that other consumers
// like pipeline-model.js / the DetailPanel would have to account for).
//
// The container box *is* the container's cgroup envelope: rather than drawing
// the per-container cgroup as one more box inside the container, we merge the
// two — the container's outer boundary is the cgroup that bounds it (mirroring
// how the Pod cgroup slice is the Pod's outer boundary). Its detail folds in the
// per-container cgroup explore commands.
const CONTAINER_BOX = {
  id: 'container', title: 'container cgroup', tag: 'cgroup', colorVar: 'k-teal',
  detail: {
    role: 'CONTAINER CGROUP',
    summary:
      "The container, drawn as its own cgroup: the CPU/memory ceiling under the Pod slice that holds the PID-1 process and its private mount + PID namespaces.",
    sections: [
      { heading: 'Interactions', bullets: [
        "Enforces this container's CPU, memory, and I/O limits under the Pod cgroup slice.",
        'Created by crun at container start, nested beneath the Pod slice.',
        "Holds the PID-1 process and the container's own mount and PID namespaces.",
      ] },
      { heading: 'Explore', commands: [
        '# Find the container cgroup (nested under the Pod slice)\ncrictl inspect <id> | jq .info.runtimeSpec.linux.cgroupsPath',
        '# Its CPU / memory ceiling\ncat /sys/fs/cgroup/<cgroup_path>/memory.max\ncat /sys/fs/cgroup/<cgroup_path>/cpu.max',
      ] },
    ],
  },
}
// The PID-1 process is not "inside" one namespace — it holds one membership per
// namespace type at once and sits at their intersection. We surface that as a row
// of membership chips on the process card: each points at the box of the
// namespace it joins, so hovering a chip lights up that frame (the [mnt] chip →
// the mount-ns box that holds the rootfs is the "this process sees those files"
// link). `view` is the lens that namespace grants the process.
const POD_PROCESS_NS = [
  { tag: 'mnt',    ref: 'pod-mountns', view: 'sees its files',  colorVar: 'k-purple' },
  { tag: 'pid',    ref: 'pod-pidns',   view: 'is PID 1',        colorVar: 'k-purple' },
  { tag: 'net',    ref: 'pod-netns',   view: 'binds sockets',   colorVar: 'k-purple' },
  { tag: 'ipc',    ref: 'pod-ipcns',   view: 'shares /dev/shm', colorVar: 'k-purple' },
  { tag: 'uts',    ref: 'pod-utsns',   view: 'its hostname',    colorVar: 'k-purple' },
  { tag: 'cgroup', ref: 'container',   view: 'resource caps',   colorVar: 'k-teal' },
]

// The mount namespace is drawn as a real filesystem: a tight list of slim
// one-line rows (variant 'fsrow'), one per mount, derived per-pod from its role
// (pod-internals.js). Each row is columnar: path · fs type (plain white — the
// kernel mount mechanism) · source-kind chip (the coloured column: what K8s
// object backs it — Secret / ConfigMap / token / PVC / hostPath) · source name.
const MOUNT_META = {
  overlayfs: { type: 'overlayfs', kind: 'image', color: 'k-green', role: 'OVERLAYFS ROOT',
    summary: "The container's root filesystem — image layers plus a throwaway writable layer.",
    bullets: [
      'Assembles the rootfs from read-only image layers + a per-container writable layer.',
      'Discards the writable layer when the container is removed.',
    ] },
  secret: { type: 'tmpfs', kind: 'Secret', color: 'k-orange', named: true, role: 'SECRET MOUNT',
    summary: 'A Secret projected as files in a tmpfs — RAM-backed, never written to disk.',
    bullets: [
      "Projects the Secret's keys as in-memory files.",
      'Mounted by CRI-O before the container starts; refreshed in place on change.',
    ] },
  configmap: { type: 'tmpfs', kind: 'ConfigMap', color: 'k-sky', named: true, role: 'CONFIGMAP MOUNT',
    summary: 'A ConfigMap projected as files in a tmpfs — the same RAM-backed mechanism as a Secret, for non-sensitive config.',
    bullets: [
      "Projects the ConfigMap's keys as in-memory files.",
      'Mounted by CRI-O before start; updated in place when the ConfigMap changes.',
    ] },
  projected: { type: 'tmpfs', kind: 'token', color: 'k-purple', role: 'PROJECTED VOLUME',
    summary: 'A tmpfs the kubelet keeps fresh — the ServiceAccount token, cluster CA, and namespace the process authenticates with.',
    bullets: [
      'Projects the SA token, ca.crt, and namespace as files.',
      'Mounted by the kubelet, which rotates the token before it expires.',
    ] },
  pvc: { type: 'block', kind: 'PVC', color: 'k-amber', named: true, role: 'PERSISTENT VOLUME',
    summary: 'Durable block (or network) storage — survives the container, unlike tmpfs volumes.',
    bullets: [
      'Mounts a real filesystem on a block / network device.',
      'Attached by the kubelet / CSI driver before the container starts.',
      'Persists data across restarts and reschedules.',
    ] },
  hostpath: { type: 'bind', kind: 'hostPath', color: 'k-teal', role: 'HOSTPATH MOUNT',
    summary: 'A node directory bind-mounted into the container — a privileged window onto the host, used by node agents.',
    bullets: [
      "Binds a path from the node's own filesystem into the container.",
      'Exposes the host to the container — OVS/OVN, KVM, and CSI agents rely on it.',
    ] },
  emptydir: { type: 'tmpfs', kind: 'emptyDir', color: 'k-ghost', role: 'EMPTYDIR · scratch',
    summary: "Scratch space shared by the Pod's containers for its lifetime, then discarded.",
    bullets: [
      "Provides ephemeral scratch space shared across the Pod's containers.",
      'Discarded when the Pod is removed.',
    ] },
  procfs: { type: 'proc', kind: 'kernel', color: 'k-ghost', role: 'PROCFS',
    summary: 'A procfs the mount namespace provides — its contents (the visible PIDs) come from the PID namespace.',
    bullets: [
      'Reads the visible process tree from the PID namespace.',
      'Provided by the mount namespace as the /proc mount point.',
    ] },
}

// One volume descriptor (pod-internals.js) → a slim fs-row box with separate
// columns: fsType (plain white), the source-kind chip (coloured), and the source.
const mountSyn = (desc, i) => {
  const m = MOUNT_META[desc.kind]
  const fsType = desc.fs || m.type
  const name = m.named && desc.source ? `"${desc.source}"` : null
  const keys = desc.keys?.join(' · ')
  const source = desc.note || [name, keys].filter(Boolean).join(' → ') || keys || ''
  // A short form (…/<last segment>) shown in place of the full path when the list
  // is narrow, so a long secret path keeps its meaningful tail instead of being
  // clipped mid-word.
  const seg = desc.path.replace(/\/+$/, '').split('/').pop()
  const shortPath = !seg || desc.path === '/' || desc.path === seg ? desc.path : `…/${seg}`
  return {
    id: `fs-${i}`,
    title: desc.path,
    shortPath,
    fsType,
    kindLabel: m.kind,
    colorVar: m.color,
    source,
    links: desc.linksPidns ? ['pod-pidns'] : undefined,
    detail: {
      role: `${m.role} · ${fsType}`,
      summary: m.summary,
      sections: [
        // The specific object + keys this mount projects, as scannable fact chips.
        (name || keys) && { facts: [
          name && { k: m.kind, v: desc.source },
          keys && { k: 'keys', v: keys },
        ].filter(Boolean) },
        m.bullets?.length && { heading: 'Interactions', bullets: m.bullets },
        { heading: 'Explore', commands: [`# Inspect this mount\nnsenter -t <pid> -m findmnt ${desc.path}`] },
      ].filter(Boolean),
    },
  }
}
const LOOPBACK_BOX = {
  id: 'lo', title: 'lo', tag: 'netdev', colorVar: 'k-sky',
  detail: {
    role: 'LOOPBACK INTERFACE',
    summary:
      "The loopback device in the Pod's network namespace — 127.0.0.1 that never leaves the Pod, shared by all its containers so a sidecar reaches the app over localhost.",
    sections: [
      { heading: 'Interactions', bullets: [
        'Carries 127.0.0.1 traffic that never leaves the network namespace.',
        'Shared across every container in the Pod — localhost links co-located sidecars.',
      ] },
    ],
  },
}
// The listen socket is a netns object, not a container one: a struct socket the
// process created and bound in the Pod's network namespace. It lives beside
// lo/eth0 (its links light them + the process, drawing residence + termination +
// fd-ownership) and is held by the process as a file descriptor.
const listenSocketBox = (listen) => ({
  id: 'listen-sock', title: `listen :${listen.port}`, tag: 'socket', colorVar: 'k-orange',
  links: ['pod-veth', 'lo', 'container-process'],
  detail: {
    role: `TCP LISTEN SOCKET · :${listen.port}`,
    summary:
      `A TCP socket bound on the Pod IP and put in LISTEN — the network-namespace endpoint where inbound connections terminate, held by the process as a file descriptor.`,
    sections: [
      { heading: 'Interactions', bullets: [
        `Binds 0.0.0.0:${listen.port} in the Pod's network namespace.`,
        'Receives the packets eth0 demuxes to it by their 4-tuple.',
        'Spawns one connected socket per client on accept().',
        'Held by the process as a file descriptor — socket:[inode] in /proc/<pid>/fd.',
      ] },
      { heading: 'Explore', commands: [
        '# The listening sockets and the pids holding them\noc exec <pod> -n <ns> -- ss -tlnp',
        "# The socket inodes in the process's fd table\nls -l /proc/<pid>/fd | grep socket",
      ] },
    ],
  },
})
// The process holds the socket as a file descriptor (distinct from a namespace
// membership): the [fd] chip points back at the socket so the ownership link is
// visible alongside the namespace-membership chips.
const POD_PROCESS_FD = [
  { tag: 'fd → socket', ref: 'listen-sock', view: 'the listen socket it bound (an fd in /proc/<pid>/fd)', colorVar: 'k-orange' },
]

// The containment tree per type. Every node is one of a small visual vocabulary
// keyed by `variant`, so a primitive's *kind* is legible at a glance:
//   (default)         → a solid leaf card — the thing that runs / is isolated
//   variant:'envelope'→ a dashed frame: a cgroup, a resource *ceiling* (pod slice,
//                        and the container, which we draw AS its own cgroup)
//   variant:'ns'      → a hatched solid frame: a namespace *isolation boundary*
//                        that nests whatever it isolates (pid ns → process,
//                        mount ns → rootfs, net ns → interfaces + the container)
//   variant:'guard'   → a small shield chip: a filter applied to the container
//                        (SELinux label, seccomp profile, capability set)
//   variant:'iface'   → a port pill welded onto a namespace's rim (lo / eth0)
//   variant:'socket'  → a syscall jack endpoint (the process's listen socket)
// Spec node forms: 'id' | { id, variant?, title?, children } | { synthetic, variant?, children }
// The Pod layout is a function of ctx so its filesystem rows and listen port come
// from the specific pod's role (pod-internals.js) rather than one mock for all.
const podLayout = (ctx) => {
  const mounts = podMounts(ctx.component)
  const listen = podListen(ctx.component)
  return [
    // Pod cgroup slice = the outer resource ceiling (dashed envelope) …
    { id: 'pod-cgroup-slice', variant: 'envelope', children: [
      // … wrapping the shared network namespace (the isolation boundary every
      // container joins). lo + eth0 are welded onto its rim; the other pod-shared
      // namespaces and the container sit inside it.
      { id: 'pod-netns', variant: 'ns', stretch: 'grow', children: [
        // lo + eth0 are the netns's L2/L3 edges (rim ports); the listen socket is
        // its L4 endpoint — all three live in the netns. The socket sits in the
        // body (not the rim) and its links cross-light lo/eth0 + the owning process.
        { synthetic: LOOPBACK_BOX, variant: 'iface', links: ['listen-sock'] },
        { id: 'pod-veth', variant: 'iface', title: 'eth0', links: ['listen-sock'] },
        { synthetic: listenSocketBox(listen), variant: 'listen' },
        { id: 'pod-ipcns', variant: 'ns' },
        { id: 'pod-utsns', variant: 'ns' },
        // The container = its own cgroup boundary. Inside: the guards applied to
        // it (chips), then the two namespaces it owns — the mount ns as a tight
        // filesystem listing, the PID ns nesting the PID-1 process (which holds
        // the netns-level socket via its fd chip).
        { synthetic: CONTAINER_BOX, variant: 'envelope', stretch: 'row', children: [
          { id: 'pod-selinux', variant: 'guard' },
          { id: 'pod-seccomp', variant: 'guard' },
          { id: 'pod-capabilities', variant: 'guard' },
          { id: 'pod-mountns', variant: 'ns', stretch: 'fsrow', children: mounts.map((d, i) => ({ synthetic: mountSyn(d, i), variant: 'fsrow' })) },
          { id: 'pod-pidns', variant: 'ns', children: [
            { id: 'container-process', memberships: POD_PROCESS_NS, holds: POD_PROCESS_FD },
          ] },
        ] },
      ] },
    ] },
  ]
}

const LAYOUT_BY_TYPE = {
  Pod: podLayout,
  systemd: [
    // The .service declaration, then the cgroup slice the process actually lives
    // in (the host-service analogue of the container's cgroup boundary). A host
    // service runs in the root namespaces, so there is no namespace nesting.
    'systemd-unit',
    { id: 'cgroup-slice', variant: 'envelope', children: ['service-process'] },
  ],
  VirtualMachineInstance: [
    // The QEMU process owns the VM: its vCPU threads and vhost offload live
    // inside it, and tap0 is the guest NIC welded onto its rim.
    { id: 'qemu-process', children: [
      { id: 'vmi-tap', variant: 'iface', title: 'tap0' },
      'kvm-vcpu', 'vhost-net',
    ] },
  ],
}

const buildBox = (ctx, id, opts = {}) => {
  const item = ctx.byId.get(id)
  if (!item) return null
  const meta = META[id] || { tag: 'kernel', colorVar: 'k-purple' }
  let title = opts.title || item.label
  let caption = meta.caption
  // Fold the per-instance realisation into the process row the same way
  // pipeline-model.js does (skipped when an explicit title override is given,
  // e.g. an interface relabelled to 'eth0'). A Pod's row keeps "PID 1" (its
  // entrypoint really is PID 1 inside the container's PID namespace); a systemd
  // service keeps "systemd Process" (a CHILD of PID 1, never PID 1 itself).
  if (!opts.title && meta.fold === 'title' && ctx.linuxPrimitive) title = `${item.label.split(' · ')[0]} · ${ctx.linuxPrimitive}`
  else if (meta.fold === 'caption' && ctx.linuxPrimitive) caption = ctx.linuxPrimitive

  const sections = []
  if (item.interactions?.length) sections.push({ heading: 'Interactions', bullets: item.interactions })
  if (item.commands?.length) sections.push({ heading: 'Explore', commands: item.commands })

  return {
    id: `${ctx.componentId}__${item.id}`,
    title,
    typePrefix: meta.tag,
    variant: opts.variant,
    colorVar: meta.colorVar,
    caption,
    // Resolve cross-highlight refs to the logical box ids the renderer compares
    // against: namespace memberships + held fds (process), and link targets
    // (eth0/lo → the socket they reach; the socket → its interfaces + process).
    memberships: resolveRefs(ctx, opts.memberships),
    holds: resolveRefs(ctx, opts.holds),
    linkIds: opts.links?.map((r) => `${ctx.componentId}__${r}`),
    detail: { role: item.label.toUpperCase(), summary: item.description, sections },
  }
}

// Resolve a chip list's `ref` (a local primitive id) to the logical box id its
// hover should light, keeping the chip's display fields.
const resolveRefs = (ctx, refs) =>
  refs?.map((m) => ({ tag: m.tag, view: m.view, colorVar: m.colorVar, boxId: `${ctx.componentId}__${m.ref}` }))

const buildSynthetic = (ctx, syn, variant) => ({
  // Spread first so fs-row extras (fsType / kindLabel / source) pass through; the
  // overrides below namespace the id, map `tag` → typePrefix, and resolve links.
  ...syn,
  id: `${ctx.componentId}__${syn.id}`,
  typePrefix: syn.tag,
  variant: variant || syn.variant,
  linkIds: syn.links?.map((r) => `${ctx.componentId}__${r}`),
})

// Resolve one spec node (and its subtree) into the box shape PrimitiveBoxCard's
// renderBox consumes. Returns null if a referenced primitive is absent.
const buildNode = (spec, ctx) => {
  if (typeof spec === 'string') return buildBox(ctx, spec)

  let box
  if (spec.synthetic) {
    box = buildSynthetic(ctx, spec.synthetic, spec.variant)
    // Spec-level links (e.g. lo / eth0 → the socket) override the synthetic's own.
    if (spec.links) box.linkIds = spec.links.map((r) => `${ctx.componentId}__${r}`)
  } else {
    box = buildBox(ctx, spec.id, { title: spec.title, variant: spec.variant, memberships: spec.memberships, holds: spec.holds, links: spec.links })
  }
  // `stretch` makes a frame fill its parent ('row' = a full-width row, 'grow' =
  // grow to fill) so the nested filesystem list inherits a real, parent-driven
  // width its container queries can respond to (instead of collapsing to content).
  if (box && spec.stretch) box.stretch = spec.stretch
  if (box && spec.children) box.children = spec.children.map((c) => buildNode(c, ctx)).filter(Boolean)
  return box
}

// Build the in-place internals for a runtime-instance node, or null if the node
// is not a drillable instance. Resolves the registered component (for
// `linuxPrimitive`) by id, falling back to the zone node's own fields.
export function buildPrimitiveInternals(node) {
  const typePrefix = typeOf(node)
  if (!RUNTIME_TYPES.has(typePrefix)) return null

  const key = typePrefix === 'Static Pod' ? 'Pod' : typePrefix
  const set = PRIMITIVES_BY_TYPE[key]
  const layout = LAYOUT_BY_TYPE[key]
  if (!set || !layout) return null

  const component = findComponent(node?.mirror || node?.id)
  const componentId = node?.mirror || node?.id || component?.componentId
  const linuxPrimitive = component?.linuxPrimitive || node?.linuxPrimitive
  const ctx = { componentId, component, byId: new Map(set.items.map((i) => [i.id, i])), linuxPrimitive }

  // The Pod layout is a function of ctx (per-pod mounts + listen port); the others
  // are static spec trees.
  const tree = typeof layout === 'function' ? layout(ctx) : layout
  const boxes = tree.map((spec) => buildNode(spec, ctx)).filter(Boolean)
  return boxes.length ? { bands: [{ boxes }] } : null
}
