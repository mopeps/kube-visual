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
  manage: {
    label: 'Manages',
    accent: 'var(--k-purple)',
    // gear — lifecycle / create / own relationship
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

  // inbound — flows toward / acts on this component
  receives: 'inbound', receive: 'inbound',
  pulls: 'inbound', pull: 'inbound',
  consumed: 'inbound', consumes: 'inbound',
  called: 'inbound',
  backed: 'inbound',
  required: 'inbound', requires: 'inbound',
  authored: 'inbound',
  provisioned: 'inbound', provisions: 'inbound',
  configured: 'inbound',
  started: 'inbound',
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
  registers: 'outbound', register: 'outbound',
  injects: 'outbound', inject: 'outbound',

  // manage — lifecycle / ownership / creation
  manages: 'manage', manage: 'manage',
  creates: 'manage', create: 'manage',
  runs: 'manage', run: 'manage',
  spawns: 'manage', spawn: 'manage',
  scales: 'manage', scaling: 'manage', scale: 'manage',
  sets: 'manage', set: 'manage',
  wires: 'manage', wire: 'manage',
  exposes: 'manage', expose: 'manage',
  provides: 'manage', provide: 'manage',
  integrates: 'manage', integrate: 'manage',
  enforced: 'manage', enforces: 'manage',
  maintains: 'manage', maintain: 'manage',
}

// Pull the leading verb token off a sentence: first run of letters/hyphens.
function leadingVerb(text) {
  const m = /^([A-Za-z][A-Za-z-]*)/.exec(text.trim())
  return m ? m[1] : ''
}

// Classify an interaction string. Returns { kind, kindMeta, verb, rest } where
// `verb` is the emphasised lead-in word and `rest` is the remainder. When the
// verb is unknown we fall back to `note` and DON'T split off a verb (the whole
// sentence renders as body text) — so contextual lines like "Traffic routes…"
// read naturally instead of bolding an arbitrary first word.
export function classifyInteraction(text) {
  const verb = leadingVerb(text)
  const kind = VERB_KIND[verb.toLowerCase()] || 'note'
  const kindMeta = INTERACTION_KINDS[kind]
  if (kind === 'note') {
    return { kind, kindMeta, verb: '', rest: text.trim() }
  }
  const rest = text.trim().slice(verb.length).replace(/^\s+/, '')
  return { kind, kindMeta, verb, rest }
}
