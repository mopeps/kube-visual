// Classifies a pipeline-tree row into a one-word *structural kind* — Record, Map,
// List, VIP, Process … — so the expandable rows can carry a leading keyword chip,
// the same scannable "kind at a glance" device the Interactions section uses for
// its relationship verbs (see interaction-kinds.js / InteractionList.jsx).
//
// Heuristic and intentionally conservative: matched most-specific first, and an
// unrecognised label returns null so the row simply renders without a chip rather
// than a misleading one. Only the expandable ("extended information") rows are
// chipped — PipelineTree gates on that — so this never has to classify bare rows.

// [regex on the row label, structural keyword]. Order matters: earlier wins.
const RULES = [
  [/PersistentVolumeClaim/i, 'Request'],
  [/PersistentVolume/i, 'Volume'],
  [/EndpointSlice/i, 'List'],
  [/ConfigMap/i, 'Map'],
  [/Secret/i, 'Map'],
  [/NetworkPolicy/i, 'Rules'],
  [/OVN ACL/i, 'Rules'],
  [/\[systemd\] (Kubelet|CRI-O)/i, 'Daemon'],
  [/systemd Unit/i, 'Unit'],
  [/Process|PID 1/i, 'Process'],
  [/etcd record|CustomResource/i, 'Record'],
  [/Deployment/i, 'Spec'],
  [/(Replica|Daemon|Stateful)Set/i, 'Set'],
  [/ClusterIP/i, 'VIP'],
  [/MetalLB|L2 VIP|router-default LB|LoadBalancer/i, 'VIP'],
  [/\bService\b/i, 'VIP'],
  [/TCP socket/i, 'Socket'],
  [/guest OS|RHCOS/i, 'Guest OS'],
  [/KVM vCPU|vCPU/i, 'vCPU'],
  [/vhost/i, 'vhost'],
  [/cgroup/i, 'cgroup'],
  [/Network Namespace|netns/i, 'netns'],
  [/mount ns|kernel mount|tmpfs|\bMount\b/i, 'Mount'],
  [/MachineConfig/i, 'Config'],
  [/\[Static Pod\]|\[Pod\]|^Static Pod\b|^Pod\b/i, 'Pod'],
  [/VirtualMachineInstance/i, 'VM'],
]

// Returns a short structural keyword for a row label, or null when none fits.
export function rowKind(label) {
  if (!label) return null
  for (const [re, kind] of RULES) {
    if (re.test(label)) return kind
  }
  return null
}
