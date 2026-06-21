import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ZONES } from '../src/data/zones.js'
import { DEEP_DIVES } from '../src/data/deep-dives.js'

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const components = await readJson('../src/data/components.json')
const events = await readJson('../src/data/events.json')

const unique = (values, label) => {
  const seen = new Set()
  for (const value of values) {
    assert(!seen.has(value), `Duplicate ${label}: ${value}`)
    seen.add(value)
  }
  return seen
}

const componentIds = unique(components.map((component) => component.componentId), 'componentId')
const eventIds = unique(events.map((event) => event.eventId), 'eventId')
assert(eventIds.size > 0, 'At least one trace flow is required')

for (const component of components) {
  for (const field of ['displayName', 'layer', 'role', 'interactions', 'explorationCommands']) {
    assert(component[field] != null, `${component.componentId} is missing ${field}`)
  }
  assert(Array.isArray(component.interactions), `${component.componentId}.interactions must be an array`)
  assert(Array.isArray(component.explorationCommands), `${component.componentId}.explorationCommands must be an array`)
}

const zoneDomIds = []
const walkZone = (zone) => {
  if (zone.componentId) zoneDomIds.push(zone.componentId)
  for (const node of zone.nodes || []) {
    zoneDomIds.push(node.id)
    const canonicalId = node.mirror || node.id
    assert(componentIds.has(canonicalId), `Zone node ${node.id} has no component metadata (${canonicalId})`)
    for (const collection of ['intentObjects', 'controllers', 'operators', 'realizes']) {
      for (const child of node[collection] || []) {
        const childCanonicalId = child.mirror || child.id
        assert(componentIds.has(childCanonicalId), `${collection} entry ${child.id} has no component metadata (${childCanonicalId})`)
      }
    }
  }
  for (const child of zone.zones || []) walkZone(child)
  for (const replica of zone.replicaNodes || []) walkZone(replica)
}
for (const zone of ZONES) walkZone(zone)
unique(zoneDomIds, 'zone/node DOM id')

for (const event of events) {
  assert(event.category, `${event.eventId} is missing category`)
  assert(event.glyph, `${event.eventId} is missing glyph`)
  assert(Array.isArray(event.steps) && event.steps.length > 0, `${event.eventId} needs at least one step`)
  event.steps.forEach((step, index) => {
    assert.equal(step.step, index + 1, `${event.eventId} steps must be sequential from 1`)
    for (const endpoint of [step.sourceComponentId, step.targetComponentId]) {
      assert(componentIds.has(endpoint), `${event.eventId} references unknown component ${endpoint}`)
    }
  })
}

unique(DEEP_DIVES.map((topic) => topic.topicId), 'deep-dive topicId')
for (const topic of DEEP_DIVES) {
  const boxIds = []
  const walkDeepZone = (zone) => {
    for (const box of zone.boxes || []) {
      if (box.spacer) continue
      boxIds.push(box.id)
      if (box.componentId) {
        assert(componentIds.has(box.componentId), `${topic.topicId}/${box.id} references unknown component ${box.componentId}`)
      }
      for (const revealed of box.reveal?.boxes || []) boxIds.push(revealed.id)
    }
    for (const child of zone.zones || []) walkDeepZone(child)
  }
  for (const zone of topic.zones || []) walkDeepZone(zone)
  const topicBoxIds = unique(boxIds, `box id in ${topic.topicId}`)

  for (const edge of [...(topic.topology?.edges || []), ...(topic.reconciliation?.edges || [])]) {
    assert(topicBoxIds.has(edge.from), `${topic.topicId}/${edge.id} has unknown source ${edge.from}`)
    assert(topicBoxIds.has(edge.to), `${topic.topicId}/${edge.id} has unknown target ${edge.to}`)
  }
  for (const flow of topic.flows || []) {
    flow.steps.forEach((step, index) => {
      assert.equal(step.step, index + 1, `${topic.topicId}/${flow.flowId} steps must be sequential from 1`)
      assert(topicBoxIds.has(step.sourceBoxId), `${topic.topicId}/${flow.flowId} has unknown source ${step.sourceBoxId}`)
      assert(topicBoxIds.has(step.targetBoxId), `${topic.topicId}/${flow.flowId} has unknown target ${step.targetBoxId}`)
    })
  }
}

console.log(`Validated ${components.length} components, ${events.length} trace flows, and ${DEEP_DIVES.length} deep dives.`)
