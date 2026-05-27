---
name: data-model
description: Use this skill when adding or modifying events, component metadata, or the JSON data files that drive the app. Trigger words: event, events.json, components.json, data model, step, sourceComponentId, targetComponentId, explorationCommands, new event, add event, schema, eventId, componentId, layer, problemSolved, interactions, JSON.
---

# Skill: Data Model

Covers the two JSON data files that drive all dynamic content in the app. Both live in `src/data/`.

---

## events.json — event definitions

**Path:** `src/data/events.json`  
**Imported by:** `Sidebar.jsx` (renders the event list), `useEventState.js` (accessed via Sidebar callback)

### Schema

```jsonc
[
  {
    "eventId": "route-ingress-traffic",     // Unique string key. Also used in EVENT_THEMES (Sidebar)
    "eventName": "External Ingress Traffic Flow",  // Displayed in event card title
    "description": "Short blurb...",        // Shown in event card body (line-clamped to 2)
    "steps": [
      {
        "step": 1,                           // 1-based integer. Used as arrow badge number
        "sourceComponentId": "external-client",    // Must be a valid DOM id on the canvas
        "targetComponentId": "ingress-router-haproxy",
        "description": "..."                 // Shown in the FlowSteps list in the sidebar
      }
    ]
  }
]
```

### Constraints

- `eventId` must be unique across all events.
- `sourceComponentId` and `targetComponentId` must match the `id` prop of a rendered `ComponentBox`. Missing IDs cause silent arrow step skips.
- `step` values should be sequential starting from 1. They drive arrow badge labels and staggered animation delays.
- Steps are rendered in array order in the sidebar FlowSteps panel.

### Current events

| eventId | Steps | Key components involved |
|---|---|---|
| `route-ingress-traffic` | 5 | external-client → ingress-router-haproxy → ovs-bridge-br-int → host-veth-pair → pod-netns → container-process |
| `pod-spawning` | 5 | api-server → scheduler → kubelet → crio → pod-cgroups, pod-netns |
| `pod-to-pod-ovn` | 5 | container-process → pod-netns → host-veth-pair → ovs-bridge-br-int → host-veth-pair → pod-netns |

### Adding a new event

1. Append an object to the array following the schema above.
2. Add its `eventId` to `EVENT_THEMES` in `Sidebar.jsx`.
3. Verify every `sourceComponentId` / `targetComponentId` exists as a DOM `id` on the canvas.
4. If the event references kernel primitives (`pod-netns`, `pod-cgroups`, `container-process`), they are auto-revealed when any event is active (via `useEventState.selectEvent`). No extra work needed.

---

## components.json — inspector metadata

**Path:** `src/data/components.json`  
**Imported by:** `InspectorPanel.jsx` only

### Schema

```jsonc
[
  {
    "componentId": "pod-netns",             // Must match the HTML id on the canvas ComponentBox
    "displayName": "Linux Network Namespace (netns)",  // H2 in the inspector panel
    "layer": "Linux Kernel Primitives",     // Controls color badge in InspectorPanel
    "problemSolved": "...",                 // Paragraph explaining architectural purpose
    "interactions": [                       // Bulleted list items
      "Attaches to a host-side veth pair...",
      "Provisioned by OVN-Kubernetes CNI..."
    ],
    "explorationCommands": [               // Array of shell command strings (can include comments)
      "# Step 1: Find the PID\ncrictl inspect <container_id> | grep pid",
      "# Step 2: Enter the namespace\nnsenter -t <PID> -n ip addr show"
    ]
  }
]
```

### Layer → color mapping

The `layer` field drives the accent color in `InspectorPanel.jsx` via `LAYER_CONFIG`:

| layer value | Accent color |
|---|---|
| `"External"` | `#00f0ff` (cyan) |
| `"Management Layer"` | `#33c8ff` (sky) |
| `"Host Networking Subsystem"` | `#39ff88` (green) |
| `"Linux Kernel Primitives"` | `#39ff88` (green) |

Any other value falls back to `#94a3b8` (slate). To add a new layer color, add an entry to `LAYER_CONFIG` in `InspectorPanel.jsx`.

### Component IDs that currently have entries

```
external-client, api-server, scheduler, kubelet, crio,
ingress-router-haproxy, ovs-bridge-br-int, host-veth-pair,
pod-netns, pod-cgroups, container-process
```

Pod containers (`app-pod`, `router-pod`) do not have `components.json` entries — clicking a pod chip finds no match and `InspectorPanel` returns `null`. This is intentional (pods expand rather than inspect). Add entries if you want inspector data on pods.

### `explorationCommands` formatting

Each string in the array is rendered inside a `<pre>` block as-is. Use `\n` for line breaks. Lead with a `# comment` line to label the command:

```jsonc
"explorationCommands": [
  "# Check status\noc get pod <pod-name> -n <namespace>",
  "# Get full YAML\noc get pod <pod-name> -n <namespace> -o yaml"
]
```

Each entry gets its own copy button. Group related commands into one string if they form a single workflow; split into separate strings if they are independent alternatives.

---

## Data loading

Both files are imported as ES module JSON imports (Vite handles this natively):

```js
import events from '../data/events.json'
import componentsData from '../data/components.json'
```

There is no API layer, no fetch, no lazy loading. Changes to these files take effect immediately on `npm run dev` hot reload.
