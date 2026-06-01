# kube-weird-visualizer — Architecture Specification

> **This is the source-of-truth spec for what kube-weird-visualizer should be.** It defines the
> target topology, component hierarchy, interaction model, and data schemas. When the
> app and this document disagree, treat this document as the intent and bring the app
> back in line with it (or update this doc deliberately if the intent itself changed).

This document defines the structural specifications, component hierarchies, and data models for **kube-weird-visualizer** — an interactive, frontend-only web-based architectural map of OpenShift Hosted Control Planes (HCP).
## 1. UI Structural Nomenclature & Multitier Canvas Layout
### Layout & Sizing Rules
 * **Nomenclature:** Use Context / Zone for macro physical/virtual infrastructure layers and Container / Instance for platform runtime isolation boundaries.
 * **Prefix System:** Each card carries its exact system / API object classification in square brackets ([Static Pod], [systemd], [Service], [NWPOLICY], [VirtualMachineInstance], …) — **with one deliberate exception: the plain `[Pod]` prefix is omitted.** Pods are by far the most common card, so `[Pod]` is treated as the implicit default and hidden to cut visual noise; every *non-Pod* type is still labeled explicitly. (See `NodeCard.jsx`, which suppresses the prefix only when `typePrefix === 'Pod'`.)
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
  │     ├── [Static Pod] Management Controller Manager Instance ──┐  // expandable "controller set"
  │     │      // Control loops inside the ONE kube-controller-manager binary —
  │     │      // goroutines, not Pods — that reconcile the management cluster
  │     │      // (including the guest control-plane Deployments):
  │     │      ├── [Controller] Deployment Controller
  │     │      ├── [Controller] ReplicaSet Controller
  │     │      ├── [Controller] Node Lifecycle Controller
  │     │      ├── [Controller] Namespace Controller
  │     │      ├── [Controller] ServiceAccount Controller
  │     │      └── [Controller] PersistentVolume Controller
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
  │           ├── [Pod] Guest Controller Manager Instance ──┐  // also a "controller set"
  │           │      // The same kube-controller-manager loops, here reconciling
  │           │      // the GUEST cluster's own objects (held in Guest Etcd):
  │           │      ├── [Controller] Node Lifecycle Controller
  │           │      ├── [Controller] Deployment Controller
  │           │      ├── [Controller] ReplicaSet Controller
  │           │      ├── [Controller] EndpointSlice Controller
  │           │      ├── [Controller] ServiceAccount Controller
  │           │      └── [Controller] PersistentVolume Controller
  │           ├── [Pod] Guest Kube-Scheduler Instance
  │           ├── [Pod] Guest Etcd Instance (StatefulSet — NOT a static pod) ──┐  // also an "intent store"
  │           │      // The guest cluster's own API records — no overview card:
  │           │      ├── [Custom Resource] ClusterVersion / ClusterOperator
  │           │      ├── [Custom Resource] Route
  │           │      ├── [API Object] Deployment / ReplicaSet (e-commerce applications)
  │           │      ├── [API Object] Secret / ConfigMap
  │           │      ├── [API Object] PersistentVolumeClaim / PersistentVolume
  │           │      └── [API Object] EndpointSlice
  │           │
  │           │   // Ingress Control, Networking & Proxy Systems
  │           │   // Two SEPARATE north-south paths front this namespace:
  │           │   //  · Shared Ingress = control-plane / API only (SNI-routed)
  │           │   //  · Apps Ingress LB = guest *.apps wildcard app traffic
  │           ├── [Pod] Shared Ingress Proxy Instance              // API/OAuth/Konnectivity/Ignition
  │           ├── [Service · LoadBalancer] Shared Ingress VIP (MetalLB L2 · control-plane / API)
  │           ├── [Service · LoadBalancer] Apps Ingress VIP (MetalLB L2 · kubevirt CCM mirror of guest router-default)
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
                    │   // Application Instances (+ their ClusterIP Services) inside the VM
                    ├── [Pod] Front-End Application Instance
                    ├── [Service · ClusterIP] Front-End Application Service
                    ├── [Pod] Back-End Application Instance
                    ├── [Service · ClusterIP] Back-End Application Service
                    └── [NWPOLICY] E-Commerce Network Policy (front-end → back-end ingress)

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
3. **The Concrete Application / Data Plane Instances** — discrete compute packages running
   processes: `Pods`, `Static Pods`, `VirtualMachineInstances`.
4. **The Networking / Policy Abstractions** — Kubernetes `Service` and `NetworkPolicy`
   objects that front or guard the applications above. Unlike pure-intent records, these have
   a *concrete data-plane realization*: a `ClusterIP` is a virtual IP backed by OVN
   load-balancer flows (DNAT), and a `LoadBalancer` (here, **MetalLB in L2 mode**) is an
   external VIP advertised over ARP/NDP. A `NetworkPolicy` is likewise declarative, but OVN
   compiles it into address sets + ACLs in the Northbound DB that become allow/drop
   OpenFlow rules enforced on `br-int`. That data-plane footprint earns each one a card on
   the canvas, next to the Pods it routes to or guards: `[Service]`, `[NWPOLICY]` (the
   compact card prefix for the `NetworkPolicy` kind).

This reinforces the **Default State** rule in §2: desired-state records that have *no*
data-plane realization (the HCP and Cluster API Custom Resources, plus the guest cluster's
own `ClusterVersion`/`ClusterOperator`, `Route`, application `Deployment`/`ReplicaSet`,
`Secret`/`ConfigMap`/`PVC`/`PV`, and `EndpointSlice`s), raw Linux kernel primitives (netns,
cgroups, host PIDs), and Project/Namespace boundaries are *not* instances, enforcers, or
realized Service/policy abstractions, so they never appear as cards on the first overview —
they live inside the expandable etcd intent stores (Management Etcd / Guest Etcd) or behind
a node's detail modal instead. The same applies to the **control loops** inside each
controller manager (`[Controller]` objects): they are goroutines sharing the
`kube-controller-manager` process, not standalone instances, so they live inside the
expandable controller-manager "controller set" rather than as cards (see §2).

### Modeling invariants (get these right)

These are the easy-to-get-wrong facts the topology and flows must respect:

1. **The HyperShift Operator is a cluster-wide singleton** in the `hypershift`
   namespace — one instance manages *every* HostedCluster. It is **not** a
   per-guest pod inside the guest control-plane namespace. The per-HCP owner is
   the **Control Plane Operator (CPO)**, which lives in the guest namespace.

   *Aside on KubeVirt agents:* `virt-controller` (cluster-level) **creates** the
   `virt-launcher` Pod for each VMI; `virt-handler` is the per-node DaemonSet that,
   once that Pod is running on its node, signals the in-Pod `libvirt`/`virt-launcher`
   to boot the qemu-kvm domain. virt-handler drives the VM boot/lifecycle *on the
   node* — it does not create the Pod.
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
   KubeVirt's `virt-controller` creates the `virt-launcher` Pod for the resulting
   VMI, and `virt-handler` (the per-node agent) on a bare metal worker then signals
   that Pod's `libvirt`/`virt-launcher` to boot the RHCOS VMI. (virt-handler drives
   the VM boot *on the node*; it does not create the Pod.) The Ignition Server only
   *serves boot config* — it does not create nodes.
6. **Guest cluster operators (DNS, ingress, monitoring) run on guest worker
   nodes** (inside the VMs), not in the control-plane namespace.
7. **Two separate north-south ingress paths — do not conflate them.** The
   **Shared Ingress Proxy + its LoadBalancer VIP** carry *control-plane / API*
   traffic only: they SNI-route the hosted cluster's `kube-apiserver`, OAuth,
   Konnectivity, and Ignition endpoints and terminate at the control-plane Pods
   in the HCP namespace — this traffic never enters a guest VM. **Application
   (`*.apps` wildcard Route) traffic** takes a different path: the guest
   cluster's own `router-default` LoadBalancer, which on the KubeVirt platform
   the **Cloud Controller Manager (kubevirt cloud provider)** mirrors to the
   infra-side **Apps Ingress LoadBalancer** Service (advertised by MetalLB);
   that traffic crosses into the VM and is served by the guest OpenShift Ingress
   Router. The `api-ingress-traffic` and `app-ingress-traffic` flows model these
   two paths respectively. Never route app traffic through the Shared Ingress
   Proxy.

## 2. Dynamic Interactivity & Progressive Disclosure
 * **Default State:** All topology components are visible but set to a dimmed idle opacity state. Do not render raw Linux kernel primitives (netns, cgroups, host PIDs) or Project/Namespace boundaries on the main view.
 * **Event Selection Integration:** Selecting an infrastructure workflow parses events.json, transitions participating objects to full opacity, and dynamically overlays ordered, numbered, directional connecting vectors (①, ②, ③) showing execution paths. Vector lines must auto-recalculate paths on window resize.
 * **Interactive Modal System:** Clicking any structural component container opens a mobile-friendly overlay pop-up modal serving progressive metadata disclosures:
   * **Application Pods:** Expose logical OpenShift Project metadata, isolated Linux Network Namespace (netns), host-side veth pair IDs, and cgroups slice boundaries.
   * **systemd Services:** Reveal corresponding host service unit configuration paths and tracking metrics.
   * **VirtualMachineInstance:** Expose the host qemu-kvm process execution details, host-side virtual network tap configuration (tap0), and master cgroup runtime boundaries.
 * **Etcd Intent Stores (expandable nodes):** Both etcd nodes double as homes for the API objects they persist — desired-state records, **not** Linux processes, so they are deliberately not rendered as sibling cards next to real Pods. **Management Etcd** holds the HCP control-plane intent and the worker-provisioning chain (`HostedCluster`, `HostedControlPlane`, `NodePool`, and the Cluster API → KubeVirt objects: `Cluster`, `MachineDeployment`, `MachineSet`, `Machine`, `KubevirtMachine`, `VirtualMachine`). **Guest Etcd** holds the guest cluster's own records that have no data-plane card (`ClusterVersion`, `ClusterOperator`, `Route`, the application `Deployment`/`ReplicaSet`, their `Secret`/`ConfigMap`/`PersistentVolumeClaim`/`PersistentVolume`, and the `EndpointSlice`s behind its Services). Realized Services and the NetworkPolicy keep their own cards; only pure records live inside the store. Clicking an etcd node enlarges it in place to reveal these objects. Inside the expanded store: clicking the **title** (ⓘ) opens etcd's own detail popup; clicking an **object** opens that record's popup; clicking the empty body, the ▴ chevron, outside the card, or pressing **Esc** collapses it. A node declares this behavior via an `intentObjects` array in `zones.js`.
 * **Controller Sets (expandable nodes):** The two controller-manager nodes
   (**Management Controller Manager** and **Guest Controller Manager**) work the
   same way as the etcd intent stores, but for *control loops* instead of
   records. A `kube-controller-manager` is a single binary hosting dozens of
   independent reconcile loops (Deployment, ReplicaSet, Node Lifecycle,
   EndpointSlice, ServiceAccount, PersistentVolume, …). Those loops are
   goroutines sharing one process — **not** separate Pods — so they are
   deliberately not rendered as sibling cards. Clicking a controller-manager
   node enlarges it in place to reveal the loops it runs (the management set
   reconciles the management cluster, including the guest control-plane
   Deployments; the guest set reconciles the guest cluster's own objects held in
   Guest Etcd). The interaction model is identical to the intent store: the
   **title** (ⓘ) opens the controller manager's own detail popup; a **loop**
   opens that controller's popup; clicking the empty body, the ▴ chevron,
   outside the card, or pressing **Esc** collapses it. Each loop is a
   `[Controller]`-typed object whose detail popup shows its watch→diff→act
   pipeline. A node declares this behavior via a `controllers` array in
   `zones.js`, rendered by `ControllerManagerCard.jsx`.
## 3. Reference Data Schemas
### Metadata Schema (components.json)
```json
{
  "componentId": "pod-netns",
  "displayName": "Linux Network Namespace (netns)",
  "layer": "Linux Kernel Primitives",
  "logicalContext": {
    "openShiftProject": "e-commerce-prod",
    "associatedObject": "Front-End Application Instance"
  },
  "role": "KERNEL PRIMITIVE",
  "problemSolved": "Gives each application Pod its own private network — IP, routes, and firewall — isolated from every other Pod.",
  "interactions": [
    "Attaches to a guest-side veth pair managed by the OVN-Kubernetes Guest Node DaemonSet.",
    "Provisioned and configured by the CRI-O runtime via CNI instructions."
  ],
  "explorationCommands": [
    "crictl inspect <container_id> | grep pid",
    "nsenter -t <PID> -n ip addr show"
  ],
  "docLinks": [
    { "label": "man7: network_namespaces", "url": "https://man7.org/linux/man-pages/man7/network_namespaces.7.html" },
    { "label": "Kubernetes", "url": "https://kubernetes.io/docs/concepts/cluster-administration/networking/" }
  ]
}

```
`docLinks` (optional) is an ordered list of `{ label, url }` links to the
**official documentation for that specific component**, rendered as an "Official
Docs" chip row at the bottom of the inspector (after `explorationCommands`) by
`DocLinks.jsx`. Include the OpenShift and/or Kubernetes page when either applies,
plus the upstream project's own docs where that is the authoritative source
(e.g. `KubeVirt`, `MetalLB`, `etcd`, `CRI-O`, `Cluster API`); for pure Linux
kernel primitives the relevant `man7` page is the authoritative source. `label`
names the doc source so a component can carry several.
### Event Workflow Schema (events.json)
Note the two distinct ingress flows (modeling invariant #7): `api-ingress-traffic`
(control-plane / API, terminating at the Guest API Server, shown below) and
`app-ingress-traffic` (the `*.apps` wildcard application path through the guest's
own ingress router). Application traffic must NOT be routed through the Shared
Ingress Proxy.

```json
{
  "eventId": "api-ingress-traffic",
  "eventName": "Control-Plane / API Ingress",
  "description": "Tracing an 'oc'/'kubectl' request to the hosted cluster's API down to the Guest API Server, via the Shared Ingress proxy's MetalLB VIP and SNI routing. This path stays in the management cluster and never enters a guest VM.",
  "steps": [
    {
      "step": 1,
      "sourceComponentId": "external-client",
      "targetComponentId": "svc-ingress-lb-shared",
      "description": "An 'oc' client resolves the guest's API hostname to the Shared Ingress LoadBalancer VIP; a MetalLB speaker answers ARP, so the request lands on the bare metal cluster."
    },
    {
      "step": 2,
      "sourceComponentId": "svc-ingress-lb-shared",
      "targetComponentId": "shared-ingress-proxy",
      "description": "The LoadBalancer Service DNATs the VIP to a Shared Ingress Proxy endpoint; HAProxy reads the TLS SNI hostname and selects this hosted cluster's control-plane backend."
    },
    {
      "step": 3,
      "sourceComponentId": "shared-ingress-proxy",
      "targetComponentId": "guest-api-server",
      "description": "The proxy forwards to this guest's kube-apiserver Service in the HCP namespace; the Guest API Server Pod terminates and serves the request — traffic never leaves the management control plane."
    }
  ]
}

```
## Adding a New Component

Adding a component touches several places — keep them in sync:

1. **`src/data/components.json`** — new entry with `componentId`, `displayName`, `layer`,
   `typePrefix` (e.g. `Pod`, `Static Pod`, `systemd`, `VirtualMachineInstance`, `Service`,
   `NWPOLICY`),
   `role` (short upper-case kind tag), `runtimeForm` (the concrete K8s kind + namespace,
   e.g. `Deployment · hypershift`), `linuxPrimitive` (the per-instance Linux realisation,
   e.g. `Go binary + controller-runtime` — name the realisation only; do **not** prefix it
   with the supervisor (`Pod →`, `systemd →`, …), which the band structure already conveys),
   `problemSolved` (one concise "why it exists" sentence), `interactions[]`,
   `explorationCommands[]`, and `docLinks[]` (official-docs links — see the
   metadata schema above). Add `logicalContext`
   (`openShiftProject` + `associatedObject`) for application pods and VMIs. `runtimeForm` and
   `linuxPrimitive` are folded into the component's Manifest → Kernel pipeline by
   `pipeline-model.js`. For Pods and systemd services `linuxPrimitive` is folded into the
   process row of the kernel band (`PID 1 · Process` → `PID 1 · <realisation>`); other types
   show it as the kernel band's lead row.
2. **`src/data/zones.js`** — add a node (with `id`, `title`, `typePrefix`, `badges`) to
   the correct zone in the recursive `ZONES` tree. `COMPONENT_COLOR` / `COMPONENT_ZONE`
   derive automatically from the tree.
3. **`src/data/events.json`** — reference the new `componentId` in any flow steps that
   should highlight it and draw connectors to/from it.

The `componentId` must be unique: `ArrowOverlay` locates nodes via
`document.getElementById(componentId)`, so a duplicate id silently drops connector steps.

## Agent Implementation Strategy
 1. **Layout Grid Scaffolding:** Code a highly flexible viewport grid supporting the multi-tier nested node tree. Ensure strict sub-component scale limits to guarantee parts can tile side-by-side on mobile devices.
 2. **Modal Portaling:** Connect global onClick handlers across canvas components to mount data-driven pop-ups fed by components.json.
 3. **Vector Vectorization:** Implement react-xarrows or leader-line rendering modules to capture bounding coordinates of active IDs from events.json and cleanly project adaptive connectors.
