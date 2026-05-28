
# AI Coding Agent Instructions
This document defines the architectural specifications and data models for building **kube-visual**—an interactive, frontend-only web blueprint mapping OpenShift Hosted Control Planes (HCP) to their underlying systems infrastructure.
# Instruction 1: Multitier Cluster Topology Canvas & Mobile Optimization
## Project Goal
Build a frontend-only interactive layout providing a nested visual mapping of an OpenShift Management Cluster hosting a Client Cluster (HCP topology), tracing communication flows based on user-selected infrastructure events.
## 1. UI Structural & Mobile Responsiveness Rules
 * **Nomenclature:** Use Context / Zone for macro physical/virtual infrastructure, Container / Instance for runtime isolation, and ensure every element line begins with its exact API/system type in square brackets ([Pod], [Static Pod], [systemd Service]).
 * **Mobile-First Sizing:** The application must deliver excellent usability on mobile displays. Scale down individual block dimensions so that **at least two instances can sit side-by-side** without breaking layout integrity or clipping text strings when viewed on mobile screen width dimensions.
### Component Nesting Map
The main workspace viewport must render this exact structural hierarchy:
```text
[Management Cluster Context]
  │
  ├── [Management Master Node Zone]
  │     └── [Dedicated Guest Control Plane Namespace Zone]
  │           ├── [Pod] Guest API Server Instance
  │           ├── [Pod] Guest Controller Manager Instance
  │           ├── [Pod] Guest Kube-Scheduler Instance
  │           ├── [Pod] Cluster Version Operator (CVO) Instance
  │           ├── [Pod] OVN-Kubernetes Master Control Instance
  │           └── [Static Pod] Etcd State Instance
  │
  └── [Management Worker Node Zone]
        ├── [systemd Service] Kubelet (Host Resident Node Manager)
        ├── [systemd Service] CRI-O (Host Resident Container Engine)
        ├── [systemd Service] Open vSwitch (Host Native Data Path)
        ├── [Pod] OVN-Kubernetes Node Instance (Plumbs Host Network)
        │
        └── [Pod] KubeVirt Launcher Container
              └── [VirtualMachineInstance] Guest Worker Node
                    ├── [systemd Service] Kubelet (Guest Resident Node Manager)
                    ├── [systemd Service] CRI-O (Guest Resident Container Engine)
                    ├── [systemd Service] Open vSwitch (Guest Native Data Path)
                    ├── [Pod] OVN-Kubernetes Guest Node Instance (Manages guest veth routing)
                    │
                    ├── [Pod] Front-End Workload Instance
                    └── [Pod] Back-End Workload Instance

```
## 2. Interactivity Requirements
 * **Idle State:** All components are visible but set to a dimmed idle opacity state. No raw Linux kernel primitives are rendered by default.
 * **Event Selection:** Selecting an infrastructure workflow from the sidebar menu highlights participating objects to full opacity and dynamically renders ordered, sequential badged (①, ②, ③) connection vectors showing execution flow.
## 3. Recommended Technical Stack
 * **Framework & Data:** React or Vue.js 3, pulling from a decoupled events.json model.
 * **Layout & Lines:** Tailwind CSS/custom styles linked with react-xarrows or leader-line to handle fluid, responsive vectors that auto-recalculate on viewport resize.
# Instruction 2: Progressive Disclosure & On-Click Modals
## Objective
Isolate detailed Linux implementations (Namespaces, Cgroups, Processes) inside an interactive pop-up overlay to keep the main canvas streamlined and clean.
## 1. Canvas Constraints
Do not render box boundaries for OpenShift Projects or Kubernetes Namespaces on the primary overview. The main canvas traces layout containment strictly down to the [VirtualMachineInstance] level.
## 2. Interactive Modal System
An onClick mouse state event on any element container launches a centered, mobile-friendly pop-up modal rendering its structural metadata and host-level mappings:
 * **For Pods ([Pod] / [Static Pod]):** Expose logical Namespace metadata, its isolated Linux Network Namespace (netns), host-side veth pair IDs, and cgroups slice allocation.
 * **For Services ([systemd Service]):** Reveal systemd host configuration path details and parent host process metrics.
 * **For VMs ([VirtualMachineInstance]):** Expose the host qemu-kvm runtime process, host-side virtual network tap configuration (tap0), and master cgroup resource blocks.
# Instruction 3: Data Schemas
## 1. Components Data Schema (components.json)
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
## 2. Event Workflow Schema (events.json)
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
## Agent Execution Roadmap
 1. **Layout Grid Scaffolding:** Code a flexible viewport grid supporting the nested node architecture while observing strict width boundaries to guarantee that components can tile cleanly side-by-side on tight screens.
 2. **Modal Portaling:** Hook up the onClick interaction handlers to feed the modal pop-ups dynamically using components.json.
 3. **Vector Vectorization:** Wire up the animation path loops parsing events.json to project directional connector lines that dynamically morph as layouts compress across mobile profiles.
