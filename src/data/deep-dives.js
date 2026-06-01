// ── Deep-dive topics ───────────────────────────────────────────────────────
// In-depth, ground-up explainers that sit one level *below* the OpenShift
// topology: what systemd is and manages, the standard Linux boot sequence, and
// how an OpenShift/HCP node actually boots. This is a general, reusable surface
// — each topic is pure data, so adding a new explainer is just another entry in
// the TOPICS array (no new plumbing).
//
// The shape deliberately mirrors events.json (title / tagline / ordered steps)
// so DeepDiveTab can mirror PacketFlowTab: an index of cards → a numbered,
// expandable stage list. A single step shape covers both boot *sequences*
// (firmware → … → targets) and systemd *concepts* (unit, slice, process):
//
//   {
//     label,            // headline shown on the collapsed row
//     kicker?,          // short uppercase eyebrow (e.g. 'STAGE 3 · KERNEL')
//     body,             // one-paragraph explanation
//     bullets?,         // concrete sub-points
//     manifest?,        // { kind: 'UNIT'|'MANIFEST', body } — copyable example
//     commands?,        // copyable shell commands to explore it live
//     colorVar?,        // per-step accent (defaults to the topic colorVar)
//   }
//
// Existing content is reused rather than re-authored: systemd primitives come
// from PRIMITIVES_BY_TYPE['systemd'] and example unit files from MANIFESTS.

import { PRIMITIVES_BY_TYPE } from './primitives'
import { MANIFESTS } from './manifests'

// systemd kernel/OS primitives already authored once — fold them into rows so
// the unit / cgroup-slice / process descriptions stay single-sourced.
const SYSTEMD_PRIMS = Object.fromEntries(
  PRIMITIVES_BY_TYPE.systemd.items.map((p) => [p.id, p]),
)
const primStep = (id, extra = {}) => {
  const p = SYSTEMD_PRIMS[id]
  return {
    label: p.label,
    body: p.description,
    bullets: p.interactions,
    commands: p.commands,
    ...extra,
  }
}

// ── systemd ────────────────────────────────────────────────────────────────
const SYSTEMD = {
  topicId: 'systemd',
  title: 'systemd — what PID 1 manages',
  tagline:
    'On every RHCOS node systemd is process 1: the first thing the kernel hands control to, and the parent of every host service. It is the layer the cluster’s [systemd] boxes — Kubelet, CRI-O, Open vSwitch — actually live in.',
  colorVar: 'k-amber',
  steps: [
    {
      kicker: 'WHAT IT IS',
      label: 'PID 1 — the init system & service manager',
      body:
        'When the kernel finishes mounting the real root filesystem it executes /usr/lib/systemd/systemd as PID 1. From then on systemd owns the userspace: it starts services in dependency order, supervises them, reaps orphans, tracks their state, and collects their logs. Nothing on the host runs outside the tree it roots.',
      bullets: [
        'Reaps every orphaned process — as PID 1 it inherits and waits on them so they never become zombies.',
        'Reads the manifest of desired host state from unit files under /etc/systemd/system, /run/systemd/system, and /usr/lib/systemd/system.',
        'Exposes the whole machine state over D-Bus, which is how systemctl and the rest of the OS talk to it.',
      ],
      commands: [
        '# Confirm systemd is PID 1\nps -p 1 -o comm=',
        '# The full supervision tree, service by service\nsystemctl status',
      ],
    },
    {
      kicker: 'THE BUILDING BLOCK',
      label: 'Units — .service, .socket, .target, .mount, .timer',
      body:
        'Everything systemd manages is a unit: a declarative file describing one piece of desired state. A .service runs a process; a .target is a named sync point that groups other units (the systemd analogue of a runlevel); a .socket defers start-up until the first connection; a .mount realises a filesystem; a .timer schedules work. The cluster’s host agents are all .service units.',
      bullets: [
        '.service — a supervised process (kubelet.service, crio.service).',
        '.target — a grouping/ordering anchor; multi-user.target is the normal "fully booted" state.',
        '.socket / .timer — lazy (socket-activated) and scheduled start-up without a always-on daemon.',
        '.mount / .device — filesystems and udev devices, so storage ordering is part of the same graph.',
      ],
      commands: [
        '# List every loaded unit and its state\nsystemctl list-units --all',
        '# Just the services\nsystemctl list-units --type=service',
      ],
    },
    {
      kicker: 'ORDERING',
      label: 'Dependencies — After= / Requires= / Wants=',
      body:
        'systemd does not run units in file order — it solves a dependency graph. After=/Before= set ordering; Requires=/Wants= set strength (a hard requirement that fails the dependent, vs a soft pull that does not). This is exactly why the cluster’s host agents come up in the right sequence: kubelet.service is ordered After=crio.service and Requires= it, and CRI-O itself waits on network-online.target.',
      bullets: [
        'After= / Before= — ordering only (when, not whether).',
        'Requires= — hard dependency: if it fails or stops, this unit is stopped too.',
        'Wants= — soft dependency: pull it in if possible, but do not fail if it is absent.',
        'kubelet.service ⟶ After=/Requires= crio.service ⟶ After= network-online.target.',
      ],
      manifest: MANIFESTS['kubelet-master'] || null,
      commands: [
        '# Why did this unit start — what pulled it in?\nsystemctl list-dependencies kubelet.service',
        '# Reverse: what depends on CRI-O?\nsystemctl list-dependencies --reverse crio.service',
      ],
    },
    primStep('systemd-unit', {
      kicker: 'PRIMITIVE · DECLARATION',
      label: 'systemd Unit — the .service contract',
      manifest: MANIFESTS['crio-master'] || null,
    }),
    primStep('cgroup-slice', {
      kicker: 'PRIMITIVE · RESOURCES',
      label: 'cgroup Slice — per-service accounting',
    }),
    primStep('service-process', {
      kicker: 'PRIMITIVE · PROCESS',
      label: 'systemd Process — the running binary',
    }),
    {
      kicker: 'OBSERVABILITY',
      label: 'journald — the logs of everything it runs',
      body:
        'Because every service is a child of PID 1, systemd captures their stdout/stderr into a single structured journal. journalctl is the one place to read host-service logs, filter by unit, and follow boot-by-boot history — indispensable when a node’s kubelet or CRI-O misbehaves.',
      bullets: [
        'Structured, indexed records (not flat text) — filter by unit, priority, boot, or time.',
        '-b selects a specific boot; journalctl --list-boots enumerates them.',
        'Survives across restarts when storage is persistent (/var/log/journal).',
      ],
      commands: [
        '# Follow a unit live\njournalctl -u kubelet.service -f --no-pager',
        '# Everything from the current boot, most recent first\njournalctl -b -r --no-pager',
      ],
    },
  ],
}

// ── Standard Linux boot ──────────────────────────────────────────────────────
const LINUX_BOOT = {
  topicId: 'linux-boot',
  title: 'The Linux boot process — firmware to PID 1',
  tagline:
    'Before systemd ever runs, four handoffs get a bare machine from power-on to a mounted root filesystem. Knowing this sequence is what makes the RHCOS/HCP boot story legible — it is the same chain with cluster-specific steps grafted on.',
  colorVar: 'k-cyan',
  steps: [
    {
      kicker: 'STAGE 1 · FIRMWARE',
      label: 'UEFI / BIOS — power-on self-test',
      colorVar: 'k-cyan',
      body:
        'At power-on the platform firmware (UEFI on modern hardware, legacy BIOS otherwise) initialises CPU, memory and buses, runs POST, then consults its boot order to find a bootloader — on UEFI, an .efi binary on the EFI System Partition.',
      bullets: [
        'Hands off to a bootloader; on UEFI that is a file on the ESP, on BIOS it is the MBR/boot sector.',
        'Secure Boot (when enabled) verifies the bootloader’s signature before executing it.',
      ],
      commands: [
        '# Are we on UEFI? (the directory exists only under UEFI)\nls /sys/firmware/efi',
        '# Inspect UEFI boot entries\nefibootmgr -v',
      ],
    },
    {
      kicker: 'STAGE 2 · BOOTLOADER',
      label: 'GRUB2 — choose kernel & pass kernel args',
      colorVar: 'k-blue',
      body:
        'GRUB2 loads its config, presents (or auto-selects) a boot entry, then loads the selected kernel (vmlinuz) and its initramfs into memory and jumps into the kernel. The kernel command line set here — root=, console=, plus any custom kargs — shapes everything that follows.',
      bullets: [
        'Loads vmlinuz + initramfs and passes the kernel command line.',
        'On OpenShift, custom kernel arguments are declared in a MachineConfig and rendered into the GRUB entry, not hand-edited.',
      ],
      commands: [
        '# The kernel command line this machine actually booted with\ncat /proc/cmdline',
      ],
    },
    {
      kicker: 'STAGE 3 · KERNEL',
      label: 'Kernel — hardware init on a temporary root',
      colorVar: 'k-sky',
      body:
        'The kernel decompresses, initialises core subsystems and the scheduler, then mounts the initramfs as a temporary in-RAM root filesystem. It cannot yet read the real disk root — the drivers and logic to do so live inside that initramfs.',
      bullets: [
        'Brings up CPUs, memory management, and the device model; starts udev to enumerate hardware.',
        'Uses the initramfs as root because the real root may need modules, LVM, LUKS, or network it does not yet have.',
      ],
      commands: [
        '# Kernel ring buffer — the earliest boot messages\ndmesg | head -n 40',
        '# Time the kernel phase took before userspace\nsystemd-analyze',
      ],
    },
    {
      kicker: 'STAGE 4 · INITRAMFS',
      label: 'initramfs (dracut) — find & mount the real root',
      colorVar: 'k-teal',
      body:
        'The initramfs is a small, self-contained userspace built by dracut. It runs just enough to locate the real root device — loading storage drivers, assembling RAID/LVM, unlocking LUKS, or bringing up networking for a remote root — and mounts it read-only at /sysroot.',
      bullets: [
        'A minimal early userspace whose only job is to make the real root mountable.',
        'On RHCOS this is also where Ignition runs on first boot, before the system has fully come up.',
      ],
      commands: [
        '# List the modules baked into the current initramfs\nlsinitrd | head -n 40',
      ],
    },
    {
      kicker: 'STAGE 5 · SWITCH-ROOT',
      label: 'switch_root — pivot onto the real filesystem',
      colorVar: 'k-green',
      body:
        'With /sysroot mounted, the initramfs performs switch_root: it makes the real root the new /, frees the in-RAM initramfs, and execs the real /usr/lib/systemd/systemd as PID 1. The boot has now crossed from throwaway early userspace into the actual installed OS.',
      bullets: [
        'Replaces the temporary RAM root with the on-disk root and execs the final init.',
        'From here the systemd deep dive takes over — PID 1 begins resolving the unit graph.',
      ],
      commands: [
        '# The pivot is visible in the early journal\njournalctl -b | grep -i switch_root',
      ],
    },
    {
      kicker: 'STAGE 6 · USERSPACE',
      label: 'systemd → default.target (multi-user.target)',
      colorVar: 'k-green',
      body:
        'PID 1 resolves the dependency graph up to default.target — on a server that is multi-user.target. Reaching it means networking, logging, and all enabled services (including the cluster’s kubelet/CRI-O/OVS units) are up. The machine is "booted".',
      bullets: [
        'default.target is a symlink to the target the machine boots into (multi-user.target on RHCOS).',
        'systemd-analyze blame ranks which units cost the most boot time.',
      ],
      commands: [
        '# What does this machine boot into?\nsystemctl get-default',
        '# Slowest units this boot\nsystemd-analyze blame | head',
      ],
    },
  ],
}

// ── OpenShift / HCP node boot ────────────────────────────────────────────────
const HCP_BOOT = {
  topicId: 'hcp-boot',
  title: 'How an OpenShift / HCP worker node boots',
  tagline:
    'A hosted-cluster worker is the standard Linux boot with three OpenShift-specific graft points: its desired OS state is a MachineConfig, that state is delivered by an Ignition Server, and the "machine" is a KubeVirt VirtualMachineInstance. The end state is a node that has joined the *hosted* cluster.',
  colorVar: 'k-sky',
  steps: [
    {
      kicker: 'STEP 1 · DESIRED STATE',
      label: 'NodePool — declaring the worker pool',
      colorVar: 'k-blue',
      body:
        'In HCP you do not provision a node directly; you declare a NodePool against the HostedCluster. The NodePool names the RHCOS version, size, and count. Cluster API + the KubeVirt provider (CAPK) translate it into the actual VM objects that will become workers.',
      bullets: [
        'NodePool is the desired-state record; CAPI/CAPK reconcile it into KubeVirt VirtualMachines.',
        'Scaling the pool is what triggers a brand-new node to go through this whole boot chain.',
      ],
      commands: [
        '# The worker pools for a hosted cluster\noc get nodepool -n clusters',
      ],
    },
    {
      kicker: 'STEP 2 · RENDER',
      label: 'MCO renders the MachineConfig → Ignition',
      colorVar: 'k-blue',
      body:
        'The Machine Config Operator merges every MachineConfig that applies to the pool — units, files, and kernel args — into one rendered config, then compiles it to an Ignition payload. This is the node’s entire "logical intent": the manifest of host state it must reach on first boot.',
      bullets: [
        'MachineConfig is the declarative source; the rendered Ignition config is the compiled artifact.',
        'Base units like crio.service also ship inside the immutable RHCOS image — Ignition layers the cluster-specific deltas on top.',
      ],
      commands: [
        '# The rendered MachineConfigs for a pool\noc get machineconfig | grep rendered',
      ],
    },
    {
      kicker: 'STEP 3 · DELIVERY',
      label: 'Ignition Server serves the config',
      colorVar: 'k-sky',
      body:
        'Unlike a standalone cluster, an HCP node fetches its Ignition from a per-hosted-cluster Ignition Server Pod running in the control-plane namespace (reached over the same shared ingress as the API). The booting VM pulls its payload from there on first boot — the bridge from control-plane intent to a real machine.',
      bullets: [
        'Ignition Server is a control-plane Pod, not a host service — it exists to hand first-boot config to new workers.',
        'The VM’s kernel args point it at the Ignition Server URL.',
      ],
    },
    {
      kicker: 'STEP 4 · THE MACHINE',
      label: 'VirtualMachineInstance powers on (RHCOS)',
      colorVar: 'k-teal',
      body:
        'The "worker" is a KubeVirt VirtualMachineInstance: a QEMU/KVM guest scheduled onto a bare-metal worker, wrapped by a virt-launcher Pod. Inside it, RHCOS runs the exact firmware → GRUB → kernel → initramfs → switch_root sequence from the Linux boot deep dive — it is a real OS booting, just on virtual hardware.',
      bullets: [
        'Same boot chain as bare metal, executed inside a VMI on virtio hardware.',
        'See the "Linux boot process" deep dive for the per-stage detail this reuses.',
      ],
      commands: [
        '# The VMIs backing a hosted cluster’s workers\noc get vmi -n clusters-<hosted-cluster>',
      ],
    },
    {
      kicker: 'STEP 5 · FIRST BOOT',
      label: 'Ignition applies units + kernel args',
      colorVar: 'k-green',
      body:
        'Still inside the initramfs, Ignition fetches the payload from the Ignition Server and writes it to /sysroot: it lays down systemd unit files, drop-ins, config files, and kernel arguments, then lets the boot continue. After switch_root, PID 1 sees a node already configured to join the cluster.',
      bullets: [
        'Runs once, early, before the system is up — this is why config changes generally require a reboot.',
        'Writes the kubelet config, pull secret, and CA the node needs to authenticate.',
      ],
      commands: [
        '# Did Ignition run this boot?\njournalctl -b | grep -i ignition | head',
      ],
    },
    {
      kicker: 'STEP 6 · JOIN',
      label: 'kubelet.service starts & the node registers',
      colorVar: 'k-green',
      body:
        'systemd reaches multi-user.target and starts kubelet.service (After=crio.service). The kubelet boots a CSR to the hosted cluster’s API server; once approved it registers the Node object, the CNI wires pod networking, and the node flips to Ready — now a real worker of the *hosted* cluster, ready to run guest workloads.',
      bullets: [
        'kubelet → CSR → approval → Node object → CNI ready → Ready.',
        'From here the node is indistinguishable from any other OpenShift worker in the hosted cluster.',
      ],
      manifest: MANIFESTS['kubelet-master'] || null,
      commands: [
        '# Watch the new node reach Ready (against the hosted cluster)\noc get nodes -w',
        '# Pending CSRs waiting for approval\noc get csr | grep -i pending',
      ],
    },
  ],
}

export const DEEP_DIVES = [SYSTEMD, LINUX_BOOT, HCP_BOOT]

export const findDeepDive = (topicId) =>
  DEEP_DIVES.find((t) => t.topicId === topicId) || null
