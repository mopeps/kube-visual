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
  │     └── [Dedicated Guest Control Plane Namespace Zone]
  │           │   // Core Management, Lifecycles & Operators
  │           ├── [Pod] HyperShift Operator Instance
  │           ├── [Pod] Cluster Version Operator (CVO) Instance
  │           │
  │           │   // Guest API, State & Authentication Engines
  │           ├── [Pod] Guest API Server Instance
  │           ├── [Pod] Guest OAuth Server Instance
  │           ├── [Pod] Guest Controller Manager Instance
  │           ├── [Pod] Guest Kube-Scheduler Instance
  │           ├── [Static Pod] Etcd State Instance
  │           │
  │           │   // Ingress Control, Networking & Proxy Systems
  │           ├── [Pod] Shared Ingress Proxy Instance
  │           ├── [Pod] OVN-Kubernetes Master Control Instance
  │           ├── [Pod] Cloud Controller Manager (CCM) Instance
  │           ├── [Pod] Konnectivity Server Instance
  │           │
  │           │   // Infrastructure Tooling & Telemetry
  │           ├── [Pod] Ignition Server Instance
  │           ├── [Pod] Guest CoreDNS Instance
  │           └── [Pod] Cluster User Workload Monitoring Instance
  │
  └── [Management Worker Node Zone]
        ├── [systemd Service] Kubelet (Host Resident Node Manager)
        ├── [systemd Service] CRI-O (Host Resident Container Engine)
        ├── [systemd Service] Open vSwitch (Host Native Data Path)
        ├── [Pod] OVN-Kubernetes Node Instance
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
                    │
                    │   // Workload Instances sitting directly inside the VM
                    ├── [Pod] Front-End Workload Instance
                    └── [Pod] Back-End Workload Instance

```
## 2. Dynamic Interactivity & Progressive Disclosure
 * **Default State:** All topology components are visible but set to a dimmed idle opacity state. Do not render raw Linux kernel primitives (netns, cgroups, host PIDs) or Project/Namespace boundaries on the main view.
 * **Event Selection Integration:** Selecting an infrastructure workflow parses events.json, transitions participating objects to full opacity, and dynamically overlays ordered, numbered, directional connecting vectors (①, ②, ③) showing execution paths. Vector lines must auto-recalculate paths on window resize.
 * **Interactive Modal System:** Clicking any structural component container opens a mobile-friendly overlay pop-up modal serving progressive metadata disclosures:
   * **Workload Pods:** Expose logical OpenShift Project metadata, isolated Linux Network Namespace (netns), host-side veth pair IDs, and cgroups slice boundaries.
   * **systemd Services:** Reveal corresponding host service unit configuration paths and tracking metrics.
   * **VirtualMachineInstance:** Expose the host qemu-kvm process execution details, host-side virtual network tap configuration (tap0), and master cgroup runtime boundaries.
   * **Guest Controller Manager:** Reveal internal control loops (NodeLifecycleController, EndpointController, etc.) running inside the binary.
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
    "Attaches to a guest-side veth pair managed by the OVN-Kubernetes Guest Node Daemon.",
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
   `typePrefix` (e.g. `Pod`, `Static Pod`, `systemd`, `VirtualMachineInstance`),
   `problemSolved`, `interactions[]`, `explorationCommands[]`. Add `logicalContext`
   (`openShiftProject` + `associatedObject`) for workload pods and VMIs.
2. **`src/data/zones.js`** — add a node (with `id`, `title`, `typePrefix`, `badges`) to
   the correct zone in the recursive `ZONES` tree. `COMPONENT_COLOR` / `COMPONENT_ZONE`
   derive automatically from the tree.
3. **`src/components/LinuxInternalsTab.jsx`** / **`ObjectMapTab.jsx`** — add
   KIND / PRIMITIVE / icon mappings if the component should surface in those tabs.
4. **`src/data/events.json`** — reference the new `componentId` in any flow steps that
   should highlight it and draw connectors to/from it.

The `componentId` must be unique: `ArrowOverlay` locates nodes via
`document.getElementById(componentId)`, so a duplicate id silently drops connector steps.

## Agent Implementation Strategy
 1. **Layout Grid Scaffolding:** Code a highly flexible viewport grid supporting the multi-tier nested node tree. Ensure strict sub-component scale limits to guarantee parts can tile side-by-side on mobile devices.
 2. **Modal Portaling:** Connect global onClick handlers across canvas components to mount data-driven pop-ups fed by components.json.
 3. **Vector Vectorization:** Implement react-xarrows or leader-line rendering modules to capture bounding coordinates of active IDs from events.json and cleanly project adaptive connectors.
