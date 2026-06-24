import { DEEP_DIVES, findDeepDive } from '../data/deep-dives'
import ObjectSelect from './ObjectSelect'
import { FlowSelect } from './DeepDiveTab'
import TopicCanvas from './TopicCanvas'

// The Network lens's "Map" altitude: the classic OVN-Kubernetes logical topology
// (logical switches, gateway routers, the join switch, ovn_cluster_router, pod
// ports) rendered straight into the Overview instead of being marooned in the
// Deep Dive tab. It reuses the deep-dive topic pipeline (TopicCanvas) but with
// idPrefix='lg', and routes box clicks through App's shared AncestryModal
// (onSelectComponent) so a logical box drills to its real OpenShift object and
// that object's Linux primitives — L1 box → L2 component → L3 primitive.
//
// The four OVN topics are the lens's "scope": the plain diagram, the same wiring
// inside greyed OpenShift containers (big view), the guest cluster's SDN, and the
// full HCP picture with both SDNs at once.
const accent = (colorVar) => `var(--${colorVar || 'k-cyan'})`
const SCOPES = DEEP_DIVES.filter((t) => t.category === 'network')

// Scope switcher — jump between the four OVN topology views. Styled as an
// "open an object" popover (ObjectSelect), echoing the Deep Dive tab's TopicSelect.
function ScopeSelect({ scope, topic, onSetScope }) {
  const options = SCOPES.map((t) => ({
    id: t.topicId,
    title: t.title,
    desc: t.tagline,
    accent: accent(t.colorVar),
  }))
  return (
    <ObjectSelect
      label="Topology"
      accent={accent(topic?.colorVar)}
      value={topic ? { title: topic.title } : null}
      placeholder="Choose a topology view"
      options={options}
      activeId={scope}
      onSelect={(opt) => { if (opt.id !== scope) onSetScope(opt.id) }}
    />
  )
}

export default function LogicalLens({
  scope,
  onSetScope,
  activeFlow,
  activeFlowStep,
  onSelectFlow,
  onClearFlow,
  onSelectFlowStep,
  onSelectComponent,
}) {
  const topic = findDeepDive(scope) || SCOPES[0]

  return (
    <div className="logical-lens">
      <div className="obj-select-row">
        <ScopeSelect scope={scope} topic={topic} onSetScope={onSetScope} />
        <FlowSelect
          topic={topic}
          activeFlow={activeFlow}
          onSelectFlow={onSelectFlow}
          onClearFlow={onClearFlow}
        />
      </div>

      <TopicCanvas
        topic={topic}
        activeFlow={activeFlow}
        activeFlowStep={activeFlowStep}
        onSelectFlowStep={onSelectFlowStep}
        onSelectComponent={onSelectComponent}
        idPrefix="lg"
        useNetworkMap
      />
    </div>
  )
}
