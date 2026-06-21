// ── Unified fuzzy-search index ───────────────────────────────────────────────
// One flat array of normalized records spanning every "object or technology"
// the app explains, built once at module load (same idiom as
// components-index.js). The search palette fuzzy-matches against these and, on
// pick, routes to the destination each record describes.
//
//   record = {
//     kind:   'component' | 'primitive' | 'topic' | 'box' | 'event',
//     id:     stable id within its kind,
//     title:  display name,
//     subtitle: short context line (type / role / where it lives),
//     hay:    lowercased "name + one-line description" haystack (high-signal),
//     deep?:  original-cased long prose (interactions / commands / step text),
//     deepLc?: lowercased copy of `deep` for matching,
//     // routing payload (kind-specific):
//     topicId?,        // box → the deep-dive topic that owns it
//     event?,          // event → the raw events.json entry (selectEvent wants it)
//     hostId?,         // primitive → the component whose modal surfaces it
//     primitiveId?,    // primitive → which primitive chip to auto-expand there
//   }
//
// Two haystacks per record, on purpose: `hay` indexes NAMES + one-line
// DESCRIPTIONS so the headline results stay high-signal, while `deep` indexes
// the full interaction/command/step prose as a lower-priority "search
// everything" tier (scoreRecord ranks deep hits below every name/description
// hit — see lib/fuzzy.js).

import componentsData from './components.json'
import eventsData from './events.json'
import { DEEP_DIVES } from './deep-dives'
import { PRIMITIVES_BY_TYPE } from './primitives'

const lc = (parts) => parts.filter(Boolean).join(' ').toLowerCase()
// Join long prose into one deep haystack (original case kept for snippets).
const deepText = (parts) => parts.flat().filter(Boolean).join(' · ')
const withDeep = (rec, deep) =>
  deep ? { ...rec, deep, deepLc: deep.toLowerCase() } : rec

// Flatten one deep-dive box detail section into searchable prose: its heading,
// body, tag chips, k/v facts, and any example-unit names + summaries.
const sectionText = (s) =>
  [
    s.heading,
    s.body,
    ...(s.tags || []),
    ...(s.facts || []).map((f) => `${f.k} ${f.v}`),
    ...(s.units || []).map((u) => `${u.name} ${u.summary}`),
  ]
    .filter(Boolean)
    .join(' ')

// ── Components (the OpenShift topology objects) ──────────────────────────────
const componentRecords = componentsData.map((c) =>
  withDeep(
    {
      kind: 'component',
      id: c.componentId,
      title: c.displayName,
      subtitle: [c.typePrefix && `[${c.typePrefix}]`, c.role].filter(Boolean).join(' · '),
      hay: lc([
        c.displayName,
        c.componentId,
        c.typePrefix,
        c.role,
        c.layer,
        c.runtimeForm,
        c.linuxPrimitive,
        c.problemSolved,
      ]),
    },
    deepText([c.interactions || [], c.explorationCommands || []]),
  ),
)

const COMPONENT_IDS = new Set(componentsData.map((c) => c.componentId))

// First non-self, on-cluster component carrying each typePrefix — the host whose
// detail sheet surfaces that family's primitives (the search result opens it and
// auto-expands the chosen primitive there).
const HOST_BY_TYPE = {}
for (const c of componentsData) {
  if (c.typePrefix && !HOST_BY_TYPE[c.typePrefix] && c.layer !== 'External') {
    HOST_BY_TYPE[c.typePrefix] = c.componentId
  }
}

// ── Linux / OS / virtualisation primitives ───────────────────────────────────
// Keyed by typePrefix in primitives.js; each is shown as an expandable chip
// inside a host component's detail sheet. Index every primitive that isn't
// already its own component (those are covered by componentRecords). Dedupe by
// id (Static Pod aliases Pod's primitive list).
const primitiveRecords = []
const seenPrimitive = new Set()
for (const [typePrefix, group] of Object.entries(PRIMITIVES_BY_TYPE)) {
  const hostId = HOST_BY_TYPE[typePrefix]
  if (!hostId) continue
  for (const p of group.items) {
    if (seenPrimitive.has(p.id) || COMPONENT_IDS.has(p.id)) continue
    seenPrimitive.add(p.id)
    primitiveRecords.push(
      withDeep(
        {
          kind: 'primitive',
          id: p.id,
          title: p.label,
          subtitle: `${group.sectionTitle} · [${typePrefix}]`,
          hay: lc([p.label, p.id, typePrefix, p.description]),
          hostId,
          primitiveId: p.id,
        },
        deepText([p.interactions || [], p.commands || []]),
      ),
    )
  }
}

// ── Trace flows (events) ─────────────────────────────────────────────────────
const eventRecords = eventsData.map((e) =>
  withDeep(
    {
      kind: 'event',
      id: e.eventId,
      title: e.eventName,
      subtitle: 'Trace flow',
      hay: lc([e.eventName, e.eventId, e.description]),
      event: e,
    },
    deepText([(e.steps || []).map((s) => s.description)]),
  ),
)

// ── Deep-dive topics + their boxes ───────────────────────────────────────────
const topicRecords = []
const boxRecords = []

for (const topic of DEEP_DIVES) {
  topicRecords.push({
    kind: 'topic',
    id: topic.topicId,
    title: topic.title,
    subtitle: 'Deep dive',
    hay: lc([topic.title, topic.topicId, topic.tagline]),
  })

  const pushBox = (box) => {
    boxRecords.push(
      withDeep(
        {
          kind: 'box',
          id: box.id,
          topicId: topic.topicId,
          title: box.title,
          subtitle: `${box.typePrefix ? `[${box.typePrefix}] · ` : ''}in ${topic.title}`,
          hay: lc([
            box.title,
            box.subtitle,
            box.typePrefix,
            box.detail?.role,
            box.detail?.summary,
          ]),
        },
        deepText((box.detail?.sections || []).map(sectionText)),
      ),
    )
    // Reveal-in-place sub-steps are real boxes too (their own detail popup) —
    // index them so a search can deep-link straight to one.
    box.reveal?.boxes?.forEach(pushBox)
  }
  const walk = (zones) => {
    for (const zone of zones || []) {
      for (const box of zone.boxes || []) pushBox(box)
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(topic.zones)
}

export const SEARCH_RECORDS = [
  ...componentRecords,
  ...primitiveRecords,
  ...topicRecords,
  ...boxRecords,
  ...eventRecords,
]

// Fixed display order + labels for the grouped result list.
export const KIND_ORDER = ['component', 'primitive', 'topic', 'box', 'event']
export const KIND_LABEL = {
  component: 'Components',
  primitive: 'Kernel / OS primitives',
  topic: 'Deep dives',
  box: 'Deep-dive sections',
  event: 'Trace flows',
}
