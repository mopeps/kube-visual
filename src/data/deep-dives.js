// ── Deep-dive topics ───────────────────────────────────────────────────────
// In-depth explainers that sit one level *below* the OpenShift topology. They
// are rendered to look like the Architecture Overview: a canvas of labelled
// ZONES holding clickable BOXES; clicking a box opens a detail popup
// (DeepDiveModal), exactly the way clicking a node opens AncestryModal.
//
// Each topic is a zone tree (mirrors the shape OverviewTab renders, but from
// this separate data source — Zone.jsx / NodeCard.jsx are pure presentational
// and take a colour + onClick, so nothing needs registering in zones.js).
//
//   topic = {
//     topicId, title, tagline, colorVar,
//     reconciliation?,                 // systemd only — drives the animation
//     zones: [ zone ],
//   }
//   zone  = { id, label, colorVar, dashed?, boxes: [box], zones?: [zone] }
//   box   = {
//     id, title, typePrefix?, subtitle?,
//     badges?: [{ label, kind:'requires'|'after'|'stat' }],
//     detail: {
//       role?, summary,
//       sections: [{ heading, body?, bullets?, kv?:[{k,v}], commands?,
//                    manifest?:{kind,body}, ascii? }],
//     },
//   }

// Example unit for the headline service (ovn-kubernetes node daemon). Mirrors
// the real ordering: structural Requires= on Open vSwitch, chronological After=
// the network-pre target.
const OVNKUBE_UNIT = `[Unit]
Description=OVN Kubernetes Node Daemon (ovnkube-node)
After=network-pre.target ovs-vswitchd.service
Requires=ovs-vswitchd.service

[Service]
ExecStart=/usr/bin/ovnkube --init-node ${'${HOSTNAME}'} --config-file=/etc/ovn/ovnkube.conf
Restart=always
RestartSec=5
Slice=system.slice

[Install]
WantedBy=multi-user.target`

const SYSTEMD_BLUEPRINT = `========================================================================
[ HUMAN / DISK LAYER ]      /etc/systemd/system  &  /usr/lib/systemd/system
                                   |
                                   |  systemctl daemon-reload
================================== V ====================================
[ SYSTEMD · PID 1 MEMORY SPACE ]

  DESIRED STATE — compiled DAG (heap)
  +------------------------------------------------------------------+
  | [ovnkube-node.service] --Requires/pointer--> [ovs-vswitchd.svc]  |
  |  state: UNIT_ACTIVE                                               |
  +------------------------------------------------------------------+
        ^
        |  (4) wakes, evaluates drift, updates flags
        |
  THE ENGINE — epoll() event loop (C)
  +-----------------------------------------------+
  |  blocks on signalfd, waiting for kernel...    |
  +-----------------------------------------------+
        |
        |  (1) state shift -> ExecStart
        |      direct syscalls: fork() / execve()
        v
========================================================================
[ LINUX KERNEL SPACE ]

  ACTUAL STATE — /sys/fs/cgroup tree (kernel VFS)
  +-----------------------------------------------+
  |  /sys/fs/cgroup/system.slice/                 |
  |    \\__ ovnkube-node.service/                  |
  |         |__ cgroup.procs  <- main PID [10243]  |
  |         \\__ (kernel pins all children here)   |
  +-----------------------------------------------+
        |                              ^
        |  (2) daemon killed           |  (3) escaped sub-tools
        v                              |      stay trapped
  KERNEL REALITY — CPU & network primitives
  +------------------------------------------|----+
  |  [PID 10243: ovnkube-node main] ---------+    |
  |  [PID 10255: ovn-nbctl helper]                |
  |  !! KILL !!  -> kernel fires SIGCHLD ---------+
  +-----------------------------------------------+
========================================================================`

// ── systemd · the state reconciliation loop ─────────────────────────────────
const SYSTEMD = {
  topicId: 'systemd',
  title: 'systemd — the state reconciliation loop',
  tagline:
    'On every RHCOS node systemd is PID 1: a state-enforcing supervisor that continuously reconciles an in-memory desired state with kernel reality. Followed here through a real, mission-critical unit — ovn-kubernetes (ovnkube-node.service).',
  colorVar: 'k-amber',
  reconciliation: {
    unit: 'ovnkube-node.service',
    dagBoxId: 'sd-dag',
    engineBoxId: 'sd-engine',
    cgroupBoxId: 'sd-cgroup',
    realityBoxId: 'sd-reality',
    mainPid: 10243,
    restartPid: 10310,
    childPid: 10255,
  },
  zones: [
    {
      id: 'sd-disk',
      label: 'Human / Disk Layer',
      colorVar: 'k-purple',
      boxes: [
        {
          id: 'sd-units',
          title: 'Unit Files',
          typePrefix: 'UNIT',
          subtitle: '/etc/systemd/system · /usr/lib/systemd/system',
          detail: {
            role: 'DECLARATION',
            summary:
              'Flat text unit files (.service, .socket, .target) are the on-disk source of truth. They are parsed once — at boot or on `systemctl daemon-reload` — and compiled into systemd’s in-memory graph. Editing a file changes nothing until that reload.',
            sections: [
              {
                heading: 'Physical reality',
                bullets: [
                  '.service / .socket / .target files under the system unit search path.',
                  'On OpenShift these are rendered from a MachineConfig and applied by Ignition / the MCO — not hand-edited.',
                  'A reload re-parses the files and recompiles the dependency graph in place.',
                ],
              },
              {
                heading: 'Example: ovnkube-node.service',
                body: 'Note the two distinct dependency dimensions — a structural Requires= on Open vSwitch and a chronological After= on the network-pre target.',
                manifest: { kind: 'UNIT', body: OVNKUBE_UNIT },
              },
              {
                heading: 'Explore',
                commands: [
                  '# Where systemd found this unit and its drop-ins\nsystemctl cat ovnkube-node.service',
                  '# Re-parse unit files after an edit\nsystemctl daemon-reload',
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'sd-pid1',
      label: 'systemd · PID 1 — Memory Space',
      colorVar: 'k-amber',
      boxes: [
        {
          id: 'sd-dag',
          title: 'Desired State · Compiled DAG',
          typePrefix: 'HEAP',
          subtitle: 'ovnkube-node.service — UNIT_ACTIVE',
          badges: [
            { label: 'Requires → ovs-vswitchd', kind: 'requires' },
            { label: 'After → network-pre.target', kind: 'after' },
          ],
          detail: {
            role: 'PILLAR 1 · DESIRED STATE',
            summary:
              'systemd compiles the unit files into a Directed Acyclic Graph held in its heap. Each unit is a C `Unit` struct carrying status flags (UNIT_ACTIVE, UNIT_FAILED) and pointers to its dependency nodes.',
            sections: [
              {
                heading: 'Two distinct dimensions',
                body: 'These are not the same edge — the UI draws them differently on purpose.',
                kv: [
                  { k: 'Requires= (structural)', v: 'Hard dependency. If ovs-vswitchd fails or stops, ovnkube-node is stopped with it.' },
                  { k: 'After= (chronological)', v: 'Ordering only. Says “start me after this” — says nothing about whether it must be present.' },
                ],
              },
              {
                heading: 'In memory',
                bullets: [
                  'Unit = a struct on the heap, not a process.',
                  'State flags flip atomically as the engine evaluates the graph.',
                  'Dependency edges are pointers between Unit nodes.',
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Forward dependency graph (what pulled this in)\nsystemctl list-dependencies ovnkube-node.service',
                  '# Reverse (what would fall if ovs-vswitchd dies)\nsystemctl list-dependencies --reverse ovs-vswitchd.service',
                ],
              },
            ],
          },
        },
        {
          id: 'sd-engine',
          title: 'The Engine · PID 1 Event Loop',
          typePrefix: 'epoll',
          subtitle: 'blocked on signalfd…',
          detail: {
            role: 'PILLAR 2 · THE ENGINE',
            summary:
              'The /usr/lib/systemd/systemd binary running as PID 1: a single monolithic C event loop anchored on epoll(). It sleeps until the kernel wakes it with an event, then runs switch/case logic over the in-memory DAG and issues direct syscalls.',
            sections: [
              {
                heading: 'Core mechanism',
                bullets: [
                  'epoll() — one loop, asleep until a file descriptor is ready.',
                  'On a state change it issues fork(), execve(), socket() directly against the kernel.',
                  'It does not poll; it waits to be notified (see Pillar 4).',
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Confirm the engine is PID 1\nps -p 1 -o comm=',
                  '# The file descriptors it is blocked on (signalfd, epoll, inotify)\nls -l /proc/1/fd',
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'sd-kernel',
      label: 'Linux Kernel Space',
      colorVar: 'k-green',
      boxes: [
        {
          id: 'sd-cgroup',
          title: 'Actual State · cgroup Tree',
          typePrefix: 'cgroupfs',
          subtitle: 'cgroup.procs → 10243  (+ helper 10255)',
          detail: {
            role: 'PILLAR 3 · ACTUAL STATE',
            summary:
              'A virtual filesystem at /sys/fs/cgroup (cgroups v2). systemd mirrors each service into a directory here and writes the forked PID into the cgroup.procs file — giving the kernel a stable handle for tracking.',
            sections: [
              {
                heading: 'The containment anchor',
                body: 'Under cgroups v2 the kernel enforces that processes cannot escape their cgroup tree. Any sub-shell, linker, or ovn-* helper that ovnkube-node forks is chained into the same directory by the kernel — so systemd’s tracking is exact.',
                kv: [
                  { k: 'Path', v: '/sys/fs/cgroup/system.slice/ovnkube-node.service/' },
                  { k: 'cgroup.procs', v: 'holds the main PID; every child inherits the slice' },
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# The process tree the kernel pins under this unit\nsystemd-cgls /system.slice/ovnkube-node.service',
                  '# Live per-service resource accounting\nsystemd-cgtop -d 1',
                ],
              },
            ],
          },
        },
        {
          id: 'sd-reality',
          title: 'Kernel Reality · Running PIDs',
          typePrefix: 'CPU',
          subtitle: 'ovnkube-node + ovs bridges br-int / br-ex',
          detail: {
            role: 'PILLAR 4 · DRIFT DETECTION',
            summary:
              'The daemon executing on the CPU, wiring veth pairs and OVS bridges. systemd does not poll for its health — it opens a signalfd and is woken the exact millisecond a process dies.',
            sections: [
              {
                heading: 'The feedback primitives',
                bullets: [
                  'signalfd — turns asynchronous SIGCHLD (fired by the kernel on process death) into a readable fd.',
                  'inotify — watches cgroup files for change.',
                  'On a signal, systemd matches the dead PID to its cgroup, flips the DAG node to UNIT_FAILED, and re-runs the graph rules (e.g. an immediate restart).',
                ],
              },
              {
                heading: 'Try the loop',
                body: 'Use the “Kill Main PID” control on the canvas to watch the SIGCHLD → UNIT_FAILED → fork()/execve() restart play out across the three layers.',
                commands: [
                  '# Watch the unit recover after a kill\nsystemctl kill -s SIGKILL ovnkube-node.service ; journalctl -u ovnkube-node -f',
                ],
              },
            ],
          },
        },
        {
          id: 'sd-blueprint',
          title: 'Architectural Blueprint',
          typePrefix: 'ASCII',
          subtitle: 'the full reconciliation loop, end to end',
          detail: {
            role: 'REFERENCE',
            summary:
              'The whole loop on one page: disk → PID 1 memory (DAG + engine) → kernel space (cgroup tree + reality), and the SIGCHLD feedback edge that closes it.',
            sections: [
              { heading: 'Blueprint', ascii: SYSTEMD_BLUEPRINT },
            ],
          },
        },
      ],
    },
  ],
}

// ── Standard Linux boot ──────────────────────────────────────────────────────
const LINUX_BOOT = {
  topicId: 'linux-boot',
  title: 'The Linux boot process — firmware to PID 1',
  tagline:
    'Four handoffs get a bare machine from power-on to a mounted root filesystem, before systemd ever runs. The same chain underlies the RHCOS/HCP node boot — with cluster-specific steps grafted on.',
  colorVar: 'k-cyan',
  zones: [
    {
      id: 'lb-firmware',
      label: 'Firmware & Bootloader',
      colorVar: 'k-cyan',
      boxes: [
        {
          id: 'lb-uefi',
          title: 'UEFI / BIOS',
          typePrefix: 'STAGE 1',
          subtitle: 'power-on self-test → find a bootloader',
          detail: {
            role: 'FIRMWARE',
            summary:
              'At power-on the platform firmware initialises CPU, memory and buses, runs POST, then consults its boot order to find a bootloader — on UEFI, an .efi binary on the EFI System Partition.',
            sections: [
              { heading: 'Hands off', bullets: [
                'UEFI → a file on the ESP; legacy BIOS → the MBR/boot sector.',
                'Secure Boot (when enabled) verifies the bootloader signature first.',
              ] },
              { heading: 'Explore', commands: [
                '# UEFI? (this dir exists only under UEFI)\nls /sys/firmware/efi',
                '# UEFI boot entries\nefibootmgr -v',
              ] },
            ],
          },
        },
        {
          id: 'lb-grub',
          title: 'GRUB2',
          typePrefix: 'STAGE 2',
          subtitle: 'load kernel + initramfs · pass kernel args',
          detail: {
            role: 'BOOTLOADER',
            summary:
              'GRUB2 selects a boot entry, loads the kernel (vmlinuz) and initramfs into memory, and jumps into the kernel. The kernel command line it sets — root=, console=, custom kargs — shapes everything that follows.',
            sections: [
              { heading: 'On OpenShift', bullets: [
                'Custom kernel arguments are declared in a MachineConfig and rendered into the GRUB entry, not hand-edited.',
              ] },
              { heading: 'Explore', commands: [
                '# The command line this machine actually booted with\ncat /proc/cmdline',
              ] },
            ],
          },
        },
      ],
    },
    {
      id: 'lb-kernel',
      label: 'Kernel & Early Userspace',
      colorVar: 'k-sky',
      boxes: [
        {
          id: 'lb-kernel-stage',
          title: 'Kernel',
          typePrefix: 'STAGE 3',
          subtitle: 'hardware init on a temporary RAM root',
          detail: {
            role: 'KERNEL',
            summary:
              'The kernel decompresses, brings up core subsystems, the scheduler and the device model (udev), then mounts the initramfs as a temporary in-RAM root. It cannot yet read the real disk root — the logic to do so lives inside the initramfs.',
            sections: [
              { heading: 'Explore', commands: [
                '# Earliest boot messages\ndmesg | head -n 40',
                '# Time the kernel phase\nsystemd-analyze',
              ] },
            ],
          },
        },
        {
          id: 'lb-initramfs',
          title: 'initramfs (dracut)',
          typePrefix: 'STAGE 4',
          subtitle: 'find & mount the real root at /sysroot',
          detail: {
            role: 'EARLY USERSPACE',
            summary:
              'A small self-contained userspace built by dracut. It runs just enough to locate the real root device — loading storage drivers, assembling LVM/RAID, unlocking LUKS, or bringing up networking for a remote root — and mounts it at /sysroot. On RHCOS, Ignition runs here on first boot.',
            sections: [
              { heading: 'Explore', commands: [
                '# Modules baked into the current initramfs\nlsinitrd | head -n 40',
              ] },
            ],
          },
        },
        {
          id: 'lb-switchroot',
          title: 'switch_root',
          typePrefix: 'STAGE 5',
          subtitle: 'pivot onto the real filesystem → exec PID 1',
          detail: {
            role: 'PIVOT',
            summary:
              'With /sysroot mounted, the initramfs performs switch_root: it makes the real root the new /, frees the in-RAM initramfs, and execs the real /usr/lib/systemd/systemd as PID 1. The boot crosses from throwaway early userspace into the installed OS.',
            sections: [
              { heading: 'Next', body: 'From here the systemd deep dive takes over — PID 1 begins resolving the unit graph.' },
            ],
          },
        },
      ],
    },
    {
      id: 'lb-userspace',
      label: 'Userspace · systemd',
      colorVar: 'k-green',
      boxes: [
        {
          id: 'lb-default-target',
          title: 'default.target',
          typePrefix: 'STAGE 6',
          subtitle: 'reach multi-user.target — “booted”',
          detail: {
            role: 'USERSPACE',
            summary:
              'PID 1 resolves the dependency graph up to default.target (multi-user.target on a server). Reaching it means networking, logging, and all enabled services — including the cluster’s kubelet/CRI-O/OVS units — are up.',
            sections: [
              { heading: 'Explore', commands: [
                '# What this machine boots into\nsystemctl get-default',
                '# Slowest units this boot\nsystemd-analyze blame | head',
              ] },
            ],
          },
        },
      ],
    },
  ],
}

// ── OpenShift / HCP node boot ────────────────────────────────────────────────
const HCP_BOOT = {
  topicId: 'hcp-boot',
  title: 'How an OpenShift / HCP worker node boots',
  tagline:
    'A hosted-cluster worker is the standard Linux boot with three OpenShift graft points: its desired OS state is a MachineConfig, that state is delivered by an Ignition Server, and the “machine” is a KubeVirt VirtualMachineInstance. The end state is a node that has joined the hosted cluster.',
  colorVar: 'k-sky',
  zones: [
    {
      id: 'hcp-control',
      label: 'Management Control Plane · Intent',
      colorVar: 'k-blue',
      boxes: [
        {
          id: 'hcp-nodepool',
          title: 'NodePool',
          typePrefix: 'STEP 1',
          subtitle: 'declare the worker pool',
          detail: {
            role: 'DESIRED STATE',
            summary:
              'You do not provision a node directly; you declare a NodePool against the HostedCluster (RHCOS version, size, count). Cluster API + the KubeVirt provider (CAPK) reconcile it into the VM objects that become workers.',
            sections: [
              { heading: 'Explore', commands: ['# Worker pools for a hosted cluster\noc get nodepool -n clusters'] },
            ],
          },
        },
        {
          id: 'hcp-mco',
          title: 'MCO → MachineConfig',
          typePrefix: 'STEP 2',
          subtitle: 'render units + kargs → Ignition payload',
          detail: {
            role: 'RENDER',
            summary:
              'The Machine Config Operator merges every MachineConfig for the pool — units, files, kernel args — into one rendered config and compiles it to an Ignition payload: the node’s entire logical intent for first boot.',
            sections: [
              { heading: 'Note', bullets: ['Base units like crio.service also ship in the immutable RHCOS image; Ignition layers the cluster-specific deltas on top.'] },
              { heading: 'Explore', commands: ['# Rendered MachineConfigs for a pool\noc get machineconfig | grep rendered'] },
            ],
          },
        },
        {
          id: 'hcp-ignition',
          title: 'Ignition Server',
          typePrefix: 'STEP 3',
          subtitle: 'serve the config to the booting VM',
          detail: {
            role: 'DELIVERY',
            summary:
              'An HCP node fetches its Ignition from a per-hosted-cluster Ignition Server Pod in the control-plane namespace (over the same shared ingress as the API). The booting VM pulls its payload from there on first boot — the bridge from control-plane intent to a real machine.',
            sections: [
              { heading: 'Mechanism', bullets: ['The VM’s kernel args point it at the Ignition Server URL.'] },
            ],
          },
        },
      ],
    },
    {
      id: 'hcp-vm',
      label: 'Guest Worker · VirtualMachineInstance (RHCOS)',
      colorVar: 'k-green',
      boxes: [
        {
          id: 'hcp-vmi',
          title: 'VMI powers on',
          typePrefix: 'STEP 4',
          subtitle: 'firmware → GRUB → kernel → initramfs',
          detail: {
            role: 'THE MACHINE',
            summary:
              'The “worker” is a KubeVirt VirtualMachineInstance: a QEMU/KVM guest on a bare-metal worker, wrapped by a virt-launcher Pod. Inside it, RHCOS runs the exact firmware → switch_root sequence from the Linux boot deep dive — a real OS booting on virtual hardware.',
            sections: [
              { heading: 'See also', body: 'The “Linux boot process” deep dive details every stage this reuses.' },
              { heading: 'Explore', commands: ['# VMIs backing a hosted cluster’s workers\noc get vmi -n clusters-<hosted-cluster>'] },
            ],
          },
        },
        {
          id: 'hcp-ignition-apply',
          title: 'Ignition applies config',
          typePrefix: 'STEP 5',
          subtitle: 'write units + kargs to /sysroot (first boot)',
          detail: {
            role: 'FIRST BOOT',
            summary:
              'Still inside the initramfs, Ignition fetches the payload and writes it to /sysroot: systemd unit files, drop-ins, config, kernel args. After switch_root, PID 1 sees a node already configured to join the cluster.',
            sections: [
              { heading: 'Note', bullets: [
                'Runs once, early — which is why config changes generally require a reboot.',
                'Writes the kubelet config, pull secret, and CA the node needs to authenticate.',
              ] },
              { heading: 'Explore', commands: ['# Did Ignition run this boot?\njournalctl -b | grep -i ignition | head'] },
            ],
          },
        },
        {
          id: 'hcp-join',
          title: 'kubelet joins',
          typePrefix: 'STEP 6',
          subtitle: 'CSR → approved → Node Ready',
          detail: {
            role: 'JOIN',
            summary:
              'systemd reaches multi-user.target and starts kubelet.service (After=crio.service). The kubelet sends a CSR to the hosted cluster’s API server; once approved it registers the Node, the CNI wires pod networking, and the node flips to Ready — a real worker of the hosted cluster.',
            sections: [
              { heading: 'Explore', commands: [
                '# Watch the new node reach Ready (against the hosted cluster)\noc get nodes -w',
                '# Pending CSRs waiting for approval\noc get csr | grep -i pending',
              ] },
            ],
          },
        },
      ],
    },
  ],
}

export const DEEP_DIVES = [SYSTEMD, LINUX_BOOT, HCP_BOOT]

export const findDeepDive = (topicId) =>
  DEEP_DIVES.find((t) => t.topicId === topicId) || null

// Flatten a topic's zone tree into a { boxId: { box, accent } } map so the tab
// can resolve a clicked box id to its detail + colour without re-walking.
export function indexTopicBoxes(topic) {
  const out = {}
  const walk = (zones) => {
    for (const zone of zones) {
      const accent = `var(--${zone.colorVar || topic.colorVar || 'k-cyan'})`
      zone.boxes?.forEach((box) => { out[box.id] = { box, accent, zone } })
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(topic.zones || [])
  return out
}
