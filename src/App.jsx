import Sidebar from './components/Sidebar'
import Canvas from './components/Canvas'
import useEventState from './hooks/useEventState'

export default function App() {
  const {
    activeEvent,
    activeComponentId,
    expandedPods,
    activeComponentIds,
    selectEvent,
    clearEvent,
    selectComponent,
    clearComponent,
    togglePod,
  } = useEventState()

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <Sidebar activeEvent={activeEvent} onSelectEvent={selectEvent} />
      <Canvas
        activeEvent={activeEvent}
        activeComponentIds={activeComponentIds}
        activeComponentId={activeComponentId}
        expandedPods={expandedPods}
        onSelectComponent={selectComponent}
        onClearComponent={clearComponent}
        onTogglePod={togglePod}
        onClearEvent={clearEvent}
      />
    </div>
  )
}
