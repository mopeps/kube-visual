// Classifies a packet-flow / trace-flow step into an *action kind* so each hop
// in the Packet Flow tab can lead with a glyph + keyword instead of a wall of
// prose — the same icon+keyword language the detail-modal Interactions section
// (interaction-kinds.js) and the Manifest→Kernel pipeline (pipeline-kinds.js)
// already speak.
//
// Like those two, this is intentionally heuristic: each step's free-text
// description is scanned for the verbs/nouns that name what the hop *does*
// (resolve a name, route a packet, terminate TLS, reconcile desired state …).
// An unrecognised step falls back to `flow`, a safe neutral "carries on" arrow,
// so a hop is never mislabelled — at worst it's un-opinionated.

// kind → presentation metadata. `accent` is a CSS custom-property name so the
// chips pick up the same palette as the rest of the app; `icon` names a glyph in
// HopIcon.jsx.
export const HOP_KINDS = {
  resolve:   { label: 'Resolves',   accent: 'var(--k-amber)',  icon: 'dns' },
  route:     { label: 'Routes',     accent: 'var(--k-cyan)',   icon: 'route' },
  forward:   { label: 'Forwards',   accent: 'var(--k-sky)',    icon: 'forward' },
  tunnel:    { label: 'Tunnels',    accent: 'var(--k-purple)', icon: 'tunnel' },
  secure:    { label: 'Secures',    accent: 'var(--k-green)',  icon: 'lock' },
  deliver:   { label: 'Delivers',   accent: 'var(--k-green)',  icon: 'deliver' },
  fetch:     { label: 'Fetches',    accent: 'var(--k-sky)',    icon: 'download' },
  observe:   { label: 'Watches',    accent: 'var(--k-amber)',  icon: 'eye' },
  reconcile: { label: 'Reconciles', accent: 'var(--k-purple)', icon: 'loop' },
  declare:   { label: 'Declares',   accent: 'var(--k-amber)',  icon: 'document' },
  store:     { label: 'Persists',   accent: 'var(--k-sky)',    icon: 'disk' },
  schedule:  { label: 'Schedules',  accent: 'var(--k-sky)',    icon: 'cube' },
  create:    { label: 'Creates',    accent: 'var(--k-orange)', icon: 'spark' },
  run:       { label: 'Runs',       accent: 'var(--k-teal)',   icon: 'run' },
  report:    { label: 'Reports',    accent: 'var(--k-cyan)',   icon: 'report' },
  remove:    { label: 'Removes',    accent: 'var(--k-orange)', icon: 'trash' },
  fault:     { label: 'Fails',      accent: 'var(--packet)',   icon: 'alert' },
  flow:      { label: 'Carries',    accent: 'var(--k-sky)',    icon: 'flow' },
}

// [regex on the step description, kind]. Order matters — earlier wins, so the
// list runs most-specific (a failure, a teardown, a name lookup) before the
// broad routing/create catch-alls. Tuned against every step in events.json.
const RULES = [
  // Name resolution — DNS / ARP / resolv.conf / cached lookups.
  [/\b(resolves?|resolv\.conf|looks? up|\bDNS\b|\bARP\b|caches? the record|returns the .*ClusterIP)\b/i, 'resolve'],

  // Faults — a process abruptly crashing or dying (a *graceful* exit reads as a
  // teardown below, so this is kept to the hard-failure verbs only).
  [/\b(crash(?:es|ed)?|dies|died|has lost its)\b/i, 'fault'],

  // Teardown — delete / evict / drain / cordon / graceful shutdown / scale-down.
  // (`evicts`/`evicting` only — the past-participle "Evicted" is a status noun a
  // hop *reports*, not the teardown act itself.)
  [/\b(delete[ds]?|deleting|evict(?:s|ing)?|cordon(?:ed)?|drain(?:ed)?|marks it for deletion|terminate the virt|shuts? the .* down|scales? .* down)\b/i, 'remove'],

  // Run — exec / runc / PID 1 / entering namespaces. Kept above `tunnel` so a
  // command that "runs … back up the tunnel" reads as Runs, not Tunnels.
  [/\b(\brunc\b|PID 1|becomes PID|executes?|runs the command|enters the container)\b/i, 'run'],

  // Tunnels — Konnectivity and any explicit tunnel/dial-out.
  [/\b(konnectivity|tunnel|dials? out|exec stream|persistent tunnel|encapsulat)\b/i, 'tunnel'],

  // Forward — proxying / handing off / issuing an onward call. Above `fetch` so a
  // kubelet that "issues … calls to CRI-O, which pulls the image" reads Forwards.
  // (`proxies` the verb only — bare "Proxy" is a noun in component names like
  // "Shared Ingress Proxy" / "HAProxy" and must not read as the act of proxying.)
  [/\b(forwards?|proxies|hands? (?:off|the exec|the request)|issues?|delegates?|opens? (?:its|the) connection)\b/i, 'forward'],

  // Fetch — pulling Ignition / config over the wire.
  [/\b(fetch(?:es|ed)?|pulls?)\b/i, 'fetch'],

  // TLS / auth — terminating TLS or authenticating a request. Above `route` so a
  // DNAT hop that "terminates TLS" reads Secures (the notable act) over Routes.
  [/(\bterminates? TLS|\bover TLS|authenticat\w*|\bTLS\b)/i, 'secure'],

  // Persistence — writing desired state into etcd.
  [/\b(persist(?:s|ed)?|etcd record|records? the (?:new|lower)|writes? the new .*(?:revision|ReplicaSet))\b/i, 'store'],

  // Routing — DNAT / OVS / OVN / bridges / load-balancer flows.
  [/\b(DNATs?|routes?|routing|\bOVS\b|br-int|\bOVN\b|flow rules?|load-balancer flows|MetalLB|bridge|matches the .*LoadBalancer|enters the .*bridge)\b/i, 'route'],

  // Delivery — handing the packet to a NIC / endpoint / the final Pod, or the
  // endpoint accepting the connection and answering.
  [/\b(delivers?|virtio-net|\bNIC\b|to a ready .* endpoint|hands the packet|accepts the connection|returns (?:a|its) response|serves it)\b/i, 'deliver'],

  // Reconcile — a controller driving observed state toward desired.
  [/\b(reconcil\w*|drives? .*(?:to create|Cluster API)|closing the loop)\b/i, 'reconcile'],

  // Schedule — placing a Pod/Machine on a node (Binding, capacity eval).
  [/\b(schedul\w*|unscheduled|binds?\b|writes? a Binding|placing the|node assignment|node capacity)\b/i, 'schedule'],

  // Create — deploy / spawn / boot / start something new.
  // (no bare "launch\w*" — it would catch the noun "virt-launcher"; the launcher
  // steps are covered by starts / boots / creates instead.)
  [/\b(creates?|deploys?|spawns?|provisions?|boots?|starts?|launch(?:es|ed|ing)\b|brings? up|comes? back up|asks? .* for a (?:fresh|new)|signals? .* to boot)\b/i, 'create'],

  // Report — surfacing status back up the control plane.
  [/\b(reports?|updates? .*status|status to Failed|surfaces?|goes Ready|registers?)\b/i, 'report'],

  // Observe — watch / see / detect / evaluate a control loop's input.
  [/\b(watch(?:es)?|observes?|sees?\b|detects?|evaluates?|monitors?|syncs?)\b/i, 'observe'],

  // Declare — applying / editing / scaling / mutating a manifest's desired state.
  [/\b('oc apply'|oc apply|applies|\bapply\b|edits? the|mutates?|rollout restart|rollout\b|declares?|oc scale|--replicas)\b/i, 'declare'],
]

// Drop parenthetical asides before matching — they carry incidental mentions
// ("(a Konnectivity-tunnelled connection)", "(api.<guest>)") that shouldn't sway
// the hop's headline action.
const stripAsides = (text) => text.replace(/\([^)]*\)/g, ' ')

// Split off the leading sentence so classification weights the hop's *primary*
// action over incidental mentions later in the prose (e.g. a trailing "scheduled
// onto a node"). Sentence end = . ! or ? followed by whitespace and a
// capital/quote — so "svc.cluster.local" doesn't split.
function leadSentence(text) {
  const m = /^(.*?[.!?])\s+[A-Z'"]/.exec(text)
  return m ? m[1] : text
}

function matchRules(text) {
  for (const [re, key] of RULES) {
    if (re.test(text)) return key
  }
  return null
}

// Classify a step's description into a hop kind. Returns the kind's metadata
// (key + label + accent + icon). The lead sentence is tried first so the
// headline action wins; only if it's silent do we scan the whole description.
// Falls back to `flow` (a neutral "carries on" arrow) when nothing matches.
export function classifyHop(description) {
  const text = stripAsides(description || '')
  const key = matchRules(leadSentence(text)) || matchRules(text) || 'flow'
  return { key, ...HOP_KINDS[key] }
}

// Break a step description into its component sentences, each paired with its own
// action kind — so the Packet Flow tab can render a hop's detail as a short list
// of glyph + keyword bullets instead of one long paragraph. Sentence boundaries
// are a . ! or ? followed by whitespace and a capital / opening quote, which
// keeps dotted identifiers (svc.cluster.local, api.<guest>) intact. The original
// sentence text is preserved for display (asides/parens are only stripped inside
// classifyHop for matching).
export function hopPoints(description) {
  const text = description || ''
  const parts = []
  const re = /([.!?])\s+(?=[A-Z'"‘“])/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    parts.push(text.slice(last, m.index + 1).trim())
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last).trim())
  return parts.filter(Boolean).map((sentence) => ({ text: sentence, ...classifyHop(sentence) }))
}
