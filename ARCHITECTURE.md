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
  │     │   // the OVN-K Node stacks above (programs) the Open vSwitch data plane
  │     ├── [Pod] OVN-Kubernetes Node Instance
  │     ├── [systemd Service] Open vSwitch (Host Native Data Path)
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
  │           ├── [Pod] Control Plane Operator (CPO) Instance ──┐  // expandable "operator set"
  │           │      // Control-plane operands the CPO deploys — each a REAL,
  │           │      // separate Deployment Pod, nested only to manage clutter:
  │           │      ├── [Pod] OpenShift API Server
  │           │      ├── [Pod] OpenShift OAuth API Server
  │           │      ├── [Pod] OpenShift Controller Manager
  │           │      ├── [Pod] Route Controller Manager
  │           │      ├── [Pod] Hosted Cluster Config Operator (HCCO)
  │           │      ├── [Pod] Cluster Network Operator (CNO)
  │           │      ├── [Pod] Multus Admission Controller
  │           │      ├── [Pod] Cluster Policy Controller
  │           │      ├── [Pod] Machine Approver
  │           │      └── [Pod] Cluster Autoscaler
  │           ├── [Pod] Cluster Version Operator (CVO) Instance ──┐  // also an "operator set"
  │           │      // Second-level cluster operators the CVO reconciles from
  │           │      // the release payload (each reports a ClusterOperator):
  │           │      ├── [Pod] Ingress Operator
  │           │      ├── [Pod] DNS Operator
  │           │      ├── [Pod] Authentication Operator
  │           │      ├── [Pod] Storage Operator
  │           │      ├── [Pod] CSI Snapshot Controller
  │           │      ├── [Pod] Image Registry Operator
  │           │      ├── [Pod] Node Tuning Operator
  │           │      ├── [Pod] OLM Operator
  │           │      ├── [Pod] Catalog Operator
  │           │      └── [Pod] Package Server
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
  │           │      ├── [API Object] EndpointSlice
  │           │      ├── [Custom Resource] DNS / Ingress / Network (config.openshift.io)
  │           │      ├── [Custom Resource] Authentication / Image / Proxy / Infrastructure
  │           │      └── [Custom Resource] Subscription / CSV / CatalogSource / InstallPlan / OperatorGroup (OLM)
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
        │   // the OVN-K Node stacks above (programs) the Open vSwitch data plane
        ├── [Pod] OVN-Kubernetes Node Instance
        ├── [systemd Service] Open vSwitch (Host Native Data Path)
        ├── [Pod] KubeVirt virt-handler Instance (VMI node agent)
        │
        └── [Pod] KubeVirt Launcher Container
              └── [VirtualMachineInstance] Guest Worker Node
                    ├── [systemd Service] Kubelet (Guest Resident Node Manager)
                    ├── [systemd Service] CRI-O (Guest Resident Container Engine)
                    │   // the OVN-K Node stacks above (programs) the Open vSwitch,
                    │   // which expands in place to reveal the Service / NetworkPolicy
                    │   // objects realized as br-int flows on it (not standalone cards):
                    ├── [Pod] OVN-Kubernetes Guest Node Instance
                    ├── [systemd Service] Open vSwitch (Guest Native Data Path)
                    │     ├── [Service · ClusterIP] Front-End Application Service
                    │     ├── [Service · ClusterIP] Back-End Application Service
                    │     └── [NWPOLICY] E-Commerce Network Policy (front-end → back-end ingress)
                    ├── [Pod] Konnectivity Agent Instance
                    ├── [Pod] CoreDNS Node Instance
                    │
                    │   // Per-node agents (DaemonSets) — the data-plane side of the
                    │   // control-plane operators above (DNS Op → CoreDNS, CNO → Multus,
                    │   // Node Tuning Op → TuneD, Storage Op → CSI node driver)
                    ├── [Pod] Multus CNI Instance
                    ├── [Pod] Node Tuning (TuneD) Instance
                    ├── [Pod] CSI Node Driver Instance
                    ├── [Pod] Image Registry Instance
                    ├── [Pod] OpenShift Ingress Router Instance
                    ├── [Service · LoadBalancer] Ingress Router VIP (MetalLB L2)
                    ├── [Pod] Cluster Monitoring Instance (openshift-monitoring)
                    │
                    │   // Application Instances inside the VM (their ClusterIP Services
                    │   // and NetworkPolicy are nested in the Open vSwitch above)
                    ├── [Pod] Front-End Application Instance
                    └── [Pod] Back-End Application Instance

```

### First Overview Rendering Rule (the primary canvas grid)

The primary overview layout is a **whitelist**: it may render *only* components that
fall into one of these three categories. Anything that is not one of these three is kept
off the main canvas (it surfaces elsewhere — e.g. in a detail modal, the etcd intent
store, or a trace-only zone).

**Replica presentation:** the modeled cluster runs **three masters and three workers**,
but only one of each renders as a full zone. The identical siblings render as condensed
**replica node zones** (`zone.replicaNodes` in `zones.js`) — real bordered node zones,
side by side in a row trailing the detailed zone, that carry *only* the components
moving traffic between nodes: the `OVN-K8s Node → Open vSwitch` data-plane pair
(`programs` br-int) and the MetalLB speaker. Each card keeps a replica-scoped DOM id
(`ovs-worker-2`, …) so overlays/flows can anchor per node, but opens the **canonical**
component's modal via its `mirror` field (the software is identical); the zone label
opens a popup explaining the HA story (etcd quorum / capacity spread) and what is not
drawn. Hidden by default for a clean main view — revealed by the wide-desktop
**All nodes** toggle, and forced on by the network overlay (its per-node gateway-router
chips anchor here).

1. **The Context / Zone Boundaries** — the macro physical/virtual boundaries that frame
   everything else: `[Management Cluster]`, `[Management Master Node]`,
   `[Dedicated Guest Control Plane Namespace]`, `[Management Worker Node]`,
   `[Guest Worker Node VM]`. Border style is a rule, not a per-zone choice:
   **physical/virtual machine boundaries draw solid; Kubernetes Namespace zones draw
   dashed** (`dashed: true` in `zones.js`) — a namespace is a logical grouping, not a
   wall, and every namespace zone (the Guest Control Plane Namespace, …) must wear
   the same dashed treatment. (MetalLB is the exception we draw at node level: both
   its speaker *and* its controller sit on the node as cards, not inside a separate
   `metallb-system` namespace zone, since MetalLB is a per-node networking concern.)
2. **The Active Enforcers (`systemd` Services)** — binary systems executing
   continuous loop cycles directly on a host OS or guest OS instance: `Kubelet`, `CRI-O`,
   `Open vSwitch`, `virt-handler`. `Open vSwitch` is the host's data-plane switch
   (`ovs-vswitchd` owning `br-int`); it is stacked directly beneath the `OVN-Kubernetes
   Node` Pod that *programs* its `br-int` flows — the same vertical pairing used for a
   Service over the Pod it fronts (see §4), expressing "control plane configures data plane".
3. **The Concrete Application / Data Plane Instances** — discrete compute packages running
   processes: `Pods`, `Static Pods`, `VirtualMachineInstances`.
4. **The Networking / Policy Abstractions** — Kubernetes `Service` and `NetworkPolicy`
   objects that front or guard the applications above. Unlike pure-intent records, these have
   a *concrete data-plane realization*: a `ClusterIP` is a virtual IP backed by OVN
   load-balancer flows (DNAT), and a `LoadBalancer` (here, **MetalLB in L2 mode**) is an
   external VIP advertised over ARP/NDP. A `NetworkPolicy` is likewise declarative, but OVN
   compiles it into address sets + ACLs in the Northbound DB that become allow/drop
   OpenFlow rules enforced on `br-int`. That data-plane footprint earns each one
   representation on the canvas: `[Service]`, `[NWPOLICY]` (the compact card prefix for the
   `NetworkPolicy` kind). A `LoadBalancer` Service stacks directly above the Pod it exposes
   (a vertical pair). The objects with *no* identity apart from the flows they compile to —
   the guest `ClusterIP` Services and the `NetworkPolicy` — are instead **nested inside the
   `Open vSwitch` that realizes them**, which expands in place to reveal them as those
   `br-int` flows (a progressive-disclosure grouping like the operator set in §2, not
   standalone cards, since the switch *is* where they live in the data plane).

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
expandable controller-manager "controller set" rather than as cards (see §2). One
**deliberate exception** to "an instance earns a card" is the **operator set** (§2):
the ~20 OpenShift operators HCP relocates into the management HCP namespace *are*
real Pods, but they are nested inside their owner (the Control Plane Operator / Cluster
Version Operator) as a progressive-disclosure grouping purely to keep the canvas legible
and two-up on mobile — not because they fail the whitelist.

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
 * **Etcd Intent Stores (expandable nodes):** Both etcd nodes double as homes for the API objects they persist — desired-state records, **not** Linux processes, so they are deliberately not rendered as sibling cards next to real Pods. **Management Etcd** holds the HCP control-plane intent and the worker-provisioning chain (`HostedCluster`, `HostedControlPlane`, `NodePool`, and the Cluster API → KubeVirt objects: `Cluster`, `MachineDeployment`, `MachineSet`, `Machine`, `KubevirtMachine`, `VirtualMachine`). **Guest Etcd** holds the guest cluster's own records that have no data-plane card (`ClusterVersion`, `ClusterOperator`, `Route`, the application `Deployment`/`ReplicaSet`, their `Secret`/`ConfigMap`/`PersistentVolumeClaim`/`PersistentVolume`, the `EndpointSlice`s behind its Services, the `config.openshift.io` singletons the relocated operators reconcile — `DNS`, `Ingress`, `Network`, `Authentication`, `Image`, `Proxy`, `Infrastructure` — and the OLM records `Subscription`, `ClusterServiceVersion`, `CatalogSource`, `InstallPlan`, `OperatorGroup`). Realized Services and the NetworkPolicy keep their own cards; only pure records live inside the store. Clicking an etcd node enlarges it in place to reveal these objects. Inside the expanded store: clicking the **title** (ⓘ) opens etcd's own detail popup; clicking an **object** opens that record's popup; clicking the empty body, the ▴ chevron, outside the card, or pressing **Esc** collapses it. A node declares this behavior via an `intentObjects` array in `zones.js`.
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
 * **Operator Sets (expandable nodes):** The two operator-owner nodes in the
   guest control-plane namespace — the **Control Plane Operator** and the
   **Cluster Version Operator** — reuse the same expand-in-place card, but with a
   **deliberate semantic difference from the two stores above, which the
   whitelist in §1 must be read against.** An operator set's members are *real,
   separate Deployment Pods*, not records in a key-value store or goroutines
   sharing one process. They would each qualify for their own card under §1, but
   HCP relocates ~20 OpenShift operators into the management cluster's HCP
   namespace, and rendering them all flat would wreck the mobile two-up layout.
   So the operator set is a **progressive-disclosure grouping by owner**: the
   parent is the thing that *deploys and reconciles* the children (the CPO stamps
   out the control-plane operands — the OpenShift API extension servers, HCCO,
   CNO, and the HyperShift controllers; the CVO reconciles the second-level
   cluster operators from the release payload, each reporting a `ClusterOperator`,
   including the OLM trio). It is **not** a claim that the children live inside
   the parent's process. The interaction model is identical to the intent store
   and controller set: the **title** (ⓘ) opens the owner's detail popup; an
   **operator** opens that operator's popup; clicking the empty body, the ▴
   chevron, outside the card, or pressing **Esc** collapses it. Each operator is
   an ordinary `[Pod]` whose detail popup shows its full Manifest → Kernel
   pipeline. A node declares this behavior via an `operators` array (plus an
   optional `operatorSetCaption`) in `zones.js`, rendered by
   `OperatorSetCard.jsx`. The data-plane agents these operators manage on the
   guest nodes (CoreDNS, Multus, TuneD, the CSI node driver, the image registry,
   the ingress router) run *inside the guest VMs* and keep their own flat cards
   in the Guest Worker Node zone.
 * **Deep Dive tab (secondary surface):** A third tab — **Deep Dive**, sitting to
   the *left* of Overview so the topology stays the first thing you see — holds
   ground-up explainers one level below the cluster: the **systemd state
   reconciliation loop** (followed through `ovnkube-node.service`), the standard
   **Linux boot** sequence, how an **OpenShift/HCP node boots** (NodePool →
   MachineConfig → Ignition Server → VMI → kubelet joins), and the
   **OVN-Kubernetes logical network topology** (the classic two-node diagram —
   underlay → per-node `GR_<node>` gateway chains → `LS "join"` →
   `ovn_cluster_router` → per-node pod switches — with three trace flows:
   same-node, cross-node Geneve, SNAT egress), plus two twin views of it: the
   "big view" (the same boxes drawn inside the greyed OpenShift components that
   contain them) and the **guest-cluster topology** (the identical wiring as run
   by the hosted cluster, one turtle down — every "node" a KubeVirt VMI, the
   underlay the management cluster's pod network, the NB DB rows in the HCP
   namespace, with Geneve-in-Geneve and double-SNAT trace flows), and the
   **full HCP picture** combining the two: both SDNs on one canvas — the
   management topology on the bare-metal workers, the guest topology nested
   inside each worker's VMI zone, two stacked logical cores (mgmt NB DB /
   guest NB DB in the HCP namespace), every group of boxes inside its greyed
   OpenShift component, and the virt-launcher pod drawn as the seam where the
   layers meet (`tap ↔ virtio` — one NIC, two SDNs). **It deliberately
   mirrors the Overview's interaction model rather than the packet flow:** a topic
   index + switcher opens a canvas of labelled **zones** holding **clickable
   boxes** (reusing `Zone.jsx`/`NodeCard.jsx`), and clicking a box opens a detail
   **popup** (`DeepDiveModal`, reusing `AncestryModal`'s gestures/CSS) with prose,
   key/value rows, copyable commands, an example unit, or an ASCII blueprint.
   A box may carry `componentId` naming the registered overview object it *is*
   (the OVN views' OpenShift-machinery chips, the launcher pod, the guest app
   pods): with no `detail` of its own the click opens the component's real
   `AncestryModal` — the same sheet as the Overview, never a copy — and with a
   `detail` the popup keeps its view-specific teaching and adds an
   "object card ↗" chip through to that sheet (chip titles/[typePrefix] come
   from `components.json` via `components-index`, so the views cannot drift). Each
   topic is pure data in `src/data/deep-dives.js` — a zone tree (`zones → boxes`),
   not registered in `zones.js`/`components.json` — so a new explainer is just
   another entry. The systemd topic additionally declares a `reconciliation`
   descriptor that drives an **animated loop** (`useReconciliationLoop`): a
   "Kill Main PID" control fires `SIGCHLD` up to the PID 1 engine, flips the DAG
   box to `UNIT_FAILED`, then animates the `fork()/execve()` restart, with the two
   dependency dimensions — **Requires** (structural, solid badge) vs **After**
   (chronological, dashed badge) — drawn distinctly. It is also reachable via a
   `systemd ↗` chip beside the `[UNIT]` tag in any systemd-service detail modal,
   which deep-links straight to the systemd page (the OVN/OVS components carry the
   same chip into the OVN topology page). Rendered by `DeepDiveTab.jsx` →
   `DeepDiveCanvas.jsx`. Generic layout/edge facilities exist for diagram-shaped
   topics: a zone may declare `layout: 'columns'` (child zones side-by-side as equal
   columns; stacks under 640px), `layout: 'stack'` (boxes as a centred vertical
   chain), or `bare: true` (no label/border/fill — an invisible layout container; a
   bare stack centres its content vertically, which is how the OVN shared core
   floats between the two node columns). Boxes may carry their own `colorVar`
   (colour-coding switches/routers/pods like the source diagram), `inline: true`
   (consecutive inline boxes share one row — pods two-up under their switch), or
   `spacer: true` (an empty flex-grow gap inside a stretch-aligned column). A topic
   may declare `topology.edges` — **always-on labeled wiring** (same edge schema as
   `reconciliation.edges`, plus `axis`/`kindLabel`/`quiet`, `step: ''`) drawn by
   `ReconLoopOverlay` with clickable IP/port labels; `quiet: true` renders a plain
   text annotation instead of the pill chip, and a label-less edge draws as a bare
   line. A topic sets `reconciliation` *or* `topology`, never both (their canvas gap
   rules conflict); the static wiring hides under 640px where the stacked columns
   would make it criss-cross.
 * **Big view & Network mode (Overview, wide desktop ≥1280px):** two header
   toggles. **Big view** renders the **whole normal Overview three times in
   parallel columns** — one per node pair. **Network** (enabled only once Big view
   is on, since the OVN core spans all three columns) floats the shared OVN logical
   objects over the top.
   `OverviewTab.jsx` reuses its own `renderOverviewStack()` (the exact normal-canvas
   content) inside three `#net-col-N` columns, so every card still opens its true
   `AncestryModal` and every special card (etcd intent store, controller/operator
   sets, realized Service/NetworkPolicy flows, MetalLB) renders unchanged. The
   **logical objects are not zones**: the management join switch + `ovn_cluster_router`
   (`NET_LOGICAL.mgmt` in `src/data/network-zones.js`) float, dashed, in a reserved
   strip **above** the columns; the guest join/router (`NET_LOGICAL.guest`) float in
   a reserved strip **below** — each spanning all three columns so it reads that one
   switch / one router is shared by every pair, parked in empty space so they never
   cover a card. `NET_CONNECTORS` leg each column up to the mgmt core
   (`net-col-top-N`) and down to the guest core (`net-col-bot-N`) via
   `ReconLoopOverlay` (`idPrefix=''`). The trailing replica rows are suppressed in
   this mode (the three columns are the three pairs). **With Network on, the columns
   are also pruned to network-only**: `filterNetworkZone()` keeps just the components
   whose `role` (components.json) is a network role — plus the network control-plane
   operators (Cluster Network / Multus / Ingress / DNS), surfaced out of the CPO/CVO
   operator-set cards as standalone cards — and drops everything else (control-plane
   pods, etcd, storage, monitoring, app workloads) and any now-empty zone. The
   classifier is `isNetworkComponent` in `src/data/network-components.js`. On phones the OVN deep-dive
   topic carries the same story instead.
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
   derive automatically from the tree. To nest a component inside an expandable parent
   instead of giving it a sibling card, add it to the parent's `intentObjects` (etcd
   records), `controllers` (controller-manager loops), `operators` (operator Pods the
   CPO/CVO own), or `realizes` (Services / NetworkPolicies an Open vSwitch realizes as
   `br-int` flows) array rather than the zone's `nodes`; the matching
   `INTENT_OBJECT_STORE` / `CONTROLLER_PARENT` / `OPERATOR_PARENT` / `FLOW_PARENT` map is
   derived automatically so trace highlighting can expand the parent first. To stack one
   node directly above another it relates to (joined by the dotted ServicePair link), give
   the top node an `exposes` (Service → workload) or `programs` (OVN-K Node → Open vSwitch)
   field naming the in-zone sibling below it.
3. **`src/data/events.json`** — reference the new `componentId` in any flow steps that
   should highlight it and draw connectors to/from it.

The `componentId` must be unique: `ArrowOverlay` locates nodes via
`document.getElementById(componentId)`, so a duplicate id silently drops connector steps.

## Agent Implementation Strategy
 1. **Layout Grid Scaffolding:** Code a highly flexible viewport grid supporting the multi-tier nested node tree. Ensure strict sub-component scale limits to guarantee parts can tile side-by-side on mobile devices.
 2. **Modal Portaling:** Connect global onClick handlers across canvas components to mount data-driven pop-ups fed by components.json.
 3. **Vector Vectorization:** Implement react-xarrows or leader-line rendering modules to capture bounding coordinates of active IDs from events.json and cleanly project adaptive connectors.
