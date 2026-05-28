// Linux / OS / virtualisation primitive definitions shown in the DetailPanel,
// keyed by component typePrefix.  Each entry carries its own label, description,
// bullet interactions, and optional shell commands so DetailPanel needs no
// lookup into components.json for this section.

export const PRIMITIVES_BY_TYPE = {

  // ── Container-based components (Pod, Static Pod) ────────────────────────
  Pod: {
    sectionTitle: 'Kernel Primitives',
    color: '#10b981',
    items: [
      {
        id: 'pod-netns',
        label: 'Network Namespace',
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
        id: 'pod-cgroups',
        label: 'cgroups v2',
        description:
          'Enforces the CPU, memory, and I/O resource limits declared in the Pod spec. The container runtime translates requests/limits into cgroup knobs so the kernel can account for and cap resource usage per container.',
        interactions: [
          'Hierarchy is created by CRI-O/runc at container start under /sys/fs/cgroup/<pod-slice>.',
          'Kubelet polls cgroup stats and reports resource consumption back to the API server.',
          'If memory.max is breached the kernel OOM-killer terminates the container process.',
        ],
        commands: [
          '# Find the cgroup path for a container\ncrictl inspect <container_id> | jq .info.runtimeSpec.linux.cgroupsPath',
          '# Check memory limit and current usage\ncat /sys/fs/cgroup/<cgroup_path>/memory.max\ncat /sys/fs/cgroup/<cgroup_path>/memory.current',
          '# Check CPU quota\ncat /sys/fs/cgroup/<cgroup_path>/cpu.max',
        ],
      },
      {
        id: 'container-process',
        label: 'PID 1 · Process',
        description:
          'The application binary running as PID 1 inside the container\'s PID namespace. It is the terminal point of the entire HCP ownership chain — from the external client request down through every networking and runtime layer.',
        interactions: [
          'Runs at the intersection of its own network namespace, cgroup slice, and PID namespace.',
          'Receives inbound socket connections on the Pod\'s private ClusterIP.',
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

  // ── systemd-managed OS daemons ───────────────────────────────────────────
  systemd: {
    sectionTitle: 'OS Primitives',
    color: '#f59e0b',
    items: [
      {
        id: 'systemd-unit',
        label: 'systemd Unit',
        description:
          'A declarative .service unit file that tells systemd — PID 1 on RHCOS — how to start, stop, restart, and health-check this daemon. Unit dependencies (After=, Requires=, Wants=) enforce the correct boot ordering across all node services.',
        interactions: [
          'Unit state transitions (activating → active → failed) are tracked atomically by the systemd state machine.',
          'Restart= and RestartSec= policies govern automatic recovery after a crash.',
          'Socket-activated variants start the daemon on-demand when the first connection arrives.',
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
          'systemd automatically places each service in its own cgroup hierarchy slice, giving the kernel a stable handle for per-service resource accounting. This is separate from the Pod cgroups managed by the container runtime above it.',
        interactions: [
          'CPU and memory limits can be set in the unit file via CPUQuota= and MemoryMax=.',
          'All child processes forked by the daemon inherit the slice automatically.',
          'Visible at /sys/fs/cgroup/system.slice/<unit>.service on the host.',
        ],
        commands: [
          '# Show the cgroup tree for a service\nsystemd-cgls /system.slice/<unit>.service',
          '# Live resource usage\nsystemd-cgtop -d 1',
        ],
      },
      {
        id: 'daemon-process',
        label: 'Daemon Process',
        description:
          'The long-running kernel process spawned by systemd. Unlike a containerised process it runs directly in the host\'s root PID namespace (unless explicitly sandboxed) and communicates with the kernel via direct syscalls, netlink sockets, and device files.',
        interactions: [
          'Writes structured log lines to the systemd journal (journalctl -u).',
          'Communicates with the kernel via netlink, ioctls, and /proc without a container shim.',
          'Has full access to the host filesystem unless restricted by systemd\'s ProtectSystem= or ReadOnlyPaths= directives.',
        ],
        commands: [
          '# Show process details\nps aux | grep <daemon-name>',
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
          'tap0 connects into the host OVS br-int bridge, placing the VM inside the same OVN overlay as host Pods.',
        ],
        commands: [
          '# Confirm vhost-net module is loaded\nlsmod | grep vhost',
          '# Show tap interface connected to this VM\nip link show tap0',
          '# Verify OVS port for the tap\novs-vsctl show | grep -A3 tap0',
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
  'pod-netns', 'pod-cgroups', 'container-process',
  'systemd-unit', 'cgroup-slice', 'daemon-process',
  'kvm-vcpu', 'qemu-process', 'vhost-net',
])
