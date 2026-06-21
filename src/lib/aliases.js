// Query synonym/alias expansion for the search palette. This domain is dense
// with acronyms and alternate spellings ("k8s" vs "kubernetes", "VMI" vs
// "VirtualMachineInstance", "kas" vs "kube-apiserver"), and the index only
// holds the canonical spellings — so a literal/fuzzy match alone misses the
// shorthand people actually type. expandQuery() turns one typed query into the
// set of equivalent strings the palette should ALSO score against (the original
// always first, so its own ranking stays primary).
//
// Groups are bidirectional: typing any member searches for all the others.
// Expansion is gated to an *exact* query match (normalized — case, spaces, and
// dashes ignored) so it never broadens a longer, more specific query.

const SYNONYM_GROUPS = [
  ['k8s', 'kubernetes'],
  ['oc', 'kubectl'],
  ['vm', 'vmi', 'virtualmachine', 'virtualmachineinstance'],
  ['kas', 'apiserver', 'api server', 'kube-apiserver'],
  ['cp', 'control plane'],
  ['hcp', 'hosted control plane'],
  ['lb', 'load balancer', 'loadbalancer'],
  ['svc', 'service'],
  ['ns', 'namespace'],
  ['netpol', 'network policy', 'networkpolicy'],
  ['sdn', 'ovn', 'ovn-kubernetes', 'networking'],
  ['ovs', 'open vswitch', 'openvswitch'],
  ['dns', 'coredns', 'name resolution'],
  ['cni', 'pod networking'],
  ['etcd', 'key value store', 'intent store'],
  ['ign', 'ignition'],
  ['cgroup', 'cgroups', 'control group'],
  ['netns', 'network namespace'],
  ['seccomp', 'syscall filter'],
  ['selinux', 'mcs'],
  ['kvm', 'hardware virtualization'],
  ['qemu', 'emulator'],
  ['ingress', 'router'],
  ['gc', 'garbage collect', 'garbage collection'],
]

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// normalized term → the other members of every group it belongs to.
const LOOKUP = new Map()
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    const key = norm(term)
    const others = group.filter((t) => t !== term)
    LOOKUP.set(key, [...(LOOKUP.get(key) || []), ...others])
  }
}

// Return [originalQuery, ...aliasExpansions] (deduped, original first). When the
// query isn't a known alias this is just [query], so callers can score against
// the list unconditionally.
//
// Expansion is asymmetric — only terms LONGER than what was typed are added.
// Expanding a long query down to a short abbreviation ("garbage collection" →
// "gc") would let that 2-char token fuzzy-subsequence-match half the index;
// expanding up ("gc" → "garbage collection") is all upside.
export function expandQuery(query) {
  const q = query.trim()
  if (!q) return [q]
  const extra = LOOKUP.get(norm(q))
  if (!extra) return [q]
  const out = [q]
  for (const t of extra) {
    if (t.length > q.length && !out.includes(t)) out.push(t)
  }
  return out
}
