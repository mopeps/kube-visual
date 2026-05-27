import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Canvas from './components/Canvas'
import useEventState from './hooks/useEventState'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
    <div className="flex h-screen text-white overflow-hidden bg-transparent">
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        activeEvent={activeEvent}
        onSelectEvent={selectEvent}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <Canvas
        activeEvent={activeEvent}
        activeComponentIds={activeComponentIds}
        activeComponentId={activeComponentId}
        expandedPods={expandedPods}
        onSelectComponent={selectComponent}
        onClearComponent={clearComponent}
        onTogglePod={togglePod}
        onClearEvent={clearEvent}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    </div>
  )
}
