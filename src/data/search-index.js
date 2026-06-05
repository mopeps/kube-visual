// ── Unified fuzzy-search index ───────────────────────────────────────────────
// One flat array of normalized records spanning every "object or technology"
// the app explains, built once at module load (same idiom as
// components-index.js). The search palette fuzzy-matches against these and, on
// pick, routes to the destination each record describes.
//
//   record = {
//     kind:   'component' | 'topic' | 'box' | 'event',
//     id:     stable id within its kind,
//     title:  display name,
//     subtitle: short context line (type / role / where it lives),
//     hay:    lowercased "name + description" haystack for matching,
//     // routing payload (kind-specific):
//     topicId?,        // box → the deep-dive topic that owns it
//     event?,          // event → the raw events.json entry (selectEvent wants it)
//   }
//
// Per the chosen depth, the haystack indexes NAMES + one-line DESCRIPTIONS
// (displayName/title, role, type, problemSolved/summary/tagline) — not the full
// interaction/section prose — so results stay high-signal.

import componentsData from './components.json'
import eventsData from './events.json'
import { DEEP_DIVES } from './deep-dives'

const lc = (parts) => parts.filter(Boolean).join(' ').toLowerCase()

// ── Components (the OpenShift topology objects) ──────────────────────────────
const componentRecords = componentsData.map((c) => ({
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
}))

// ── Trace flows (events) ─────────────────────────────────────────────────────
const eventRecords = eventsData.map((e) => ({
  kind: 'event',
  id: e.eventId,
  title: e.eventName,
  subtitle: 'Trace flow',
  hay: lc([e.eventName, e.eventId, e.description]),
  event: e,
}))

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

  const walk = (zones) => {
    for (const zone of zones || []) {
      for (const box of zone.boxes || []) {
        boxRecords.push({
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
        })
      }
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(topic.zones)
}

export const SEARCH_RECORDS = [
  ...componentRecords,
  ...topicRecords,
  ...boxRecords,
  ...eventRecords,
]

// Fixed display order + labels for the grouped result list.
export const KIND_ORDER = ['component', 'topic', 'box', 'event']
export const KIND_LABEL = {
  component: 'Components',
  topic: 'Deep dives',
  box: 'Deep-dive sections',
  event: 'Trace flows',
}
