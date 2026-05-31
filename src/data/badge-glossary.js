// Short explanations shown when a badge chip is clicked in the DetailPanel.
// Keys must match badge label strings exactly (case-sensitive).
export const BADGE_GLOSSARY = {
  'HTTPS :443':
    'Port 443 is the standard HTTPS port. All external traffic arrives here encrypted. For control-plane / API traffic the Shared Ingress Proxy reads only the TLS SNI and passes the connection through (TLS terminates at the guest kube-apiserver, which needs the client cert for mTLS auth); for *.apps application traffic TLS is terminated by the guest cluster\'s own Ingress Router.',
  'TLS 1.3':
    'Transport Layer Security 1.3 — the current standard for encrypting data in transit. Provides forward secrecy and faster 1-RTT handshakes compared to TLS 1.2.',
  'ClusterVersion CR':
    'Custom Resource that tracks the current and target OpenShift release version. The Cluster Version Operator reads this object to drive cluster-wide upgrades.',
  ':6443':
    'Default Kubernetes API server port. Every kubectl/oc command targeting the guest cluster reaches this endpoint; it handles authn, authz, admission, and state persistence to etcd.',
  'gRPC':
    'Google Remote Procedure Call — a high-performance, binary-framed protocol. Used internally for API server ↔ etcd communication, kubelet ↔ CRI-O (container runtime), and Konnectivity tunnels.',
  'OAuth2':
    'Open Authorization 2.0 — the protocol for token-based user authentication. The Guest OAuth Server issues short-lived bearer tokens that the API server validates on every request.',
  'Controllers':
    'Kubernetes control loops that continuously watch the API server for desired-state changes and reconcile the actual state to match (e.g. ReplicaSet, Deployment, Service, and Endpoint controllers).',
  'Bindings':
    'Scheduler decisions written back to the API server as Binding objects, assigning a pending Pod to a specific node. Once bound, the kubelet on that node pulls and starts the containers.',
  'Static Manifest':
    'A Static Pod is defined by a YAML file in /etc/kubernetes/manifests on the node. The kubelet — not the scheduler — watches this directory and runs the Pod directly, which is how the management cluster bootstraps its own control plane before any API server is available.',
  'Raft':
    'Consensus algorithm used by etcd to replicate writes across cluster members. A write is only committed once a majority quorum acknowledges it, guaranteeing consistency under partial failures.',
  'HAProxy':
    'High-Availability Proxy — the load-balancer engine inside OpenShift\'s Ingress Router. It reads Route CRs and dynamically updates its backends to route HTTP/HTTPS traffic to matching services.',
  'Route CR':
    'OpenShift-specific resource that maps a public hostname to a backend Service. The Ingress Router watches Route objects and programs HAProxy rules so external traffic reaches the right Pod.',
  'SNI routing':
    'The Shared Ingress Proxy selects a hosted cluster\'s control-plane backend by reading the TLS Server Name Indication (SNI) hostname and passing the connection through unterminated. Its backends come from each HostedCluster\'s control-plane endpoints (kube-apiserver, OAuth, Konnectivity, Ignition), not from OpenShift Route objects.',
  'Northbound DB':
    'OVN\'s logical network database. Stores high-level constructs (logical switches, routers, load balancers, ACLs). ovn-controller on each node translates these into low-level OpenFlow rules on the OVS bridge.',
  'Cloud API':
    'The infrastructure API the Cloud Controller Manager reconciles against. On this KubeVirt platform there is no external cloud — the kubevirt cloud provider plays that role, mirroring the guest\'s router-default LoadBalancer onto an infra-side Service and reporting VMI node addresses back to the guest API server.',
  'Tunnel :8091':
    'Konnectivity Server listens on port 8091 for persistent gRPC connections from Konnectivity Agents running inside the guest nodes. This tunnel lets the bare metal cluster API server reach Pods behind the NAT boundary.',
  'Bootstrap':
    'Ignition bootstrap payload delivered to a new worker node on its very first boot. Provides OS-level configuration: certificates, kubelet settings, pull secrets, and systemd unit files needed to join the cluster.',
  'DNS :53':
    'Standard DNS port. CoreDNS intercepts all in-cluster DNS queries and resolves service hostnames (e.g. my-svc.my-ns.svc.cluster.local) to ClusterIP addresses, enabling service discovery.',
  'Prometheus':
    'Time-series metrics database. Cluster Monitoring scrapes metrics from all components via /metrics endpoints, stores them, and evaluates alerting rules that feed PagerDuty or on-call dashboards.',
  'CRI client':
    'Container Runtime Interface client. Kubelet speaks the CRI gRPC protocol to ask the container runtime (CRI-O) to create, start, stop, and inspect containers — without knowing the runtime\'s internals.',
  'OCI':
    'Open Container Initiative — standards body that defines the image format and runtime spec. CRI-O uses OCI-compliant runtimes (runc or crun) to launch the actual container process.',
  'br-int':
    'OVS integration bridge. All container veth pairs plug into br-int; OVN-generated OpenFlow rules installed on this bridge implement network policies, service load balancing, and packet routing.',
  'OpenFlow':
    'Protocol for programming flow tables on an Open vSwitch bridge. OVN-Kubernetes compiles logical network policies into OpenFlow rules that br-int evaluates for every packet.',
  'CNI':
    'Container Network Interface — the plugin API kubelet invokes when a Pod starts. The CNI plugin (OVN-Kubernetes here) sets up the Pod\'s network namespace, assigns an IP, and installs routes.',
  'QEMU/KVM':
    'QEMU is the machine emulator; KVM is the Linux kernel\'s built-in hypervisor. Together they run the guest worker node as a full VM with near-native CPU performance via hardware virtualisation extensions.',
  'tap0':
    'A virtual network tap device inside the KubeVirt launcher container that backs the guest\'s virtio NIC. With KubeVirt\'s default masquerade binding it attaches to a pod-local bridge (k6t-eth0) with NAT — it is the launcher Pod\'s own eth0 veth that actually plugs into the host OVS br-int bridge, so the VM rides the same OVN overlay as host Pods.',
  'virtio-net':
    'Para-virtualised network driver used by the guest VM\'s kernel. Much lower overhead than emulated hardware because the guest and host cooperate directly through a shared ring buffer, bypassing device emulation.',
  'e-commerce-prod':
    'The Kubernetes namespace where the sample front-end and back-end application Pods run. Namespaces provide resource isolation, RBAC boundaries, and NetworkPolicy scoping.',
  ':8080':
    'HTTP port exposed by the front-end application container. The Ingress Router forwards external HTTP/HTTPS traffic to this port after matching the incoming hostname against the Route CR.',
  ':3000':
    'HTTP port exposed by the back-end application container. Typically reachable only via cluster-internal Service DNS from the front-end Pod.',
  'Tunnel':
    'Persistent gRPC tunnel maintained by the Konnectivity Agent. Allows the bare metal cluster API server to initiate connections to Pods and exec/port-forward endpoints inside the guest VM network.',
  'LoadBalancer':
    'Service type that asks the platform for an externally-reachable IP and spreads traffic across the Service\'s backend Pods. There is no cloud here, so MetalLB hands out the IP and advertises it on the local network.',
  'ClusterIP':
    'Default Service type — a stable virtual IP reachable only inside the cluster. OVN load-balancer flows DNAT it to one of the backing Pods, giving callers a single address that survives Pod churn.',
  'MetalLB L2':
    'Bare-metal load-balancer running in Layer-2 mode: it assigns LoadBalancer Services an external IP and advertises ownership of it via ARP/NDP on the local segment, standing in for a cloud load balancer.',
  'StatefulSet':
    'Application controller for Pods that need a stable identity and their own storage — ordered names and per-Pod PersistentVolumes. Used here so each etcd member keeps its own data across restarts.',
  'RHCOS':
    'Red Hat Enterprise Linux CoreOS — the immutable, container-optimised OS the guest worker node VM boots. Updates ship as whole-image swaps driven by Ignition, not in-place package upgrades.',
  'OVN ACL':
    'Access-control rule in OVN\'s logical database. A NetworkPolicy compiles into ACLs that br-int enforces as allow/drop OpenFlow rules evaluated on every packet.',
}

// A badge label that is an apiGroup / apiVersion provenance stamp
// ("hypershift.openshift.io", "core/v1", "cluster.x-k8s.io", "apps/v1") rather
// than a concept or a vital stat. These are lowercase dotted/slashed
// identifiers with no spaces — distinct from concept badges ("gRPC", "TLS 1.3")
// and config stats ("e-commerce-prod", "router-default"), which carry capitals,
// spaces, or no dot/slash. The detail modal lifts these out of the badge row
// into a quiet metadata line instead of a clickable chip.
export function isApiGroupStamp(label) {
  return /^[a-z0-9][a-z0-9./-]*[./][a-z0-9][a-z0-9./-]*$/.test(label)
}
