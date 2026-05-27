# kube-visual

https://mopeps.github.io/kube-visual/

An interactive web application that visualizes OpenShift/Kubernetes cluster architecture as a nested containment diagram. Select cluster events to trace how traffic and control signals move through the stack — from external clients down to Linux kernel primitives like network namespaces and cgroups.

## Features

- **Nested containment layout** — Cluster → Node → Namespace → Pod → Linux Kernel Primitives, rendered as nested HTML containers rather than flowcharts
- **Event-driven tracing** — Pick a cluster event from the sidebar to highlight the participating components and draw numbered directional arrows showing the data path
- **Progressive disclosure** — Linux kernel layers (netns, cgroups, container process) are hidden by default; expand them by clicking a pod or selecting an event
- **Object Inspector** — Click any component block to open a slide-out panel with an architectural description, interaction list, and copyable terminal commands for live cluster exploration
- **Breadcrumb navigation** — A dynamic breadcrumb at the top of the canvas tracks your current drill-down depth

## Quick Start

**Requirements:** Node.js 18+

```bash
# 1. Clone the repository
git clone https://github.com/mopeps/kube-visual.git
cd kube-visual

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open `http://localhost:5173` in your browser.

## Usage

**Exploring the topology**

The canvas shows the full cluster structure on load, with all components dimmed. The left sidebar lists available cluster events.

**Tracing an event**

Click an event in the sidebar (e.g. "External Ingress Traffic Flow") to:
1. Highlight the components involved in that event
2. Draw numbered arrows showing the step-by-step data path
3. See a step-by-step description in the sidebar below the event list

Click the same event again, or the "Clear Event" button, to return to the idle state.

**Drilling into a pod**

Click the "Expand" button on any Pod box to reveal its internal Linux kernel primitives — Network Namespace, cgroups, and the Container Process. Click "Collapse" to hide them again.

**Inspecting a component**

Click any box on the canvas to open the Object Inspector panel on the right. It shows:
- What problem the component solves
- How it interacts with other components
- Terminal commands you can run on a live cluster to explore it

Click the **×** button or click the empty canvas background to close the panel.

## Adding Events

Events are defined in `src/data/events.json`. Each event follows this schema:

```json
{
  "eventId": "my-event",
  "eventName": "My Event Name",
  "description": "A short description shown in the sidebar.",
  "steps": [
    {
      "step": 1,
      "sourceComponentId": "api-server",
      "targetComponentId": "kubelet",
      "description": "Step description shown in the step list."
    }
  ]
}
```

`sourceComponentId` and `targetComponentId` must match the `id` attributes on the rendered component boxes (see `src/components/Canvas.jsx` for the full list of IDs).

## Adding Component Metadata

Component Inspector data lives in `src/data/components.json`. Add an entry for any component you want to make inspectable:

```json
{
  "componentId": "my-component",
  "displayName": "My Component",
  "layer": "Management Layer",
  "problemSolved": "Explain what this component does and why it exists.",
  "interactions": [
    "Describe one interaction with another component.",
    "Describe another interaction."
  ],
  "explorationCommands": [
    "# Comment explaining the command\nthe-actual-command --with flags"
  ]
}
```

Valid `layer` values: `External`, `Management Layer`, `Host Networking Subsystem`, `Linux Kernel Primitives`.

## Project Structure

```
src/
├── data/
│   ├── events.json          # Cluster event definitions
│   └── components.json      # Component metadata for the inspector panel
├── components/
│   ├── Canvas.jsx           # Main workspace with nested containment layout
│   ├── Sidebar.jsx          # Event list and step-by-step description panel
│   ├── ComponentBox.jsx     # Reusable clickable component block
│   ├── PodLayer.jsx         # Pod boundary with expand/collapse
│   ├── KernelPrimitives.jsx # netns, cgroups, container process (hidden by default)
│   ├── ArrowOverlay.jsx     # Directional arrows rendered via react-xarrows
│   ├── InspectorPanel.jsx   # Slide-out object inspector
│   └── Breadcrumb.jsx       # Dynamic drill-down breadcrumb
└── hooks/
    └── useEventState.js     # Central state: active event, selected component, expanded pods
```

## Tech Stack

| Tool | Purpose |
|---|---|
| [Vite](https://vitejs.dev) | Build tool and dev server |
| [React](https://react.dev) | UI framework |
| [Tailwind CSS v3](https://tailwindcss.com) | Utility-first styling |
| [react-xarrows](https://github.com/Eliav2/react-xarrows) | SVG connector arrows between DOM elements |

## Build for Production

```bash
npm run build
```

Output is written to `dist/`. Serve it with any static file host.
