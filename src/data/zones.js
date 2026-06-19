// Zone tree — top-to-bottom nested layout of the HCP cluster.
// Each zone may have `nodes` (rendered as NodeCards) and/or `zones` (nested sub-zones).

// A condensed replica of a bare-metal node, rendered as a real (bordered,
// labelled) node zone like the primary — but carrying only the components that
// move traffic *between* nodes: the OVN-K8s Node → Open vSwitch data-plane pair
// (programs br-int) plus the MetalLB speaker. Their componentIds are
// replica-scoped so each is unique in the DOM (the network overlay anchors a
// per-node gateway-router chip to each node's Open vSwitch); `mirror` points the
// detail popup at the canonical component's metadata, since the software is
// identical to the primary node's. Shown only when "All nodes" is toggled on
// (or the network overlay is active). See OverviewTab's renderZone.
function replicaCard(id, title, typePrefix, mirror, color, extra = {}) {
  return { id, title, typePrefix, mirror, badges: [], ...extra,
    replicaBadge: extra.replicaBadge,
    color,
  }
}

function guestRealizations(suffix, color) {
  return [
    replicaCard(`svc-frontend-${suffix}-flow`, 'Front-End LB flow', 'LB flow', 'svc-frontend', color),
    replicaCard(`svc-backend-${suffix}-flow`, 'Back-End LB flow', 'LB flow', 'svc-backend', color),
    replicaCard(`netpol-ecommerce-${suffix}-flow`, 'E-Commerce ACL flow', 'ACL flow', 'netpol-ecommerce', color),
    replicaCard(`svc-router-${suffix}-flow`, 'Router LB flow', 'LB flow', 'svc-router-internal-default', color),
  ]
}

function guestReplicaZone({ hostId, ordinal, colorVar }) {
  const color = `var(--${colorVar})`
  const suffix = hostId
  const workerNodes = [
    replicaCard(`kubelet-guest-${suffix}`, 'Kubelet', 'systemd', 'kubelet-guest', color),
    replicaCard(`crio-guest-${suffix}`, 'CRI-O', 'systemd', 'crio-guest', color),
    replicaCard(`ovn-node-guest-${suffix}`, 'OVN-K8s Node', 'Pod', 'ovn-node-guest', color, { programs: `ovs-guest-${suffix}` }),
    replicaCard(`ovs-guest-${suffix}`, 'Open vSwitch', 'systemd', 'ovs-guest', color, { realizes: guestRealizations(suffix, color) }),
    replicaCard(`konnectivity-agent-${suffix}`, 'Konnectivity Agent', 'Pod', 'konnectivity-agent', color),
    replicaCard(`coredns-node-${suffix}`, 'CoreDNS Node', 'Pod', 'coredns-node', color),
    replicaCard(`multus-guest-${suffix}`, 'Multus CNI', 'Pod', 'multus-guest', color),
    replicaCard(`tuned-guest-${suffix}`, 'Node Tuning (TuneD)', 'Pod', 'tuned-guest', color),
    replicaCard(`csi-node-guest-${suffix}`, 'CSI Node Driver', 'Pod', 'csi-node-guest', color),
    replicaCard(`frontend-application-pod-${suffix}`, 'Front-End Application', 'Pod', 'frontend-application-pod', color, { replicaBadge: `replica ${ordinal}/3` }),
    replicaCard(`backend-application-pod-${suffix}`, 'Back-End Application', 'Pod', 'backend-application-pod', color, { replicaBadge: `replica ${ordinal}/3` }),
  ]
  return {
    id: `guest-vm-zone-${suffix}`,
    componentId: `guest-worker-node-vm-${suffix}`,
    mirrorComponentId: 'guest-worker-node-vm',
    label: `Worker Node ${ordinal} · VirtualMachineInstance`,
    color,
    colorVar,
    nodes: workerNodes,
  }
}

function replicaNode({ id, title, colorVar, kind, ordinal }) {
  const c = `var(--${colorVar})`
  const isMaster = kind === 'master'
  const nodes = isMaster
    ? [
        replicaCard(`kubelet-${id}`, 'Kubelet', 'systemd', 'kubelet-master', c),
        replicaCard(`crio-${id}`, 'CRI-O', 'systemd', 'crio-master', c),
        replicaCard(`ovn-node-${id}`, 'OVN-K8s Node', 'Pod', 'ovn-node-master', c, { programs: `ovs-${id}` }),
        replicaCard(`ovs-${id}`, 'Open vSwitch', 'systemd', 'ovs-master', c),
        replicaCard(`metallb-${id}`, 'MetalLB Speaker', 'Pod', 'metallb-speaker-master', c),
        replicaCard(`mgmt-kube-apiserver-${id}`, 'Kube API Server', 'Static Pod', 'mgmt-kube-apiserver', c),
        replicaCard(`mgmt-etcd-${id}`, 'Etcd', 'Static Pod', 'mgmt-etcd', c),
        replicaCard(`mgmt-controller-manager-${id}`, 'Controller Manager', 'Static Pod', 'mgmt-controller-manager', c),
        replicaCard(`mgmt-scheduler-${id}`, 'Scheduler', 'Static Pod', 'mgmt-scheduler', c),
      ]
    : [
        replicaCard(`kubelet-${id}`, 'Kubelet', 'systemd', 'kubelet-host', c),
        replicaCard(`crio-${id}`, 'CRI-O', 'systemd', 'crio-host', c),
        replicaCard(`ovn-node-${id}`, 'OVN-K8s Node', 'Pod', 'ovn-node-host', c, { programs: `ovs-${id}` }),
        replicaCard(`ovs-${id}`, 'Open vSwitch', 'systemd', 'ovs-host', c),
        replicaCard(`metallb-${id}`, 'MetalLB Speaker', 'Pod', 'metallb-speaker-worker', c),
        replicaCard(`virt-handler-${id}`, 'KubeVirt virt-handler', 'Pod', 'virt-handler', c),
      ]
  return {
    id,
    label: title,
    color: c,
    colorVar,
    modeledReplica: true,
    nodes,
    zones: isMaster ? [] : [{
      id: `kubevirt-launcher-zone-${id}`,
      componentId: `kubevirt-launcher-${id}`,
      mirrorComponentId: 'kubevirt-launcher',
      label: `KubeVirt Launcher ${ordinal} · Pod`,
      color: 'var(--k-teal)',
      colorVar: 'k-teal',
      zones: [guestReplicaZone({ hostId: id, ordinal, colorVar: 'k-green' })],
    }],
  }
}

export const ZONES = [
  {
    id: 'client',
    label: 'Client',
    color: 'var(--k-cyan)',
    colorVar: 'k-cyan',
    // External to the cluster — hidden from the default overview, shown only
    // when an active trace flow involves a node inside this zone.
    traceOnly: true,
    nodes: [
      {
        id: 'external-client',
        title: 'External Client',
        typePrefix: 'Client',
        badges: [
          { label: 'HTTPS :443', color: 'var(--k-cyan)' },
          { label: 'TLS 1.3', color: 'var(--k-cyan)' },
        ],
      },
    ],
  },
  {
    id: 'management-context',
    label: 'Bare Metal Cluster',
    color: 'var(--k-blue)',
    colorVar: 'k-blue',
    hideWrapper: true,
    zones: [
      {
        id: 'master-node',
        label: 'Bare Metal Master Node',
        color: 'var(--k-blue)',
        colorVar: 'k-blue',
        // The cluster runs three masters; one is drawn in full and these two
        // render as condensed-but-real node zones after this one (replicaNode),
        // carrying just the inter-node network data plane.
        replicaNodes: [
          replicaNode({ id: 'master-2', title: 'master-2', colorVar: 'k-blue', kind: 'master', ordinal: 2 }),
          replicaNode({ id: 'master-3', title: 'master-3', colorVar: 'k-blue', kind: 'master', ordinal: 3 }),
        ],
        // The master node's own host-level agents — the same node stack every
        // bare metal node runs (mirrors the worker node), distinct from the
        // guest control-plane Pods it also hosts.
        nodes: [
          {
            id: 'kubelet-master',
            title: 'Kubelet',
            typePrefix: 'systemd',
            badges: [{ label: 'CRI client', color: 'var(--k-blue)' }],
          },
          {
            id: 'crio-master',
            title: 'CRI-O',
            typePrefix: 'systemd',
            badges: [
              { label: 'OCI', color: 'var(--k-blue)' },
              { label: 'gRPC', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'ovs-master',
            title: 'Open vSwitch',
            typePrefix: 'systemd',
            badges: [
              { label: 'br-int', color: 'var(--k-blue)' },
              { label: 'OpenFlow', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'ovn-node-master',
            title: 'OVN-K8s Node',
            typePrefix: 'Pod',
            // Stacks above the Open vSwitch it programs (see ServicePair).
            programs: 'ovs-master',
            badges: [{ label: 'CNI', color: 'var(--k-blue)' }],
          },
          // The MANAGEMENT cluster's own OVN control plane (ovnkube-control-plane).
          // In interconnect mode it's lightweight — it allocates each bare-metal
          // node its pod subnet; the NB/SB DBs live per-node in OVN-K8s Node. The
          // guest cluster has its own copy in the Guest Control Plane Namespace.
          {
            id: 'ovn-control-mgmt',
            title: 'OVN-K8s Master',
            typePrefix: 'Pod',
            badges: [{ label: 'control-plane', color: 'var(--k-sky)' }],
          },
          // MetalLB speaker — a DaemonSet Pod on every bare metal node. This is
          // the per-node L2 announcer: it answers ARP/NDP for the LoadBalancer
          // VIPs assigned by the MetalLB controller, so external traffic for the
          // guest's apps + control-plane LB Services lands on this cluster. It
          // runs in the management (bare metal) cluster, never inside a guest VM.
          {
            id: 'metallb-speaker-master',
            title: 'MetalLB Speaker',
            typePrefix: 'Pod',
            badges: [
              { label: 'DaemonSet', color: 'var(--k-blue)' },
              { label: 'ARP/NDP', color: 'var(--k-blue)' },
            ],
          },
          // MetalLB controller — the Deployment that watches LoadBalancer
          // Services and allocates VIPs from the pools, which the per-node
          // speakers then advertise. It lives in the metallb-system namespace,
          // but MetalLB is a node-level networking concern, so it sits here on
          // the node beside its speaker rather than in a separate namespace zone.
          {
            id: 'metallb-controller',
            title: 'MetalLB Controller',
            typePrefix: 'Pod',
            badges: [
              { label: 'Deployment', color: 'var(--k-amber)' },
              { label: 'IP allocation', color: 'var(--k-amber)' },
            ],
          },
          // The management (bare metal) cluster's OWN control plane, run by the
          // master kubelet from /etc/kubernetes/manifests — these sit directly
          // on the master node alongside its host agents.
          {
            id: 'mgmt-kube-apiserver',
            title: 'Kube API Server',
            typePrefix: 'Static Pod',
            badges: [
              { label: 'Static Manifest', color: 'var(--k-blue)' },
              { label: ':6443', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'mgmt-etcd',
            title: 'Etcd',
            typePrefix: 'Static Pod',
            badges: [
              { label: 'Static Manifest', color: 'var(--k-blue)' },
              { label: 'Raft', color: 'var(--k-blue)' },
            ],
            // Etcd is the single home for cluster *intent*: the Custom
            // Resources that declare desired infrastructure. These are
            // persisted records in the key-value store, not Linux
            // processes — so they live *inside* etcd rather than beside
            // real Pods. The overview renders this node as an expandable
            // "intent store" that reveals these objects on click.
            // Two intent threads persisted here: the HCP control-plane intent
            // (HostedCluster → HostedControlPlane) and the worker-provisioning
            // chain (NodePool → Cluster API → KubeVirt) that the operators
            // reconcile into the running control plane and guest worker VMs.
            // All are desired-state records, never rendered as cards.
            intentObjects: [
              {
                id: 'hostedcluster-cr',
                title: 'HostedCluster',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'hypershift.openshift.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'hostedcontrolplane-cr',
                title: 'HostedControlPlane',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'hypershift.openshift.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'nodepool-cr',
                title: 'NodePool',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'hypershift.openshift.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'capi-cluster-cr',
                title: 'Cluster (CAPI)',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'machinedeployment-cr',
                title: 'MachineDeployment',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'machineset-cr',
                title: 'MachineSet',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'machine-cr',
                title: 'Machine',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'kubevirtmachine-cr',
                title: 'KubevirtMachine',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'infrastructure.cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'kubevirt-vm-cr',
                title: 'VirtualMachine',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'kubevirt.io', color: 'var(--k-blue)' }],
              },
              // metallb.io config CRs — pure desired state the MetalLB controller
              // reconciles into VIP allocations and L2 advertisements. Namespaced
              // in metallb-system but persisted here in management etcd, so they
              // live in this intent store rather than as cards in that namespace.
              {
                id: 'metallb-ipaddresspool',
                title: 'IPAddressPool',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'metallb.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'metallb-l2advertisement',
                title: 'L2Advertisement',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'metallb.io', color: 'var(--k-blue)' }],
              },
            ],
          },
          {
            id: 'mgmt-controller-manager',
            title: 'Controller Manager',
            typePrefix: 'Static Pod',
            badges: [
              { label: 'Static Manifest', color: 'var(--k-blue)' },
              { label: 'Controllers', color: 'var(--k-blue)' },
            ],
            // The controller manager is a single binary hosting dozens of
            // independent control loops. Like the etcd intent store, those
            // loops are not separate Pods — they are reconciliation goroutines
            // sharing one process, so they get no sibling card and instead live
            // *inside* this node, revealed when it expands into a "controller
            // set". These loops keep the management cluster (including the guest
            // control-plane Deployments) reconciled to desired state.
            controllers: [
              {
                id: 'mgmt-ctrl-deployment',
                title: 'Deployment Controller',
                typePrefix: 'Controller',
                badges: [{ label: 'apps/v1 Deployment', color: 'var(--k-blue)' }],
              },
              {
                id: 'mgmt-ctrl-replicaset',
                title: 'ReplicaSet Controller',
                typePrefix: 'Controller',
                badges: [{ label: 'apps/v1 ReplicaSet', color: 'var(--k-blue)' }],
              },
              {
                id: 'mgmt-ctrl-node-lifecycle',
                title: 'Node Lifecycle Controller',
                typePrefix: 'Controller',
                badges: [{ label: 'core/v1 Node', color: 'var(--k-blue)' }],
              },
              {
                id: 'mgmt-ctrl-namespace',
                title: 'Namespace Controller',
                typePrefix: 'Controller',
                badges: [{ label: 'core/v1 Namespace', color: 'var(--k-blue)' }],
              },
              {
                id: 'mgmt-ctrl-serviceaccount',
                title: 'ServiceAccount Controller',
                typePrefix: 'Controller',
                badges: [{ label: 'core/v1 ServiceAccount', color: 'var(--k-blue)' }],
              },
              {
                id: 'mgmt-ctrl-pv',
                title: 'PersistentVolume Controller',
                typePrefix: 'Controller',
                badges: [{ label: 'core/v1 PersistentVolume', color: 'var(--k-blue)' }],
              },
            ],
          },
          {
            id: 'mgmt-scheduler',
            title: 'Scheduler',
            typePrefix: 'Static Pod',
            badges: [
              { label: 'Static Manifest', color: 'var(--k-blue)' },
              { label: 'Bindings', color: 'var(--k-blue)' },
            ],
          },
          // Cluster-wide management operator. One HyperShift Operator serves
          // every HostedCluster on the mgmt cluster. The HostedCluster and
          // NodePool CRs it reconciles are intent records — they live inside
          // the Management Etcd "intent store", not beside the operator Pod.
          {
            id: 'hypershift-operator',
            title: 'HyperShift Operator',
            typePrefix: 'Pod',
            badges: [{ label: 'cluster-wide', color: 'var(--k-blue)' }],
          },
        ],
        zones: [
          {
            id: 'guest-cp-namespace',
            label: 'Guest Control Plane Namespace',
            color: 'var(--k-sky)',
            colorVar: 'k-sky',
            dashed: true,
            nodes: [
              {
                id: 'control-plane-operator',
                title: 'Control Plane Operator',
                typePrefix: 'Pod',
                badges: [{ label: 'per-HCP owner', color: 'var(--k-sky)' }],
                // The CPO doubles as an "operator set": it deploys the control-
                // plane operands (the OpenShift API extension servers and the
                // HyperShift-specific controllers) into this HCP namespace.
                // Unlike the controller-manager loops or etcd records, each of
                // these IS a real, separate Deployment Pod — they are nested
                // here only to keep ~10 Pods off the primary canvas. Expanding
                // the node reveals them; see OperatorSetCard.jsx + ARCHITECTURE §2.
                operatorSetCaption:
                  'Per-HCP owner: the control-plane operands the CPO builds for THIS guest — each a separate Pod, grouped to keep the canvas legible. Open the CPO for the full picture.',
                operators: [
                  {
                    id: 'openshift-apiserver',
                    title: 'OpenShift API Server',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Routes · Projects · Images', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'openshift-oauth-apiserver',
                    title: 'OpenShift OAuth API Server',
                    typePrefix: 'Pod',
                    badges: [{ label: 'user.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'openshift-controller-manager',
                    title: 'OpenShift Controller Manager',
                    typePrefix: 'Pod',
                    badges: [{ label: 'builds · images · SCC', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'route-controller-manager',
                    title: 'Route Controller Manager',
                    typePrefix: 'Pod',
                    badges: [{ label: 'route.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'hosted-cluster-config-operator',
                    title: 'Hosted Cluster Config Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'guest config bridge', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'cluster-network-operator',
                    title: 'Cluster Network Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Network CR → OVN', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'multus-admission-controller',
                    title: 'Multus Admission Controller',
                    typePrefix: 'Pod',
                    badges: [{ label: 'net-attach-def webhook', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'cluster-policy-controller',
                    title: 'Cluster Policy Controller',
                    typePrefix: 'Pod',
                    badges: [{ label: 'SCC · quota', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'machine-approver',
                    title: 'Machine Approver',
                    typePrefix: 'Pod',
                    badges: [{ label: 'CSR auto-approve', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'cluster-autoscaler',
                    title: 'Cluster Autoscaler',
                    typePrefix: 'Pod',
                    badges: [{ label: 'NodePool scaling', color: 'var(--k-sky)' }],
                  },
                ],
              },
              {
                id: 'cluster-version-operator',
                title: 'Cluster Version Operator',
                typePrefix: 'Pod',
                badges: [{ label: 'ClusterVersion CR', color: 'var(--k-sky)' }],
                // The CVO doubles as an "operator set": it reconciles the
                // second-level OpenShift cluster operators from the release
                // payload, pinning each to the guest cluster's version. As with
                // the CPO above, every member here is a real, separate
                // Deployment Pod (each reports a ClusterOperator) — nested only
                // to keep the canvas legible, not because they share a process.
                operatorSetCaption:
                  'Release-payload owner: the standard cluster operators the CVO version-pins — each a separate Pod, grouped to keep the canvas legible. Open the CVO for the full picture.',
                operators: [
                  {
                    id: 'ingress-operator',
                    title: 'Ingress Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'IngressController CR', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'dns-operator',
                    title: 'DNS Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'DNS CR → CoreDNS', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'cluster-authentication-operator',
                    title: 'Authentication Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Authentication CR', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'cluster-storage-operator',
                    title: 'Storage Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'CSI drivers · StorageClass', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'csi-snapshot-controller',
                    title: 'CSI Snapshot Controller',
                    typePrefix: 'Pod',
                    badges: [{ label: 'VolumeSnapshot', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'cluster-image-registry-operator',
                    title: 'Image Registry Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Config (imageregistry)', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'cluster-node-tuning-operator',
                    title: 'Node Tuning Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Tuned CR · MachineConfig', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'olm-operator',
                    title: 'OLM Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'CSV · Subscription', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'catalog-operator',
                    title: 'Catalog Operator',
                    typePrefix: 'Pod',
                    badges: [{ label: 'CatalogSource · InstallPlan', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'packageserver',
                    title: 'Package Server',
                    typePrefix: 'Pod',
                    badges: [{ label: 'packages.operators API', color: 'var(--k-sky)' }],
                  },
                ],
              },
              {
                id: 'capi-manager',
                title: 'Cluster API Manager',
                typePrefix: 'Pod',
                badges: [{ label: 'Machines', color: 'var(--k-sky)' }],
              },
              {
                id: 'capk-provider',
                title: 'CAPI Provider (KubeVirt)',
                typePrefix: 'Pod',
                badges: [{ label: 'VirtualMachine', color: 'var(--k-sky)' }],
              },
              {
                id: 'guest-api-server',
                title: 'API Server',
                typePrefix: 'Pod',
                badges: [
                  { label: ':6443', color: 'var(--k-sky)' },
                  { label: 'gRPC', color: 'var(--k-sky)' },
                ],
              },
              {
                id: 'guest-oauth-server',
                title: 'OAuth Server',
                typePrefix: 'Pod',
                badges: [{ label: 'OAuth2', color: 'var(--k-sky)' }],
              },
              {
                id: 'guest-controller-manager',
                title: 'Controller Manager',
                typePrefix: 'Pod',
                badges: [{ label: 'Controllers', color: 'var(--k-sky)' }],
                // Same model as the management controller manager above: one
                // kube-controller-manager binary hosting many control loops
                // (goroutines, not Pods). Expanding this node into a "controller
                // set" reveals the loops that keep the *guest* cluster reconciled
                // to the desired-state records held in Guest Etcd.
                controllers: [
                  {
                    id: 'guest-ctrl-node-lifecycle',
                    title: 'Node Lifecycle Controller',
                    typePrefix: 'Controller',
                    badges: [{ label: 'core/v1 Node', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'guest-ctrl-deployment',
                    title: 'Deployment Controller',
                    typePrefix: 'Controller',
                    badges: [{ label: 'apps/v1 Deployment', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'guest-ctrl-replicaset',
                    title: 'ReplicaSet Controller',
                    typePrefix: 'Controller',
                    badges: [{ label: 'apps/v1 ReplicaSet', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'guest-ctrl-endpointslice',
                    title: 'EndpointSlice Controller',
                    typePrefix: 'Controller',
                    badges: [{ label: 'discovery.k8s.io EndpointSlice', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'guest-ctrl-serviceaccount',
                    title: 'ServiceAccount Controller',
                    typePrefix: 'Controller',
                    badges: [{ label: 'core/v1 ServiceAccount', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'guest-ctrl-pv',
                    title: 'PersistentVolume Controller',
                    typePrefix: 'Controller',
                    badges: [{ label: 'core/v1 PersistentVolume', color: 'var(--k-sky)' }],
                  },
                ],
              },
              {
                id: 'guest-kube-scheduler',
                title: 'Scheduler',
                typePrefix: 'Pod',
                badges: [{ label: 'Bindings', color: 'var(--k-sky)' }],
              },
              {
                id: 'guest-etcd',
                title: 'Etcd',
                typePrefix: 'Pod',
                badges: [
                  { label: 'StatefulSet', color: 'var(--k-sky)' },
                  { label: 'Raft', color: 'var(--k-sky)' },
                ],
                // Guest Etcd is also an intent store: it persists the guest
                // cluster's OWN API objects — the records that have no
                // data-plane card on the overview (ClusterVersion/Operator,
                // Route, the application Deployment→ReplicaSet chain, its
                // Secrets/ConfigMaps/PVCs/PVs and the EndpointSlices behind its
                // Services). Realized Services & the NetworkPolicy keep their
                // own cards; these pure records live in here.
                intentObjects: [
                  {
                    id: 'clusterversion-cr',
                    title: 'ClusterVersion',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'clusteroperator-cr',
                    title: 'ClusterOperator',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'route-cr',
                    title: 'Route',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'route.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'deployment-application',
                    title: 'Deployment',
                    typePrefix: 'API Object',
                    badges: [{ label: 'apps/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'replicaset-application',
                    title: 'ReplicaSet',
                    typePrefix: 'API Object',
                    badges: [{ label: 'apps/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'secret-application',
                    title: 'Secret',
                    typePrefix: 'API Object',
                    badges: [{ label: 'core/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'configmap-application',
                    title: 'ConfigMap',
                    typePrefix: 'API Object',
                    badges: [{ label: 'core/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'pvc-application',
                    title: 'PersistentVolumeClaim',
                    typePrefix: 'API Object',
                    badges: [{ label: 'core/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'pv-application',
                    title: 'PersistentVolume',
                    typePrefix: 'API Object',
                    badges: [{ label: 'core/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'endpointslice',
                    title: 'EndpointSlice',
                    typePrefix: 'API Object',
                    badges: [{ label: 'discovery.k8s.io', color: 'var(--k-sky)' }],
                  },
                  // config.openshift.io singletons — the desired-state knobs the
                  // relocated cluster operators (DNS, Ingress, CNO, Auth, Image
                  // Registry, …) reconcile. They are pure records with no
                  // data-plane card of their own, so they live in here.
                  {
                    id: 'dns-config-cr',
                    title: 'DNS',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'ingress-config-cr',
                    title: 'Ingress',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'network-config-cr',
                    title: 'Network',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'authentication-config-cr',
                    title: 'Authentication',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'image-config-cr',
                    title: 'Image',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'proxy-config-cr',
                    title: 'Proxy',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'infrastructure-config-cr',
                    title: 'Infrastructure',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  // OLM records — the operator catalog/install objects the OLM
                  // and Catalog Operators reconcile. Also pure desired state.
                  {
                    id: 'subscription-cr',
                    title: 'Subscription',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'operators.coreos.com', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'csv-cr',
                    title: 'ClusterServiceVersion',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'operators.coreos.com', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'catalogsource-cr',
                    title: 'CatalogSource',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'operators.coreos.com', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'installplan-cr',
                    title: 'InstallPlan',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'operators.coreos.com', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'operatorgroup-cr',
                    title: 'OperatorGroup',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'operators.coreos.com', color: 'var(--k-sky)' }],
                  },
                ],
              },
              {
                id: 'shared-ingress-proxy',
                title: 'Shared Ingress Proxy',
                typePrefix: 'Pod',
                badges: [
                  { label: 'HAProxy', color: 'var(--k-sky)' },
                  { label: 'SNI routing', color: 'var(--k-sky)' },
                ],
              },
              // MetalLB L2 LoadBalancer VIP fronting the shared ingress proxy.
              // CONTROL-PLANE / API ingress only (kube-apiserver, OAuth,
              // Konnectivity, Ignition) — NOT application/*.apps traffic, which
              // enters via the Apps Ingress LoadBalancer below. A Service is a
              // networking abstraction, not a process — allowed on the overview
              // per the 4th category of the First Overview rendering rule
              // (ARCHITECTURE.md §1).
              {
                id: 'svc-ingress-lb-shared',
                title: 'Shared Ingress LoadBalancer',
                typePrefix: 'Service',
                serviceType: 'LoadBalancer',
                badges: [
                  { label: 'LoadBalancer', color: 'var(--k-sky)' },
                  { label: 'MetalLB L2', color: 'var(--k-sky)' },
                  { label: 'control-plane / API', color: 'var(--k-sky)' },
                ],
              },
              // APPLICATION (*.apps wildcard) ingress entry point on the bare
              // metal side: the infra-side LoadBalancer the kubevirt cloud
              // provider (CCM) mirrors from the guest's router-default LB. This
              // is the guest app-traffic path — it does NOT go through the
              // Shared Ingress Proxy above.
              {
                id: 'svc-apps-lb-infra',
                title: 'Apps Ingress LoadBalancer',
                typePrefix: 'Service',
                serviceType: 'LoadBalancer',
                badges: [
                  { label: 'LoadBalancer', color: 'var(--k-sky)' },
                  { label: 'MetalLB L2', color: 'var(--k-sky)' },
                  { label: 'kubevirt CCM mirror', color: 'var(--k-sky)' },
                ],
              },
              {
                id: 'ovn-master-control',
                title: 'OVN-K8s Master',
                typePrefix: 'Pod',
                badges: [{ label: 'Northbound DB', color: 'var(--k-sky)' }],
              },
              {
                id: 'cloud-controller-manager',
                title: 'Cloud Controller Manager',
                typePrefix: 'Pod',
                badges: [{ label: 'Cloud API', color: 'var(--k-sky)' }],
              },
              {
                id: 'konnectivity-server',
                title: 'Konnectivity Server',
                typePrefix: 'Pod',
                badges: [{ label: 'Tunnel :8091', color: 'var(--k-sky)' }],
              },
              // Guest storage backend: provisions a management-cluster PVC
              // behind every guest PVC and hotplugs it into the worker VMI.
              {
                id: 'kubevirt-csi-controller',
                title: 'KubeVirt CSI Controller',
                typePrefix: 'Pod',
                badges: [
                  { label: 'csi.kubevirt.io', color: 'var(--k-sky)' },
                  { label: 'CreateVolume · hotplug', color: 'var(--k-sky)' },
                ],
              },
              {
                id: 'ignition-server',
                title: 'Ignition Server',
                typePrefix: 'Pod',
                badges: [{ label: 'Bootstrap', color: 'var(--k-sky)' }],
              },
            ],
          },
        ],
      },
      {
        id: 'worker-node',
        label: 'Bare Metal Worker Node',
        color: 'var(--k-blue-worker)',
        colorVar: 'k-blue-worker',
        // Three workers in the cluster; two condensed replica nodes (see master-node).
        replicaNodes: [
          replicaNode({ id: 'worker-2', title: 'worker-2', colorVar: 'k-blue-worker', kind: 'worker', ordinal: 2 }),
          replicaNode({ id: 'worker-3', title: 'worker-3', colorVar: 'k-blue-worker', kind: 'worker', ordinal: 3 }),
        ],
        nodes: [
          {
            id: 'kubelet-host',
            title: 'Kubelet',
            typePrefix: 'systemd',
            badges: [{ label: 'CRI client', color: 'var(--k-blue-worker)' }],
          },
          {
            id: 'crio-host',
            title: 'CRI-O',
            typePrefix: 'systemd',
            badges: [
              { label: 'OCI', color: 'var(--k-blue-worker)' },
              { label: 'gRPC', color: 'var(--k-blue-worker)' },
            ],
          },
          {
            id: 'ovs-host',
            title: 'Open vSwitch',
            typePrefix: 'systemd',
            badges: [
              { label: 'br-int', color: 'var(--k-blue-worker)' },
              { label: 'OpenFlow', color: 'var(--k-blue-worker)' },
            ],
          },
          {
            id: 'ovn-node-host',
            title: 'OVN-K8s Node',
            typePrefix: 'Pod',
            // Stacks above the Open vSwitch it programs (see ServicePair).
            programs: 'ovs-host',
            badges: [{ label: 'CNI', color: 'var(--k-blue-worker)' }],
          },
          // The same MetalLB speaker DaemonSet Pod, here on the worker node — it
          // announces the LoadBalancer VIPs from whichever node currently owns
          // them (L2 mode elects one announcer per VIP across all speakers).
          {
            id: 'metallb-speaker-worker',
            title: 'MetalLB Speaker',
            typePrefix: 'Pod',
            badges: [
              { label: 'DaemonSet', color: 'var(--k-blue-worker)' },
              { label: 'ARP/NDP', color: 'var(--k-blue-worker)' },
            ],
          },
          {
            id: 'virt-handler',
            title: 'KubeVirt virt-handler',
            typePrefix: 'Pod',
            badges: [{ label: 'VMI node agent', color: 'var(--k-blue-worker)' }],
          },
        ],
        zones: [
          {
            id: 'kubevirt-launcher-zone',
            // The launcher zone *is* the [Pod] — it doubles as the
            // `kubevirt-launcher` hop in events.json. The boundary itself is
            // the component (mirroring the VM zone below), so there is no
            // redundant inner Pod card: the box you see is the launcher Pod,
            // and the VMI nests directly inside it.
            componentId: 'kubevirt-launcher',
            label: 'KubeVirt Launcher · Pod',
            color: 'var(--k-teal)',
            colorVar: 'k-teal',
            badges: [
              { label: 'QEMU/KVM', color: 'var(--k-teal)' },
              { label: 'tap0', color: 'var(--k-teal)' },
            ],
            zones: [
              {
                id: 'guest-vm-zone',
                // The VM zone *is* a component: it doubles as the
                // `guest-worker-node-vm` hop in events.json. Its label carries
                // this id so ArrowOverlay can anchor connectors to it and
                // DetailPanel can open when the label is clicked.
                componentId: 'guest-worker-node-vm',
                label: 'Worker Node · VirtualMachineInstance',
                color: 'var(--k-green)',
                colorVar: 'k-green',
                badges: [
                  { label: 'RHCOS', color: 'var(--k-green)' },
                  { label: 'virtio-net', color: 'var(--k-green)' },
                ],
                nodes: [
                  {
                    id: 'kubelet-guest',
                    title: 'Kubelet',
                    typePrefix: 'systemd',
                    badges: [{ label: 'CRI client', color: 'var(--k-green)' }],
                  },
                  {
                    id: 'crio-guest',
                    title: 'CRI-O',
                    typePrefix: 'systemd',
                    badges: [
                      { label: 'OCI', color: 'var(--k-green)' },
                      { label: 'CNI', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'ovs-guest',
                    title: 'Open vSwitch',
                    typePrefix: 'systemd',
                    badges: [
                      { label: 'br-int', color: 'var(--k-green)' },
                      { label: 'virtio-net', color: 'var(--k-green)' },
                    ],
                    // ClusterIP Services and the NetworkPolicy have no datapath of
                    // their own — OVN-Kubernetes compiles them into load-balancer /
                    // ACL OpenFlow rules installed on this switch's br-int. They are
                    // nested here as the flows they're realized as (expand-in-place,
                    // like the etcd intent store), not as standalone cards.
                    realizes: [
                      {
                        id: 'svc-frontend',
                        title: 'Front-End Service',
                        typePrefix: 'Service',
                        realizationType: 'LB flow',
                        realizationTitle: 'Front-End LB flow',
                        serviceType: 'ClusterIP',
                        badges: [
                          { label: 'ClusterIP', color: 'var(--k-green)' },
                          { label: 'e-commerce-prod', color: 'var(--k-green)' },
                        ],
                      },
                      {
                        id: 'svc-backend',
                        title: 'Back-End Service',
                        typePrefix: 'Service',
                        realizationType: 'LB flow',
                        realizationTitle: 'Back-End LB flow',
                        serviceType: 'ClusterIP',
                        badges: [
                          { label: 'ClusterIP', color: 'var(--k-green)' },
                          { label: 'e-commerce-prod', color: 'var(--k-green)' },
                        ],
                      },
                      {
                        id: 'netpol-ecommerce',
                        title: 'E-Commerce Network Policy',
                        typePrefix: 'NWPOLICY',
                        realizationType: 'ACL flow',
                        realizationTitle: 'E-Commerce ACL flow',
                        badges: [
                          { label: 'frontend → backend', color: 'var(--k-green)' },
                          { label: 'OVN ACL', color: 'var(--k-green)' },
                        ],
                      },
                      // The router's in-cluster ClusterIP handle (router-internal
                      // -default). Like the app ClusterIPs, it has no datapath of
                      // its own — OVN compiles it into a br-int load-balancer flow.
                      {
                        id: 'svc-router-internal-default',
                        title: 'Router Internal Service',
                        typePrefix: 'Service',
                        realizationType: 'LB flow',
                        realizationTitle: 'Router LB flow',
                        serviceType: 'ClusterIP',
                        badges: [
                          { label: 'ClusterIP', color: 'var(--k-green)' },
                          { label: 'openshift-ingress', color: 'var(--k-green)' },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'ovn-node-guest',
                    title: 'OVN-K8s Node',
                    typePrefix: 'Pod',
                    // Stacks directly above the Open vSwitch it programs (see
                    // ServicePair): the CNI/ovn-controller is the control plane that
                    // installs br-int flows on the data-plane switch below.
                    programs: 'ovs-guest',
                    badges: [{ label: 'CNI', color: 'var(--k-green)' }],
                  },
                  {
                    id: 'konnectivity-agent',
                    title: 'Konnectivity Agent',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Tunnel', color: 'var(--k-green)' }],
                  },
                  {
                    id: 'coredns-node',
                    title: 'CoreDNS Node',
                    typePrefix: 'Pod',
                    badges: [{ label: 'DNS :53', color: 'var(--k-green)' }],
                  },
                  // Per-node agents that run *inside* the guest VM — the data-plane
                  // counterparts of the control-plane-resident operators above
                  // (DNS Operator → CoreDNS, CNO → Multus, Node Tuning Operator →
                  // TuneD, Storage Operator → CSI node driver). They are real
                  // DaemonSet Pods on the guest worker, so they get flat cards
                  // here rather than nesting.
                  {
                    id: 'multus-guest',
                    title: 'Multus CNI',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'DaemonSet', color: 'var(--k-green)' },
                      { label: 'meta-CNI', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'tuned-guest',
                    title: 'Node Tuning (TuneD)',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'DaemonSet', color: 'var(--k-green)' },
                      { label: 'Tuned profile', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'csi-node-guest',
                    title: 'CSI Node Driver',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'DaemonSet', color: 'var(--k-green)' },
                      { label: 'kubevirt-csi', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'image-registry-guest',
                    title: 'Image Registry',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'openshift-image-registry', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'openshift-ingress-router-guest',
                    title: 'Ingress Router',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'HAProxy', color: 'var(--k-green)' },
                      { label: 'Route CR', color: 'var(--k-green)' },
                    ],
                  },
                  // The guest cluster's own external handle for the in-VM ingress
                  // router. In HCP-on-KubeVirt the guest ingress is NOT a
                  // LoadBalancer (there is no MetalLB or cloud LB inside the
                  // guest) — it is a NodePort. The infra-side Apps Ingress
                  // LoadBalancer on the bare metal cluster forwards to this
                  // NodePort on the worker VMs; that infra Service is where the
                  // MetalLB VIP actually lives.
                  {
                    id: 'svc-router-nodeport-default',
                    title: 'Router NodePort',
                    typePrefix: 'Service',
                    serviceType: 'NodePort',
                    // Stacks directly above the Pod it exposes (see ServicePair).
                    exposes: 'openshift-ingress-router-guest',
                    badges: [
                      { label: 'NodePort', color: 'var(--k-green)' },
                      { label: 'router-nodeport-default', color: 'var(--k-green)' },
                    ],
                  },
                  // The e-commerce application Pods. Their ClusterIP Services and
                  // NetworkPolicy aren't standalone cards here — they live inside
                  // the Open vSwitch node above, as the br-int flows they're
                  // realized as (see `ovs-guest.realizes`).
                  {
                    id: 'frontend-application-pod',
                    title: 'Front-End Application',
                    typePrefix: 'Pod',
                    replicaBadge: 'replica 1/3',
                    badges: [
                      { label: 'e-commerce-prod', color: 'var(--k-green)' },
                      { label: ':8080', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'backend-application-pod',
                    title: 'Back-End Application',
                    typePrefix: 'Pod',
                    replicaBadge: 'replica 1/3',
                    badges: [
                      { label: 'e-commerce-prod', color: 'var(--k-green)' },
                      { label: ':3000', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'cluster-monitoring',
                    title: 'Cluster Monitoring',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Prometheus', color: 'var(--k-green)' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

// Recursively collect all nodes from the zone tree.
function collectNodes(zones, result = []) {
  for (const zone of zones) {
    // A zone that doubles as a component (e.g. the VM zone) registers its own
    // id so the color/zone/badge lookups below resolve it like any node.
    if (zone.componentId) {
      result.push({ node: { id: zone.componentId, badges: zone.badges }, zone })
    }
    if (zone.nodes) {
      for (const node of zone.nodes) {
        result.push({ node, zone })
        // Intent objects (CRs nested inside an etcd "intent store" node) are
        // not rendered as standalone cards, but still need their color / zone /
        // badge lookups resolved so the DetailPanel can open for them.
        if (node.intentObjects) {
          for (const obj of node.intentObjects) result.push({ node: obj, zone })
        }
        // Controllers (control loops nested inside a controller-manager node)
        // are likewise not standalone cards, but need the same lookups so their
        // detail popups inherit the manager's zone accent.
        if (node.controllers) {
          for (const ctrl of node.controllers) result.push({ node: ctrl, zone })
        }
        // Operators (operator Pods nested inside an "operator set" owner — the
        // CVO / Control Plane Operator) only render once their owner expands, so
        // like the two above they need their color / zone / badge lookups
        // resolved here for the DetailPanel and trace highlighting.
        if (node.operators) {
          for (const op of node.operators) result.push({ node: op, zone })
        }
        // Realized flows (Services / NetworkPolicies nested inside an Open vSwitch
        // node as the br-int flows they compile to) only render once the switch
        // expands, but still need color / zone / badge lookups for their popups.
        if (node.realizes) {
          for (const obj of node.realizes) result.push({ node: obj, zone })
        }
      }
    }
    if (zone.zones) collectNodes(zone.zones, result)
  }
  return result
}

const allNodes = collectNodes(ZONES)

// Map componentId → zone accent color (for hop-list coloring, connector strokes, etc.)
export const COMPONENT_COLOR = Object.fromEntries(
  allNodes.map(({ node, zone }) => [node.id, zone.color])
)

// Map componentId → zone object (for DetailPanel zone label display)
export const COMPONENT_ZONE = Object.fromEntries(
  allNodes.map(({ node, zone }) => [node.id, zone])
)

// Map componentId → badge array (for DetailPanel tag chips)
export const COMPONENT_BADGES = Object.fromEntries(
  allNodes.map(({ node }) => [node.id, node.badges || []])
)

// Map intent-object id → the id of the etcd "intent store" node that holds it.
// Intent objects only render (and gain a DOM id) when their store is expanded,
// so spotlighting one on the overview means expanding its store first.
export const INTENT_OBJECT_STORE = (() => {
  const map = {}
  const walk = (zones) => {
    for (const zone of zones) {
      zone.nodes?.forEach((n) =>
        n.intentObjects?.forEach((o) => { map[o.id] = n.id })
      )
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(ZONES)
  return map
})()

// Map controller-loop id → the id of the controller-manager node that hosts it.
// Same role as INTENT_OBJECT_STORE: a loop only gains a DOM id once its manager
// expands into a "controller set", so spotlighting one means expanding it first.
export const CONTROLLER_PARENT = (() => {
  const map = {}
  const walk = (zones) => {
    for (const zone of zones) {
      zone.nodes?.forEach((n) =>
        n.controllers?.forEach((c) => { map[c.id] = n.id })
      )
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(ZONES)
  return map
})()

// Map operator id → the id of the "operator set" owner node (CVO / Control Plane
// Operator) that holds it. Same role as the two maps above: an operator Pod only
// gains a DOM id once its owner expands, so spotlighting one during a trace means
// expanding the owner first.
export const OPERATOR_PARENT = (() => {
  const map = {}
  const walk = (zones) => {
    for (const zone of zones) {
      zone.nodes?.forEach((n) =>
        n.operators?.forEach((o) => { map[o.id] = n.id })
      )
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(ZONES)
  return map
})()

// Map realized-flow id → the id of the Open vSwitch node that realizes it. Same
// role as the maps above: a nested Service / NetworkPolicy only gains a DOM id
// once its switch expands, so spotlighting one means expanding the switch first.
export const FLOW_PARENT = (() => {
  const map = {}
  const walk = (zones) => {
    for (const zone of zones) {
      zone.nodes?.forEach((n) =>
        n.realizes?.forEach((o) => { map[o.id] = n.id })
      )
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(ZONES)
  return map
})()

// First Overview rendering rule (ARCHITECTURE.md §1) — the primary canvas is a
// whitelist: a NodeCard may only be a systemd enforcer/service, a concrete
// application instance (Pod / Static Pod / VMI), or a networking Service
// abstraction (ClusterIP / LoadBalancer). Zone boundaries are the zones
// themselves; pure-intent CRs render *inside* the etcd store, not as cards; and
// trace-only zones (the external Client) are not part of the default canvas.
// This dev-only guard flags any future node that drifts outside the rule.
const OVERVIEW_NODE_TYPES = new Set([
  'systemd', // Active Enforcers — systemd services
  'Pod', // Concrete application / data-plane instances
  'Static Pod',
  'VirtualMachineInstance',
  'Service', // Networking / Service abstractions (ClusterIP, LoadBalancer)
  'NWPOLICY', // Policy abstractions realized as OVN ACLs / OpenFlow rules
])

function assertOverviewWhitelist(zones) {
  const offenders = []
  const walk = (list) => {
    for (const zone of list) {
      if (zone.traceOnly) continue // not rendered on the default overview
      // intentObjects (CRs) live inside the etcd store and controllers (control
      // loops) inside the controller-manager set — neither is a card, so the
      // loop only checks the node's own typePrefix and leaves both alone.
      zone.nodes?.forEach((n) => {
        if (!OVERVIEW_NODE_TYPES.has(n.typePrefix)) {
          offenders.push(`${n.id} [${n.typePrefix}]`)
        }
      })
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(zones)
  if (offenders.length) {
    console.warn(
      '[kube-visual] First Overview rendering-rule violation (ARCHITECTURE.md §1): ' +
        'these nodes are not zone boundaries, systemd enforcers, or concrete ' +
        'application instances and must not render on the primary canvas:\n  ' +
        offenders.join('\n  ')
    )
  }
}

if (import.meta.env?.DEV) assertOverviewWhitelist(ZONES)
