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
//     flows?: [ flow ],                // Overview-style trace flows: numbered
//                                      // box→box hops drawn on the canvas with a
//                                      // flow navigator + bottom hop inspector.
//                                      // Mirrors events.json for the deep dives.
//     zones: [ zone ],
//   }
//   flow  = { flowId, flowName, description,
//             steps: [{ step, sourceBoxId, targetBoxId, description }] }
//   zone  = { id, label, colorVar, dashed?, boxes: [box], zones?: [zone] }
//   box   = {
//     id, title, typePrefix?, subtitle?,
//     badges?: [{ label, kind:'requires'|'after'|'stat' }],
//     // Reveal-in-place: a box can hold an ordered sequence of sub-step boxes
//     // that expand *inside* it on the canvas (like the etcd intent store),
//     // instead of living in a separate zone. Each sub-step is itself a full
//     // box (its own detail popup). Used for the tmux deep dive's two zoom-ins.
//     reveal?: { hint, caption, boxes: [box] },
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

// ── The cgroup v2 tree (what `systemd-cgls` prints) ──────────────────────────
// The unified hierarchy the kernel actually keeps, so the three kinds of cgroup
// — slices (grouping), services (systemd-forked) and scopes (externally-forked,
// e.g. login sessions and VMs) — are visible side by side, with our headline
// unit's pinned PIDs in place.
const CGROUP_TREE = {
  caption: 'systemd-cgls · the unified cgroup v2 tree',
  nodes: [
    {
      label: '/ · root cgroup', kind: 'root',
      children: [
        {
          label: 'init.scope', kind: 'scope', sub: 'systemd itself (PID 1)',
          children: [{ label: '1 · systemd', kind: 'proc' }],
        },
        {
          label: 'system.slice', kind: 'slice', sub: 'OS daemons',
          children: [
            {
              label: 'ovnkube-node.service', kind: 'service', sub: 'the headline unit',
              children: [
                { label: '10243 · ovnkube-node', kind: 'proc', sub: 'main PID' },
                { label: '10255 · ovn-nbctl', kind: 'proc' },
                { label: '10256 · ovn-controller mon', kind: 'proc' },
              ],
            },
            { label: 'crio.service', kind: 'service', children: [{ label: '3120 · crio', kind: 'proc' }] },
            { label: 'kubelet.service', kind: 'service', children: [{ label: '3450 · kubelet', kind: 'proc' }] },
          ],
        },
        {
          label: 'user.slice', kind: 'slice', sub: 'human logins',
          children: [
            {
              label: 'user-1000.slice', kind: 'slice',
              children: [
                { label: 'user@1000.service', kind: 'service', sub: 'the per-user manager' },
                {
                  label: 'session-3.scope', kind: 'scope', sub: 'an SSH login — systemd adopts, it did not fork it',
                  children: [
                    { label: '14782 · sshd', kind: 'proc' },
                    { label: '14790 · bash', kind: 'proc' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'machine.slice', kind: 'slice', sub: 'VMs & containers',
          children: [
            { label: 'machine-qemu\\x2d1.scope', kind: 'scope', sub: 'a KubeVirt/libvirt guest' },
          ],
        },
      ],
    },
  ],
  legend: [
    { kind: 'slice', meaning: 'a grouping cgroup (no process of its own) for accounting & limits' },
    { kind: 'service', meaning: 'a cgroup holding the processes systemd forked from a unit' },
    { kind: 'scope', meaning: 'a cgroup of externally-forked processes systemd only adopts (sessions, VMs)' },
    { kind: 'proc', meaning: 'a live PID pinned by the kernel' },
  ],
}

// ── The systemd target dependency tree (what `systemctl list-dependencies`
// prints) ──────────────────────────────────────────────────────────────────
// Targets own no process — they are named sync points other units order
// against. This is the forward graph from the boot goal down to the leaf
// services, with our headline unit grafted in where it really sits.
const TARGET_TREE = {
  caption: 'systemctl list-dependencies · targets pull in units',
  nodes: [
    {
      label: 'default.target', kind: 'target', sub: '→ aliased to multi-user.target',
      children: [
        {
          label: 'multi-user.target', kind: 'target', sub: 'the “system is up” milestone',
          children: [
            {
              label: 'basic.target', kind: 'target',
              children: [
                {
                  label: 'sysinit.target', kind: 'target', sub: 'early init',
                  children: [
                    { label: 'systemd-journald.service', kind: 'service' },
                    { label: 'systemd-sysctl.service', kind: 'service', sub: 'oneshot' },
                  ],
                },
                {
                  label: 'sockets.target', kind: 'target',
                  children: [{ label: 'dbus.socket', kind: 'socket' }],
                },
              ],
            },
            {
              label: 'network-online.target', kind: 'target',
              children: [{ label: 'NetworkManager.service', kind: 'service' }],
            },
            { label: 'crio.service', kind: 'service', sub: 'container runtime' },
            { label: 'ovnkube-node.service', kind: 'service', sub: 'After=network-pre.target · Requires=ovs-vswitchd' },
            { label: 'kubelet.service', kind: 'service', sub: 'After=crio.service' },
          ],
        },
      ],
    },
  ],
  legend: [
    { kind: 'target', meaning: 'a named sync point — runs nothing, units order against it' },
    { kind: 'service', meaning: 'a unit that actually runs a process' },
    { kind: 'socket', meaning: 'a listening socket that activates its service on demand' },
  ],
}

// ── systemd · the state reconciliation loop ─────────────────────────────────
const SYSTEMD = {
  topicId: 'systemd',
  title: 'systemd — the state reconciliation loop',
  tagline:
    'On every RHCOS node systemd is PID 1: a state-enforcing supervisor that continuously reconciles an in-memory desired state with kernel reality. Followed here through a real, mission-critical unit — ovn-kubernetes (ovnkube-node.service).',
  colorVar: 'k-amber',
  reconciliation: {
    unit: 'ovnkube-node.service',
    // Why the cgroup box invites you to kill PIDs: shown under cgroup.procs
    // while no walkthrough is armed, so the interaction explains itself.
    hint: 'Click a PID to fire the loop for real — kill the main PID and systemd restarts the unit (watch cgroup.procs repopulate); kill a child and it is only reaped.',
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
    //   labelT   = where on the curve the chip parks (0=source … 1=target) — used
    //              to slide the two engine↔reality chips apart in the same gap
    //   accent   = colour var; phase = loop phase that lights this edge up
    //   title/detail = the edge's clickable popup. Clicking a chip opens this in
    //                  the DeepDiveModal, same as clicking a box — so each
    //                  connector explains what actually crosses it (parse,
    //                  evaluate, syscall, pin, feedback signal).
    edges: [
      { id: 'compile', from: 'sd-units', to: 'sd-dag', step: '1', kind: 'syscall',
        label: 'daemon-reload\n→ compile DAG', accent: 'k-purple',
        title: 'daemon-reload — compile the DAG',
        detail: {
          role: 'EDGE 1 · PARSE → LOAD',
          summary:
            'The one-time translation from flat on-disk text into systemd’s in-memory graph. It runs at boot and on every `systemctl daemon-reload`; until it runs, an edited unit file has zero effect on the running system — the DAG, not the file, is what the engine acts on.',
          sections: [
            {
              heading: 'What crosses this edge',
              facts: [
                { k: 'From', v: 'Unit Files — flat text on disk (/etc/ + /usr/lib/systemd/system)' },
                { k: 'To', v: 'Compiled DAG — a graph of C `Unit` structs in PID 1’s heap' },
                { k: 'Trigger', v: 'boot, or an explicit `systemctl daemon-reload`' },
              ],
              tags: ['parse once', 'text → structs', 'no reload = no effect', 'MCO-rendered on OpenShift'],
            },
            {
              heading: 'Why a reload is required',
              body: 'systemd never re-reads files on the fly — it would be both slow and racy mid-transaction. Instead it snapshots the whole tree into memory once, so every later decision is a pointer walk, not a disk read.',
            },
            {
              heading: 'Explore',
              commands: [
                '# Re-parse unit files after editing one\nsystemctl daemon-reload',
                '# Show the merged unit systemd actually compiled (file + drop-ins)\nsystemctl cat ovnkube-node.service',
              ],
            },
          ],
        },
      },
      { id: 'evaluate', from: 'sd-dag', to: 'sd-engine', step: '2', kind: 'memory',
        label: 'read desired\n→ detect drift', accent: 'k-amber', phase: 'failed',
        title: 'evaluate — read desired, detect drift',
        detail: {
          role: 'EDGE 2 · READ DESIRED → DRIFT',
          summary:
            'Woken by the SIGCHLD, the engine reads the unit’s desired state off the DAG (UNIT_ACTIVE) and compares it to what just happened. A dead main PID means desired ≠ actual — so the engine marks the unit UNIT_FAILED back in the DAG and consults Restart=. This read is the formal moment drift is detected and the restart rules become eligible to fire.',
          sections: [
            {
              heading: 'Same process — not two things talking',
              body: 'The DAG and the Engine are NOT separate programs exchanging messages. They are two faces of the one systemd process (PID 1): the Engine is the code, the DAG is its own in-memory data — a graph of C Unit structs in PID 1’s heap. So this “edge” is the engine dereferencing a pointer into its own memory and reading a flag: a plain memory access, not inter-process communication. It is drawn as an arrow only to show which way the information flows (out of the graph, into the code) — which is why both boxes sit inside the one “systemd · PID 1” zone.',
              tags: ['one process', 'DAG = its heap data', 'engine = its code', 'memory read, not IPC'],
            },
            {
              heading: 'And it does not poll the table',
              body: 'systemd never spins watching the DAG. It is event-driven: it sleeps on epoll/signalfd and the kernel wakes it (the SIGCHLD edge). Only once woken does it read the desired flag from the heap, compare, mark UNIT_FAILED on drift, and decide the next action — then it goes back to sleep. The thing it “watches” is a set of file descriptors, not the table.',
            },
            {
              heading: 'What this read involves',
              facts: [
                { k: 'From', v: 'Compiled DAG — the unit’s desired state (UNIT_ACTIVE), a field in a heap struct' },
                { k: 'To', v: 'The Engine — PID 1’s epoll loop, just woken by SIGCHLD' },
                { k: 'Decision', v: 'desired == actual? if not, write UNIT_FAILED back to the struct and consult Restart=' },
              ],
              tags: ['read desired vs actual', 'mark UNIT_FAILED', 'Restart=always → recover'],
            },
            {
              heading: 'Explore',
              commands: [
                '# The current active/sub state the engine is tracking\nsystemctl show ovnkube-node.service -p ActiveState,SubState,Result',
                '# Watch the failure + recovery decision in the journal\njournalctl -u ovnkube-node -f',
              ],
            },
          ],
        },
      },
      { id: 'enforce', from: 'sd-engine', to: 'sd-reality', step: '3', kind: 'syscall', bias: 'left', labelT: 0.12, labelDX: -82,
        label: 'ExecStart\nfork() / execve()', accent: 'k-green', phase: 'restart',
        title: 'enforce — ExecStart via fork() / execve()',
        detail: {
          role: 'EDGE 3 · ENFORCE → SYSCALL',
          summary:
            'The write side of the loop: how desired state becomes a running process. The engine issues raw fork() then execve() syscalls to launch the unit’s ExecStart= — no shell, no fork-server, no intermediary. This is the only edge that turns in-memory intent into a live process on the CPU.',
          sections: [
            {
              heading: 'What crosses this edge',
              facts: [
                { k: 'From', v: 'The Engine — issuing syscalls directly to the kernel' },
                { k: 'To', v: 'Kernel Reality — a fresh process running ExecStart on the CPU' },
                { k: 'Syscalls', v: 'fork() clones PID 1, then execve() replaces it with the binary' },
              ],
              tags: ['fork() + execve()', 'no shell', 'fresh PID', 'RestartSec= back-off'],
            },
            {
              heading: 'fork() then execve()',
              facts: [
                { k: 'fork()', v: 'PID 1 clones itself, creating an empty child process' },
                { k: 'execve()', v: 'the child overlays itself with /usr/bin/ovnkube — same PID, new program' },
                { k: 'setup', v: 'between the two, systemd applies the cgroup, namespaces and limits' },
              ],
            },
            {
              heading: 'Explore',
              commands: [
                '# The ExecStart the engine runs on this edge\nsystemctl show ovnkube-node.service -p ExecStart',
                '# Trace the actual fork/execve as a unit starts\nstrace -f -e trace=fork,execve systemctl restart ovnkube-node.service',
              ],
            },
          ],
        },
      },
      { id: 'pin', from: 'sd-reality', to: 'sd-cgroup', step: '4', kind: 'memory',
        label: 'pin PIDs →\ncgroup.procs', accent: 'k-green',
        title: 'pin — write PIDs into cgroup.procs',
        detail: {
          role: 'EDGE 4 · PIN → CONTAIN',
          summary:
            'The instant a process is forked, the kernel writes its PID into the unit’s cgroup.procs file, and every child it later spawns inherits the same cgroup. This is what makes systemd’s tracking exact: actual state is no longer a guess from a PID file — it is precisely whatever the cgroup tree says is inside it.',
          sections: [
            {
              heading: 'One domain — the kernel’s own bookkeeping',
              body: 'This is the kernel-side mirror of the engine reading its DAG. The cgroup Tree and the Running PIDs are not two things talking — they are both the one kernel’s state: the running PIDs are the ground truth (task structs the scheduler runs), and the cgroup tree is the kernel’s own index over them. So this edge is the kernel recording a task it just forked in its own membership table — not communication. The kernel keeps the two in sync automatically: fork adds the PID, exit removes it.',
              tags: ['one kernel', 'PIDs = ground truth', 'cgroup = its index', 'kept in sync automatically'],
            },
            {
              heading: 'What this records',
              facts: [
                { k: 'Ground truth', v: 'Kernel Reality — the running PIDs (task structs) on the CPU' },
                { k: 'Index', v: 'cgroup Tree — /sys/fs/cgroup/system.slice/ovnkube-node.service/' },
                { k: 'Mechanism', v: 'the kernel records each PID in cgroup.procs; children inherit it' },
              ],
              tags: ['cgroups v2', 'kernel-enforced', 'no escape', 'exact membership'],
            },
            {
              heading: 'Why it matters for the loop',
              body: 'Because the kernel won’t let a process leave its cgroup, systemd can reliably sweep an entire unit — main process and every orphaned helper — by acting on the directory, not by chasing individual PIDs that could have re-parented to PID 1.',
            },
            {
              heading: 'Explore',
              commands: [
                '# The exact PIDs the kernel has pinned under this unit\ncat /sys/fs/cgroup/system.slice/ovnkube-node.service/cgroup.procs',
                '# The same, rendered as a tree\nsystemd-cgls /system.slice/ovnkube-node.service',
              ],
            },
          ],
        },
      },
      { id: 'notify', from: 'sd-reality', to: 'sd-engine', step: '5', kind: 'signal', bias: 'right', labelT: 0.88, labelDX: 82,
        label: 'SIGCHLD\n→ wake engine', accent: 'packet', phase: 'sigchld',
        title: 'notify — SIGCHLD wakes the engine',
        detail: {
          role: 'EDGE 5 · NOTIFY → FEEDBACK',
          summary:
            'The feedback edge that closes the loop. systemd never polls for health — the kernel fires SIGCHLD the moment any child dies and delivers it through a signalfd that the engine’s epoll loop is blocked on. PID 1 is woken the exact millisecond reality changes, which is what makes the whole supervisor event-driven instead of a busy-wait.',
          sections: [
            {
              heading: 'What crosses this edge',
              facts: [
                { k: 'From', v: 'Kernel Reality — a process just died on the CPU' },
                { k: 'To', v: 'The Engine — woken from its epoll() sleep' },
                { k: 'Carrier', v: 'SIGCHLD, converted to a readable event by signalfd' },
              ],
              tags: ['signalfd', 'SIGCHLD', 'event-driven', 'never polls', 'zero latency'],
            },
            {
              heading: 'Why signalfd, not a handler',
              body: 'A classic async signal handler can only run a few safe calls and races with the main loop. signalfd turns the signal into a plain file descriptor read, so the death is just another event the single epoll loop dequeues in order — no reentrancy, no polling.',
            },
            {
              heading: 'Explore',
              commands: [
                '# The signalfd/epoll descriptors PID 1 is blocked on\nls -l /proc/1/fd',
                '# Fire the loop yourself and watch the wake-up\nsystemctl kill -s SIGKILL ovnkube-node.service ; journalctl -u ovnkube-node -f',
              ],
            },
          ],
        },
      },
      // Transient cleanup edge — drawn ONLY while the sweep step is active (it is
      // not part of the steady-state loop, so it would clutter the resting view).
      // It makes the systemd → kernel push visible: PID 1 issues the kill
      // syscalls for the unit's cgroup. The kernel never watches systemd.
      { id: 'sweep', from: 'sd-engine', to: 'sd-cgroup', step: '', transient: true, kind: 'syscall',
        bias: 'right', labelT: 0.5, labelDX: -10,
        label: 'kill the cgroup\nkill() / cgroup.kill', accent: 'k-amber',
        title: 'sweep — systemd tells the kernel to kill the cgroup',
        detail: {
          role: 'CLEANUP · SYSCALL PUSH',
          summary:
            'systemd pushes the cleanup to the kernel — the kernel never watches systemd or acts on its own. Having decided to recover, PID 1 issues kill syscalls for the unit’s cgroup: either a kill() per PID listed in cgroup.procs, or a single write of “1” to cgroup.kill (cgroup v2) to take out the whole group at once. The kernel then delivers SIGTERM, and SIGKILL after the timeout, to every process in the group.',
          sections: [
            {
              heading: 'Who tells whom',
              facts: [
                { k: 'Direction', v: 'systemd (PID 1, user space) → kernel — a push, not a watch' },
                { k: 'Mechanism', v: 'kill(pid, SIG…) per cgroup.procs entry, or write “1” > cgroup.kill (v2)' },
                { k: 'Kernel role', v: 'executes the signals; it never decides to sweep on its own' },
              ],
              tags: ['syscall push', 'cgroup.kill (v2)', 'SIGTERM → SIGKILL', 'KillMode=control-group'],
            },
            {
              heading: 'Why a push, not a watch',
              body: 'The kernel has no idea what “the unit failed” means — that is systemd’s policy. systemd holds the desired state and the Restart= rules, so it is the one that decides, then commands the kernel to carry the decision out.',
            },
            {
              heading: 'Explore',
              commands: [
                '# Kill an entire cgroup at once (cgroup v2)\necho 1 > /sys/fs/cgroup/system.slice/ovnkube-node.service/cgroup.kill',
                '# Watch PID 1 issue the kill syscalls as a unit is swept\nstrace -f -e trace=kill,write -p 1',
              ],
            },
          ],
        },
      },
    ],
  },
  zones: [
    {
      id: 'sd-disk',
      label: 'On-Disk · Unit Files',
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
      label: 'systemd · PID 1 — User Space',
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
                heading: 'The graph, drawn',
                body: 'Following the edges from the boot goal down to the leaf services — targets are sync points that pull in the units below them. This is what `systemctl list-dependencies` walks.',
                tree: TARGET_TREE,
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
                heading: 'The tree, drawn',
                body: 'The whole hierarchy at once — slices group, services hold what systemd forked, and scopes hold processes it merely adopted (login sessions, VMs). Our unit’s pinned PIDs sit under system.slice.',
                tree: CGROUP_TREE,
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
  flows: [
    {
      flowId: 'lb-poweron',
      flowName: 'Power-on → PID 1',
      description:
        'The five handoffs that carry a bare machine from firmware to a mounted real root with systemd running as PID 1.',
      steps: [
        { step: 1, sourceBoxId: 'lb-uefi', targetBoxId: 'lb-grub',
          description: 'Firmware finishes POST and hands control to the bootloader it found on the EFI System Partition.' },
        { step: 2, sourceBoxId: 'lb-grub', targetBoxId: 'lb-kernel-stage',
          description: 'GRUB2 loads vmlinuz + the initramfs into memory, sets the kernel command line, and jumps into the kernel.' },
        { step: 3, sourceBoxId: 'lb-kernel-stage', targetBoxId: 'lb-initramfs',
          description: 'The kernel brings up core subsystems and the device model, then mounts the initramfs as a temporary in-RAM root.' },
        { step: 4, sourceBoxId: 'lb-initramfs', targetBoxId: 'lb-switchroot',
          description: 'dracut’s early userspace loads storage drivers, locates the real root device, and mounts it at /sysroot.' },
        { step: 5, sourceBoxId: 'lb-switchroot', targetBoxId: 'lb-default-target',
          description: 'switch_root pivots onto the real filesystem and execs systemd as PID 1, which drives the boot up to default.target.' },
      ],
    },
  ],
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
              {
                heading: 'What “reaching the target” pulls in',
                body: 'A target runs nothing itself — it is the milestone the units below it order against. PID 1 walks this tree until every required unit is active.',
                tree: TARGET_TREE,
              },
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
  flows: [
    {
      flowId: 'hcp-provision',
      flowName: 'NodePool → Node Ready',
      description:
        'How a declared NodePool becomes a running worker that has joined the hosted cluster — control-plane intent on the left, the booting VMI on the right.',
      steps: [
        { step: 1, sourceBoxId: 'hcp-nodepool', targetBoxId: 'hcp-mco',
          description: 'The NodePool is reconciled; the Machine Config Operator merges every MachineConfig for the pool into one rendered config.' },
        { step: 2, sourceBoxId: 'hcp-mco', targetBoxId: 'hcp-ignition',
          description: 'The rendered config is compiled to an Ignition payload and handed to the per-hosted-cluster Ignition Server.' },
        { step: 3, sourceBoxId: 'hcp-ignition', targetBoxId: 'hcp-vmi',
          description: 'The KubeVirt VMI powers on and, via its kernel args, fetches its Ignition payload from the Ignition Server over the shared ingress.' },
        { step: 4, sourceBoxId: 'hcp-vmi', targetBoxId: 'hcp-ignition-apply',
          description: 'Still inside the initramfs, Ignition writes the units, files and kernel args to /sysroot on first boot.' },
        { step: 5, sourceBoxId: 'hcp-ignition-apply', targetBoxId: 'hcp-join',
          description: 'After switch_root, systemd reaches multi-user.target and starts kubelet; it sends a CSR, gets approved, and the node flips to Ready.' },
      ],
    },
  ],
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

// ── HCP cluster install · the Agent platform ─────────────────────────────────
// The end-to-end "how do I actually stand up a hosted cluster on bare metal"
// flow, using HyperShift's **Agent** provider (Central Infrastructure Management
// / the Assisted Installer). It sits one level *beside* the HCP node-boot deep
// dive: that one starts at an already-declared NodePool and follows a single VMI
// to Ready; this one starts from *bare metal* — Phase 0 installs OpenShift on
// the hosts with the standalone Agent-based Installer so the box becomes the
// management hub — then lays out every prerequisite + operator step that has to
// be in place before a host can even be discovered, and finally traces a
// physical machine from "boots the discovery ISO" to "joins the hosted cluster
// as a worker".
//
// Note the two Assisted-Installer guises this topic deliberately spans:
//   · the **Agent-based Installer** (`openshift-install agent create image`) —
//     a one-shot, offline CLI that builds the *first* cluster: the hub itself.
//   · **CIM** (the Infrastructure Operator MCE adds onto that hub) — the
//     in-cluster service that then provisions every subsequent host/cluster.
//
// Mental model — the agent platform has two layers that are easy to conflate:
//   · the **Agent** (assisted-installer-agent) — a binary that runs in the
//     RHCOS *live/discovery* environment, inventories the host and phones home.
//   · the **Agent CR** — the Kubernetes object CIM creates on the hub once that
//     binary registers; it is what you approve, label and the NodePool selects.
const AGENT_SERVICE_CONFIG = `apiVersion: agent-install.openshift.io/v1beta1
kind: AgentServiceConfig
metadata:
  name: agent          # singleton — must be named "agent"
spec:
  databaseStorage:     # assisted-service Postgres
    accessModes: [ReadWriteOnce]
    resources: { requests: { storage: 20Gi } }
  filesystemStorage:   # manifests, logs, boot artifacts
    accessModes: [ReadWriteOnce]
    resources: { requests: { storage: 20Gi } }
  imageStorage:        # cached RHCOS images
    accessModes: [ReadWriteOnce]
    resources: { requests: { storage: 50Gi } }
  osImages:            # the RHCOS the discovery ISO + install use
    - openshiftVersion: "4.17"
      version: "417.94.20240..."
      url: "https://.../rhcos-live.x86_64.iso"
      cpuArchitecture: x86_64`

const INFRAENV = `apiVersion: agent-install.openshift.io/v1beta1
kind: InfraEnv
metadata:
  name: my-infraenv
  namespace: my-hosts          # the "agent namespace" the NodePool selects from
spec:
  pullSecretRef:
    name: pull-secret
  sshAuthorizedKey: "ssh-ed25519 AAAA... admin@laptop"
  # No clusterRef → "late binding": agents register unbound and are claimed by a
  # NodePool later, instead of being pinned to one ClusterDeployment up front.`

const HCP_CREATE_AGENT = `# Create the HostedCluster + NodePool on the agent platform.
# --agent-namespace is where the approved Agent CRs live (the InfraEnv namespace).
hcp create cluster agent \\
  --name my-hosted \\
  --pull-secret ./pull-secret.json \\
  --ssh-key ~/.ssh/id_ed25519.pub \\
  --agent-namespace my-hosts \\
  --base-domain example.com \\
  --api-server-address api.my-hosted.example.com \\
  --release-image quay.io/openshift-release-dev/ocp-release:4.17.0-x86_64 \\
  --node-pool-replicas 0          # start at 0; scale up once agents are approved`

// ── Day-0: installing the bare-metal management cluster itself ───────────────
// Before any of the HCP prerequisites can exist, OpenShift has to be installed
// on bare metal to *become* the management hub. The cleanest match for the rest
// of this deep dive is the standalone **Agent-based Installer** — the same
// Assisted-Installer engine CIM uses, but packaged offline as a single ISO with
// no external provisioning service required. Two files describe the cluster:
// install-config.yaml (the cluster shape) and agent-config.yaml (per-host
// network/role + the rendezvous IP that elects the in-place bootstrap node).
const MGMT_INSTALL_CONFIG = `apiVersion: v1
baseDomain: example.com
metadata:
  name: mgmt-hub
controlPlane:
  name: master
  replicas: 3            # 3 for HA (or 1 for single-node OpenShift)
compute:
  - name: worker
    replicas: 2
platform:
  baremetal:
    apiVIPs:     ["10.0.0.5"]   # on-cluster keepalived owns these
    ingressVIPs: ["10.0.0.6"]
networking:
  machineNetwork:
    - cidr: 10.0.0.0/24
pullSecret: '{"auths": ...}'    # same pull secret reused by MCE/InfraEnv later
sshKey: 'ssh-ed25519 AAAA... admin@laptop'`

const MGMT_AGENT_CONFIG = `apiVersion: v1beta1
kind: AgentConfig
metadata:
  name: mgmt-hub
rendezvousIP: 10.0.0.10     # ONE control-plane host runs assisted-service in-memory
hosts:
  - hostname: master-0
    role: master
    rootDeviceHints:        # which disk RHCOS is written to
      deviceName: /dev/sda
    interfaces:
      - name: eno1
        macAddress: 52:54:00:aa:bb:cc
    networkConfig:          # NMState — static IPs, bonds, VLANs (no DHCP needed)
      interfaces:
        - name: eno1
          type: ethernet
          state: up
          ipv4:
            enabled: true
            address: [{ ip: 10.0.0.10, prefix-length: 24 }]`

const MGMT_CREATE_IMAGE = `# Drop install-config.yaml + agent-config.yaml into a working dir
mkdir mgmt-hub && cp install-config.yaml agent-config.yaml mgmt-hub/

# Bake them into ONE bootable agent ISO (embeds assisted-service + RHCOS rootfs)
openshift-install agent create image --dir ./mgmt-hub
# → ./mgmt-hub/agent.x86_64.iso  (the originals are consumed/moved)`

const HCP_INSTALL = {
  topicId: 'hcp-install',
  title: 'Installing an HCP cluster on the Agent platform',
  tagline:
    'The full bare-metal story, from nothing to a hosted worker. First Day-0: install OpenShift on bare metal with the Agent-based Installer so it can *become* the management hub. Then layer on the HCP prerequisites (MCE → HyperShift → Central Infrastructure Management), and finally the live steps that carry a physical machine from booting the discovery ISO, to registering as an Agent, to joining the hosted cluster as a Ready worker.',
  colorVar: 'k-orange',
  flows: [
    {
      flowId: 'hcp-install-mgmt',
      flowName: 'Bare metal → Management cluster',
      description:
        'Day-0: standing up the bare-metal OpenShift cluster that becomes the management hub, using the standalone Agent-based Installer. Plan the hosts and VIPs, describe the cluster in install-config + agent-config, bake a single agent ISO, boot every host, and let the in-place bootstrap form the control plane until the cluster reports install-complete — then MCE installs onto it.',
      steps: [
        { step: 1, sourceBoxId: 'hi-mgmt-plan', targetBoxId: 'hi-mgmt-config',
          description: 'With the hosts, DNS and API/ingress VIPs planned, you describe the cluster declaratively in install-config.yaml (shape) and agent-config.yaml (per-host network + rendezvous IP).' },
        { step: 2, sourceBoxId: 'hi-mgmt-config', targetBoxId: 'hi-mgmt-iso',
          description: '`openshift-install agent create image` consumes both files and bakes them into a single bootable agent ISO that embeds assisted-service and the RHCOS rootfs.' },
        { step: 3, sourceBoxId: 'hi-mgmt-iso', targetBoxId: 'hi-mgmt-boot',
          description: 'Every control-plane (and worker) host boots the same ISO; the node at the rendezvous IP elects itself to run assisted-service in RAM and the others register to it.' },
        { step: 4, sourceBoxId: 'hi-mgmt-boot', targetBoxId: 'hi-mgmt-bootstrap',
          description: 'After validations pass, the Assisted Installer writes RHCOS to each disk and orchestrates an in-place bootstrap — a temporary control plane on the rendezvous node hands etcd + kube-apiserver over to the real control-plane nodes.' },
        { step: 5, sourceBoxId: 'hi-mgmt-bootstrap', targetBoxId: 'hi-mgmt-ready',
          description: 'The CVO rolls out every cluster operator; `wait-for install-complete` returns a kubeconfig and console URL — the bare-metal hub is now a running OpenShift cluster.' },
        { step: 6, sourceBoxId: 'hi-mgmt-ready', targetBoxId: 'hi-mce',
          description: 'Onto that fresh hub you install the MultiCluster Engine operator, which delivers HyperShift + the Assisted Installer — the first HCP prerequisite.' },
      ],
    },
    {
      flowId: 'hcp-install-e2e',
      flowName: 'Discovery ISO → Node Ready',
      description:
        'The end-to-end path once the prerequisites are in place: CIM mints a discovery ISO from an InfraEnv, a host boots it and registers as an Agent, you approve it, create the HostedCluster, and scaling the NodePool binds the Agent, installs RHCOS to disk, and the rebooted host joins the hosted cluster.',
      steps: [
        { step: 1, sourceBoxId: 'hi-cim', targetBoxId: 'hi-infraenv',
          description: 'You create an InfraEnv; CIM (the Assisted Service) reconciles it and publishes a per-InfraEnv discovery ISO download URL.' },
        { step: 2, sourceBoxId: 'hi-infraenv', targetBoxId: 'hi-boot',
          description: 'The host boots that discovery ISO — manually, via virtual media, or automatically through a BareMetalHost + BMC.' },
        { step: 3, sourceBoxId: 'hi-boot', targetBoxId: 'hi-register',
          description: 'Inside the RHCOS live environment the assisted-installer-agent inventories CPU/RAM/disks/NICs and registers back to CIM, which creates an Agent CR.' },
        { step: 4, sourceBoxId: 'hi-register', targetBoxId: 'hi-approve',
          description: 'You review the inventory and approve the Agent (spec.approved=true), optionally labelling it so a NodePool can select it.' },
        { step: 5, sourceBoxId: 'hi-approve', targetBoxId: 'hi-create',
          description: 'With hosts waiting in the pool, you run `hcp create cluster agent`, pointing --agent-namespace at where the approved Agents live.' },
        { step: 6, sourceBoxId: 'hi-create', targetBoxId: 'hi-cp-pods',
          description: 'The HyperShift Operator reconciles the HostedCluster and stamps out the HostedControlPlane Pods (etcd, kube-apiserver, …) in the control-plane namespace.' },
        { step: 7, sourceBoxId: 'hi-cp-pods', targetBoxId: 'hi-nodepool',
          description: 'Part of that control plane is the NodePool and its Cluster API stack, including the cluster-api-provider-agent that will claim Agents.' },
        { step: 8, sourceBoxId: 'hi-nodepool', targetBoxId: 'hi-bind',
          description: 'You scale the NodePool; the agent CAPI provider picks free approved Agents matching the selector and binds each one to an AgentMachine.' },
        { step: 9, sourceBoxId: 'hi-bind', targetBoxId: 'hi-write',
          description: 'Binding hands the Agent an install spec; the Assisted Installer writes RHCOS to the host’s disk and lays down the Ignition pointing at the HCP Ignition endpoint.' },
        { step: 10, sourceBoxId: 'hi-write', targetBoxId: 'hi-join',
          description: 'The host reboots off its disk into RHCOS; kubelet starts, sends a CSR to the hosted API server, the machine-approver approves it, and the Node goes Ready.' },
      ],
    },
  ],
  zones: [
    {
      id: 'hi-mgmt',
      label: 'Phase 0 · Install the Bare-Metal Management Cluster',
      colorVar: 'k-amber',
      boxes: [
        {
          id: 'hi-mgmt-plan',
          title: 'Plan the bare-metal hub',
          typePrefix: 'DAY-0 1',
          subtitle: 'what to prepare — the hosts start blank, no OS needed',
          detail: {
            role: 'DAY-0 · FOUNDATION',
            summary:
              'Blank hosts are fine — the agent ISO carries the OS. You just prepare the network, DNS, VIPs and time around them.',
            sections: [
              {
                heading: 'Prepare these',
                facts: [
                  { k: 'Hosts', v: '3 control-plane (or 1 for single-node OpenShift) + workers — blank, no OS' },
                  { k: 'Install disk', v: 'one usable disk per host; picked via rootDeviceHints' },
                  { k: 'Boot path', v: 'BMC virtual media, a USB stick, or (optional) PXE/iPXE' },
                  { k: 'Per-host IP', v: 'DHCP or a static NMState address — neither is mandatory' },
                  { k: 'Two VIPs', v: 'API + ingress, floated by the cluster’s keepalived (no external LB)' },
                  { k: 'DNS', v: 'api, api-int, *.apps → the two VIPs' },
                  { k: 'Time + pull', v: 'NTP on every host; registry pull access (or a mirror)' },
                  { k: 'Secrets', v: 'a Red Hat pull secret + an SSH public key' },
                ],
              },
              {
                heading: 'The questions everyone asks',
                facts: [
                  { k: 'Need an OS first?', v: 'No — hosts boot blank; the ISO’s live RHCOS installs itself to disk' },
                  { k: 'Boot into rescue?', v: 'No — boot the ISO once; the agent inventories, installs, reboots' },
                  { k: 'Where’s the image?', v: 'It IS the agent ISO (DAY-0 3) — RHCOS is baked in, nothing fetched at boot' },
                  { k: 'PXE required?', v: 'No — virtual media or USB work; PXE is just one option' },
                  { k: 'DHCP required?', v: 'No — static NMState IPs work just as well' },
                  { k: 'Provisioning net?', v: 'No — unlike bare-metal IPI, none is needed' },
                ],
                tags: ['blank hosts', 'no OS', 'no rescue', 'no PXE required', 'no DHCP required'],
              },
              {
                heading: 'Why this becomes the hub',
                bullets: [
                  'Not the product — it is the hub MCE, HyperShift and every hosted control plane install onto.',
                  'Must be a healthy, supported OpenShift cluster in its own right first.',
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Sanity-check DNS for the API + a wildcard apps name\ndig +short api.mgmt-hub.example.com\ndig +short test.apps.mgmt-hub.example.com',
                  '# If you use BMCs, confirm each responds before you start\ncurl -sk https://<bmc-host>/redfish/v1/ | head',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-mgmt-config',
          title: 'install-config + agent-config',
          typePrefix: 'DAY-0 2',
          subtitle: 'describe the cluster shape + per-host network',
          detail: {
            role: 'DAY-0 · DECLARE',
            summary:
              'Two YAML files describe the cluster: install-config.yaml (the shape) and agent-config.yaml (per-host network + the rendezvousIP that bootstraps in place).',
            sections: [
              {
                heading: 'install-config.yaml · the cluster shape',
                tags: ['baseDomain', 'controlPlane.replicas', 'platform: baremetal', 'apiVIPs / ingressVIPs', 'pullSecret + sshKey'],
                manifest: { kind: 'YAML', body: MGMT_INSTALL_CONFIG },
              },
              {
                heading: 'agent-config.yaml · hosts + rendezvous',
                facts: [
                  { k: 'rendezvousIP', v: 'the one host that runs assisted-service in RAM and bootstraps the cluster' },
                  { k: 'role', v: 'master / worker per host' },
                  { k: 'rootDeviceHints', v: 'which disk RHCOS is written to' },
                  { k: 'networkConfig', v: 'NMState — static IPs, bonds, VLANs; no DHCP required' },
                ],
                manifest: { kind: 'YAML', body: MGMT_AGENT_CONFIG },
              },
              {
                heading: 'Note',
                bullets: [
                  'The pull secret and SSH key here are the same ones you reuse later for MCE, the InfraEnv, and the hosted cluster.',
                  'Both files are consumed by the next step — keep copies, they are moved into the ISO.',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-mgmt-iso',
          title: 'agent create image',
          typePrefix: 'DAY-0 3',
          subtitle: 'bake one bootable agent.iso',
          detail: {
            role: 'DAY-0 · BUILD THE ISO',
            summary:
              'One command folds both YAMLs, the RHCOS rootfs and assisted-service into a single bootable ISO — the offline, standalone cousin of CIM.',
            sections: [
              {
                heading: 'The command',
                tags: ['offline-capable', 'embeds assisted-service', 'one ISO for all hosts', 'no PXE / no bootstrap node'],
                manifest: { kind: 'CLI', body: MGMT_CREATE_IMAGE },
              },
              {
                heading: 'Agent-based vs. CIM',
                facts: [
                  { k: 'Same engine', v: 'both are the Assisted Installer (assisted-service + agent)' },
                  { k: 'Agent-based', v: 'standalone CLI, one-shot, builds the FIRST cluster (the hub)' },
                  { k: 'CIM', v: 'the in-cluster service MCE adds later to provision MORE hosts/clusters' },
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# After it runs, the bootable image lands here\nls -lh mgmt-hub/agent.x86_64.iso',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-mgmt-boot',
          title: 'Boot every host off the ISO',
          typePrefix: 'DAY-0 4',
          subtitle: 'one ISO, every host · rendezvous node elects itself',
          detail: {
            role: 'DAY-0 · POWER ON',
            summary:
              'Point every host at the same ISO and power on — no OS needed. It boots live RHCOS in RAM; the rendezvous node runs assisted-service and the rest register to it.',
            sections: [
              {
                heading: 'Three ways to attach the ISO',
                facts: [
                  { k: 'Virtual media', v: 'mount agent.iso over the BMC (Redfish / iDRAC / iLO) and set a one-time boot — best for remote/lights-out' },
                  { k: 'USB stick', v: 'write the ISO with dd / balenaEtcher and boot from it — simplest for hands-on hosts' },
                  { k: 'PXE / iPXE', v: 'optional: serve the kernel/initramfs/rootfs from `agent create pxe-files` over your existing PXE setup' },
                ],
                tags: ['no OS needed', 'boots live in RAM', 'disk untouched until validated'],
              },
              {
                heading: 'What happens at boot',
                facts: [
                  { k: 'Rendezvous host', v: 'runs assisted-service in-memory — there is no separate dedicated bootstrap machine' },
                  { k: 'Other hosts', v: 'phone home to the rendezvous node and report inventory' },
                  { k: 'Validations', v: 'must pass before install begins (same checks as CIM)' },
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# (Optional) generate PXE artifacts instead of an ISO\nopenshift-install agent create pxe-files --dir ./mgmt-hub',
                  '# Watch bootstrap progress from your workstation\nopenshift-install agent wait-for bootstrap-complete --dir ./mgmt-hub --log-level info',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-mgmt-bootstrap',
          title: 'In-place bootstrap → control plane',
          typePrefix: 'DAY-0 5',
          subtitle: 'RHCOS to disk · etcd + kube-apiserver form',
          detail: {
            role: 'DAY-0 · BOOTSTRAP',
            summary:
              'The installer writes RHCOS to each disk, then bootstraps in place: a temporary control plane on the rendezvous node hands etcd + kube-apiserver to the real nodes and exits.',
            sections: [
              {
                heading: 'The hand-off',
                facts: [
                  { k: 'Write', v: 'coreos-installer streams RHCOS onto each rootDeviceHints disk' },
                  { k: 'Bootstrap', v: 'temporary control plane on the rendezvous node' },
                  { k: 'Pivot', v: 'etcd + kube-apiserver move to the control-plane nodes, bootstrap exits' },
                ],
                tags: ['in-place', 'self-hosted control plane', 'bootstrap-complete'],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Block until the control plane is up and bootstrap has pivoted away\nopenshift-install agent wait-for bootstrap-complete --dir ./mgmt-hub',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-mgmt-ready',
          title: 'Management cluster Ready',
          typePrefix: 'DAY-0 6',
          subtitle: 'cluster operators Available · kubeconfig',
          detail: {
            role: 'DAY-0 · INSTALL COMPLETE',
            summary:
              'The CVO rolls out every cluster operator; wait-for install-complete returns a kubeconfig and console URL. The bare-metal hub is now a running OpenShift cluster.',
            sections: [
              {
                heading: 'What “complete” means',
                tags: ['all ClusterOperators Available', 'nodes Ready', 'kubeconfig issued', 'console reachable on the ingress VIP'],
              },
              {
                heading: 'Next',
                body: 'From here the Prerequisites zone takes over: install MultiCluster Engine onto this hub, then enable its HyperShift and Infrastructure (CIM) components.',
              },
              {
                heading: 'Explore',
                commands: [
                  '# Block until every operator is Available\nopenshift-install agent wait-for install-complete --dir ./mgmt-hub',
                  '# Use the issued kubeconfig and check the cluster\nexport KUBECONFIG=./mgmt-hub/auth/kubeconfig\noc get clusteroperators ; oc get nodes',
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'hi-prereq',
      label: 'Prerequisites · Management Hub',
      colorVar: 'k-purple',
      dashed: true,
      boxes: [
        {
          id: 'hi-mce',
          title: 'MultiCluster Engine (MCE)',
          typePrefix: 'PREREQ 1',
          subtitle: 'the operator that ships HyperShift + Assisted Installer',
          detail: {
            role: 'PREREQUISITE · PLATFORM',
            summary:
              'Everything below is delivered by the MultiCluster Engine operator on the management (hub) cluster. MCE bundles both the HyperShift component (hosted control planes) and the Infrastructure Operator (the Assisted Installer / Central Infrastructure Management). Install it from OperatorHub, then enable those two components in the MultiClusterEngine CR.',
            sections: [
              {
                heading: 'What it provides',
                facts: [
                  { k: 'hypershift', v: 'the component that runs the HyperShift Operator + hosted-cluster CRDs' },
                  { k: 'assisted-service', v: 'the Infrastructure Operator behind CIM / the Agent platform' },
                  { k: 'local-cluster', v: 'the hub registered as a managed cluster (ManagedCluster)' },
                ],
                tags: ['hub-side', 'OperatorHub', 'one per management cluster'],
              },
              {
                heading: 'Also need on the hub',
                bullets: [
                  'A default StorageClass — the AgentServiceConfig PVCs and control-plane etcd bind against it.',
                  'A pull secret and an SSH public key (reused by the InfraEnv and the hosted cluster).',
                  'DNS for the hosted cluster: api.<name>.<base-domain> (+ api-int) and *.apps.<name>.<base-domain>.',
                  'On bare metal, a way to reach the API/ingress VIPs — typically MetalLB in L2 mode.',
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Is MCE healthy and which components are on?\noc get multiclusterengine -o yaml | grep -A40 status',
                  '# The hub registered as a managed cluster\noc get managedcluster local-cluster',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-hypershift',
          title: 'HyperShift Operator',
          typePrefix: 'PREREQ 2',
          subtitle: 'reconciles HostedCluster / NodePool',
          detail: {
            role: 'PREREQUISITE · CONTROL-PLANE ENGINE',
            summary:
              'Enabling MCE’s hypershift component installs the HyperShift Operator (the hypershift-addon on local-cluster). It runs in the `hypershift` namespace as a cluster-wide singleton and watches every HostedCluster / NodePool: when you create one, it stamps out the hosted control-plane Pods and wires up Cluster API. Nothing about hosted clusters works until it is Running.',
            sections: [
              {
                heading: 'Role',
                tags: ['singleton', 'namespace: hypershift', 'watches HostedCluster + NodePool', 'creates HostedControlPlane'],
              },
              {
                heading: 'See also',
                body: 'The cluster topology this operator builds — the per-HCP control-plane Pods in the guest namespace — is the subject of the Architecture Overview tab. This deep dive only covers getting it created.',
              },
              {
                heading: 'Explore',
                commands: [
                  '# The operator itself\noc get pods -n hypershift',
                  '# Confirm the hosted-cluster CRDs are installed\noc get crd hostedclusters.hypershift.openshift.io nodepools.hypershift.openshift.io',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-cim',
          title: 'Central Infrastructure Management',
          typePrefix: 'PREREQ 3',
          subtitle: 'AgentServiceConfig → the Assisted Service',
          detail: {
            role: 'PREREQUISITE · HOST PROVISIONING',
            summary:
              'CIM is the Assisted Installer running on the hub, deployed by MCE’s Infrastructure Operator. You turn it on by creating a single AgentServiceConfig (named "agent"), which gives the assisted-service its storage and the list of RHCOS images it may serve. Once it is up, CIM is what turns an InfraEnv into a bootable discovery ISO and later drives each host’s installation.',
            sections: [
              {
                heading: 'The AgentServiceConfig',
                tags: ['singleton named "agent"', 'databaseStorage', 'filesystemStorage', 'imageStorage', 'osImages'],
                manifest: { kind: 'YAML', body: AGENT_SERVICE_CONFIG },
              },
              {
                heading: 'What CIM does for you',
                facts: [
                  { k: 'Discovery', v: 'mints a per-InfraEnv RHCOS discovery ISO' },
                  { k: 'Inventory', v: 'receives each host’s hardware report from the agent binary' },
                  { k: 'Validation', v: 'runs pre-flight checks (disk, CPU, network) before install' },
                  { k: 'Install', v: 'drives coreos-installer to write RHCOS to the chosen disk' },
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Is the Assisted Service up?\noc get pods -n multicluster-engine | grep assisted-service',
                  '# Its config and the images it will serve\noc get agentserviceconfig agent -o yaml',
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'hi-discovery',
      label: 'Phase 1 · Host Discovery & Inventory',
      colorVar: 'k-cyan',
      boxes: [
        {
          id: 'hi-infraenv',
          title: 'InfraEnv → Discovery ISO',
          typePrefix: 'STEP 1',
          subtitle: 'mint a bootable image for a namespace of hosts',
          detail: {
            role: 'STEP · CREATE THE ISO',
            summary:
              'An InfraEnv is a small CR that ties a pull secret + SSH key to a namespace of future hosts. When CIM reconciles it, it bakes those into an RHCOS discovery ISO and publishes a download URL on the InfraEnv’s status. Created without a clusterRef, the hosts that boot it register with "late binding" — unattached until a NodePool claims them.',
            sections: [
              {
                heading: 'The InfraEnv',
                tags: ['namespaced', 'pullSecretRef', 'sshAuthorizedKey', 'late binding (no clusterRef)'],
                manifest: { kind: 'YAML', body: INFRAENV },
              },
              {
                heading: 'The namespace matters',
                body: 'The namespace you create the InfraEnv in is the "agent namespace": every host that boots this ISO produces an Agent CR here, and it is exactly what you later point `hcp create cluster agent --agent-namespace` at.',
              },
              {
                heading: 'Explore',
                commands: [
                  '# Grab the freshly-minted ISO URL\noc get infraenv my-infraenv -n my-hosts -o jsonpath=\'{.status.isoDownloadURL}\'',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-boot',
          title: 'Host boots the ISO',
          typePrefix: 'STEP 2',
          subtitle: 'manual · virtual media · BareMetalHost + BMC',
          detail: {
            role: 'STEP · POWER ON',
            summary:
              'The physical (or virtual) machine boots the discovery ISO. It runs a full RHCOS *live* environment in RAM — nothing is written to disk yet. You can boot it three ways: burn/attach the ISO by hand, mount it as virtual media over the BMC, or declare a BareMetalHost CR with BMC credentials so Metal³ powers the host on and attaches the image for you.',
            sections: [
              {
                heading: 'Boot options',
                facts: [
                  { k: 'Manual', v: 'write the ISO to USB / attach in the hypervisor' },
                  { k: 'Virtual media', v: 'mount the ISO via the BMC (Redfish/iDRAC/iLO)' },
                  { k: 'BareMetalHost', v: 'a CR + BMC secret; Metal³ boots & attaches automatically' },
                ],
                tags: ['RHCOS live', 'runs in RAM', 'disk untouched'],
              },
              {
                heading: 'Explore',
                commands: [
                  '# If you declared BareMetalHosts, watch them power on\noc get bmh -n my-hosts',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-register',
          title: 'Agent registers',
          typePrefix: 'STEP 3',
          subtitle: 'inventory phoned home → Agent CR appears',
          detail: {
            role: 'STEP · DISCOVERY',
            summary:
              'Inside the live environment the assisted-installer-agent starts, takes a full hardware inventory — CPU, memory, disks, NICs, and connectivity checks — and registers back to CIM over the network. CIM creates an Agent CR in the InfraEnv’s namespace carrying that inventory. The host is now "known" to the hub but not yet approved or assigned.',
            sections: [
              {
                heading: 'Agent vs. Agent CR',
                facts: [
                  { k: 'The agent', v: 'assisted-installer-agent — a binary in the RHCOS live env' },
                  { k: 'The Agent CR', v: 'the Kubernetes object CIM creates from its registration' },
                  { k: 'State now', v: 'approved=false, bound to no cluster (late binding)' },
                ],
                tags: ['hardware inventory', 'connectivity checks', 'unapproved'],
              },
              {
                heading: 'Explore',
                commands: [
                  '# New agents show up here as hosts finish discovery\noc get agents -n my-hosts',
                  '# Inspect one host’s reported inventory\noc get agent <id> -n my-hosts -o jsonpath=\'{.status.inventory}\'',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-approve',
          title: 'Approve & label Agents',
          typePrefix: 'STEP 4',
          subtitle: 'spec.approved=true · add selector labels',
          detail: {
            role: 'STEP · ADMIT THE HOST',
            summary:
              'Discovery is deliberately not auto-trusted: a freshly-registered Agent sits unapproved until you admit it. Patch spec.approved=true (after sanity-checking its inventory), and add any labels you want a NodePool to select on. Approved, labelled, unbound Agents form the pool the hosted cluster will draw workers from.',
            sections: [
              {
                heading: 'What approval gates',
                tags: ['spec.approved=true', 'selector labels', 'optional hostname/role', 'still unbound'],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Approve a discovered host\noc patch agent <id> -n my-hosts --type merge -p \'{"spec":{"approved":true}}\'',
                  '# Label it so a NodePool can select it\noc label agent <id> -n my-hosts mypool=true',
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'hi-create-zone',
      label: 'Phase 2 · Create the Hosted Control Plane',
      colorVar: 'k-blue',
      boxes: [
        {
          id: 'hi-create',
          title: 'hcp create cluster agent',
          typePrefix: 'STEP 5',
          subtitle: 'declare HostedCluster + NodePool',
          detail: {
            role: 'STEP · DECLARE THE CLUSTER',
            summary:
              'With a pool of approved Agents waiting, you create the hosted cluster. The `hcp` CLI writes a HostedCluster (and a starter NodePool) onto the *management* API server. The key flag is --agent-namespace: it tells HyperShift which namespace’s Agents this cluster may consume. Start with --node-pool-replicas 0 so the control plane comes up before any host is claimed.',
            sections: [
              {
                heading: 'The command',
                tags: ['--agent-namespace', '--base-domain', '--api-server-address', '--release-image', '--node-pool-replicas 0'],
                manifest: { kind: 'CLI', body: HCP_CREATE_AGENT },
              },
              {
                heading: 'Where it lands',
                body: 'HostedCluster/NodePool are records in the management cluster’s API server (the hosted API server does not exist yet). This is the same modeling invariant as the rest of the app: `oc apply` of these hits the management hub, not the guest.',
              },
              {
                heading: 'Explore',
                commands: [
                  '# The hosted cluster and its pool\noc get hostedcluster,nodepool -n clusters',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-cp-pods',
          title: 'HostedControlPlane Pods',
          typePrefix: 'STEP 6',
          subtitle: 'etcd · kube-apiserver · CAPI come up',
          detail: {
            role: 'STEP · CONTROL PLANE UP',
            summary:
              'The HyperShift Operator reconciles the HostedCluster into a HostedControlPlane and the Control Plane Operator fills the control-plane namespace with the guest cluster’s control plane as ordinary Pods — etcd, kube-apiserver, controller-manager, scheduler, OAuth, Konnectivity, the Ignition server, and the Cluster API stack. The hosted API server becomes reachable at the address you gave.',
            sections: [
              {
                heading: 'What appears',
                tags: ['etcd', 'kube-apiserver', 'oauth', 'konnectivity', 'ignition-server', 'cluster-api + capi-provider-agent'],
              },
              {
                heading: 'See also',
                body: 'The full set of control-plane Pods and how they relate is exactly the Architecture Overview tab — this step is the moment that topology is created.',
              },
              {
                heading: 'Explore',
                commands: [
                  '# Control-plane namespace is clusters-<name>\noc get pods -n clusters-my-hosted',
                  '# Watch the HostedCluster march to Available\noc get hostedcluster my-hosted -n clusters -w',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-nodepool',
          title: 'NodePool + agent CAPI provider',
          typePrefix: 'STEP 7',
          subtitle: 'agentLabelSelector · ready to claim hosts',
          detail: {
            role: 'STEP · THE WORKER POOL',
            summary:
              'The NodePool is the declared worker pool. On the agent platform it carries an agentLabelSelector and is backed by Cluster API objects in the control-plane namespace, driven by the cluster-api-provider-agent (CAPI agent provider). At replicas 0 it claims nothing; it is now armed and waiting for you to scale it.',
            sections: [
              {
                heading: 'How it picks hosts',
                facts: [
                  { k: 'agentLabelSelector', v: 'only Agents carrying these labels are eligible' },
                  { k: 'capi-provider-agent', v: 'the controller that binds free Agents to AgentMachines' },
                  { k: 'replicas', v: 'how many Agents to claim — drives the next step' },
                ],
                tags: ['Cluster API', 'AgentMachine', 'late binding resolved here'],
              },
              {
                heading: 'Explore',
                commands: [
                  '# The pool and its current replica/ready counts\noc get nodepool my-hosted -n clusters',
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'hi-join-zone',
      label: 'Phase 3 · Bind, Install & Join',
      colorVar: 'k-green',
      boxes: [
        {
          id: 'hi-bind',
          title: 'Scale → bind Agents',
          typePrefix: 'STEP 8',
          subtitle: 'free Agent → AgentMachine',
          detail: {
            role: 'STEP · CLAIM A HOST',
            summary:
              'Scaling the NodePool is the trigger. Cluster API asks for N machines; the cluster-api-provider-agent finds approved, unbound Agents matching the selector and binds each to an AgentMachine — setting the Agent’s clusterDeploymentName so CIM knows which cluster it now belongs to. This is the moment a "discovered host" becomes "this cluster’s worker".',
            sections: [
              {
                heading: 'What binding does',
                tags: ['oc scale nodepool', 'Agent.spec.clusterDeploymentName set', 'AgentMachine created', 'no longer claimable by others'],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Scale the pool to claim two hosts\noc scale nodepool my-hosted -n clusters --replicas 2',
                  '# Agents flip from unbound to bound\noc get agents -n my-hosts',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-write',
          title: 'Assisted Installer writes RHCOS',
          typePrefix: 'STEP 9',
          subtitle: 'coreos-installer to disk + Ignition pointer',
          detail: {
            role: 'STEP · INSTALL TO DISK',
            summary:
              'Once bound, CIM hands the still-live host an install spec and the Assisted Installer takes over: it writes RHCOS to the selected disk with coreos-installer and lays down a small Ignition that points at the HostedControlPlane’s Ignition server. That pointer is how the installed node will fetch its real worker config (kubelet config, pull secret, CA, MCO content) on first boot.',
            sections: [
              {
                heading: 'What gets written',
                facts: [
                  { k: 'coreos-installer', v: 'streams the RHCOS image onto the host disk' },
                  { k: 'Ignition pointer', v: 'tiny config → the HCP ignition-server URL' },
                  { k: 'On first boot', v: 'the node pulls kubelet config, pull secret, CA, kargs' },
                ],
                tags: ['disk now written', 'reboot pending', 'links to the HCP node-boot deep dive'],
              },
              {
                heading: 'See also',
                body: 'What happens *after* the reboot — Ignition applying config in the initramfs, switch_root, kubelet starting — is the "How an OpenShift / HCP worker node boots" deep dive. This step is the bare-metal equivalent of its Ignition-apply stage.',
              },
              {
                heading: 'Explore',
                commands: [
                  '# Per-host install progress / debug info\noc get agent <id> -n my-hosts -o jsonpath=\'{.status.progress}\'',
                ],
              },
            ],
          },
        },
        {
          id: 'hi-join',
          title: 'Reboot → Node Ready',
          typePrefix: 'STEP 10',
          subtitle: 'kubelet → CSR → approved → joins',
          detail: {
            role: 'STEP · JOIN THE CLUSTER',
            summary:
              'The host reboots off its own disk into the installed RHCOS. systemd reaches multi-user.target and starts kubelet, which contacts the hosted cluster’s API server and submits a CSR. The machine-approver (running in the control plane) approves it, the Node registers and the CNI wires pod networking — and the host flips to Ready, a real worker of the hosted cluster. The NodePool’s ready count ticks up.',
            sections: [
              {
                heading: 'The join handshake',
                facts: [
                  { k: 'kubelet', v: 'starts after switch_root, talks to the hosted API server' },
                  { k: 'CSR', v: 'kubelet requests a client cert; machine-approver approves it' },
                  { k: 'Node Ready', v: 'CNI wires networking, the Node registers and goes Ready' },
                ],
                tags: ['multi-user.target', 'machine-approver', 'NodePool ready++'],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Against the HOSTED cluster: watch the node arrive\noc --kubeconfig my-hosted.kubeconfig get nodes -w',
                  '# Any CSRs still pending approval\noc --kubeconfig my-hosted.kubeconfig get csr | grep -i pending',
                ],
              },
            ],
          },
        },
      ],
    },
  ],
}

// ── tmux window naming across `sudo -iu` ────────────────────────────────────
// Why a window rename survives an identity switch the *control* channel forbids.
// You start tmux as `bongo`, then `sudo -iu oracle` inside a pane. oracle cannot
// reach tmux's control socket (a 0700 dir owned by bongo) — yet it can still
// rename the window by writing an escape sequence to its own stdout, because that
// byte stream flows straight into the pty tmux is already reading. The crux is
// **control path vs. data path**: a socket connect is permission-checked at
// connect time (denied); the pty fd was checked at open() time and merely
// inherited across fork/setuid/execve (allowed).
//
// Laid out as ONE clear top-to-bottom journey (oracle's shell → your terminal).
// Zones are real environments ONLY — the shell; the host's nested terminal stack
// (the two ptys with tmux bridging between them — inner pty → tmux → outer pty);
// the SSH hop back out; your terminal. The "data path vs control path" split is
// modelled as EDGES, not a zone: the data path is the journey's first hop
// (shell → pty, allowed); the control path is a refused edge (shell → tmux's
// control socket, denied) drawn dashed-red alongside it. The two "zoom-ins" are
// NOT separate zones — they reveal in place *inside the object they describe*
// (like the etcd intent store), via that box's `reveal`:
//   · the journey                              → "Follow the rename" flow (spine)
//   · data path (taken) vs control (refused)   → step 1 + the dashed-red edge
//   · the terminal-parser FSM (how a terminal  → revealed inside the "terminal
//     reads bytes; tmux ran it on ESC k step 3)   parser" box (your local term)
//   · how oracle got the handle (sudo -iu)     → revealed inside oracle's bash
// Factual backbone: docs/tmux-window-naming.md.
const TMUX_SUDO = {
  topicId: 'tmux-sudo',
  title: 'tmux window naming across sudo -iu',
  tagline:
    'You run tmux as bongo, then `sudo -iu oracle` inside a pane. oracle is locked out of tmux’s control socket — yet it can still rename the window by writing an escape sequence to its own stdout, which flows into the pty tmux is already reading. The crux is control path vs. data path: a socket connect is permission-checked at connect time (denied); the pty fd was checked at open() time and merely inherited (allowed). Read it as one journey from the shell to your terminal; the two zoom-ins explain how tmux reads the byte and how oracle got the handle.',
  colorVar: 'k-teal',
  flows: [
    {
      flowId: 'tx-journey',
      flowName: 'Follow the rename · shell → your terminal',
      description:
        'One rename byte, traced top to bottom from oracle’s shell to a glyph on your laptop. It leaves on the DATA path — oracle’s own stdout, the pty fd it inherited across sudo — not the control socket, whose refused attempt is drawn as the dashed-red edge. It lands on the pane’s pty, is consumed by tmux (which renders its own screen and sends THAT out over SSH), and only tmux’s output ever crosses the network. The rename is already done before SSH.',
      steps: [
        { step: 1, sourceBoxId: 'tx-bash', targetBoxId: 'tx-pts7',
          description: 'oracle’s bash runs its PROMPT_COMMAND: write(1, "\\033koracle\\033\\\\", 10). That is the DATA path — an ordinary write to its own stdout, fd 1, which is the handle to the pane’s pty slave /dev/pts/7 it inherited across sudo. No new open(), so no permission check; the bytes just land. (The CONTROL path — asking the tmux server over its socket — is refused: the dashed-red edge.)' },
        { step: 2, sourceBoxId: 'tx-pts7', targetBoxId: 'tx-tmux',
          description: 'tmux holds the master end of that pty, so it reads the bytes oracle wrote — as ordinary terminal input.' },
        { step: 3, sourceBoxId: 'tx-tmux', targetBoxId: 'tx-pts3',
          description: 'tmux’s parser consumes \\033koracle\\033\\\\ (it stops here), sets the window name, then renders its whole screen as its OWN escape sequences onto its stdout, /dev/pts/3.' },
        { step: 4, sourceBoxId: 'tx-pts3', targetBoxId: 'tx-sshd',
          description: 'That second pty is the one sshd handed your login shell. sshd holds its master end and reads tmux’s rendered output. Two ptys are now nested on the one remote host.' },
        { step: 5, sourceBoxId: 'tx-sshd', targetBoxId: 'tx-net',
          description: 'sshd encrypts the bytes into the TCP stream — a dumb pipe, not a parser. It neither knows nor cares that a rename happened.' },
        { step: 6, sourceBoxId: 'tx-net', targetBoxId: 'tx-ssh',
          description: 'The encrypted SSH stream crosses the network to your laptop, where your local ssh client decrypts it.' },
        { step: 7, sourceBoxId: 'tx-ssh', targetBoxId: 'tx-term',
          description: 'Your terminal’s own parser draws tmux’s rendered output — including “oracle” in the status bar. It never saw /dev/pts/7 or the raw \\033k…, only what tmux already turned it into.' },
      ],
      // The control path is not a stop on the journey — it is the road NOT taken.
      // Modelled as an edge, not a box/zone: a refused attempt from the shell to
      // the tmux server's control socket, drawn dashed-red and ending in a blocked
      // cap. Clicking it opens the tmux box, where the "why denied" detail lives.
      rejectedEdges: [
        { sourceBoxId: 'tx-bash', targetBoxId: 'tx-tmux',
          label: 'control path\nconnect() → denied', openBoxId: 'tx-tmux' },
      ],
    },
  ],
  zones: [
    {
      id: 'tx-z-shell',
      label: '1 · oracle’s shell · remote host (inside the tmux pane)',
      colorVar: 'k-green',
      boxes: [
        {
          id: 'tx-bash',
          title: 'oracle’s bash',
          typePrefix: 'SHELL · uid 1001',
          subtitle: 'every prompt: write(1, "\\033koracle\\033\\\\")',
          detail: {
            role: 'THE EMITTER',
            summary:
              'The shell you land in after `sudo -iu oracle`. On every prompt it does one write() of the rename sequence to its own stdout — it is not talking to tmux, just printing.',
            sections: [
              {
                heading: 'At a glance',
                tags: ['uid 1001', 'PROMPT_COMMAND', 'no tmux client', 'no socket', 'just stdout'],
              },
              {
                heading: 'What it does each prompt',
                bullets: [
                  'Reads the name: id -un (effective user), or $KUBE_PS1_CLUSTER_NAME if set.',
                  'Writes "\\033koracle\\033\\\\" to fd 1 — an ordinary write to its own stdout.',
                  'Renders nothing itself — tmux, reading the pty, acts on the bytes.',
                ],
              },
              {
                heading: 'Why PROMPT_COMMAND, not a preexec hook',
                facts: [
                  { k: 'preexec', v: 'would capture the running command, but in bash needs a DEBUG trap that can wedge the shell' },
                  { k: 'PROMPT_COMMAND', v: 'runs on prompt redraw only — cannot wedge anything (the command suffix is dropped on purpose)' },
                ],
              },
              {
                heading: 'The bashrc block',
                manifest: {
                  kind: 'UNIT',
                  body: `__tmux_name() {
    { [[ -n "$TMUX" ]] || [[ "$(ps -o comm= -p "$PPID")" == *tmux* ]]; } || return
    local name
    if [[ -n "\${KUBE_PS1_CLUSTER_NAME:-}" ]]; then
        name=$KUBE_PS1_CLUSTER_NAME
    else
        name=$(id -un)
    fi
    printf '\\033k%s\\033\\\\' "$name"
}
case $- in
*i*) PROMPT_COMMAND="__tmux_name\${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
esac`,
                },
              },
              {
                heading: 'Explore',
                commands: [
                  '# Fire a rename by hand (run inside tmux)\nprintf \'\\033kTEST\\033\\\\\'',
                  '# See ESC rendered as ^[ so the sequence is visible\nprintf \'\\033koracle\\033\\\\\' | cat -v',
                ],
              },
            ],
          },
          // Zoom-in revealed in place: how this shell came to hold fd 1 → pts/7.
          // `sudo -iu` allocates no new pty — fork → setuid → execve carry the
          // inherited handle across, so a bare write() just works.
          reveal: {
            hint: 'how it got fd 1 · sudo -iu',
            caption:
              '`sudo -iu oracle` allocates no new pty — it forks, changes uid, and execs, and the open file descriptors ride along untouched. Permission was checked once, at open() time, by bongo; oracle simply inherits the result. Click a step to read it.',
            boxes: [
              {
                id: 'tx-fork',
                title: 'fork()',
                typePrefix: 'SYSCALL',
                subtitle: 'child gets a COPY of the fd table',
                detail: {
                  role: 'STEP 1 · FORK',
                  summary:
                    'sudo forks the process that will become oracle’s shell. The child inherits a copy of the parent’s fd table, so fd 0/1/2 point at the very same open file description for /dev/pts/7. Nothing is re-opened.',
                  sections: [
                    {
                      heading: 'What an fd actually is',
                      facts: [
                        { k: 'fd', v: 'a small integer indexing a per-process table' },
                        { k: 'entry', v: 'points at a shared kernel “open file description”' },
                      ],
                      tags: ['fd = integer + table', 'fork copies the table', 'same pts/7 underneath'],
                    },
                  ],
                },
              },
              {
                id: 'tx-setuid',
                title: 'setuid(1001)',
                typePrefix: 'SYSCALL',
                subtitle: 'become oracle — fd table untouched',
                detail: {
                  role: 'STEP 2 · CHANGE UID',
                  summary:
                    'sudo changes credentials to oracle (uid 1001). The pivotal non-event: changing uid does not touch the fd table, so the open pts/7 handles stay valid. The kernel never revisits past open() decisions when identity changes.',
                  sections: [
                    {
                      heading: 'The pivotal rule',
                      states: [
                        { label: 'checked at open()', tone: 'ok', meaning: 'bongo opened pts/7 and had permission then' },
                        { label: 'NOT checked at write()', tone: 'ok', meaning: 'oracle inherited the handle — nothing to deny' },
                      ],
                      tags: ['uid change ≠ fd change', 'identity at write time is irrelevant'],
                    },
                  ],
                },
              },
              {
                id: 'tx-execve',
                title: 'execve(/bin/bash)',
                typePrefix: 'SYSCALL',
                subtitle: 'fds 0/1/2 survive exec (not close-on-exec)',
                detail: {
                  role: 'STEP 3 · EXEC',
                  summary:
                    'exec replaces the program image with bash but preserves open fds — 0/1/2 are not close-on-exec, so they cross the exec boundary intact. oracle’s bash starts already wired to pts/7.',
                  sections: [
                    {
                      heading: 'Why the fds survive',
                      facts: [
                        { k: 'execve', v: 'overlays a new program but keeps the fd table' },
                        { k: 'FD_CLOEXEC', v: 'not set on 0/1/2, so they are NOT closed on exec' },
                      ],
                      tags: ['exec preserves fds', 'no re-open', 'born wired to pts/7'],
                    },
                  ],
                },
              },
              {
                id: 'tx-fdtable',
                title: 'fd 1 → /dev/pts/7',
                typePrefix: 'FD',
                subtitle: 'the inherited handle · the whole reason data works',
                badges: [{ label: 'no write-time check', kind: 'concept' }],
                detail: {
                  role: 'THE INHERITED HANDLE',
                  summary:
                    'After fork → setuid → execve, oracle’s bash holds fd 1 pointing at the open file description bongo opened for /dev/pts/7. Writing it is an ordinary write to a borrowed handle — no escalation, no re-opening, no fresh check. That is exactly why the data path works where control can’t.',
                  sections: [
                    {
                      heading: 'Inherited handle vs fresh connection',
                      states: [
                        { label: 'pty write', tone: 'ok', meaning: 'inherited fd → no new open() → no check → ALLOWED' },
                        { label: 'socket connect', tone: 'bad', meaning: 'fresh connect() → new open → checked → DENIED for oracle' },
                      ],
                      tags: ['inherited = allowed', 'fresh = checked', 'this is the trick'],
                    },
                    {
                      heading: 'See it directly',
                      commands: [
                        '# Before and after sudo -iu oracle: fds 0/1/2 symlink to the SAME pts\nls -l /proc/$$/fd',
                        '# Robust fix so the $TMUX check survives sudo (edit only with visudo)\n# /etc/sudoers.d/tmux:\nDefaults env_keep += "TMUX TMUX_PANE"',
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
    {
      id: 'tx-z-pty',
      label: '2 · Remote host · the nested terminal stack (inner pty → tmux → outer pty)',
      colorVar: 'k-teal',
      boxes: [
        {
          id: 'tx-pts7',
          title: '/dev/pts/7 · pty slave',
          typePrefix: 'PTY · inner',
          subtitle: 'oracle’s terminal — the handle it inherited (the data path lands here)',
          badges: [
            { label: 'inherited handle', kind: 'concept' },
            { label: 'data path · allowed', kind: 'concept' },
          ],
          detail: {
            role: 'INNER PTY · SLAVE',
            summary:
              'The pseudo-terminal slave oracle’s bash holds as fds 0/1/2. A pty has two ends: the slave (/dev/pts/N) a program treats as its terminal, and the master held by whatever pretends to be it — here, tmux. Bytes written to the slave surface at tmux’s master. This is where the DATA path lands.',
            sections: [
              {
                heading: 'Why oracle’s write is allowed — the data path',
                states: [
                  { label: 'write(1, …)', tone: 'ok', meaning: 'to an fd oracle already holds → no new open() → no permission check → allowed' },
                ],
                facts: [
                  { k: 'Reaches tmux via', v: 'this pty — oracle’s own stdout, fd 1' },
                  { k: 'Not a security bypass', v: 'any process in the pane can set the title; it is orientation, not an authenticated indicator — and the handle was legitimately inherited' },
                ],
                tags: ['inherited handle', 'open-time check already passed', 'rename succeeds'],
              },
              {
                heading: 'Two ends, one local pipe',
                facts: [
                  { k: 'slave', v: '/dev/pts/7 — what oracle’s bash opened as its terminal' },
                  { k: 'master', v: 'the other end, held by the tmux server' },
                ],
                tags: ['slave ↔ master', 'local only — never crosses the network', 'tmux holds the master'],
              },
              {
                heading: 'Genuinely the same terminal',
                bullets: [
                  'Receives the same open file description bongo opened — not a copy.',
                  'Shares the controlling terminal, session and job control with pts/7.',
                  'Reverts on exit: oracle’s fd copies close, bongo’s originals survive on the same pts/7.',
                ],
              },
              {
                heading: 'Confirm the nesting',
                commands: [
                  '# Inside the tmux pane → the inner pty\ntty   # /dev/pts/7',
                  '# Detach (prefix d), then in the bare ssh shell → the outer pty\ntty   # /dev/pts/3',
                ],
              },
            ],
          },
        },
        {
          id: 'tx-tmux',
          title: 'tmux server',
          typePrefix: 'THE BRIDGE',
          subtitle: 'reads the inner pty · consumes \\033k… · renders onto the outer pty',
          badges: [
            { label: 'parser here', kind: 'concept' },
            { label: 'control path · denied', kind: 'static' },
          ],
          detail: {
            role: 'THE CONSUMER',
            summary:
              'The long-lived server bridges the two ptys: it holds the master end of oracle’s inner pty (/dev/pts/7) and renders onto its own outer pty (/dev/pts/3). Its parser interprets the rename sequence, sets the window name, then renders its whole screen (status bar + panes) as a brand-new stream of its own escape sequences — which is what flows onward. The raw \\033k… stops here. It also owns the control socket the CONTROL path tries — and fails — to reach.',
            sections: [
              {
                heading: 'The control path is refused — why',
                states: [
                  { label: 'connect()', tone: 'bad', meaning: 'a fresh open → permission-checked NOW → oracle is a different uid → denied' },
                ],
                facts: [
                  { k: 'Control socket', v: '/tmp/tmux-1000/default — its directory is mode 0700, owned by bongo (uid 1000)' },
                  { k: 'Control vs data', v: 'connect() is checked at connect time (denied); the data-path write rides an inherited fd and is never re-checked (allowed) — same boundary, opposite outcome, all about WHEN the check happens' },
                ],
                tags: ['fresh connect', 'checked at connect time', 'cross-uid denied'],
              },
              {
                heading: 'What it does to the bytes',
                bullets: [
                  'Reads "\\033koracle\\033\\\\" off the pty master.',
                  'Consumes the sequence — sets this window’s name to “oracle”.',
                  'Renders its full screen as its OWN escape sequences onto its stdout.',
                ],
              },
              {
                heading: 'Two settings make it listen',
                facts: [
                  { k: 'allow-rename on', v: 'lets the \\033k escape sequence set the name at all' },
                  { k: 'automatic-rename off', v: 'stops tmux overwriting your name with pane_current_command' },
                ],
                tags: ['~/.tmux.conf', 'both server-global', 'affect every window'],
              },
              {
                heading: 'Each layer parses its child’s stream',
                facts: [
                  { k: 'tmux (remote)', v: 'interprets oracle’s \\033k… and consumes it' },
                  { k: 'your terminal (local)', v: 'interprets tmux’s rendered output' },
                  { k: 'sshd (between)', v: 'not a parser — a dumb encrypted pipe' },
                ],
                tags: ['rename completes remote-side', 'before SSH', 'latency irrelevant'],
              },
              {
                heading: 'See also',
                facts: [
                  { k: 'How this parse works', v: 'a terminal parser is a finite state machine — stepped out inside the “terminal parser” box (ground → escape → collecting → act)' },
                ],
              },
              {
                heading: 'Explore',
                commands: [
                  '# Apply the two settings without restarting the server\ntmux set -g allow-rename on ; tmux set -g automatic-rename off',
                  '# The control socket the DATA path deliberately avoids\nls -la /tmp/tmux-$(id -u)/',
                  '# As oracle, pointed at bongo’s socket → the CONTROL path is denied\ntmux rename-window oracle',
                ],
              },
            ],
          },
        },
        {
          id: 'tx-pts3',
          title: '/dev/pts/3 · pty slave',
          typePrefix: 'PTY · outer',
          subtitle: 'tmux’s own terminal — the pty sshd gave your login shell',
          detail: {
            role: 'OUTER PTY · SLAVE',
            summary:
              'The second pty, nested around the first. tmux’s stdout is /dev/pts/3 — the slave sshd handed your login shell when you connected. So on one remote host two ptys are stacked, with tmux bridging them: it reads the inner pty and renders onto this outer one.',
            sections: [
              {
                heading: 'The nesting, stated plainly',
                facts: [
                  { k: 'inner', v: 'oracle’s bash → /dev/pts/7 (master held by tmux)' },
                  { k: 'outer', v: 'tmux → /dev/pts/3 (master held by sshd)' },
                ],
                tags: ['two nested ptys', 'one host', 'each layer re-emits upward'],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'tx-z-ssh',
      label: '3 · Back out over SSH · remote host → your laptop',
      colorVar: 'k-cyan',
      boxes: [
        {
          id: 'tx-sshd',
          title: 'sshd',
          typePrefix: 'ENCRYPTS',
          subtitle: 'reads pts/3 master · encrypts into TCP (a dumb pipe)',
          detail: {
            role: 'THE FORWARDER',
            summary:
              'sshd holds the master end of the outer pty and forwards whatever tmux renders into the encrypted TCP stream. It does not parse terminal sequences — a stacked forwarder like tmux, but without the interpreting step.',
            sections: [
              {
                heading: 'How bytes leave the host',
                bullets: [
                  'Reads tmux’s rendered output off the outer pty master.',
                  'Forwards it as an encrypted byte stream — nothing about the pty travels.',
                ],
                tags: ['pty stays local', 'SSH stream travels', 'no parsing'],
              },
            ],
          },
        },
        {
          id: 'tx-net',
          title: 'SSH stream',
          typePrefix: 'NETWORK',
          subtitle: 'encrypted — only these bytes cross, never the pty',
          detail: {
            role: 'THE WIRE',
            summary:
              'The encrypted TCP stream between the two hosts — the only thing that crosses the network. By now tmux has already consumed the rename and re-rendered, so what travels is tmux’s output, never the raw \\033k… and never the pty.',
            sections: [
              {
                heading: 'On the wire vs not',
                facts: [
                  { k: 'on the wire', v: 'tmux’s rendered screen, as its own escape sequences, encrypted' },
                  { k: 'NOT on the wire', v: 'the pty (local plumbing) and the raw \\033k… (consumed remote-side)' },
                ],
                tags: ['encrypted', 'rename already done', 'latency irrelevant'],
              },
            ],
          },
        },
        {
          id: 'tx-ssh',
          title: 'local ssh client',
          typePrefix: 'DECRYPTS',
          subtitle: 'on your laptop — hands bytes to the terminal',
          detail: {
            role: 'DECRYPT',
            summary:
              'Your local ssh process decrypts the TCP stream and hands tmux’s rendered output to your terminal emulator. Like sshd, a forwarder, not a parser.',
            sections: [
              {
                heading: 'Mirror of the remote side',
                bullets: [
                  'Receives the encrypted stream and decrypts it.',
                  'Forwards the bytes to the local terminal — does not interpret them.',
                ],
                tags: ['decrypt', 'forward', 'not a parser'],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'tx-z-term',
      label: '4 · Your terminal · local laptop',
      colorVar: 'k-blue',
      boxes: [
        {
          id: 'tx-term',
          title: 'terminal parser',
          typePrefix: 'DRAWS',
          subtitle: 'paints tmux’s output — “oracle” in the status bar',
          badges: [{ label: 'shows “oracle”', kind: 'concept' }],
          detail: {
            role: 'THE RENDERER',
            summary:
              'Your terminal emulator’s own parser interprets tmux’s rendered output and paints pixels — a second, independent state machine. It never sees /dev/pts/7 or the raw rename sequence, only what tmux already turned that into.',
            sections: [
              {
                heading: 'Two parsers, two streams',
                facts: [
                  { k: 'tmux parser (remote)', v: 'interprets oracle’s \\033k… and consumes it' },
                  { k: 'your terminal (local)', v: 'interprets tmux’s rendered output and draws it' },
                ],
                tags: ['second FSM', 'sees only tmux’s output', 'never the raw sequence'],
              },
            ],
          },
          // Zoom-in revealed in place: what a terminal parser actually is. This
          // box is "a second, independent state machine" — so the finite-state
          // machine every terminal parser runs is stepped out here, using the
          // rename sequence tmux handled back in step 3 as the worked example.
          reveal: {
            hint: 'parser FSM · how a terminal reads bytes',
            caption:
              'Every terminal parser — this one, and tmux back in step 3 — is the same finite state machine: in ground state each byte is drawn as text; ESC is the one byte that means “a command follows”. Step through the rename sequence \\033 k o r a c l e \\033 \\\\ to watch it leave ground, collect a name, act on the terminator, and return to ground. Click a state to read it.',
            boxes: [
              {
                id: 'tx-ground',
                title: 'GROUND',
                typePrefix: 'STATE',
                subtitle: 'printable bytes → drawn as glyphs',
                detail: {
                  role: 'STATE · GROUND',
                  summary:
                    'The resting state. Every byte read here is an ordinary character to draw. Visible text is just the parser sitting in ground. One byte breaks the spell: ESC (0x1B), the toggle into command state.',
                  sections: [
                    {
                      heading: 'The one idea behind terminal control',
                      states: [
                        { label: 'ground', tone: 'idle', meaning: 'printable bytes are drawn as glyphs' },
                      ],
                      tags: ['one byte stream', 'no separate control channel', 'ESC = the door'],
                    },
                    {
                      heading: 'Why catting a binary garbles the screen',
                      bullets: [
                        'Reads random bytes as if they were commands — tripping the parser out of ground.',
                      ],
                    },
                  ],
                },
              },
              {
                id: 'tx-escape',
                title: 'ESCAPE',
                typePrefix: 'STATE',
                subtitle: 'saw ESC — next byte selects the family',
                detail: {
                  role: 'STATE · ESCAPE',
                  summary:
                    'The parser saw ESC and waits for the next byte, which decides the kind of sequence. The moment to untangle “escape sequence” from “control sequence”: a control sequence (CSI) is one family of escape sequence, not a synonym.',
                  sections: [
                    {
                      heading: 'The byte after ESC picks a family',
                      facts: [
                        { k: 'ESC [', v: 'CSI — cursor, colour, clear (e.g. ESC[31m = red). The “control sequence”.' },
                        { k: 'ESC ]', v: 'OSC — window titles, clipboard, hyperlinks.' },
                        { k: 'ESC k', v: 'a tmux/screen string: “set this window’s name”. The one used here.' },
                        { k: 'ESC \\\\', v: 'ST — the string terminator, a short two-byte form.' },
                      ],
                      tags: ['CSI ⊂ escape sequences', 'not a synonym', 'ESC k = tmux/screen'],
                    },
                    {
                      heading: 'Escape vs control sequence',
                      states: [
                        { label: 'escape sequence', tone: 'busy', meaning: 'anything starting with ESC — the whole family' },
                        { label: 'control sequence (CSI)', tone: 'busy', meaning: 'only the ESC [ … subset; ESC k is NOT one' },
                      ],
                    },
                  ],
                },
              },
              {
                id: 'tx-collect',
                title: 'COLLECTING',
                typePrefix: 'STATE',
                subtitle: 'ESC k opened a string — accumulate the name',
                detail: {
                  role: 'STATE · COLLECTING THE STRING',
                  summary:
                    'ESC k opened a string, so the parser accumulates bytes into a name buffer instead of drawing them. It stays here until the terminator — which is why both delimiters exist: ESC k opens, ESC \\\\ closes.',
                  sections: [
                    {
                      heading: 'Same bytes, different meaning',
                      states: [
                        { label: 'in GROUND', tone: 'idle', meaning: '“oracle” would be six glyphs drawn on screen' },
                        { label: 'in COLLECTING', tone: 'busy', meaning: 'the identical bytes are the NAME — buffered, not drawn' },
                      ],
                      tags: ['state decides meaning', 'buffer, don’t draw', 'awaiting ST'],
                    },
                    {
                      heading: 'Why two delimiters',
                      facts: [
                        { k: 'ESC k', v: 'marks the start of the name' },
                        { k: 'ESC \\\\ (ST)', v: 'marks the end — without it the parser couldn’t tell where the name stops' },
                      ],
                    },
                  ],
                },
              },
              {
                id: 'tx-act',
                title: 'ACT · set window name',
                typePrefix: 'ACTION',
                subtitle: 'ESC \\\\ terminates → apply “oracle” → back to ground',
                detail: {
                  role: 'ACTION · COMMIT',
                  summary:
                    'The terminator arrives, the string is complete, the parser acts: window name = “oracle”. That is the difference between an escape sequence (control — it changed state) and printable content (merely drawn). Then it returns to ground.',
                  sections: [
                    {
                      heading: 'Control vs content, made concrete',
                      states: [
                        { label: 'escape sequence', tone: 'ok', meaning: 'ESC k oracle ESC \\\\ → an action: rename the window' },
                        { label: 'printable content', tone: 'idle', meaning: 'the bytes “oracle” in ground → six drawn glyphs' },
                      ],
                      tags: ['acted, not drawn', 'then → GROUND'],
                    },
                    {
                      heading: 'Watch a real parser',
                      commands: [
                        '# Render ESC as ^[ so you can see the control bytes\nprintf \'\\033koracle\\033\\\\\' | cat -v   # ^[koracle^[\\\\',
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  ],
}

const LINUX_FDS = {
  topicId: 'linux-fds-sockets',
  title: 'File descriptors, sockets & how Linux talks',
  tagline:
    'A file descriptor is the one handle Linux hands a process for every kind of open thing — a file, a pipe, a socket, a device — so the same read()/write() moves bytes through all of them. A socket is a special fd built for two-way, addressed communication. Together they are how processes talk. (For the permission/inheritance angle, see the tmux deep dive.)',
  colorVar: 'k-purple',
  zones: [
    {
      id: 'fd-z-core',
      label: '1 · The file descriptor',
      colorVar: 'k-purple',
      boxes: [
        {
          id: 'fd-what',
          title: 'What a file descriptor is',
          typePrefix: 'CONCEPT',
          subtitle: 'a small integer — your handle to a kernel object',
          detail: {
            role: 'THE HANDLE',
            summary:
              'A file descriptor is a small non-negative integer the kernel hands back when you open something. It indexes a table the kernel keeps per process; you pass the integer to read()/write()/close() and the kernel looks up the real object behind it. You never touch the object directly — only its number.',
            sections: [
              { heading: 'At a glance',
                tags: ['small integer', 'per-process', 'opaque handle', 'kernel-managed'] },
              { heading: 'What the integer indexes',
                facts: [
                  { k: 'fd', v: 'an index into this process’s open-file table' },
                  { k: 'table slot', v: 'points at a kernel open file description — the real state' },
                  { k: 'lowest free', v: 'open() returns the lowest unused number — why 0/1/2 are stdin/out/err' },
                ] },
              { heading: 'See it',
                commands: ['# every fd this shell holds, as symlinks to what it points at\nls -l /proc/$$/fd'] },
            ],
          },
        },
        {
          id: 'fd-three-level',
          title: 'fd → open file description → inode',
          typePrefix: 'MODEL',
          subtitle: 'three layers, and why the offset lives in the middle one',
          detail: {
            role: 'THE THREE LEVELS',
            summary:
              'There are three layers, not one. The fd (per process) points at an open file description (system-wide — it holds the read/write offset and status flags), which points at an inode (the actual file/pipe/socket). dup() and fork() copy the fd but SHARE the description, so the offset is shared too; two separate open()s of one path get independent descriptions.',
            sections: [
              { heading: 'The layout',
                ascii: `  per-process            system-wide              kernel object
  fd table               open file table          inode
  +----------+           +----------------+        +--------------+
  | 0 stdin  |           | descr #12      |        | inode: file, |
  | 1 stdout |---------->|  offset = 4096 |------->| pipe, socket |
  | 2 stderr |           |  flags  = O_WR |        | or device    |
  | 3 -------|---+       +----------------+        +--------------+
  +----------+   |       +----------------+
                 +------>| descr #19      |------> (same inode,
                         |  offset = 0    |         own offset)
                         +----------------+` },
              { heading: 'Who owns what',
                facts: [
                  { k: 'fd table', v: 'per process — fork() copies it, exec keeps it' },
                  { k: 'open file description', v: 'holds the offset + status flags; dup()/fork() share one' },
                  { k: 'inode', v: 'the actual object; many descriptions can point at it' },
                ] },
              { heading: 'Why it matters',
                bullets: [
                  'dup2(fd, 1) makes stdout point at the same description — that is all redirection is.',
                  'fork() children share the offset, so parent and child writing one fd append in order.',
                  'Two independent open()s of one file get separate offsets — they clobber each other.',
                ] },
            ],
          },
        },
        {
          id: 'fd-everything',
          title: '“Everything is a file”',
          typePrefix: 'UNIX',
          subtitle: 'one set of verbs over every kind of object',
          detail: {
            role: 'THE UNIFORM INTERFACE',
            summary:
              'The payoff of the fd abstraction: the same handful of syscalls — read(), write(), close() and friends — work on almost everything. A regular file, a pipe, a socket, a terminal, a block device, even kernel event objects all answer to the same verbs. Code that moves bytes does not care what is on the other end.',
            sections: [
              { heading: 'Same verbs, many objects',
                facts: [
                  { k: 'read()/write()', v: 'files, pipes, sockets, ttys, devices — all the same call' },
                  { k: 'close()', v: 'releases the slot for any of them' },
                  { k: 'poll()/select()', v: 'wait on a mix of fd types at once' },
                ] },
              { heading: 'Why this is powerful',
                bullets: [
                  'Shell pipelines: a program’s stdout is an fd; it has no idea it feeds another program.',
                  'Redirection: < and > just point fd 0/1 at a file instead of the terminal.',
                  'Testability: hand a program a pipe or socket where it expected a file — it can’t tell.',
                ] },
              { heading: 'The not-quite-everything caveat',
                tags: ['lseek fails on pipes/sockets', 'sockets add send/recv', 'ioctl() for device knobs'] },
            ],
          },
        },
        {
          id: 'fd-stdio',
          title: 'fd 0, 1, 2 — stdin / stdout / stderr',
          typePrefix: 'FD 0/1/2',
          subtitle: 'the three every process is born holding',
          detail: {
            role: 'THE STANDARD STREAMS',
            summary:
              'By convention every process starts with three fds already open: 0 = standard input, 1 = standard output, 2 = standard error. The shell wires them up before exec; redirection and pipes are just the shell rewriting these slots with dup2() before handing control to your program.',
            sections: [
              { heading: 'The three',
                facts: [
                  { k: '0 · stdin', v: 'where input is read from (keyboard, file, or pipe)' },
                  { k: '1 · stdout', v: 'normal output' },
                  { k: '2 · stderr', v: 'errors — kept separate so logs survive a redirected stdout' },
                ] },
              { heading: 'Redirection is just dup2()',
                bullets: [
                  'cmd > out.txt: open out.txt, dup2 it onto fd 1, then exec cmd.',
                  'cmd 2>&1: dup2 fd 1 onto fd 2 so both point at the same description.',
                  'a | b: a pipe’s write end becomes a’s fd 1, its read end becomes b’s fd 0.',
                ] },
              { heading: 'See it',
                commands: ['# what your shell’s 0/1/2 currently point at\nls -l /proc/$$/fd/0 /proc/$$/fd/1 /proc/$$/fd/2'] },
            ],
          },
        },
      ],
    },
    {
      id: 'fd-z-socket',
      label: '2 · Sockets — a different kind of fd',
      colorVar: 'k-cyan',
      boxes: [
        {
          id: 'fd-sk-what',
          title: 'What makes a socket a socket',
          typePrefix: 'CONCEPT',
          subtitle: 'still an fd — but born for two-way, addressed talk',
          detail: {
            role: 'A SPECIAL FD',
            summary:
              'A socket is an fd like any other — but it is created by socket(domain, type, protocol), not open(path), and it carries things a file never does: an address family, a transport type, a peer, and (for streams) a connection state machine. You still read()/write() it, but it is built for communication, not storage.',
            sections: [
              { heading: 'Three choices at creation',
                facts: [
                  { k: 'domain', v: 'AF_UNIX (same host) / AF_INET / AF_INET6 (network)' },
                  { k: 'type', v: 'SOCK_STREAM (ordered, reliable) / SOCK_DGRAM (messages)' },
                  { k: 'protocol', v: 'usually 0 — let the family pick (TCP for stream, UDP for dgram)' },
                ] },
              { heading: 'What a file never has',
                tags: ['a peer address', 'two directions', 'a connection state', 'send()/recv() flags'] },
            ],
          },
        },
        {
          id: 'fd-sk-vs-file',
          title: 'Socket fd vs file fd',
          typePrefix: 'COMPARE',
          subtitle: 'same handle, very different object behind it',
          detail: {
            role: 'THE DIFFERENCE',
            summary:
              'Both are fds you read() and write(); what differs is the object behind the number. A file is a seekable, byte-addressable store you open by path. A socket is a non-seekable communication channel you create, then name or connect — often full-duplex, with two independent buffers and a peer on the far end.',
            sections: [
              { heading: 'Side by side',
                facts: [
                  { k: 'created by', v: 'file: open(path) · socket: socket() + bind()/connect()' },
                  { k: 'addressing', v: 'file: a path · socket: a path or IP:port, plus a peer' },
                  { k: 'seekable', v: 'file: yes (lseek) · socket: no — a moving stream' },
                  { k: 'direction', v: 'file: one offset · socket: usually full-duplex, two buffers' },
                  { k: 'extra verbs', v: 'socket adds send/recv, shutdown, setsockopt, accept/connect' },
                ] },
              { heading: 'The same, though',
                tags: ['both are fds', 'both do read()/write()/close()', 'both work in poll()/epoll()'] },
              { heading: 'Peek at both',
                commands: [
                  '# open sockets on the box, with the owning process\nss -tulpn',
                  '# watch a process’s socket syscalls\nstrace -e trace=network -p <pid>',
                ] },
            ],
          },
        },
        {
          id: 'fd-sk-families',
          title: 'AF_UNIX vs AF_INET — local vs networked',
          typePrefix: 'AF_*',
          subtitle: 'same API, different reach',
          detail: {
            role: 'ADDRESS FAMILIES',
            summary:
              'The domain you pass to socket() decides how far it reaches and how it is named. AF_UNIX sockets live on one host, addressed by a filesystem path, and never touch the network stack — fast, and able to pass fds and credentials between processes. AF_INET/AF_INET6 sockets are addressed by IP:port and go through TCP/IP, so they can span machines.',
            sections: [
              { heading: 'The two you meet most',
                facts: [
                  { k: 'AF_UNIX', v: 'a path like /run/docker.sock · same host only · can pass fds (SCM_RIGHTS) + peer creds' },
                  { k: 'AF_INET / AF_INET6', v: 'IP:port · across the network · through the TCP/IP stack' },
                ] },
              { heading: 'Stream vs datagram',
                facts: [
                  { k: 'SOCK_STREAM', v: 'a reliable, ordered byte stream (TCP, or a local unix stream)' },
                  { k: 'SOCK_DGRAM', v: 'discrete messages, no connection guarantees (UDP, or local unix datagram)' },
                ] },
              { heading: 'Who uses AF_UNIX',
                tags: ['Docker /run/docker.sock', 'systemd journald', 'X11', 'the tmux control socket'] },
              { heading: 'See them',
                commands: ['# list unix-domain sockets and who holds them\nss -xl'] },
            ],
          },
        },
        {
          id: 'fd-seealso',
          title: 'See also · the tmux deep dive',
          typePrefix: 'CROSS-REF',
          subtitle: 'where this fd-vs-socket split decides a permission',
          detail: {
            role: 'WHERE THIS SHOWS UP',
            summary:
              'The “tmux window naming across sudo -iu” deep dive is this machinery with stakes attached. There, the difference between an inherited pty fd (a write — allowed) and a fresh socket connect() (checked now — denied) is exactly what lets a cross-uid process rename a window but not command the server. Read it next for the control-path-vs-data-path angle this topic leaves out.',
            sections: [
              { heading: 'The link in one line',
                facts: [
                  { k: 'this topic', v: 'what fds and sockets ARE' },
                  { k: 'tmux topic', v: 'how inherited-fd vs fresh-connect decides who is allowed' },
                ] },
              { heading: 'The crux there',
                tags: ['inherited fd → checked at open() → allowed', 'fresh connect() → checked now → denied', 'same boundary, opposite outcome'] },
            ],
          },
        },
        {
          id: 'fd-sk-handshake',
          title: 'Opening a connection · the handshake',
          typePrefix: 'LIFECYCLE',
          subtitle: 'socket → bind → listen → accept / connect',
          detail: {
            role: 'THE SOCKET LIFECYCLE',
            summary:
              'A connection is built by a fixed sequence of syscalls. The server side creates a socket, gives it a name, marks it passive, then accepts; the client creates a socket and connects. Expand this box to walk each step.',
            sections: [
              { heading: 'Two sides',
                facts: [
                  { k: 'server', v: 'socket() → bind() → listen() → accept() (loops per client)' },
                  { k: 'client', v: 'socket() → connect()' },
                ] },
              { heading: 'The sequence',
                ascii: `  server                      client
  --------                    --------
  socket()                    socket()
  bind(name)                     |
  listen()                       |
     ^------- connect() ---------+
  accept()
     |
  new per-client fd  <====>  connected fd
     |
  (loop for the next client)` },
            ],
          },
          reveal: {
            hint: 'the socket handshake · socket → … → accept',
            caption:
              'The syscalls that turn two nameless sockets into a connected pair — the server names and listens, the client connects, and accept() mints a fresh per-client fd. Click any step for detail.',
            boxes: [
        {
          id: 'fd-sk-socket',
          title: 'socket()',
          typePrefix: 'SYSCALL',
          subtitle: 'create an unbound, unconnected fd',
          detail: {
            role: 'STEP · CREATE',
            summary:
              'Both ends start here. socket(domain, type, protocol) allocates a new fd backed by a fresh, nameless, peerless socket object. Nothing is reachable yet — it has neither an address nor a connection.',
            sections: [
              { heading: 'What you get back',
                facts: [
                  { k: 'returns', v: 'a new fd in the unconnected state' },
                  { k: 'not yet', v: 'no name (bind), no peer (connect/accept)' },
                ] },
            ],
          },
        },
        {
          id: 'fd-sk-bind',
          title: 'bind()',
          typePrefix: 'SYSCALL',
          subtitle: 'give the server fd a name',
          detail: {
            role: 'STEP · NAME · server',
            summary:
              'The server attaches an address to its socket so clients can find it: a filesystem path for AF_UNIX, or an IP:port for AF_INET. Clients usually skip this — the kernel auto-assigns them an ephemeral local address at connect() time.',
            sections: [
              { heading: 'The name',
                facts: [
                  { k: 'AF_UNIX', v: 'a path, e.g. /run/app.sock (created on the filesystem)' },
                  { k: 'AF_INET', v: 'an IP:port, e.g. 0.0.0.0:8080' },
                ] },
              { heading: 'See it',
                commands: ['# the listening addresses bind() produced\nss -ltnp'] },
            ],
          },
        },
        {
          id: 'fd-sk-listen',
          title: 'listen()',
          typePrefix: 'SYSCALL',
          subtitle: 'mark it passive · start a backlog',
          detail: {
            role: 'STEP · PASSIVE · server',
            summary:
              'listen() flips the bound socket into passive mode and tells the kernel to start queuing incoming connections in a backlog. This socket will now never send data itself — it only manufactures connected sockets via accept().',
            sections: [
              { heading: 'What changes',
                facts: [
                  { k: 'state', v: '→ LISTEN' },
                  { k: 'backlog', v: 'how many completed connections may wait for accept()' },
                ] },
            ],
          },
        },
        {
          id: 'fd-sk-accept',
          title: 'accept()',
          typePrefix: 'SYSCALL',
          subtitle: 'pull one connection off the queue → a NEW fd',
          detail: {
            role: 'STEP · ACCEPT · server',
            summary:
              'accept() removes one completed connection from the backlog and returns a brand-new fd dedicated to that single client. The listening fd stays open to take the next one. This is the moment one server fd becomes many connected fds.',
            sections: [
              { heading: 'The key idea',
                states: [
                  { label: 'listening fd', tone: 'idle', meaning: 'stays in LISTEN — never carries data' },
                  { label: 'accepted fd', tone: 'ok', meaning: 'a fresh connected socket for this one peer — read()/write() here' },
                ] },
            ],
          },
        },
        {
          id: 'fd-sk-connect',
          title: 'connect()',
          typePrefix: 'SYSCALL',
          subtitle: 'client reaches the server’s name',
          detail: {
            role: 'STEP · CONNECT · client',
            summary:
              'The client points its fresh socket at the server’s address. For a unix socket this is the permission-checked moment (the path’s mode must allow it); for TCP it triggers the SYN handshake. On success both ends hold a connected fd and ordinary read()/write() moves data.',
            sections: [
              { heading: 'After it returns',
                facts: [
                  { k: 'client fd', v: 'now connected — read()/write() talk to the server’s accepted fd' },
                  { k: 'permission', v: 'AF_UNIX: checked HERE, against the socket path’s mode' },
                ] },
              { heading: 'Try it',
                commands: ['# a throwaway unix-socket echo, then connect to it\nsocat UNIX-LISTEN:/tmp/demo.sock - & socat - UNIX-CONNECT:/tmp/demo.sock'] },
            ],
          },
        },
            ],
          },
        },
      ],
    },
    {
      id: 'fd-z-ipc',
      label: '3 · The IPC menu — how processes actually talk',
      colorVar: 'k-green',
      boxes: [
        {
          id: 'ipc-pipe',
          title: 'Anonymous pipe',
          typePrefix: 'pipe()',
          subtitle: 'one-way stream between related processes',
          detail: {
            role: 'IPC · PIPE',
            summary:
              'pipe() returns two fds — a read end and a write end — joined by a kernel buffer. It is one-directional and nameless, so the only way to share it is to inherit it across fork(). This is exactly what a shell does for a | b.',
            sections: [
              { heading: 'Shape',
                facts: [
                  { k: 'returns', v: 'fd[0] read end, fd[1] write end' },
                  { k: 'reach', v: 'related processes only (inherited via fork)' },
                  { k: 'direction', v: 'one way; need two pipes for a conversation' },
                ] },
              { heading: 'See it',
                commands: ['# the shell builds a pipe between these two\nls | wc -l'] },
            ],
          },
          reveal: {
            hint: 'a byte through the pipe · write → buffer → read',
            caption:
              'A pipe is just a kernel buffer between two fds. Walk a byte across it — and meet the back-pressure that blocks whichever side gets ahead. Click a step for detail.',
            boxes: [
            {
              id: 'fd-pipe-writer',
              title: 'write(fd[1], …)',
              typePrefix: 'WRITER',
              subtitle: 'copy bytes into the kernel buffer',
              detail: {
                role: 'STEP · WRITE',
                summary:
                  'The writing process calls write() on the pipe’s write end. The kernel copies the bytes into an in-memory ring buffer attached to the pipe. No disk, no addressing, no peer lookup — the bytes just sit in the buffer waiting to be read.',
                sections: [
                  { heading: 'Back-pressure',
                    states: [
                      { label: 'buffer has room', tone: 'ok', meaning: 'write() returns immediately' },
                      { label: 'buffer full', tone: 'busy', meaning: 'write() blocks until the reader drains it — built-in flow control' },
                    ] },
                ],
              },
            },
            {
              id: 'fd-pipe-buf',
              title: 'kernel pipe buffer',
              typePrefix: 'BUFFER',
              subtitle: 'a small in-memory ring (~64 KiB)',
              detail: {
                role: 'THE BUFFER',
                summary:
                  'The pipe itself is just this kernel-side ring buffer between the two fds. It preserves order (first in, first out) and bounds memory: writers fill it, readers drain it, and the kernel blocks whichever side gets ahead. Nothing here is ever named or written to disk.',
                sections: [
                  { heading: 'Properties',
                    facts: [
                      { k: 'ordering', v: 'FIFO — bytes come out in the order written' },
                      { k: 'size', v: 'bounded (default ~64 KiB) — the source of back-pressure' },
                    ] },
                ],
              },
            },
            {
              id: 'fd-pipe-reader',
              title: 'read(fd[0], …)',
              typePrefix: 'READER',
              subtitle: 'drain the buffer · EOF when writers close',
              detail: {
                role: 'STEP · READ',
                summary:
                  'The reading process calls read() on the read end and the kernel copies bytes out of the buffer in order. An empty buffer blocks the reader until more arrives; when every write end is closed and the buffer is drained, read() returns 0 — end of file. That EOF is how the reader knows the writer is done.',
                sections: [
                  { heading: 'Edge cases',
                    states: [
                      { label: 'buffer empty', tone: 'busy', meaning: 'read() blocks, waiting for a writer' },
                      { label: 'all write ends closed', tone: 'idle', meaning: 'read() returns 0 (EOF)' },
                    ] },
                  { heading: 'Gotcha',
                    tags: ['write to a pipe with no readers → SIGPIPE', 'that is why `yes | head` ends cleanly'] },
                ],
              },
            },
            ],
          },
        },
        {
          id: 'ipc-fifo',
          title: 'Named pipe (FIFO)',
          typePrefix: 'FIFO',
          subtitle: 'a pipe with a filesystem name',
          detail: {
            role: 'IPC · FIFO',
            summary:
              'A FIFO is a pipe given a path with mkfifo, so unrelated processes — with no common parent — can rendezvous by opening the same name. The bytes still never hit disk; the path is just a meeting point. open() blocks until both a reader and a writer arrive.',
            sections: [
              { heading: 'vs anonymous pipe',
                facts: [
                  { k: 'naming', v: 'a path on the filesystem (mkfifo)' },
                  { k: 'reach', v: 'any process that can open the path' },
                ] },
              { heading: 'Try it',
                commands: [
                  '# terminal one\nmkfifo /tmp/f && cat /tmp/f',
                  '# terminal two\necho hello > /tmp/f',
                ] },
            ],
          },
        },
        {
          id: 'ipc-unix',
          title: 'Unix-domain socket',
          typePrefix: 'AF_UNIX',
          subtitle: 'the local two-way workhorse',
          detail: {
            role: 'IPC · UNIX SOCKET',
            summary:
              'A full-duplex socket addressed by a filesystem path, staying entirely on one host. Bidirectional, connection-oriented (or datagram), and uniquely able to pass open fds and verified peer credentials between processes. The default for local client/server IPC.',
            sections: [
              { heading: 'Why it wins locally',
                facts: [
                  { k: 'duplex', v: 'two-way, unlike a pipe' },
                  { k: 'fd passing', v: 'hand an open fd to another process (SCM_RIGHTS)' },
                  { k: 'identity', v: 'kernel-verified peer uid/pid (SO_PEERCRED)' },
                ] },
              { heading: 'In the wild',
                tags: ['/run/docker.sock', 'systemd / journald', 'the tmux control socket'] },
            ],
          },
        },
        {
          id: 'ipc-tcp',
          title: 'TCP / UDP socket',
          typePrefix: 'AF_INET',
          subtitle: 'the same API, across the network',
          detail: {
            role: 'IPC · NETWORK SOCKET',
            summary:
              'Swap the domain to AF_INET and the same socket calls now reach another machine through the TCP/IP stack. TCP gives a reliable ordered stream; UDP gives fire-and-forget messages. Identical verbs to a unix socket — only the address (IP:port) and the path through the kernel differ.',
            sections: [
              { heading: 'Two transports',
                facts: [
                  { k: 'TCP (SOCK_STREAM)', v: 'reliable, ordered, connection — handshake, then a byte stream' },
                  { k: 'UDP (SOCK_DGRAM)', v: 'messages, no connection or delivery guarantee' },
                ] },
              { heading: 'Cost vs a unix socket',
                tags: ['goes through the IP stack', 'checksums + copies', 'can cross hosts'] },
            ],
          },
        },
        {
          id: 'ipc-shm',
          title: 'Shared memory',
          typePrefix: 'mmap/shm',
          subtitle: 'fastest — but you bring the locks',
          detail: {
            role: 'IPC · SHARED MEMORY',
            summary:
              'Two processes map the same physical pages into their address spaces (shm_open + mmap, or MAP_SHARED). After setup there are no syscalls and no copies — both just read and write memory. The catch: nothing serializes access, so you must add your own synchronization (futexes, semaphores).',
            sections: [
              { heading: 'Trade-off',
                states: [
                  { label: 'throughput', tone: 'ok', meaning: 'zero-copy — the fastest IPC there is' },
                  { label: 'safety', tone: 'bad', meaning: 'no built-in ordering — races unless you lock' },
                ] },
              { heading: 'How',
                facts: [
                  { k: 'set up', v: 'shm_open() → ftruncate() → mmap(MAP_SHARED)' },
                  { k: 'synchronize', v: 'a futex / POSIX semaphore in the shared region' },
                ] },
            ],
          },
        },
        {
          id: 'ipc-signal',
          title: 'Signals',
          typePrefix: 'signal',
          subtitle: 'a notification, not a channel',
          detail: {
            role: 'IPC · SIGNAL',
            summary:
              'A signal is an asynchronous nudge — a single number (SIGTERM, SIGCHLD, …) delivered to a process, interrupting it to run a handler. It carries no real payload (a little more with SIGINFO), so it is control, not data: “something happened”, not “here are the bytes”.',
            sections: [
              { heading: 'What it is good for',
                facts: [
                  { k: 'control', v: 'stop, reload, “your child exited” (SIGCHLD)' },
                  { k: 'payload', v: 'essentially just the signal number' },
                ] },
              { heading: 'Not for moving data',
                tags: ['async', 'tiny', 'interrupts the target', 'pair it with a real channel for data'] },
            ],
          },
        },
        {
          id: 'ipc-ready',
          title: 'epoll / eventfd',
          typePrefix: 'epoll/eventfd',
          subtitle: 'readiness, not transport',
          detail: {
            role: 'IPC · READINESS',
            summary:
              'These do not move payload — they tell you WHEN another fd is ready, so one thread can wait on thousands of connections at once. epoll watches a set of fds and reports which became readable/writable; eventfd is a tiny counter fd used as a wakeup between threads.',
            sections: [
              { heading: 'The two',
                facts: [
                  { k: 'epoll', v: 'wait on many fds; get back just the ready ones — the basis of async servers' },
                  { k: 'eventfd', v: 'an 8-byte counter fd — write to it to wake a thread blocked in epoll' },
                ] },
              { heading: 'Why it exists',
                tags: ['scales to many fds', 'everything is an fd, so they compose', 'poll/select are the older cousins'] },
            ],
          },
        },
        {
          id: 'ipc-choose',
          title: 'Which one do I use?',
          typePrefix: 'WHICH?',
          subtitle: 'a quick decision table',
          detail: {
            role: 'CHOOSING',
            summary:
              'They are not interchangeable — each trades reach for cost. Pick by where the other process is and what you are moving.',
            sections: [
              { heading: 'Rules of thumb',
                facts: [
                  { k: 'same host, client/server', v: 'unix-domain socket' },
                  { k: 'related procs, simple stream', v: 'a pipe' },
                  { k: 'unrelated procs, no network', v: 'a FIFO' },
                  { k: 'across machines', v: 'TCP (or UDP for lossy/streaming)' },
                  { k: 'bulk / lowest latency', v: 'shared memory + your own locks' },
                  { k: 'just “wake up” / “done”', v: 'signal or eventfd' },
                ] },
            ],
          },
        },
      ],
    },
  ],
}

// ── Inside the API server · one request's journey ───────────────────────────
const API_REQUEST_PATH = {
  topicId: 'api-request-path',
  title: 'Inside the API server — one request’s journey',
  tagline:
    'Every `oc apply`, controller write, and kubelet status update runs the same gauntlet inside kube-apiserver: authentication → authorization → mutating admission → validation → an etcd write → watch fan-out to every interested loop. In HCP the server running this chain is itself a Pod in the management cluster’s HCP namespace, and the admission webhooks it calls are Pods next door.',
  colorVar: 'k-blue',
  flows: [
    {
      flowId: 'api-write',
      flowName: 'oc apply → etcd → watchers',
      description:
        'One write request, followed through the handler chain. The two dashed-red edges are the roads not taken: a request with no valid credential dies at authentication with 401; an authenticated user without an RBAC grant dies at authorization with 403. Everything that survives admission is persisted once in etcd, and the new revision fans out to every open watch — that fan-out, not polling, is what drives all the controllers on the Overview.',
      steps: [
        { step: 1, sourceBoxId: 'api-request', targetBoxId: 'api-authn',
          description: 'The client opens TLS to the API endpoint and sends the request; the kubeconfig decides which credential rides along — a client certificate, a bearer token, or an OIDC token. Authentication runs first: the configured authenticators are tried in order and the first success wins, producing a user and group list.' },
        { step: 2, sourceBoxId: 'api-authn', targetBoxId: 'api-authz',
          description: 'The request now carries an identity (user, groups, extra attributes). Authorization asks one question: may THIS identity do THIS verb on THIS resource in THIS namespace? The RBAC authorizer walks RoleBindings and ClusterRoleBindings looking for a rule that allows it.' },
        { step: 3, sourceBoxId: 'api-authz', targetBoxId: 'api-admission-mutate',
          description: 'Authorized requests enter admission. Mutating admission runs first: compiled-in plugins (ServiceAccount injects the token volume, DefaultStorageClass fills an empty storageClassName), then every matching MutatingWebhookConfiguration webhook in order — each one an HTTPS call to a webhook Pod that may return a JSONPatch rewriting the object.' },
        { step: 4, sourceBoxId: 'api-admission-mutate', targetBoxId: 'api-validate',
          description: 'The MUTATED object is then validated: built-in schema/CEL validation first, then every matching ValidatingWebhookConfiguration webhook — called in parallel, none may change the object, any one veto fails the whole request. This is where the Multus Admission Controller on the Overview earns its place: it validates NetworkAttachmentDefinitions exactly here.' },
        { step: 5, sourceBoxId: 'api-validate', targetBoxId: 'api-etcd-commit',
          description: 'The surviving object is persisted: serialized to protobuf and written to etcd under its key, committed through Raft consensus (the etcd deep dive walks that part). The object’s resourceVersion is the etcd modification revision — it exists nowhere else.' },
        { step: 6, sourceBoxId: 'api-etcd-commit', targetBoxId: 'api-watch-cache',
          description: 'The API server’s watch cache observes the committed revision on its own etcd watch and appends the event to its in-memory ring — one etcd watch feeding thousands of client watches, so etcd is read once no matter how many controllers care.' },
        { step: 7, sourceBoxId: 'api-watch-cache', targetBoxId: 'api-watchers',
          description: 'The event streams out every open WATCH whose selector matches: controller informers, the scheduler, and each kubelet’s own outbound watch. Nothing is pushed to nodes — the kubelet dialled in and keeps the stream open, which is why a watch never needs the Konnectivity tunnel.' },
      ],
      // One denied edge, not two: the 403 road-not-taken from authorization
      // straight past the rest of the chain. The 401 case stays on the
      // Authentication box itself (its stat badge + popup) — a second short
      // dashed edge between the adjacent filter boxes just collided with it.
      rejectedEdges: [
        { sourceBoxId: 'api-authz', targetBoxId: 'api-etcd-commit',
          label: '403 Forbidden\nno RBAC grant', openBoxId: 'api-authz' },
      ],
    },
  ],
  zones: [
    {
      id: 'api-client-zone',
      label: 'Client · the request',
      colorVar: 'k-cyan',
      boxes: [
        {
          id: 'api-request',
          title: 'oc apply -f deploy.yaml',
          typePrefix: 'HTTPS',
          subtitle: 'TLS + a credential from the kubeconfig',
          detail: {
            role: 'THE REQUEST',
            summary:
              'Every interaction with Kubernetes is an HTTPS request to the API server — `oc` and `kubectl` are just typed REST clients. The kubeconfig supplies the server URL, the CA to trust, and the credential to present; in HCP that URL resolves to the Shared Ingress and terminates at the Guest API Server Pod.',
            sections: [
              { heading: 'At a glance', tags: ['HTTPS', 'TLS 1.3', 'HTTP/2', 'kubeconfig', 'REST + watch'] },
              { heading: 'Explore', commands: [
                '# The raw request oc makes for you\noc get deployment my-app -v=8',
                '# Who does the kubeconfig say you are?\noc whoami',
              ] },
            ],
          },
        },
      ],
    },
    {
      id: 'api-chain',
      label: 'kube-apiserver · the handler chain',
      colorVar: 'k-blue',
      boxes: [
        {
          id: 'api-authn',
          title: 'Authentication',
          typePrefix: 'FILTER 1',
          subtitle: 'who are you? — first authenticator to succeed wins',
          badges: [{ label: '401 on failure', kind: 'stat' }],
          detail: {
            role: 'IDENTITY',
            summary:
              'The configured authenticators run in order and the first success attaches a user + groups to the request. X.509 client certificates encode the user in the CN and groups in O fields; ServiceAccount bearer tokens are verified as signed JWTs (the TokenReview API exposes the same check); OIDC tokens map claims to users. OpenShift adds its own path: the integrated OAuth server issues tokens that the oauth-apiserver validates. No authenticator succeeding = 401, and the request never goes further.',
            sections: [
              { heading: 'The authenticators', bullets: [
                'X.509 client cert — CN = username, O = groups; how admins and kubelets authenticate.',
                'ServiceAccount token — a signed JWT mounted into Pods; how in-cluster clients authenticate.',
                'OIDC / OAuth token — how human users authenticate in OpenShift (oc login).',
                'Anonymous — if everything fails and anonymous-auth is on, you are system:anonymous (and RBAC will almost certainly say 403).',
              ] },
              { heading: 'Explore', commands: [
                '# The identity your current credential resolves to\noc whoami',
                '# Decode a ServiceAccount JWT (header.payload.signature)\noc create token default | cut -d. -f2 | base64 -d | jq',
              ] },
            ],
          },
        },
        {
          id: 'api-authz',
          title: 'Authorization · RBAC',
          typePrefix: 'FILTER 2',
          subtitle: 'may THIS user do THIS verb on THIS resource?',
          detail: {
            role: 'PERMISSION',
            summary:
              'Authorization is a pure function over the identity and the request attributes: verb, API group, resource, namespace, name. The RBAC authorizer walks RoleBindings (namespaced) and ClusterRoleBindings (cluster-wide) for the user and its groups, looking for a Role/ClusterRole rule that allows the tuple. RBAC is allow-only — there is no deny rule; anything not granted is forbidden. The same decision is queryable through the SubjectAccessReview API, which is what `oc auth can-i` calls.',
            sections: [
              { heading: 'Beyond RBAC', bullets: [
                'Node authorizer — scopes each kubelet to exactly the objects of its own node (its credential is in system:nodes).',
                'Webhook mode — delegate the decision to an external service.',
                'Authorizers run as a chain too: the first one with a definitive allow/deny answer wins.',
              ] },
              { heading: 'Explore', commands: [
                '# Ask the authorizer directly\noc auth can-i create deployments -n e-commerce-prod',
                '# What grants someone a verb? (OpenShift helper)\noc adm policy who-can delete pods -n e-commerce-prod',
              ] },
            ],
          },
        },
        {
          id: 'api-admission-mutate',
          title: 'Mutating admission',
          typePrefix: 'FILTER 3',
          subtitle: 'compiled-in plugins, then webhooks — each may patch',
          detail: {
            role: 'REWRITE',
            summary:
              'Admission is where the cluster gets to edit and police objects before they exist. Mutating admission runs first: compiled-in plugins (the ServiceAccount plugin injects the token volume into every Pod; DefaultStorageClass fills in an empty storageClassName — exactly what the storage trace relies on), then each matching MutatingWebhookConfiguration webhook in order. A webhook is just an HTTPS POST of an AdmissionReview to a Service — in HCP, to a Pod in the same namespace — whose response may carry a JSONPatch.',
            sections: [
              { heading: 'Note', bullets: [
                'Order matters and webhooks can observe earlier patches — which is why validation runs only after ALL mutation is done.',
                'sidecar injection (service meshes), default resource limits, and image-pull-secret injection all live here.',
              ] },
              { heading: 'Explore', commands: [
                '# Which mutating webhooks does this cluster run?\noc get mutatingwebhookconfiguration',
              ] },
            ],
          },
        },
        {
          id: 'api-validate',
          title: 'Validation',
          typePrefix: 'FILTER 4',
          subtitle: 'schema + CEL, then validating webhooks — any veto fails',
          detail: {
            role: 'VETO',
            summary:
              'The mutated object is checked against its OpenAPI schema and CEL validation rules, then every matching ValidatingWebhookConfiguration webhook is called — in parallel, since none may modify the object. A single veto fails the whole request with the webhook’s message. The Multus Admission Controller card on the Overview is one of these: it validates NetworkAttachmentDefinitions for the guest cluster right here in the Guest API Server’s chain.',
            sections: [
              { heading: 'Note', bullets: [
                'ValidatingAdmissionPolicy (CEL, in-process) covers simple cases without the webhook round-trip.',
                'A webhook with failurePolicy: Fail can block ALL matching writes if its Pod is down — a classic cluster outage.',
              ] },
              { heading: 'Explore', commands: [
                '# Which validating webhooks does this cluster run?\noc get validatingwebhookconfiguration',
              ] },
            ],
          },
        },
      ],
    },
    {
      id: 'api-store-zone',
      label: 'Persistence · etcd',
      colorVar: 'k-green',
      boxes: [
        {
          id: 'api-etcd-commit',
          title: 'etcd commit',
          typePrefix: 'KV',
          subtitle: 'protobuf write → Raft → resourceVersion',
          detail: {
            role: 'THE WRITE',
            summary:
              'The object is serialized to protobuf and written to etcd under /registry/<resource>/<namespace>/<name>, committed through Raft consensus across the etcd members. The resourceVersion every Kubernetes object carries is the etcd modification revision of that write — the cluster’s single logical clock. The “etcd — Raft, quorum” deep dive walks what commit means; in HCP this is the Guest Etcd StatefulSet in the management cluster, not the management masters’ static-pod etcd.',
            sections: [
              { heading: 'Explore', commands: [
                '# The revision the object was last written at\noc get deployment my-app -o jsonpath=\'{.metadata.resourceVersion}\'',
              ] },
            ],
          },
        },
      ],
    },
    {
      id: 'api-fanout',
      label: 'Watch fan-out · what makes controllers tick',
      colorVar: 'k-sky',
      boxes: [
        {
          id: 'api-watch-cache',
          title: 'Watch cache',
          typePrefix: 'CACHE',
          subtitle: 'one etcd watch in → thousands of client watches out',
          detail: {
            role: 'MULTIPLIER',
            summary:
              'The API server keeps a per-resource in-memory cache fed by its own etcd watch. Every committed revision lands here once and is replayed to every open client watch whose filter matches. This is why hundreds of controllers and kubelets watching Pods costs etcd a single watch — the API server, not etcd, does the fan-out.',
            sections: [
              { heading: 'Note', bullets: [
                'A client resuming a watch from a too-old resourceVersion gets HTTP 410 Gone and must re-list — the cache ring is finite.',
              ] },
            ],
          },
        },
        {
          id: 'api-watchers',
          title: 'The watchers',
          typePrefix: 'LOOPS',
          subtitle: 'informers · scheduler · every kubelet',
          detail: {
            role: 'THE AUDIENCE',
            summary:
              'Everything event-driven on the Overview hangs off this stream: controller informers (Deployment, ReplicaSet, the CSI external-provisioner from the storage trace), the scheduler watching for unbound Pods, and each kubelet watching for Pods bound to its node. Every connection is OUTBOUND into the API server — nothing is pushed to nodes, which is why pod-spawning needs no Konnectivity tunnel: the kubelet was already listening.',
            sections: [
              { heading: 'Explore', commands: [
                '# Watch the stream yourself\noc get pods -w -n e-commerce-prod',
              ] },
            ],
          },
        },
      ],
    },
  ],
}

export const DEEP_DIVES = [SYSTEMD, LINUX_BOOT, HCP_BOOT, HCP_INSTALL, API_REQUEST_PATH, TMUX_SUDO, LINUX_FDS]

export const findDeepDive = (topicId) =>
  DEEP_DIVES.find((t) => t.topicId === topicId) || null

// Flatten a topic's zone tree into a { boxId: { box, accent } } map so the tab
// can resolve a clicked box id to its detail + colour without re-walking.
export function indexTopicBoxes(topic) {
  const out = {}
  const add = (box, accent, zone, parentId) => {
    out[box.id] = { box, accent, zone, parentId }
    // Reveal-in-place sub-steps share their parent's zone accent and resolve
    // here too, so clicking one opens its detail popup like any other box.
    box.reveal?.boxes?.forEach((child) => add(child, accent, zone, box.id))
  }
  const walk = (zones) => {
    for (const zone of zones) {
      const accent = `var(--${zone.colorVar || topic.colorVar || 'k-cyan'})`
      zone.boxes?.forEach((box) => add(box, accent, zone))
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(topic.zones || [])
  return out
}
