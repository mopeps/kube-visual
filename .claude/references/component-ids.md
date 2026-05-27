# Reference: All Component IDs

Quick-reference table for every `ComponentBox` ID in the app. These strings must stay consistent across three places: the `id` prop on `ComponentBox`, `events.json` step references, and `components.json` entries.

## Canvas ID map

| componentId | Label on canvas | Layer | components.json entry |
|---|---|---|---|
| `external-client` | External Client | External | yes |
| `api-server` | API Server | Management Layer | yes |
| `scheduler` | Scheduler | Management Layer | yes |
| `kubelet` | Kubelet | Management Layer | yes |
| `crio` | CRI-O | Management Layer | yes |
| `ingress-router-haproxy` | Ingress Router · HAProxy | Management Layer | yes |
| `app-pod` | Pod · web-app | Pod boundary | no |
| `router-pod` | Pod · router | Pod boundary | no |
| `pod-netns` | Network Namespace · netns | Linux Kernel Primitives | yes |
| `pod-cgroups` | Control Groups · cgroups | Linux Kernel Primitives | yes |
| `container-process` | Container Process · PID 1 | Linux Kernel Primitives | yes |
| `ovs-bridge-br-int` | OVS Bridge · br-int | Host Networking Subsystem | yes |
| `host-veth-pair` | veth Pair | Host Networking Subsystem | yes |

## Duplicate ID warning

`pod-netns`, `pod-cgroups`, and `container-process` are rendered **twice** on the canvas — once inside `PodLayer id="app-pod"` and once inside `PodLayer id="router-pod"`. Both `PodLayer` instances use `KernelPrimitives`, which hardcodes the same three IDs.

`document.getElementById()` returns the **first match** in document order. Arrow endpoints targeting these IDs will always resolve to the `app-pod` instance. Do not add more duplicate IDs without a plan to disambiguate.

## Event step usage

Which events reference which IDs:

| componentId | route-ingress-traffic | pod-spawning | pod-to-pod-ovn |
|---|---|---|---|
| `external-client` | step 1 src | — | — |
| `ingress-router-haproxy` | step 1 tgt, step 2 src | — | — |
| `ovs-bridge-br-int` | step 2 tgt, step 3 src | — | step 3 tgt, step 4 src |
| `host-veth-pair` | step 3 tgt, step 4 src | — | step 2 tgt, step 3 src, step 4 tgt, step 5 src |
| `pod-netns` | step 4 tgt, step 5 src | step 5 tgt | step 1 tgt, step 2 src, step 5 tgt |
| `container-process` | step 5 tgt | — | step 1 src |
| `api-server` | — | step 1 src | — |
| `scheduler` | — | step 1 tgt, step 2 src | — |
| `kubelet` | — | step 2 tgt, step 3 src | — |
| `crio` | — | step 3 tgt, step 4 src, step 5 src | — |
| `pod-cgroups` | — | step 4 tgt | — |
| `app-pod` | — | — | — |
| `router-pod` | — | — | — |
