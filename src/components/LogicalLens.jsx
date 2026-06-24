import { findDeepDive } from '../data/deep-dives'
import TopicCanvas from './TopicCanvas'

// The Network lens's "Map" altitude: the primary OVN logical topology rendering.
// It reuses the deep-dive topic pipeline (TopicCanvas) but with idPrefix='lg',
// and routes box clicks through App's shared AncestryModal (onSelectComponent).
export default function LogicalLens({
  scope,
  activeFlow,
  activeFlowStep,
  onSelectFlowStep,
  onSelectComponent,
}) {
  const topic = findDeepDive(scope)

  return (
    <div className="logical-lens">
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
