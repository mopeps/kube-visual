import componentsData from './components.json'

// O(1) componentId → entry lookup, built once at module load. Replaces the
// linear `componentsData.find(c => c.componentId === id)` that was copy-pasted
// across the hop and detail views (HopInspector, PacketFlowTab, AncestryModal).
const COMPONENT_BY_ID = new Map(componentsData.map(c => [c.componentId, c]))

export function findComponent(id) {
  return COMPONENT_BY_ID.get(id)
}
