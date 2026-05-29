# kube-visual — Architecture Specification

> **This is the source-of-truth spec for what kube-visual should be.** It defines the
> target topology, component hierarchy, interaction model, and data schemas. When the
> app and this document disagree, treat this document as the intent and bring the app
> back in line with it (or update this doc deliberately if the intent itself changed).

This document defines the structural specifications, component hierarchies, and data models for **kube-visual** — an interactive, frontend-only web-based architectural map of OpenShift Hosted Control Planes (HCP).
## 1. UI Structural Nomenclature & Multitier Canvas Layout
### Layout & Sizing Rules
 * **Nomenclature:** Use Context / Zone for macro physical/virtual infrastructure layers and Container / Instance for platform runtime isolation boundaries.
 * **Prefix System:** Every line on the canvas must explicitly start with its exact system or API object classification in square brackets ([Pod], [Static Pod], [systemd Service]).
 * **Mobile-First Footprint:** Minimize individual block dimensions. The UI layout tree components must compress cleanly so that **at least two instances sit side-by-side** without clipping content strings when viewed on compact mobile display widths.
### Component Nesting Structure
The workspace viewport canvas must render this exact structural hierarchy:
```text
[Management Cluster Context]
  │
  ├── [Management Master Node Zone]
  │     │
  │     │   // The master node's own host-resident node agents
  │     ├── [systemd Service] Kubelet (Host Resident Node Manager)
  │     ├── [systemd Service] CRI-O (Host Resident Container Engine)
  │     ├── [systemd Service] Open vSwitch (Host Native Data Path)
  │     ├── [Pod] OVN-Kubernetes Node Instance
  │     │
  │     │   // The management (bare metal) cluster's OWN control plane,
  │     │   // run by the master kubelet from /etc/kubernetes/manifests —
  │     │   // these sit directly on the master node alongside its host agents.
  │     ├── [Static Pod] Management Kube API Server Instance
  │     ├── [Static Pod] Management Etcd Instance ──┐  // expandable "intent store"
  │     │      // Desired-state records persisted here, not processes:
  │     │      // the HCP control-plane intent + the Cluster API → KubeVirt chain
  │     │      ├── [Custom Resource] HostedCluster
  │     │      ├── [Custom Resource] HostedControlPlane
  │     │      ├── [Custom Resource] NodePool
  │     │      ├── [Custom Resource] Cluster (CAPI)
  │     │      ├── [Custom Resource] MachineDeployment
  │     │      ├── [Custom Resource] MachineSet
  │     │      ├── [Custom Resource] Machine
  │     │      ├── [Custom Resource] KubevirtMachine
  │     │      └── [Custom Resource] VirtualMachine (KubeVirt)
  │     ├── [Static Pod] Management Controller Manager Instance
  │     ├── [Static Pod] Management Kube-Scheduler Instance
  │     │
  │     │   // Cluster-wide management operator (ONE per mgmt cluster,
  │     │   // not per guest). The HostedCluster/NodePool CRs it
  │     │   // reconciles are intent records inside Management Etcd above.
  │     ├── [Pod] HyperShift Operator Instance
  │     │
  │     └── [Dedicated Guest Control Plane Namespace Zone]
  │           │   // Per-HCP operators & lifecycle controllers
  │           ├── [Pod] Control Plane Operator (CPO) Instance
  │           ├── [Pod] Cluster Version Operator (CVO) Instance
  │           ├── [Pod] Cluster API Manager Instance
  │           ├── [Pod] Cluster API Provider · KubeVirt (CAPK) Instance
  │           │
  │           │   // Guest API, State & Authentication Engines
  │           ├── [Pod] Guest API Server Instance
  │           ├── [Pod] Guest OAuth Server Instance
  │           ├── [Pod] Guest Controller Manager Instance
  │           ├── [Pod] Guest Kube-Scheduler Instance
  │           ├── [Pod] Guest Etcd Instance (StatefulSet — NOT a static pod) ──┐  // also an "intent store"
  │           │      // The guest cluster's own API records — no overview card:
  │           │      ├── [Custom Resource] ClusterVersion / ClusterOperator
  │           │      ├── [Custom Resource] Route
  │           │      ├── [API Object] Deployment / ReplicaSet (e-commerce workloads)
  │           │      ├── [API Object] Secret / ConfigMap
  │           │      ├── [API Object] PersistentVolumeClaim / PersistentVolume
  │           │      └── [API Object] EndpointSlice
  │           │
  │           │   // Ingress Control, Networking & Proxy Systems
  │           ├── [Pod] Shared Ingress Proxy Instance
  │           ├── [Service · LoadBalancer] Shared Ingress VIP (MetalLB L2)
  │           ├── [Pod] OVN-Kubernetes Master Control Instance
  │           ├── [Pod] Cloud Controller Manager (CCM) Instance
  │           ├── [Pod] Konnectivity Server Instance
  │           │
  │           │   // Infrastructure Tooling
  │           └── [Pod] Ignition Server Instance
  │
  └── [Management Worker Node Zone]
        ├── [systemd Service] Kubelet (Host Resident Node Manager)
        ├── [systemd Service] CRI-O (Host Resident Container Engine)
        ├── [systemd Service] Open vSwitch (Host Native Data Path)
        ├── [Pod] OVN-Kubernetes Node Instance
        ├── [Pod] KubeVirt virt-handler Instance (VMI node agent)
        │
        └── [Pod] KubeVirt Launcher Container
              └── [VirtualMachineInstance] Guest Worker Node
                    ├── [systemd Service] Kubelet (Guest Resident Node Manager)
                    ├── [systemd Service] CRI-O (Guest Resident Container Engine)
                    ├── [systemd Service] Open vSwitch (Guest Native Data Path)
                    ├── [Pod] OVN-Kubernetes Guest Node Instance
                    ├── [Pod] Konnectivity Agent Instance
                    ├── [Pod] CoreDNS Node Instance
                    ├── [Pod] OpenShift Ingress Router Instance
                    ├── [Service · LoadBalancer] Ingress Router VIP (MetalLB L2)
                    ├── [Pod] Cluster Monitoring Instance (openshift-monitoring)
                    │
                    │   // Workload Instances (+ their ClusterIP Services) inside the VM
                    ├── [Pod] Front-End Workload Instance
                    ├── [Service · ClusterIP] Front-End Workload Service
                    ├── [Pod] Back-End Workload Instance
                    ├── [Service · ClusterIP] Back-End Workload Service
                    └── [NetworkPolicy] E-Commerce Network Policy (front-end → back-end ingress)

```

### First Overview Rendering Rule (the primary canvas grid)

The primary overview layout is a **whitelist**: it may render *only* components that
fall into one of these three categories. Anything that is not one of these three is kept
off the main canvas (it surfaces elsewhere — e.g. in a detail modal, the etcd intent
store, or a trace-only zone).

1. **The Context / Zone Boundaries** — the macro physical/virtual boundaries that frame
   everything else: `[Management Cluster]`, `[Management Master Node]`,
   `[Dedicated Guest Control Plane Namespace]`, `[Management Worker Node]`,
   `[Guest Worker Node VM]`.
2. **The Active Enforcers (`systemd` Services)** — binary systems executing
   continuous loop cycles directly on a host OS or guest OS instance: `Kubelet`, `CRI-O`,
   `Open vSwitch`, `virt-handler`.
3. **The Concrete Workload / Data Plane Instances** — discrete compute packages running
   processes: `Pods`, `Static Pods`, `VirtualMachineInstances`.
4. **The Networking / Policy Abstractions** — Kubernetes `Service` and `NetworkPolicy`
   objects that front or guard the workloads above. Unlike pure-intent records, these have
   a *concrete data-plane realization*: a `ClusterIP` is a virtual IP backed by OVN
   load-balancer flows (DNAT), and a `LoadBalancer` (here, **MetalLB in L2 mode**) is an
   external VIP advertised over ARP/NDP. A `NetworkPolicy` is likewise declarative, but OVN
   compiles it into address sets + ACLs in the Northbound DB that become allow/drop
   OpenFlow rules enforced on `br-int`. That data-plane footprint earns each one a card on
   the canvas, next to the Pods it routes to or guards: `[Service]`, `[NetworkPolicy]`.

This reinforces the **Default State** rule in §2: desired-state records that have *no*
data-plane realization (the HCP and Cluster API Custom Resources, plus the guest cluster's
own `ClusterVersion`/`ClusterOperator`, `Route`, workload `Deployment`/`ReplicaSet`,
`Secret`/`ConfigMap`/`PVC`/`PV`, and `EndpointSlice`s), raw Linux kernel primitives (netns,
cgroups, host PIDs), and Project/Namespace boundaries are *not* instances, enforcers, or
realized Service/policy abstractions, so they never appear as cards on the first overview —
they live inside the expandable etcd intent stores (Management Etcd / Guest Etcd) or behind
a node's detail modal instead.

### Modeling invariants (get these right)

These are the easy-to-get-wrong facts the topology and flows must respect:

1. **The HyperShift Operator is a cluster-wide singleton** in the `hypershift`
   namespace — one instance manages *every* HostedCluster. It is **not** a
   per-guest pod inside the guest control-plane namespace. The per-HCP owner is
   the **Control Plane Operator (CPO)**, which lives in the guest namespace.
2. **Guest etcd is a StatefulSet Pod**, not a static pod. Static pods only exist
   on kubelet-managed nodes (`/etc/kubernetes/manifests`); only the *management*
   cluster's own API server/etcd/scheduler/controller-manager are static pods.
3. **Konnectivity is one-directional**: it only carries **API-Server-initiated**
   traffic (exec, logs, port-forward, webhooks, metrics). The guest kubelet
   learns about its pods by **watching the Guest API Server directly** over its
   own outbound connection — the API Server never pushes PodSpecs through the
   tunnel. Do not route pod-scheduling notifications through Konnectivity.
4. **HostedCluster/NodePool CRs live in the management API Server.** `oc apply`
   of these manifests hits the *Management* Kube API Server, not the guest one
   (which may not exist yet).
5. **Worker nodes come from NodePools → Cluster API → CAPK.** The HyperShift
   Operator's NodePool controller renders a NodePool into Cluster API objects;
   `cluster-api-provider-kubevirt` (CAPK) creates a KubeVirt `VirtualMachine`,
   and `virt-handler` on a bare metal worker launches the `virt-launcher` Pod
   that boots the RHCOS VMI. The Ignition Server only *serves boot config* — it
   does not create nodes.
6. **Guest cluster operators (DNS, ingress, monitoring) run on guest worker
   nodes** (inside the VMs), not in the control-plane namespace.

## 2. Dynamic Interactivity & Progressive Disclosure
 * **Default State:** All topology components are visible but set to a dimmed idle opacity state. Do not render raw Linux kernel primitives (netns, cgroups, host PIDs) or Project/Namespace boundaries on the main view.
 * **Event Selection Integration:** Selecting an infrastructure workflow parses events.json, transitions participating objects to full opacity, and dynamically overlays ordered, numbered, directional connecting vectors (①, ②, ③) showing execution paths. Vector lines must auto-recalculate paths on window resize.
 * **Interactive Modal System:** Clicking any structural component container opens a mobile-friendly overlay pop-up modal serving progressive metadata disclosures:
   * **Workload Pods:** Expose logical OpenShift Project metadata, isolated Linux Network Namespace (netns), host-side veth pair IDs, and cgroups slice boundaries.
   * **systemd Services:** Reveal corresponding host service unit configuration paths and tracking metrics.
   * **VirtualMachineInstance:** Expose the host qemu-kvm process execution details, host-side virtual network tap configuration (tap0), and master cgroup runtime boundaries.
   * **Guest Controller Manager:** Reveal internal control loops (NodeLifecycleController, EndpointController, etc.) running inside the binary.
 * **Etcd Intent Stores (expandable nodes):** Both etcd nodes double as homes for the API objects they persist — desired-state records, **not** Linux processes, so they are deliberately not rendered as sibling cards next to real Pods. **Management Etcd** holds the HCP control-plane intent and the worker-provisioning chain (`HostedCluster`, `HostedControlPlane`, `NodePool`, and the Cluster API → KubeVirt objects: `Cluster`, `MachineDeployment`, `MachineSet`, `Machine`, `KubevirtMachine`, `VirtualMachine`). **Guest Etcd** holds the guest cluster's own records that have no data-plane card (`ClusterVersion`, `ClusterOperator`, `Route`, the workload `Deployment`/`ReplicaSet`, their `Secret`/`ConfigMap`/`PersistentVolumeClaim`/`PersistentVolume`, and the `EndpointSlice`s behind its Services). Realized Services and the NetworkPolicy keep their own cards; only pure records live inside the store. Clicking an etcd node enlarges it in place to reveal these objects. Inside the expanded store: clicking the **title** (ⓘ) opens etcd's own detail popup; clicking an **object** opens that record's popup; clicking the empty body, the ▴ chevron, outside the card, or pressing **Esc** collapses it. A node declares this behavior via an `intentObjects` array in `zones.js`.
## 3. Reference Data Schemas
### Metadata Schema (components.json)
```json
{
  "componentId": "pod-netns",
  "displayName": "Linux Network Namespace (netns)",
  "layer": "Linux Kernel Primitives",
  "logicalContext": {
    "openShiftProject": "e-commerce-prod",
    "associatedObject": "Front-End Workload Instance"
  },
  "problemSolved": "Provides network virtualization and isolation inside the Guest RHCOS VM.",
  "interactions": [
    "Attaches to a guest-side veth pair managed by the OVN-Kubernetes Guest Node DaemonSet.",
    "Provisioned and configured by the CRI-O runtime via CNI instructions."
  ],
  "explorationCommands": [
    "crictl inspect <container_id> | grep pid",
    "nsenter -t <PID> -n ip addr show"
  ]
}

```
### Event Workflow Schema (events.json)
```json
{
  "eventId": "route-ingress-traffic",
  "eventName": "External Ingress Traffic Flow via Route",
  "description": "Tracing an inbound HTTPS request from an external web client down into an application pod runtime running inside a Guest KubeVirt VM.",
  "steps": [
    {
      "step": 1,
      "sourceComponentId": "external-client",
      "targetComponentId": "guest-api-server",
      "description": "Client establishes handshake with the isolated Guest API Server Instance running in the Management Master Node Zone."
    },
    {
      "step": 2,
      "sourceComponentId": "guest-api-server",
      "targetComponentId": "management-ovs-bridge",
      "description": "Traffic routes across the management overlay fabric, hitting the Open vSwitch service on the Management Worker Node."
    },
    {
      "step": 3,
      "sourceComponentId": "management-ovs-bridge",
      "targetComponentId": "kubevirt-launcher",
      "description": "OVS switches the network frames directly into the KubeVirt Launcher Container handling the virtual network tap."
    },
    {
      "step": 4,
      "sourceComponentId": "kubevirt-launcher",
      "targetComponentId": "guest-worker-node-vm",
      "description": "The packet passes through the virtual tap interface boundary, shifting context directly into the running Guest Worker Node Virtual Machine Instance."
    },
    {
      "step": 5,
      "sourceComponentId": "guest-worker-node-vm",
      "targetComponentId": "guest-ovs-bridge",
      "description": "The guest-resident Open vSwitch systemd service processes the frame and identifies the target workload container destination."
    },
    {
      "step": 6,
      "sourceComponentId": "guest-ovs-bridge",
      "targetComponentId": "frontend-workload-pod",
      "description": "The packet crosses the guest-side veth wire directly into the Front-End Workload Instance Pod where the application container processes it."
    }
  ]
}

```
## Adding a New Component

Adding a component touches several places — keep them in sync:

1. **`src/data/components.json`** — new entry with `componentId`, `displayName`, `layer`,
   `typePrefix` (e.g. `Pod`, `Static Pod`, `systemd`, `VirtualMachineInstance`, `Service`,
   `NetworkPolicy`),
   `problemSolved`, `interactions[]`, `explorationCommands[]`. Add `logicalContext`
   (`openShiftProject` + `associatedObject`) for workload pods and VMIs.
2. **`src/data/zones.js`** — add a node (with `id`, `title`, `typePrefix`, `badges`) to
   the correct zone in the recursive `ZONES` tree. `COMPONENT_COLOR` / `COMPONENT_ZONE`
   derive automatically from the tree.
3. **`src/components/ObjectMapTab.jsx`** — add KIND / PRIMITIVE mappings if the
   component should surface in that table.
4. **`src/data/events.json`** — reference the new `componentId` in any flow steps that
   should highlight it and draw connectors to/from it.

The `componentId` must be unique: `ArrowOverlay` locates nodes via
`document.getElementById(componentId)`, so a duplicate id silently drops connector steps.

## Agent Implementation Strategy
 1. **Layout Grid Scaffolding:** Code a highly flexible viewport grid supporting the multi-tier nested node tree. Ensure strict sub-component scale limits to guarantee parts can tile side-by-side on mobile devices.
 2. **Modal Portaling:** Connect global onClick handlers across canvas components to mount data-driven pop-ups fed by components.json.
 3. **Vector Vectorization:** Implement react-xarrows or leader-line rendering modules to capture bounding coordinates of active IDs from events.json and cleanly project adaptive connectors.
