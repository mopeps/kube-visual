// Classifies a free-text interaction sentence (from components.json) into a
// small set of *relationship kinds* so the detail-modal Interactions section
// can render direction + type visually instead of as a flat wall of bullets.
//
// The kind is derived from the sentence's leading verb. This is intentionally
// heuristic — an unrecognised verb falls back to `note`, which is always a
// safe, neutral rendering. The goal is a scannable visual grouping, not a
// formal grammar: even a rough classification turns 150+ undifferentiated
// bullets into rows whose icon + accent telegraph what the line is about.

// kind → presentation metadata. `accent` is a CSS custom-property name so the
// rows pick up the same palette as the rest of the app.
export const INTERACTION_KINDS = {
  declare: {
    label: 'Declares',
    accent: 'var(--k-amber)',
    // document — states desired state on a spec/CR (no act of its own). Shares the
    // declare→document language of hop-kinds.js / pipeline-kinds.js.
    icon: 'document',
  },
  observe: {
    label: 'Watches',
    accent: 'var(--k-amber)',
    // eye — a control-loop / read-only watch relationship
    icon: 'eye',
  },
  inbound: {
    label: 'Receives',
    accent: 'var(--k-green)',
    // arrow into a wall — something flows toward this component
    icon: 'in',
  },
  outbound: {
    label: 'Sends',
    accent: 'var(--k-cyan)',
    // arrow leaving a wall — this component acts on / pushes to others
    icon: 'out',
  },
  create: {
    label: 'Creates',
    accent: 'var(--k-orange)',
    // spark — brings a new object/process into existence (create / spawn / run)
    icon: 'spark',
  },
  manage: {
    label: 'Manages',
    accent: 'var(--k-purple)',
    // gear — ongoing lifecycle / configuration / upkeep of something that exists
    icon: 'gear',
  },
  note: {
    label: 'Note',
    accent: 'var(--k-sky)',
    // info dot — non-directional context
    icon: 'note',
  },
}

// Leading verb → kind. Keys are lower-cased; lookup lower-cases the verb too.
const VERB_KIND = {
  // declare — a spec/CR stating desired state (HostedCluster, the config CRs).
  // Not an action the object performs; just an authored intent other controllers
  // read and reconcile.
  declares: 'declare', declare: 'declare', declared: 'declare',

  // observe / read-only control loops
  watches: 'observe', watched: 'observe', watch: 'observe',
  polls: 'observe', poll: 'observe',
  reads: 'observe', read: 'observe',
  monitors: 'observe', monitor: 'observe',
  scrapes: 'observe', scrape: 'observe',
  listens: 'observe', listen: 'observe',
  reconciles: 'observe', reconciled: 'observe', reconcile: 'observe',
  evaluates: 'observe', evaluate: 'observe',
  validates: 'observe', validate: 'observe',
  selects: 'observe', select: 'observe',
  caches: 'observe', cache: 'observe',
  matches: 'observe', match: 'observe', matched: 'observe',
  aggregates: 'observe', aggregate: 'observe',
  'cross-checks': 'observe', 'cross-check': 'observe',

  // inbound — flows toward / acts on this component
  receives: 'inbound', receive: 'inbound',
  pulls: 'inbound', pull: 'inbound',
  consumed: 'inbound', consumes: 'inbound',
  called: 'inbound',
  backed: 'inbound',
  required: 'inbound', requires: 'inbound',
  configured: 'inbound',
  handles: 'inbound', handle: 'inbound',
  terminates: 'inbound', terminated: 'inbound',
  accepts: 'inbound',

  // outbound — this component pushes to / acts on others
  sends: 'outbound', send: 'outbound',
  forwards: 'outbound', forward: 'outbound',
  writes: 'outbound', write: 'outbound',
  persists: 'outbound', persist: 'outbound',
  stores: 'outbound', store: 'outbound',
  reports: 'outbound', report: 'outbound',
  returns: 'outbound', return: 'outbound', returned: 'outbound',
  surfaces: 'outbound', surface: 'outbound',
  notifies: 'outbound', notify: 'outbound',
  proxies: 'outbound', proxy: 'outbound',
  replicates: 'outbound', replicate: 'outbound',
  serves: 'outbound', serve: 'outbound',
  calls: 'outbound', call: 'outbound',
  invokes: 'outbound', invoke: 'outbound',
  delegates: 'outbound', delegate: 'outbound',
  communicates: 'outbound', communicate: 'outbound',
  connects: 'outbound', connect: 'outbound',
  opens: 'outbound', open: 'outbound',
  applies: 'outbound', apply: 'outbound',
  pushes: 'outbound', push: 'outbound',
  injects: 'outbound', inject: 'outbound',
  // registering yourself with an API server / kubelet is an outbound announcement,
  // not the creation of a new object
  registers: 'outbound', register: 'outbound',
  advertises: 'outbound', advertise: 'outbound',
  publishes: 'outbound', publish: 'outbound', published: 'outbound',
  populates: 'outbound', populate: 'outbound',
  signals: 'outbound', signal: 'outbound',
  asks: 'outbound', ask: 'outbound',
  performs: 'outbound', perform: 'outbound',

  // create — brings a new object/process into existence (vs. manage, which is
  // upkeep of something that already exists)
  creates: 'create', create: 'create', created: 'create',
  spawns: 'create', spawn: 'create', spawned: 'create',
  provisions: 'create', provision: 'create', provisioned: 'create',
  runs: 'create', run: 'create',
  scales: 'create', scaling: 'create', scale: 'create',
  starts: 'create', start: 'create', started: 'create',
  authored: 'create', authors: 'create', author: 'create',
  owns: 'create', own: 'create', owned: 'create',
  renders: 'create', render: 'create', rendered: 'create',
  realises: 'create', realise: 'create', realised: 'create',
  realizes: 'create', realize: 'create', realized: 'create',
  implements: 'create', implement: 'create',
  triggers: 'create', trigger: 'create', triggered: 'create',
  instantiates: 'create', instantiate: 'create',
  generates: 'create', generate: 'create', generated: 'create',
  carves: 'create', carve: 'create', carved: 'create',
  // active "Deploys X" creates an operand; passive "Deployed by X" is caught by
  // isPassiveByAgent() above and re-read as inbound, so this never points the
  // arrow the wrong way.
  deploys: 'create', deploy: 'create', deployed: 'create',

  // manage — ongoing lifecycle / configuration / upkeep of an existing object
  manages: 'manage', manage: 'manage',
  sets: 'manage', set: 'manage',
  wires: 'manage', wire: 'manage',
  exposes: 'manage', expose: 'manage',
  provides: 'manage', provide: 'manage',
  integrates: 'manage', integrate: 'manage',
  enforced: 'manage', enforces: 'manage',
  maintains: 'manage', maintain: 'manage',
  updates: 'manage', updated: 'manage', update: 'manage',
  coordinates: 'manage', coordinate: 'manage',
  adopts: 'manage', adopt: 'manage', adopted: 'manage',
  reclaims: 'manage', reclaim: 'manage', reclaimed: 'manage',
  taints: 'manage', taint: 'manage', tainted: 'manage',
  evicts: 'manage', evict: 'manage', evicted: 'manage',
  deletes: 'manage', delete: 'manage', deleted: 'manage',
  drives: 'manage', drive: 'manage', driven: 'manage',
  rejects: 'manage', reject: 'manage', rejected: 'manage',
  blocks: 'manage', block: 'manage', blocked: 'manage',
  keeps: 'manage', keep: 'manage', kept: 'manage',
  hosts: 'manage', host: 'manage', hosted: 'manage',
  pairs: 'manage', pair: 'manage', paired: 'manage',
  fronts: 'manage', front: 'manage', fronted: 'manage',
  backs: 'manage', back: 'manage',

  // pipeline mechanics — the verbs that lead the kubelet/CRI-O/kernel-primitive
  // detail bullets (see pipeline-model.js / primitives.js). Classed so the
  // pipeline tree's revealed detail reads in the same icon+accent language as the
  // Interactions section rather than as neutral notes.
  resolves: 'create', resolve: 'create', resolved: 'create',
  assembles: 'create', assemble: 'create', assembled: 'create',
  allocates: 'create', allocate: 'create', allocated: 'create',
  assigns: 'create', assign: 'create', assigned: 'create',
  executes: 'outbound', execute: 'outbound', executed: 'outbound',
  issues: 'outbound', issue: 'outbound', issued: 'outbound',
  hands: 'outbound', hand: 'outbound', handed: 'outbound',
  enters: 'outbound', enter: 'outbound', entered: 'outbound',
  attached: 'manage', attaches: 'manage', attach: 'manage',
  captures: 'observe', capture: 'observe', captured: 'observe',

  // network data-plane verbs — the OVN deep-dive popup bullets lead with these
  // (see ovn-topology.js). Carrying / routing / SNATing push traffic onward
  // (outbound); DNAT / decapsulation act on traffic arriving here (inbound);
  // compiling flows brings the realized pipeline into existence (create).
  carries: 'outbound', carry: 'outbound',
  routes: 'outbound', route: 'outbound',
  delivers: 'outbound', deliver: 'outbound',
  answers: 'outbound', answer: 'outbound',
  encapsulates: 'outbound', encapsulate: 'outbound',
  snats: 'outbound',
  dnats: 'inbound',
  decapsulates: 'inbound',
  enslaves: 'manage', enslave: 'manage',
  compiles: 'create', compile: 'create', compiled: 'create',

  // kernel / filesystem primitive verbs — lead the Primitives-mode popup bullets
  // (namespaces, cgroups, sockets, volume mounts). Isolating / capping / holding /
  // sharing / projecting are upkeep of a boundary or projection (manage); binding a
  // port, mounting a filesystem, or assembling a rootfs brings something into
  // existence (create). ("Mounted by CRI-O…" still reads inbound via the passive
  // "…ed by <agent>" rule.)
  isolates: 'manage', isolate: 'manage', isolated: 'manage',
  holds: 'manage', hold: 'manage', held: 'manage',
  shares: 'manage', share: 'manage', shared: 'manage',
  caps: 'manage', cap: 'manage', capped: 'manage',
  limits: 'manage', limit: 'manage', limited: 'manage',
  projects: 'manage', project: 'manage', projected: 'manage',
  binds: 'create', bind: 'create', bound: 'create',
  mounts: 'create', mount: 'create', mounted: 'create',
  reserves: 'create', reserve: 'create', reserved: 'create',
  merges: 'create', merge: 'create', merged: 'create',

  // more network / data-plane / control-plane verbs that lead the Network-mode and
  // Deep-Dive popup bullets. Programming flows / translating intent brings the
  // realized pipeline into existence (create); wrapping (encapsulating) and demuxing
  // move or steer traffic (outbound / inbound); splicing / dropping / queueing are
  // upkeep of an existing datapath (manage); tracking is read-only (observe).
  programs: 'create', program: 'create', programmed: 'create',
  translates: 'create', translate: 'create', translated: 'create',
  realises: 'create', realise: 'create',
  wraps: 'outbound', wrap: 'outbound', wrapped: 'outbound',
  ships: 'outbound', ship: 'outbound', shipped: 'outbound',
  demuxes: 'inbound', demux: 'inbound', demuxed: 'inbound',
  splices: 'manage', splice: 'manage', spliced: 'manage',
  drops: 'manage', drop: 'manage', dropped: 'manage',
  queues: 'manage', queue: 'manage', queued: 'manage',
  tracks: 'observe', track: 'observe', tracked: 'observe',
  elects: 'manage', elect: 'manage', elected: 'manage',
}

// Pull the leading verb token off a sentence: first run of letters/hyphens.
function leadingVerb(text) {
  const m = /^([A-Za-z][A-Za-z-]*)/.exec(text.trim())
  return m ? m[1] : ''
}

// Scan a sentence for its first RECOGNISED verb anywhere (not just the lead) —
// used to label a relationship edge from a packet-flow step whose sentence opens
// with a subject ("An 'oc' client resolves…", "The LoadBalancer DNATs…") rather
// than a verb. A leading adverbial/subordinate clause ("With X resolved, …",
// "Once Y, …", "On each interval, …") is dropped first so we land on the MAIN
// clause's verb (the actor's action), not a participle buried in the lead-in.
// Returns { verb, kind, kindMeta } or null.
const LEAD_CLAUSE =
  /^(with|once|after|before|when|while|during|as|if|unless|unlike|separately|still|because|since|now|having|although|though|whenever|then|on|in|to|for|under|each|first)\b[^,.;:]*,\s*/i
export function firstKnownVerb(text) {
  let s = String(text).trim()
  const m = LEAD_CLAUSE.exec(s)
  if (m) s = s.slice(m[0].length)
  const tokens = s.toLowerCase().match(/[a-z][a-z-]*/g) || []
  for (const t of tokens) {
    const kind = VERB_KIND[t]
    if (kind) return { verb: t, kind, kindMeta: INTERACTION_KINDS[kind] }
  }
  return null
}

// A sentence that opens with a past participle and names its agent with "by"
// ("Authored by the admin…", "Created and reconciled by the CCM…", "Deployed …
// by the Control Plane Operator") is passive: this component is the *object*
// being acted upon, so it reads as an inbound relationship — not as the thing
// doing the creating/deploying. Without this, "Created by X" would borrow the
// active Creates glyph and point the arrow the wrong way.
function isPassiveByAgent(text) {
  return /^[A-Za-z-]+ed\b[^.;:]*\bby\b/.test(text.trim())
}

// "Runs as a Pod / Runs in the HCP namespace / Runs control-plane-side …" states
// where and how a component runs — a placement/identity fact, not an act of
// creation. Only "Runs the <…> controller/loop" is an active create. Everything
// else under "Runs" falls through to the neutral note rather than the Creates
// spark, which otherwise lit up ~30 descriptive rows.
function isPlacementRuns(verbLower, text) {
  return (verbLower === 'runs' || verbLower === 'run') && !/^runs?\s+the\b/i.test(text.trim())
}

// Classify an interaction string. Returns { kind, kindMeta, verb, rest } where
// `verb` is the emphasised lead-in word and `rest` is the remainder. When the
// verb is unknown we fall back to `note` and DON'T split off a verb (the whole
// sentence renders as body text) — so contextual lines like "Traffic routes…"
// read naturally instead of bolding an arbitrary first word.
export function classifyInteraction(text) {
  const verb = leadingVerb(text)
  const verbLower = verb.toLowerCase()
  let kind = VERB_KIND[verbLower] || 'note'

  // Passive "…ed by <agent>" — this component is acted upon, so it reads inbound
  // regardless of the participle's own (active) mapping.
  if (isPassiveByAgent(text)) kind = 'inbound'
  // "Runs as / in / control-plane-side …" is placement, not creation.
  else if (isPlacementRuns(verbLower, text)) kind = 'note'

  const kindMeta = INTERACTION_KINDS[kind]
  if (kind === 'note') {
    return { kind, kindMeta, verb: '', rest: text.trim() }
  }
  // When we re-classed a passive participle as inbound, keep the participle as
  // the emphasised lead-in ("Created", "Deployed") and split off the remainder.
  const rest = text.trim().slice(verb.length).replace(/^\s+/, '')
  return { kind, kindMeta, verb, rest }
}
