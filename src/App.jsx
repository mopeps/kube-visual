import { useState, useEffect, useRef } from 'react'
import useEventState from './hooks/useEventState'
import useMediaQuery from './hooks/useMediaQuery'
import Tabs from './components/Tabs'
import OverviewTab from './components/OverviewTab'
import PacketFlowTab from './components/PacketFlowTab'
import AncestryModal from './components/AncestryModal'
import HopInspector from './components/HopInspector'
import SwipeViews from './components/SwipeViews'

const TABS = [
  { id: 'overview',   label: 'Architecture Overview' },
  { id: 'packetflow', label: 'Step-by-Step Packet Flow' },
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
    highlightedId,
    selectEvent,
    clearEvent,
    selectComponent,
    clearComponent,
    revealComponent,
    clearHighlight,
    selectStep,
    focusStep,
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

  // Jump from a hop in the event tab straight to its object on the overview:
  // focus the hop (so the arrow + hop inspector light up) and surface the
  // overview. The auto-scroll effect below then brings the object into view.
  const jumpToStep = (n) => {
    focusStep(n)
    setTab('overview')
  }

  // From a detail popup's location badge: close the popup, surface the overview,
  // and spotlight the component there (OverviewTab scrolls to and pulses it).
  const revealInOverview = (id) => {
    clearComponent()
    setTab('overview')
    revealComponent(id)
  }

  // Follow the trace on the overview: whenever the inspected hop changes (or an
  // event is freshly selected) and the overview is showing, scroll the object
  // the packet is currently on into the upper third of the viewport — keeping
  // the source above it visible so you keep your bearings along the flow.
  const lastTraceRef = useRef(null)
  useEffect(() => {
    if (tab !== 'overview' || !activeEvent) {
      if (!activeEvent) lastTraceRef.current = null
      return
    }
    const step = activeStep != null
      ? activeEvent.steps.find(s => s.step === activeStep)
      : null
    // With a hop focused, follow its target (where the packet now is). With no
    // hop focused, only park at the start when the event was *just* selected —
    // so dismissing the hop inspector doesn't yank the page back to the top.
    let focusId
    if (step) {
      focusId = step.targetComponentId
    } else if (lastTraceRef.current !== activeEvent.eventId) {
      focusId = activeEvent.steps[0]?.sourceComponentId
    }
    lastTraceRef.current = activeEvent.eventId
    if (!focusId) return
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(focusId)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const upper = window.innerHeight * 0.33
      window.scrollBy({ top: rect.top - upper, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [activeStep, activeEvent, tab])

  const overviewPanel = (
    <OverviewTab
      activeEvent={activeEvent}
      activeComponentIds={activeComponentIds}
      onSelectComponent={selectComponent}
      activeStep={activeStep}
      onSelectStep={selectStep}
      highlightId={highlightedId}
      onClearHighlight={clearHighlight}
    />
  )
  const packetPanel = (
    <PacketFlowTab
      activeEvent={activeEvent}
      onSelectEvent={selectEvent}
      onClearEvent={clearEvent}
      activeStep={activeStep}
      onSelectStep={selectStep}
      onJumpToStep={jumpToStep}
    />
  )
  const panelFor = (id) => {
    if (id === 'packetflow') return packetPanel
    return overviewPanel
  }

  return (
    <div className="relative">
      <div
        className="px-3 sm:px-8 py-10 mx-auto"
        style={{ maxWidth: 1500 }}
      >
        <Header />

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
                  onClearEvent={clearEvent}
                  activeStep={activeStep}
                  onSelectStep={selectStep}
                  onJumpToStep={jumpToStep}
                  followSelected
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
          💡 Click any node to inspect its role, interactions, Manifest → Kernel
          pipeline, and copy-paste shell commands. Pick a trace flow in the Packet
          Flow tab to follow a packet from client to PID 1, then tap a numbered
          arrow to read about that hop.
        </p>
      </div>

      <AncestryModal
        componentId={activeComponentId}
        onClose={clearComponent}
        onSelectComponent={selectComponent}
        onRevealInOverview={revealInOverview}
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
