import { useState, useEffect } from 'react'
import useEventState from './hooks/useEventState'
import useMediaQuery from './hooks/useMediaQuery'
import Tabs from './components/Tabs'
import EventSelector from './components/EventSelector'
import OverviewTab from './components/OverviewTab'
import PacketFlowTab from './components/PacketFlowTab'
import ObjectMapTab from './components/ObjectMapTab'
import AncestryModal from './components/AncestryModal'
import HopInspector from './components/HopInspector'
import SwipeViews from './components/SwipeViews'

const TABS = [
  { id: 'overview',   label: 'Architecture Overview' },
  { id: 'packetflow', label: 'Step-by-Step Packet Flow' },
  { id: 'objects',    label: 'K8s Object Map' },
]

const DOCK_KEY = 'kv-dock-open'

function Header() {
  return (
    <header className="text-center mb-8">
      <h1 className="font-display title-gradient text-[clamp(1.9rem,4vw,3.2rem)] font-extrabold tracking-tight leading-tight">
        kube-weird-visualizer
      </h1>
    </header>
  )
}

export default function App() {
  const [tab, setTab] = useState('overview')
  const {
    activeEvent,
    activeComponentId,
    activeComponentIds,
    activeStep,
    selectEvent,
    clearEvent,
    selectComponent,
    clearComponent,
    selectStep,
    clearStep,
  } = useEventState()

  // Swipe paging is the navigation model on small/touch screens; the dockable
  // side panel is a wide-desktop affordance. The 1024–1279px band keeps the
  // classic single-column tabs.
  const isCompact = useMediaQuery('(max-width: 1023px)')
  const isWide = useMediaQuery('(min-width: 1280px)')

  const [dockOpen, setDockOpen] = useState(() => {
    try { return localStorage.getItem(DOCK_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(DOCK_KEY, dockOpen ? '1' : '0') } catch { /* ignore */ }
  }, [dockOpen])

  // When the packet flow is docked beside the overview it stops being a tab, so
  // it never lives in two places at once. Snap off it if it was active.
  const docked = isWide && dockOpen
  useEffect(() => {
    if (docked && tab === 'packetflow') setTab('overview')
  }, [docked, tab])

  const visibleTabs = docked ? TABS.filter(t => t.id !== 'packetflow') : TABS
  // Keep the active index valid for the swipe pager / tab strip.
  const activeIndex = Math.max(0, visibleTabs.findIndex(t => t.id === tab))

  const overviewPanel = (
    <OverviewTab
      activeEvent={activeEvent}
      activeComponentIds={activeComponentIds}
      onSelectComponent={selectComponent}
      activeStep={activeStep}
      onSelectStep={selectStep}
    />
  )
  const packetPanel = (
    <PacketFlowTab activeEvent={activeEvent} onSelectEvent={selectEvent} />
  )
  const objectsPanel = <ObjectMapTab />

  const panelFor = (id) => {
    if (id === 'overview') return overviewPanel
    if (id === 'packetflow') return packetPanel
    return objectsPanel
  }

  return (
    <div className="relative">
      <div
        className="px-3 sm:px-8 py-10 mx-auto"
        style={{ maxWidth: 1500 }}
      >
        <Header />

        <EventSelector
          activeEvent={activeEvent}
          onSelectEvent={selectEvent}
          onClearEvent={clearEvent}
        />

        <div className="tabs-row">
          <Tabs tabs={visibleTabs} active={tab} onSelect={setTab} />
          {isWide && (
            <button
              type="button"
              className={`dock-toggle ${dockOpen ? 'is-active' : ''}`}
              onClick={() => setDockOpen(v => !v)}
              aria-pressed={dockOpen}
              title={dockOpen ? 'Undock the packet flow panel' : 'Dock the packet flow beside the overview'}
            >
              <span aria-hidden>⧉</span>
              {dockOpen ? 'Undock flow' : 'Dock flow'}
            </button>
          )}
        </div>

        {isCompact ? (
          // Touch / small screens: swipe horizontally between tabs.
          <div className="pt-6">
            <SwipeViews
              index={activeIndex}
              count={visibleTabs.length}
              onIndexChange={(i) => setTab(visibleTabs[i].id)}
            >
              {visibleTabs.map(t => panelFor(t.id))}
            </SwipeViews>
          </div>
        ) : docked ? (
          // Wide desktop with the flow docked: overview + flow, side by side.
          <div className="pt-6 dock-layout">
            <div className="dock-main min-w-0">{panelFor(tab)}</div>
            <aside className="dock-panel">
              <div className="dock-panel-head">
                <span className="dock-panel-title">Packet Flow</span>
                <button
                  type="button"
                  className="dock-panel-close"
                  onClick={() => setDockOpen(false)}
                  aria-label="Close packet flow panel"
                >✕</button>
              </div>
              <div className="dock-panel-body">
                <PacketFlowTab
                  activeEvent={activeEvent}
                  onSelectEvent={selectEvent}
                  activeStep={activeStep}
                  onSelectStep={selectStep}
                />
              </div>
            </aside>
          </div>
        ) : (
          // Mid-width desktop: classic single-column tabs.
          <div className="pt-6 animate-fade-in" key={tab}>
            {panelFor(tab)}
          </div>
        )}

        <p
          className="mt-8 text-[0.7rem]"
          style={{ color: 'var(--tx-muted)' }}
        >
          💡 Click any node to inspect its YAML role, interactions, and copy-paste
          shell commands. Pick a trace flow above to follow a packet from
          client to PID 1, then tap a numbered arrow to read about that hop.
        </p>
      </div>

      <AncestryModal
        componentId={activeComponentId}
        onClose={clearComponent}
        onSelectComponent={selectComponent}
      />

      {/* Bottom-docked hop inspector — only on the overview tab, and only when
          the side panel isn't already serving as the hop reader. */}
      {tab === 'overview' && !docked && (
        <HopInspector
          activeEvent={activeEvent}
          activeStep={activeStep}
          onSelectStep={selectStep}
          onClose={clearStep}
        />
      )}
    </div>
  )
}
