import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Canvas from './components/Canvas'
import useEventState from './hooks/useEventState'
import events from './data/events.json'

function TrafficLights() {
  return (
    <div className="flex items-center gap-2 pl-3">
      <span className="traffic-light" style={{ background: '#f38ba8' }} />
      <span className="traffic-light" style={{ background: '#f9e2af' }} />
      <span className="traffic-light" style={{ background: '#a6e3a1' }} />
    </div>
  )
}

function TitleBar() {
  return (
    <div className="term-titlebar flex items-center relative flex-shrink-0">
      <TrafficLights />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="font-mono text-[11px] text-k-tx-mut tracking-wide">
          <span className="text-k-tx">user@kube-visual</span>
          <span className="text-k-tx-dim">:</span>
          <span className="text-k-blue">~/cluster-01/openshift</span>
          <span className="text-k-tx-dim"> ── </span>
          <span className="text-k-mauve">tmux</span>
          <span className="text-k-tx-dim">: 0:</span>
          <span className="text-k-tx-wh">topology</span>
          <span className="text-k-peach">*</span>
        </span>
      </div>
      <div className="ml-auto pr-3 flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-k-tx-dim">[ readonly ]</span>
      </div>
    </div>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 15)
    return () => clearInterval(t)
  }, [])
  return now
}

function StatusBar({ activeEvent, expandedCount }) {
  const now = useClock()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const date = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })

  return (
    <div className="tmux-bar flex-shrink-0">
      {/* left — session badge */}
      <div className="seg seg-mauve">
        <span className="tracking-widest text-[10px]">▎ KUBE-VIS</span>
      </div>
      <div className="pl-sep" style={{ '--pl-from': 'var(--c-mauve)', background: 'var(--c-s2)' }} />

      {/* mode */}
      <div className="seg seg-overlay">
        <span className="text-k-yellow font-bold">●</span>
        <span className="ml-1.5 text-k-tx-br">[0]</span>
        <span className="ml-2 text-k-tx-mut">topology</span>
        {activeEvent && <span className="ml-1 text-k-peach">*</span>}
      </div>

      {/* spacer */}
      <div className="seg seg-crust flex-1 justify-center min-w-0">
        {activeEvent ? (
          <span className="truncate">
            <span className="text-k-peach">tracing</span>
            <span className="text-k-tx-dim"> :: </span>
            <span className="text-k-tx-wh">{activeEvent.eventName}</span>
            <span className="text-k-tx-dim"> ({activeEvent.steps.length} steps)</span>
          </span>
        ) : (
          <span className="text-k-tx-dim">
            -- NORMAL --   select an event from the buffer list
          </span>
        )}
      </div>

      {/* right */}
      <div className="pl-sep" style={{ '--pl-from': 'var(--c-s2)', background: 'var(--c-s2)', transform: 'rotate(180deg)' }} />
      <div className="seg seg-overlay">
        <span className="text-k-tx-mut">pods:</span>
        <span className="ml-1 text-k-green">{expandedCount}/2</span>
      </div>
      <div className="pl-sep" style={{ '--pl-from': 'var(--c-blue)', background: 'var(--c-s2)', transform: 'rotate(180deg)' }} />
      <div className="seg seg-blue">
        <span className="tracking-wider text-[10px]">{events.length} events</span>
      </div>
      <div className="pl-sep" style={{ '--pl-from': 'var(--c-green)', background: 'var(--c-blue)', transform: 'rotate(180deg)' }} />
      <div className="seg" style={{ background: 'var(--c-green)', color: 'var(--c-crust)' }}>
        <span className="tracking-wider text-[10px]">{date} · {hh}:{mm}</span>
      </div>
    </div>
  )
}

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
    <div className="h-full w-full p-2 sm:p-3 md:p-4 flex">
      <div className="term-window flex-1 flex flex-col min-w-0 flicker-soft">
        <TitleBar />

        <div className="flex-1 flex overflow-hidden relative">
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(17, 17, 27, 0.78)', backdropFilter: 'blur(2px)' }}
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

        <StatusBar activeEvent={activeEvent} expandedCount={expandedPods.size} />
      </div>
    </div>
  )
}
