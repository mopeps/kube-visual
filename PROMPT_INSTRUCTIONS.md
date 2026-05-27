# AI Coding Agent Instructions

This file contains the original prompt instructions used to build kube-visual.

---

# Instruction 1: Interactive OpenShift-to-Linux Blueprint Tool

## Project Goal
Build a frontend-only interactive web application that provides a nested, containment-based visual mapping of OpenShift cluster-level logical objects down to their underlying Linux kernel primitives. The core utility is tracing dynamic interaction and communication flows across these layers based on user-selected cluster events.

## 1. UI Structural & Visual Hierarchy
The application must render a containment-based grid layout using a strict visual hierarchy. Avoid linear flowcharts; use nested HTML container boxes to show strict ownership and boundaries.

### Component Nesting Map
```text
[Cluster Boundary]
  ├── [Management Layer (Red/Purple Boxes)]
  │     └── API Server, Controllers, Kubelet, CRI-O
  └── [Infrastructure Node Boundary (Green Boxes)]
        ├── [Logical Kubernetes Namespace / Project Boundary (Dashed Blue Boxes)]
        │     └── [Pod Boundary]
        │           └── [Linux Isolation Layer (Kernel Primitives)]
        │                 ├── Network Namespace (netns)
        │                 ├── Control Groups (cgroups)
        │                 └── [Container Process (PID 1)]
        └── [Host Networking Subsystem]
              └── OVS Bridge (br-int), veth pairs, Routing Tables
```

## 2. Core Features & Interactivity Requirements
 * **State 1: Default Structural Map:** Display the nested topology cleanly. All components are visible but dimmed to an idle opacity (e.g., opacity-40).
 * **State 2: Event-Driven Tracing:** Provide a sidebar dropdown or list of "Events" (e.g., *Pod Spawning*, *Ingress TLS Termination*, *Pod-to-Pod OVN Traffic*).
 * **Dynamic Illumination:** When an event is selected:
   1. Highlight only the participating boxes/primitives to opacity-100.
   2. Draw ordered, numbered, directional connecting arrows between the components to show the data path or reconciliation loop.
   3. Display a small, concise step-by-step text sidebar explaining the chronological interactions.

## 3. Recommended Technical Stack
To keep the project lightweight, maintainable, and open-source friendly, use the following stack:
 * **Framework:** React or Vue.js (for state management of active layers/events).
 * **Styling:** Tailwind CSS (for crisp, color-coded, flexible layout wrappers).
 * **Connector Lines:** leader-line (JS library) or react-xarrows to dynamically render smooth, responsive connecting vectors between nested HTML elements.
 * **Data Layer:** A clean, decoupled events.json data model.

## 4. MVP Target: Initial Event Data Model
Implement this specific data schema in a standalone JSON file to trace the **Pod Network Traffic Ingress via Route** event:
```json
{
  "eventId": "route-ingress-traffic",
  "eventName": "External Ingress Traffic Flow",
  "description": "Tracing an HTTPS request from an external client to an app pod via OVN-Kubernetes.",
  "steps": [
    {
      "step": 1,
      "sourceComponentId": "external-client",
      "targetComponentId": "ingress-router-haproxy",
      "description": "Client initiates connection; HAProxy terminates TLS at the Route layer."
    },
    {
      "step": 2,
      "sourceComponentId": "ingress-router-haproxy",
      "targetComponentId": "ovs-bridge-br-int",
      "description": "Traffic is forwarded into the OVN-Kubernetes host integration bridge."
    },
    {
      "step": 3,
      "sourceComponentId": "ovs-bridge-br-int",
      "targetComponentId": "host-veth-pair",
      "description": "OVS routes the packet through the host-side virtual Ethernet interface."
    },
    {
      "step": 4,
      "sourceComponentId": "host-veth-pair",
      "targetComponentId": "pod-netns",
      "description": "Packet crosses the boundary into the Pod's isolated Linux Network Namespace."
    },
    {
      "step": 5,
      "sourceComponentId": "pod-netns",
      "targetComponentId": "container-process",
      "description": "The application process (PID 1) accepts the cleartext socket connection."
    }
  ]
}
```

## Next Action Items for the Agent
 1. Scaffold the base web page with a sidebar on the left and a massive canvas workspace container on the right.
 2. Build the visual layout of nested components using hardcoded CSS grids or flexboxes based on Section 1.
 3. Wire the JSON event data model to trigger opacity updates and render connecting lines when an event is clicked.

---

# Instruction 2: UI Layering & Progressive Disclosure

## Objective
Implement a multi-layered, zoomable visual interface that prevents cognitive overload by hiding deep Linux implementation details until explicitly requested by the user.

## 1. Visibility Matrix (The 3-Stage Reveal)
Configure the components into three distinct visibility states based on user interaction:

| Component / Layer | Default View State | Expanded View State | Visual Style |
|---|---|---|---|
| **Layer 1: Cluster & Nodes** | **Visible** | **Visible** | Solid outer boundaries (Gray/Dark background) |
| **Layer 2: Projects & Pods** | **Visible** | **Visible** | Solid logical boxes (Blue/Purple accents) |
| **Layer 3: CRI-O Containers** | **Hidden** | **Visible** | Nested inside Pods (Dashed borders) |
| **Layer 4: Linux Kernel Primitives** (netns, veth, cgroups) | **Hidden** | **Visible** | Nested deep inside Pods/Nodes (Green accents) |

## 2. Interaction Triggers for Expanding Deep Layers
The coding agent must programmatically transition hidden layers (Layers 3 and 4) from display: none or collapsed states into fully visible states via two triggers:

### Trigger A: Direct User Selection (Drill-Down)
 * When a user **clicks** on a specific Pod box, smoothly expand the box or open a side panel to reveal its internal container runtime boundary and Linux kernel primitives (netns, veth mapping).

### Trigger B: Event-Driven Automation
 * When an event is selected from the sidebar, the application must **automatically expand only the specific parent containers** involved in that workflow.
 * *Example:* If "Pod-to-Pod OVN Traffic" is selected, automatically expand the involved Pod boxes to reveal their inner Network Namespaces and host veth interfaces so connector arrows can map the path accurately. Unrelated layers (like Storage/PVs) remain collapsed.

## 3. Visual Styling Rules
 * **Depth Cueing:** Use progressive background shading. Inner nested boxes must use a darker, contrasting background than their parent containers to create a distinct visual illusion of depth.
 * **Breadcrumb Navigation:** When deep layers are exposed, render a dynamic structural breadcrumb at the top of the workspace canvas (e.g., Cluster ➔ Node-01 ➔ Project: App ➔ Pod: Web ➔ Linux NetNS).
 * **Idle State:** When an event is active, dim all non-participating structural elements to opacity-30 or opacity-40 to maintain focus on the active data path.

---

# Instruction 3: Interactive Object Inspector Sidebar

## Objective
Implement an "Object Inspector" slide-out panel or floating card that activates whenever a user clicks on any visual block in the blueprint canvas. This panel provides deep architectural context, dependency tracking, and real-world terminal verification commands.

## 1. Metadata Schema (components.json)
Every clickable box on the canvas must map to a standalone structural data entry following this exact JSON schema format:
```json
{
  "componentId": "pod-netns",
  "displayName": "Linux Network Namespace (netns)",
  "layer": "Linux Kernel Primitives",
  "problemSolved": "Provides network virtualization and isolation. It gives each Pod a private routing table, IP address, and packet filtering space, preventing port conflicts on the host.",
  "interactions": [
    "Attaches to a host-side veth pair to bridge traffic out of the namespace.",
    "Provisioned and configured by the OVN-Kubernetes CNI plugin during pod creation."
  ],
  "explorationCommands": [
    "# Step 1: Find the target host PID of the container process\ncrictl inspect <container_id> | grep pid",
    "# Step 2: Enter the isolated network namespace using the PID to view interfaces\nnsenter -t <PID> -n ip addr show"
  ]
}
```

## 2. UI & Interaction Requirements
 * **Trigger State:** Clicking any structural container box captures its unique componentId and sets the active component state.
 * **Component Feedback:** The clicked box on the canvas must immediately receive a distinct active border outline (e.g., a glowing ring or high-contrast border) to signal selection.
 * **The Inspector Panel Layout:** Render a clean, non-obtrusive right-side slide-out panel containing:
   1. **Header:** Displays displayName and the corresponding layer category banner.
   2. **Problem Solved Section:** A text block rendering the problemSolved string to explain architectural intent.
   3. **Interactions List:** A bulleted loop rendering the items in the interactions array.
   4. **Terminal Exploration Block:** A dark, monospaced code snippet container block displaying the commands in explorationCommands with a 1-click "Copy Code" clipboard button helper.
 * **Dismissal:** Provide an obvious close button (X) or allow clicking on the empty canvas background to clear the active selection and close the panel.
