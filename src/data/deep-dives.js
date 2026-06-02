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
//     reconciliation?,                 // systemd only — drives the animation +
//                                      // the on-canvas loop edges (recon.edges)
//     zones: [ zone ],
//   }
//   zone  = { id, label, colorVar, dashed?, boxes: [box], zones?: [zone] }
//   box   = {
//     id, title, typePrefix?, subtitle?,
//     badges?: [{ label, kind:'requires'|'after'|'stat' }],
//     detail: {
//       role?, summary,
//       // Sections render keyword-first (mirrors the Overview's chip/tag look):
//       //   tags   → short keyword chips        facts  → accent key-chip + value
//       //   states → colour-coded status pills + meaning (ok/bad/busy/idle tone)
//       //   units  → chip-selectable unit gallery (UnitGallery)
//       // plus the long-form fallbacks: body, bullets, kv, manifest, commands, ascii.
//       sections: [{ heading, body?, tags?:[str], facts?:[{k,v}],
//                    states?:[{label,tone,meaning}], bullets?,
//                    kv?:[{k,v}], units?:[unit], commands?,
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

// ── A gallery of example units ───────────────────────────────────────────────
// Many unit *types*, deliberately spanning beyond Kubernetes, so the reader sees
// the range of what a unit can be and what each kind is for. Surfaced as a
// chip-selectable gallery in the "Unit Files" popup.
//   { id, name, kind, tag, summary, body, directives:[keyword chips] }
const UNIT_EXAMPLES = [
  {
    id: 'u-nginx', name: 'nginx.service', kind: '.service', tag: 'forking daemon',
    summary: 'A long-running web server. Type=forking tells systemd the launched process forks and the parent exits, so it tracks the daemonised child.',
    directives: ['Type=forking', 'ExecReload', 'Restart=on-failure', 'Wants='],
    body: `[Unit]
Description=nginx web server
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
PIDFile=/run/nginx.pid
ExecStart=/usr/sbin/nginx
ExecReload=/usr/sbin/nginx -s reload
Restart=on-failure

[Install]
WantedBy=multi-user.target`,
  },
  {
    id: 'u-sysctl', name: 'systemd-sysctl.service', kind: '.service', tag: 'oneshot',
    summary: 'Runs once to completion, not a daemon. RemainAfterExit keeps it reported "active" so other units can order After= it even though no process lingers.',
    directives: ['Type=oneshot', 'RemainAfterExit=yes', 'WantedBy=sysinit.target'],
    body: `[Unit]
Description=Apply Kernel Variables
DefaultDependencies=no
After=systemd-modules-load.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/lib/systemd/systemd-sysctl

[Install]
WantedBy=sysinit.target`,
  },
  {
    id: 'u-backup-timer', name: 'backup.timer', kind: '.timer', tag: 'scheduler · cron',
    summary: 'The systemd replacement for cron. It owns no process — it starts its sibling backup.service on a schedule. Persistent=true runs a missed job after downtime.',
    directives: ['OnCalendar=', 'Persistent=true', 'WantedBy=timers.target'],
    body: `[Unit]
Description=Run the daily backup job

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=15m

[Install]
WantedBy=timers.target`,
  },
  {
    id: 'u-sshd-socket', name: 'sshd.socket', kind: '.socket', tag: 'socket activation',
    summary: 'systemd itself holds the listening port and only launches the service when a connection actually arrives — saving resources until something connects.',
    directives: ['ListenStream=22', 'Accept=yes', 'WantedBy=sockets.target'],
    body: `[Unit]
Description=OpenSSH per-connection socket

[Socket]
ListenStream=22
Accept=yes

[Install]
WantedBy=sockets.target`,
  },
  {
    id: 'u-data-mount', name: 'srv-data.mount', kind: '.mount', tag: 'filesystem',
    summary: 'A declarative mount, equivalent to an /etc/fstab line. The unit filename must encode the mount point: /srv/data → srv-data.mount.',
    directives: ['What=', 'Where=', 'Type=ext4', 'Options=noatime'],
    body: `[Unit]
Description=Mount the data volume

[Mount]
What=/dev/disk/by-label/DATA
Where=/srv/data
Type=ext4
Options=defaults,noatime

[Install]
WantedBy=multi-user.target`,
  },
  {
    id: 'u-jobs-path', name: 'jobs.path', kind: '.path', tag: 'path activation',
    summary: 'Watches the filesystem (via inotify) and starts a companion service the moment a matching file appears — e.g. a spool directory that triggers a processor.',
    directives: ['PathExistsGlob=', 'Unit=', 'WantedBy=multi-user.target'],
    body: `[Unit]
Description=Watch the job spool directory

[Path]
PathExistsGlob=/var/spool/jobs/*
Unit=jobs-process.service

[Install]
WantedBy=multi-user.target`,
  },
  {
    id: 'u-multiuser', name: 'multi-user.target', kind: '.target', tag: 'sync point',
    summary: 'A target runs nothing — it is a named milestone (like an old SysV runlevel) that other units order against. Reaching it means "the system is up, multi-user".',
    directives: ['Requires=', 'After=', 'AllowIsolate=yes'],
    body: `[Unit]
Description=Multi-User System
Documentation=man:systemd.special(7)
Requires=basic.target
Conflicts=rescue.service rescue.target
After=basic.target rescue.service rescue.target
AllowIsolate=yes`,
  },
  {
    id: 'u-kubelet', name: 'kubelet.service', kind: '.service', tag: 'kubernetes',
    summary: 'The Kubernetes node agent — the cluster-side counterpart of ovnkube-node. After=crio.service guarantees the container runtime is up before the kubelet starts pods.',
    directives: ['After=crio.service', 'Restart=always', 'RestartSec=10'],
    body: `[Unit]
Description=Kubernetes Kubelet
Wants=crio.service
After=crio.service

[Service]
ExecStart=/usr/bin/kubelet --config=/etc/kubernetes/kubelet.conf
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`,
  },
]

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
    // The processes the kernel pins inside the unit's cgroup. The main process
    // death triggers a unit restart; a child death is merely reaped.
    main: { pid: 10243, label: 'ovnkube-node' },
    children: [
      { pid: 10255, label: 'ovn-nbctl' },
      { pid: 10256, label: 'ovn-controller mon' },
    ],
    // Fresh PIDs systemd forks on restart.
    restart: {
      main: { pid: 10310, label: 'ovnkube-node' },
      children: [
        { pid: 10322, label: 'ovn-nbctl' },
        { pid: 10323, label: 'ovn-controller mon' },
      ],
    },
    // The reconciliation loop drawn directly on the canvas (this replaces the
    // old "Architectural Blueprint" popup): labelled connector edges between the
    // four pillars — desired state (DAG), the engine, actual state (cgroup) and
    // kernel reality — so the end-to-end loop reads off the overview itself.
    //   from/to  = box ids to anchor between (dd-<id> in the DOM)
    //   bias     = sideways bow for parallel vertical edges ('left' | 'right')
    //   accent   = colour var; phase = loop phase that lights this edge up
    edges: [
      { id: 'compile', from: 'sd-units', to: 'sd-dag', step: '1',
        label: 'daemon-reload\ncompiles the DAG', accent: 'k-purple' },
      { id: 'evaluate', from: 'sd-engine', to: 'sd-dag', step: '2',
        label: 'evaluates drift\nsets UNIT flags', accent: 'k-amber', phase: 'failed' },
      { id: 'enforce', from: 'sd-engine', to: 'sd-reality', step: '3', bias: 'left',
        label: 'ExecStart\nfork() / execve()', accent: 'k-green', phase: 'restart' },
      { id: 'pin', from: 'sd-reality', to: 'sd-cgroup', step: '4',
        label: 'kernel pins PIDs\ninto cgroup.procs', accent: 'k-green' },
      { id: 'notify', from: 'sd-reality', to: 'sd-engine', step: '5', bias: 'right',
        label: 'SIGCHLD on\nprocess death', accent: 'packet', phase: 'sigchld' },
    ],
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
              'Flat text unit files are the on-disk source of truth. They are parsed once — at boot or on `systemctl daemon-reload` — and compiled into systemd’s in-memory graph. Editing a file changes nothing until that reload.',
            sections: [
              {
                heading: 'At a glance',
                tags: ['plain text', 'declarative', 'parsed on daemon-reload', 'MCO-rendered on OpenShift'],
                facts: [
                  { k: '[Unit]', v: 'metadata + dependencies (Description, Requires, After)' },
                  { k: '[Service]', v: 'how to run it (Type, ExecStart, Restart)' },
                  { k: '[Install]', v: 'enablement target (WantedBy)' },
                ],
              },
              {
                heading: 'Unit types — pick a chip',
                body: 'Units come in many kinds, far beyond Kubernetes. Each example shows what that type is for.',
                units: UNIT_EXAMPLES,
              },
              {
                heading: 'The headline unit · ovnkube-node.service',
                tags: ['Requires= → structural', 'After= → ordering'],
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
                heading: 'Why “Directed Acyclic Graph”?',
                facts: [
                  { k: 'Directed', v: 'edges point one way — Requires= / After= have a direction' },
                  { k: 'Acyclic', v: 'no cycles allowed — guarantees a solvable start order (no A→B→A deadlock)' },
                  { k: 'Graph', v: 'units are nodes, dependencies are the edges between them' },
                ],
                tags: ['cycle → systemd breaks it + warns', 'topologically sortable'],
              },
              {
                heading: 'Unit states (the ACTIVE flag)',
                body: 'Every unit reports one high-level active state. The engine flips between them as it reconciles desired vs actual.',
                states: [
                  { label: 'active', tone: 'ok', meaning: 'running / ran successfully — desired == actual' },
                  { label: 'activating', tone: 'busy', meaning: 'starting up — ExecStart in flight' },
                  { label: 'deactivating', tone: 'busy', meaning: 'shutting down — ExecStop in flight' },
                  { label: 'reloading', tone: 'busy', meaning: 're-reading its own config, no full restart' },
                  { label: 'inactive', tone: 'idle', meaning: 'stopped cleanly — not running, no error' },
                  { label: 'failed', tone: 'bad', meaning: 'process exited non-zero, timed out, or was killed' },
                ],
              },
              {
                heading: 'Load state (is the file even parsed?)',
                facts: [
                  { k: 'loaded', v: 'file found on the search path + parsed into the DAG' },
                  { k: 'not-found', v: 'no such unit file — nothing to start' },
                  { k: 'masked', v: 'symlinked to /dev/null — cannot be started at all' },
                ],
              },
              {
                heading: 'Two distinct dependency dimensions',
                facts: [
                  { k: 'Requires=', v: 'structural — if ovs-vswitchd dies, ovnkube-node is stopped with it' },
                  { k: 'After=', v: 'ordering only — “start me after this”, nothing about presence' },
                ],
              },
              {
                heading: 'In memory',
                tags: ['Unit = heap struct', 'not a process', 'flags flip atomically', 'edges = pointers'],
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
                tags: ['PID 1', 'single C event loop', 'epoll()', 'event-driven, never polls'],
                facts: [
                  { k: 'asleep', v: 'blocks on epoll() until a file descriptor is ready' },
                  { k: 'on event', v: 'issues fork() / execve() / socket() directly to the kernel' },
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
          subtitle: 'system.slice/ovnkube-node.service · click a PID to kill it',
          detail: {
            role: 'PILLAR 3 · ACTUAL STATE',
            summary:
              'A virtual filesystem at /sys/fs/cgroup (cgroups v2). systemd mirrors each service into a directory here and writes the forked PID into the cgroup.procs file — giving the kernel a stable handle for tracking.',
            sections: [
              {
                heading: 'The containment anchor',
                body: 'Under cgroups v2 the kernel won’t let a process escape its cgroup tree — every helper ovnkube-node forks is chained into the same directory, so tracking is exact.',
                tags: ['cgroups v2', 'kernel-enforced', 'no escape', 'children inherit the slice'],
                facts: [
                  { k: 'Path', v: '/sys/fs/cgroup/system.slice/ovnkube-node.service/' },
                  { k: 'system.slice', v: 'the cgroup branch grouping OS daemons (user apps live under user.slice)' },
                  { k: 'cgroup.procs', v: 'holds the main PID; every child inherits the slice' },
                ],
              },
              {
                heading: 'Try it on the canvas',
                tags: ['kill main → restart', 'kill child → reaped, no restart', 'children stay trapped'],
                body: 'Click a PID in this box to arm the walkthrough, then step through what the kernel and systemd do.',
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
                tags: ['signalfd', 'SIGCHLD', 'inotify', 'no polling'],
                facts: [
                  { k: 'signalfd', v: 'turns async SIGCHLD (kernel fires it on death) into a readable fd' },
                  { k: 'inotify', v: 'watches cgroup files for change' },
                  { k: 'on signal', v: 'match dead PID → flip DAG to UNIT_FAILED → re-run rules (restart)' },
                ],
              },
              {
                heading: 'Try the loop',
                body: 'Use the step-through walkthrough on the canvas to watch SIGCHLD → UNIT_FAILED → fork()/execve() play out one event at a time.',
                commands: [
                  '# Watch the unit recover after a kill\nsystemctl kill -s SIGKILL ovnkube-node.service ; journalctl -u ovnkube-node -f',
                ],
              },
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
