// Linux / OS / virtualisation primitive definitions shown in the DetailPanel,
// keyed by component typePrefix.  Each entry carries its own label, description,
// bullet interactions, and optional shell commands so DetailPanel needs no
// lookup into components.json for this section.

export const PRIMITIVES_BY_TYPE = {

  // ── Container-based components (Pod, Static Pod) ────────────────────────
  // `scope` splits these into the two real boundaries the kernel enforces:
  //   'pod'       — held open by the pause (sandbox) container and shared by
  //                 every container in the Pod: the network namespace + the veth
  //                 that plugs it into the node, the IPC and UTS namespaces, and
  //                 the Pod-level cgroup slice that caps the Pod's aggregate.
  //   'container' — created fresh per container: its mount and PID namespaces,
  //                 its own cgroup nested under the Pod slice, and the SELinux
  //                 MCS label, seccomp filter, and capability set that guard its
  //                 PID-1 process.
  // The pipeline tree (pipeline-model.js) reads this to label the two groups.
  Pod: {
    sectionTitle: 'Kernel Primitives',
    color: '#10b981',
    items: [
      {
        id: 'pod-netns',
        label: 'Network Namespace',
        scope: 'pod',
        description:
          'Gives the container its own private network stack — a dedicated IP address, routing table, and iptables chains — fully isolated from the host and other Pods. Created by the CNI plugin when the Pod sandbox initialises.',
        interactions: [
          'Attached to a veth pair whose host-side peer lives in the root netns and plugs into the OVS br-int bridge.',
          'Traffic leaving the Pod crosses the veth boundary, where OVN-generated OpenFlow rules apply NAT, ACLs, and routing.',
          'oc exec / kubectl exec enters this namespace to run in-container commands.',
        ],
        commands: [
          '# Find the container PID, then enter its network namespace\nPID=$(crictl inspect <container_id> | jq .info.pid)\nnsenter -t $PID -n ip addr show',
          '# Capture Pod traffic\nnsenter -t $PID -n tcpdump -i eth0 -n',
        ],
      },
      {
        id: 'pod-veth',
        label: 'veth Pair (eth0)',
        scope: 'pod',
        description:
          "A virtual Ethernet (veth) pair connecting the Pod to the node network — the Pod's eth0 is one end; its peer lives in the host root netns and is enslaved to the OVS integration bridge br-int, stitching the Pod's private network namespace into the node's OVN datapath. Created by the CNI plugin (OVN-Kubernetes) when the Pod sandbox is set up.",
        interactions: [
          'The in-namespace end is eth0 inside the Pod; the host-side peer (ovn-…) is a port on br-int.',
          'A packet sent on eth0 emerges on the host peer, where OVN OpenFlow rules apply routing, NAT, and ACLs.',
          'Created once for the Pod sandbox (the pause container) and shared by every container in the Pod.',
        ],
        commands: [
          "# Find the Pod's eth0 and its peer ifindex\nPID=$(crictl inspect <container_id> | jq .info.pid)\nnsenter -t $PID -n ip -d link show eth0",
          '# Match the host-side veth to its OVS port\nip link | grep <peer_ifindex>\novs-vsctl show | grep -B2 <veth-name>',
        ],
      },
      {
        id: 'pod-ipcns',
        label: 'IPC Namespace',
        scope: 'pod',
        description:
          "The Pod's private inter-process communication (IPC) space — the shared-memory segments, semaphores, and message queues Linux processes use to talk on one host without a network socket.",
        interactions: [
          'Held open by the pause (sandbox) container and joined by every container in the Pod, so sidecars can share data through /dev/shm.',
          'Created with the Pod sandbox via clone(CLONE_NEWIPC).',
          'Backs the /dev/shm tmpfs mount; its size is governed by the Pod’s shared-memory settings.',
          "Isolates this Pod's semaphores, message queues, and shared-memory segments from other Pods and the host.",
        ],
        commands: [
          "# List the Pod's System V IPC objects from inside its IPC namespace\nPID=$(crictl inspect <container_id> | jq .info.pid)\nnsenter -t $PID -i ipcs",
          '# Show the shared-memory tmpfs the namespace backs\nnsenter -t $PID -m df -h /dev/shm',
        ],
      },
      {
        id: 'pod-utsns',
        label: 'UTS Namespace',
        scope: 'pod',
        description:
          "Isolates the hostname and NIS domain name, so the Pod reports its own hostname (its Pod name) rather than the node's — and every container in the Pod sees the same one. Held open by the pause (sandbox) container and shared across the Pod.",
        interactions: [
          'Created with the sandbox via clone(CLONE_NEWUTS); the kubelet sets the hostname to the Pod name (or spec.hostname).',
          'Shared by every container in the Pod, so `hostname` returns an identical value across them.',
          'Independent of the network namespace — changing the UTS hostname does not change DNS resolution or the Pod IP.',
        ],
        commands: [
          '# Show the hostname the Pod sees\nPID=$(crictl inspect <container_id> | jq .info.pid)\nnsenter -t $PID -u hostname',
        ],
      },
      {
        id: 'pod-cgroup-slice',
        label: 'Pod cgroup Slice',
        scope: 'pod',
        description:
          "The pod-level cgroups v2 slice the kubelet creates for the whole Pod — kubepods.slice/<qos>/pod<uid>.slice, under the Pod's QoS class (Guaranteed / Burstable / BestEffort). It caps the Pod's *aggregate* CPU, memory, and I/O and is the parent of every per-container cgroup nested beneath it, so the containers can never collectively exceed the Pod's budget.",
        interactions: [
          "Created by the kubelet (not the runtime) when the sandbox is set up, under the slice matching the Pod's QoS class.",
          "Each container's own cgroup is nested inside this slice, so per-container limits roll up into the Pod total.",
          'memory.max here caps the whole Pod; breaching it lets the kernel OOM-killer terminate a container in the Pod.',
        ],
        commands: [
          '# Show the Pod-level slice (the parent of the container cgroups)\nsystemd-cgls /kubepods.slice | grep pod<uid>',
          '# Aggregate memory limit for the whole Pod\ncat /sys/fs/cgroup/kubepods.slice/.../kubepods-pod<uid>.slice/memory.max',
        ],
      },
      {
        id: 'pod-mountns',
        label: 'Mount Namespace',
        scope: 'container',
        description:
          "Gives the container its own view of the filesystem — an overlayfs root built from the image layers, with each volume bind-mounted in: Secrets and ConfigMaps as in-memory tmpfs files, PersistentVolumeClaims as real block-device mounts. Isolated from the host and from other Pods.",
        interactions: [
          'CRI-O assembles the overlay rootfs and bind-mounts every projected volume before the container starts.',
          'Secret / ConfigMap volumes are tmpfs (RAM) so they never touch disk; PVCs are kernel block mounts.',
          'oc exec enters this namespace to see the container-private filesystem.',
        ],
        commands: [
          '# Enter the mount namespace and list the container mounts\nnsenter -t $PID -m mount',
          '# Inspect the overlay rootfs path\ncrictl inspect <container_id> | jq .info.runtimeSpec.root.path',
        ],
      },
      {
        id: 'pod-pidns',
        label: 'PID Namespace',
        scope: 'container',
        description:
          "Gives the container its own process-ID space, so its entrypoint runs as PID 1 and can only see and signal its own descendants — never the host's processes or those of other containers. Per-container by default; setting spec.shareProcessNamespace: true makes all containers in the Pod share one instead.",
        interactions: [
          'Created per container by the runtime via clone(CLONE_NEWPID); the entrypoint becomes PID 1 inside it.',
          'PID 1 reaps zombies and receives termination signals — a process that ignores SIGTERM stalls Pod shutdown until the grace period expires.',
          "With shareProcessNamespace: true the pause container is PID 1 and every container can see the others' processes.",
        ],
        commands: [
          "# Show the container's isolated process tree (its own PID 1)\nPID=$(crictl inspect <container_id> | jq .info.pid)\nnsenter -t $PID -p ps -ef",
        ],
      },
      {
        id: 'pod-cgroups',
        label: 'Container cgroup',
        scope: 'container',
        description:
          "The per-container cgroups v2 the runtime (crun/runc) creates *beneath* the Pod slice — one for each container — enforcing that single container's own CPU, memory, and I/O requests and limits. Nested inside the Pod slice, so its usage rolls up into the Pod's aggregate budget.",
        interactions: [
          'Hierarchy is created by CRI-O/crun at container start, nested under the Pod slice at /sys/fs/cgroup/<pod-slice>/crio-<id>.',
          'Kubelet polls cgroup stats and reports resource consumption back to the API server.',
          'If this container’s memory.max is breached the kernel OOM-killer terminates its process.',
        ],
        commands: [
          '# Find the cgroup path for a container\ncrictl inspect <container_id> | jq .info.runtimeSpec.linux.cgroupsPath',
          '# Check memory limit and current usage\ncat /sys/fs/cgroup/<cgroup_path>/memory.max\ncat /sys/fs/cgroup/<cgroup_path>/memory.current',
          '# Check CPU quota\ncat /sys/fs/cgroup/<cgroup_path>/cpu.max',
        ],
      },
      {
        id: 'pod-selinux',
        label: 'SELinux MCS Label',
        scope: 'container',
        description:
          "A unique SELinux Multi-Category Security label per container — e.g. system_u:system_r:container_t:s0:c14,c742 — tagged onto its process and files. The kernel's SELinux LSM only permits access between matching categories, so even a container escape can't read another Pod's files.",
        interactions: [
          'CRI-O assigns each container a unique pair of MCS categories (c<NN>,c<MM>) at start.',
          "The kernel denies any access whose label categories don't match and logs an AVC denial.",
          "Mounted volumes are relabelled to the container's context so the process can read them.",
        ],
        commands: [
          "# Show the container process's SELinux context\nps -eZ | grep container_t",
          '# Watch for AVC denials on the host node\nausearch -m avc -ts recent',
          "# View a Pod's requested SELinux options\noc get pod <pod> -n <ns> -o jsonpath='{.spec.securityContext.seLinuxOptions}'",
        ],
      },
      {
        id: 'pod-seccomp',
        label: 'seccomp Profile',
        scope: 'container',
        description:
          "A seccomp-BPF syscall filter the kernel attaches to the container's processes, restricting which of the ~350 Linux system calls they may make. OpenShift applies the RuntimeDefault profile by default, blocking dangerous calls (mount, ptrace, kexec, …) so a compromised process has a far smaller kernel attack surface.",
        interactions: [
          'CRI-O loads the profile’s BPF program and attaches it at container exec (no_new_privs + SECCOMP_SET_MODE_FILTER).',
          "A blocked syscall returns EPERM or kills the process, per the profile's default action.",
          'Set per workload via spec.securityContext.seccompProfile; RuntimeDefault is the cluster default under the restricted-v2 SCC.',
        ],
        commands: [
          "# Check the seccomp mode of the container's process (2 = filtered)\nPID=$(crictl inspect <container_id> | jq .info.pid)\ngrep Seccomp /proc/$PID/status",
          "# View a Pod's requested seccomp profile\noc get pod <pod> -n <ns> -o jsonpath='{.spec.securityContext.seccompProfile}'",
        ],
      },
      {
        id: 'pod-capabilities',
        label: 'Linux Capabilities',
        scope: 'container',
        description:
          "The kernel splits root's power into ~40 distinct capabilities (CAP_NET_ADMIN, CAP_SYS_ADMIN, …); the runtime sets the container's bounding and effective sets from the Pod spec. OpenShift's restricted-v2 SCC drops ALL capabilities by default, so even a process running as uid 0 inside the container holds almost none of root's real privileges.",
        interactions: [
          'crun applies the cap sets from config.json after creating the namespaces and before exec — the drop happens at container start.',
          'A dropped capability makes its guarded syscall fail with EPERM regardless of the process UID.',
          "Workloads request extras via securityContext.capabilities.add, gated by the namespace's SCC / Pod Security admission.",
        ],
        commands: [
          '# Decode the effective capability set of the container process\nPID=$(crictl inspect <container_id> | jq .info.pid)\ngrep CapEff /proc/$PID/status\n# capsh --decode=<CapEff hex value>',
        ],
      },
      {
        id: 'container-process',
        label: 'PID 1 · Process',
        scope: 'container',
        description:
          'The application binary running as PID 1 inside the container\'s PID namespace. It is the terminal point of the entire HCP ownership chain — from the external client request down through every networking and runtime layer.',
        interactions: [
          "Joins the namespaces held open by the Pod's pause (sandbox) container — the pause process itself just holds them and sleeps; this is the container that actually does the work.",
          'Runs at the intersection of its own network namespace, cgroup slice, and PID namespace.',
          'Receives inbound socket connections on the Pod\'s private Pod IP (a ClusterIP is a Service VIP, not the Pod\'s own address).',
          'stdout/stderr are captured by the container runtime and forwarded to oc logs.',
        ],
        commands: [
          '# Exec directly into the container\noc exec -it <pod-name> -n <ns> -- /bin/sh',
          '# Check the process tree\noc exec <pod-name> -n <ns> -- ps aux',
          '# List listening sockets\noc exec <pod-name> -n <ns> -- ss -tlnp',
        ],
      },
    ],
  },

  // ── systemd-managed OS services ──────────────────────────────────────────
  systemd: {
    sectionTitle: 'OS Primitives',
    color: '#f59e0b',
    items: [
      {
        id: 'systemd-unit',
        label: 'systemd Unit',
        description:
          'A declarative .service unit file that tells systemd — PID 1 on RHCOS — how to start, stop, restart, and health-check this service. Unit dependencies (After=, Requires=, Wants=) enforce the correct boot ordering across all node services.',
        interactions: [
          'Unit state transitions (activating → active → failed) are tracked atomically by the systemd state machine.',
          'Restart= and RestartSec= policies govern automatic recovery after a crash.',
          'Socket-activated variants start the service on-demand when the first connection arrives.',
        ],
        commands: [
          '# Check unit status\nsystemctl status <unit-name>',
          '# Follow live logs\njournalctl -u <unit-name> -f --no-pager',
          '# Force restart\nsystemctl restart <unit-name>',
        ],
      },
      {
        id: 'cgroup-slice',
        label: 'cgroup Slice',
        description:
          "systemd automatically places each service in its own cgroup hierarchy slice, giving the kernel a stable handle for per-service resource accounting. It is the host-service analogue of a Pod's cgroup slice — but parented under system.slice and supervised by PID 1 directly, never by the kubelet.",
        interactions: [
          'CPU and memory limits can be set in the unit file via CPUQuota= and MemoryMax=.',
          'All child processes forked by the service inherit the slice automatically.',
          'Visible at /sys/fs/cgroup/system.slice/<unit>.service on the host.',
        ],
        commands: [
          '# Show the cgroup tree for a service\nsystemd-cgls /system.slice/<unit>.service',
          '# Live resource usage\nsystemd-cgtop -d 1',
        ],
      },
      {
        id: 'service-process',
        label: 'systemd Process',
        description:
          "The long-running kernel process spawned by systemd. Unlike a containerised process it runs directly in the host's root PID, network, and mount namespaces (unless a unit opts into sandboxing via PrivateTmp=, ProtectSystem=, or NetworkNamespacePath=) and communicates with the kernel via direct syscalls, netlink sockets, and device files.",
        interactions: [
          'Writes structured log lines to the systemd journal (journalctl -u).',
          'Communicates with the kernel via netlink, ioctls, and /proc without a container shim.',
          'Has full access to the host filesystem unless restricted by systemd\'s ProtectSystem= or ReadOnlyPaths= directives.',
        ],
        commands: [
          '# Show process details\nps aux | grep <service-name>',
          '# Inspect open file descriptors and sockets\nls -la /proc/<PID>/fd',
          '# View recent journal entries\njournalctl -u <unit-name> --since "5 min ago" --no-pager',
        ],
      },
    ],
  },

  // ── KubeVirt VirtualMachineInstance ─────────────────────────────────────
  VirtualMachineInstance: {
    sectionTitle: 'Virtualisation Primitives',
    color: '#7c3aed',
    items: [
      {
        id: 'kvm-vcpu',
        label: 'KVM vCPU',
        description:
          'The Linux Kernel-based Virtual Machine module (/dev/kvm) provides hardware-assisted virtualisation using Intel VT-x or AMD-V CPU extensions. Each guest vCPU is a host kernel thread that runs guest machine code at near-native speed, exiting to the hypervisor only for privileged instructions.',
        interactions: [
          'QEMU opens /dev/kvm and issues KVM_CREATE_VCPU ioctls to create virtual CPUs.',
          'VM exits fire when the guest executes privileged instructions; KVM handles or delegates each exit to QEMU.',
          'vCPU threads are scheduled by the Linux Completely Fair Scheduler alongside normal host threads.',
        ],
        commands: [
          '# Verify KVM is active on the host node\nlsmod | grep kvm',
          '# List running VMs and their vCPU count\nvirsh list --all',
          '# View vCPU statistics\nvirsh vcpuinfo <domain-name>',
        ],
      },
      {
        id: 'qemu-process',
        label: 'QEMU Process',
        description:
          'The userspace machine emulator process that owns all VM state: guest RAM allocation, device emulation, snapshot/migration. It hands off CPU execution to KVM but handles every device I/O that KVM cannot accelerate in-kernel.',
        interactions: [
          'Allocates guest RAM as anonymous mmap regions; KVM registers these as memory slots.',
          'Emulates virtio-net, virtio-blk, and other para-virtual devices, offloading data paths to vhost kernel threads.',
          'The KubeVirt virt-handler DaemonSet on the host monitors and manages this process lifecycle.',
        ],
        commands: [
          '# Find the QEMU process for this VM (from inside the launcher pod)\nps aux | grep qemu',
          '# Inspect QEMU monitor\noc exec -n <hcp-namespace> <launcher-pod> -- virsh qemu-monitor-command <domain> --hmp info status',
          '# View VM memory layout\noc exec -n <hcp-namespace> <launcher-pod> -- cat /proc/<QEMU_PID>/maps | grep -i anon | head -20',
        ],
      },
      {
        id: 'vhost-net',
        label: 'vhost-net',
        description:
          'A kernel-mode acceleration path for virtio-net that moves the network data plane entirely into the kernel, bypassing QEMU for packet forwarding. The guest virtio driver writes packets to a shared ring buffer processed by a dedicated vhost kernel thread.',
        interactions: [
          'Activated when QEMU opens /dev/vhost-net and passes the tap file descriptor to the kernel.',
          'The kernel vhost thread moves packets between the virtio ring and the tap0 device without QEMU involvement.',
          'With KubeVirt\'s default masquerade binding tap0 sits on a pod-local bridge (k6t-eth0) with NAT; the launcher Pod\'s eth0 veth is what plugs into the host OVS br-int bridge, placing the VM inside the same OVN overlay as host Pods.',
        ],
        commands: [
          '# Confirm vhost-net module is loaded\nlsmod | grep vhost',
          '# Show tap interface connected to this VM\nip link show tap0',
          '# Verify OVS port for the tap\novs-vsctl show | grep -A3 tap0',
        ],
      },
      {
        id: 'vmi-tap',
        label: 'tap0 / k6t-eth0 Bridge',
        description:
          "The guest's virtual NIC at the kernel level: QEMU's tap0 device sits on a Pod-local Linux bridge (k6t-eth0) inside the virt-launcher Pod. With KubeVirt's default masquerade binding the guest gets a private link to that bridge, NATed onto the launcher Pod's own eth0 — the veth that plugs into the host OVS br-int — so the VM rides the same OVN overlay as ordinary Pods without exposing its MAC to the node network.",
        interactions: [
          'virt-launcher creates the k6t-eth0 bridge and the tap0 device, then hands tap0’s file descriptor to QEMU.',
          'vhost-net moves packets between the virtio ring and tap0; masquerade NAT rules bridge tap0 ↔ the Pod’s eth0.',
          "From the host OVS view the VM is just the launcher Pod's veth port on br-int — the guest IP is hidden behind the Pod IP.",
        ],
        commands: [
          '# Show the tap device and pod-local bridge (inside the launcher pod)\noc exec -n <hcp-namespace> <launcher-pod> -- ip link show tap0\noc exec -n <hcp-namespace> <launcher-pod> -- bridge link',
          '# Match the launcher Pod veth to its OVS port on the host\novs-vsctl show | grep -A3 <pod-veth>',
        ],
      },
    ],
  },
}

// Static Pod is a container like any other Pod
PRIMITIVES_BY_TYPE['Static Pod'] = PRIMITIVES_BY_TYPE.Pod

// Convenience: the primitive component IDs that ARE the expandable entries
// (used to suppress the section on those entries themselves)
export const SELF_PRIMITIVE_IDS = new Set([
  'pod-netns', 'pod-veth', 'pod-ipcns', 'pod-utsns', 'pod-cgroup-slice',
  'pod-mountns', 'pod-pidns', 'pod-cgroups', 'pod-selinux', 'pod-seccomp',
  'pod-capabilities', 'container-process',
  'systemd-unit', 'cgroup-slice', 'service-process',
  'kvm-vcpu', 'qemu-process', 'vhost-net', 'vmi-tap',
])
