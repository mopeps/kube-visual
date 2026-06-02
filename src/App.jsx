import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import useEventState from './hooks/useEventState'
import useFlowState from './hooks/useFlowState'
import useMediaQuery from './hooks/useMediaQuery'
import Tabs from './components/Tabs'
import OverviewTab from './components/OverviewTab'
import PacketFlowTab from './components/PacketFlowTab'
import DeepDiveTab from './components/DeepDiveTab'
import AncestryModal from './components/AncestryModal'
import HopInspector from './components/HopInspector'
import DeepDiveHopInspector from './components/DeepDiveHopInspector'
import SwipeViews from './components/SwipeViews'
import { findDeepDive, indexTopicBoxes } from './data/deep-dives'
import { scrollIntoUpperThird } from './lib/scroll'

const TABS = [
  { id: 'deepdive',   label: 'Deep Dive' },
  { id: 'overview',   label: 'Overview' },
  { id: 'packetflow', label: 'Packet Flow' },
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
  // Which in-depth page the Deep Dive tab is showing (null = the topic index).
  const [deepTopic, setDeepTopic] = useState(null)
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

  // Deep-dive trace flows mirror the Overview's event state, but live on their
  // own hook so the two never tangle (a topic's flow vs the topology's event).
  const {
    activeFlow,
    activeFlowStep,
    activeBoxIds,
    selectFlow,
    clearFlow,
    selectFlowStep,
    clearFlowStep,
  } = useFlowState()

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

  // Per-tab scroll memory. The whole page shares one (window) scroll offset, so
  // without this a tab inherits wherever the previous one was scrolled to —
  // reading as a "synchronized" scroll across tabs. We stash the outgoing tab's
  // scrollY on every plain tab switch and restore the incoming tab's own offset
  // after it paints, so each tab scrolls independently. Programmatic jumps
  // (jumpToStep / revealInOverview) deliberately bypass this so their own
  // scroll-to-target wins.
  const scrollPositions = useRef({})
  const restoreTabRef = useRef(null)

  // Compact mode: the header + tab strip live in an absolutely-positioned
  // "chrome" layer over the top of the swipe pager. We slide that layer up by
  // the active pane's scroll offset (clamped to its own height) so it scrolls
  // away with the content — then back into view when you scroll to the top —
  // while the pager keeps its per-tab independent scroll and swipe gestures.
  const shellRef = useRef(null)
  const chromeRef = useRef(null)
  const chromeHRef = useRef(0)

  useLayoutEffect(() => {
    if (!isCompact) return
    const el = chromeRef.current
    if (!el) return
    const measure = () => {
      const h = el.offsetHeight
      chromeHRef.current = h
      shellRef.current?.style.setProperty('--compact-chrome-h', `${h}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isCompact])

  const handleActiveScroll = (scrollTop) => {
    const el = chromeRef.current
    if (!el) return
    const shift = Math.min(Math.max(scrollTop, 0), chromeHRef.current)
    el.style.transform = `translate3d(0, ${-shift}px, 0)`
  }

  const changeTab = (next) => {
    if (next === tab) return
    scrollPositions.current[tab] = window.scrollY
    // In compact mode SwipeViews owns scroll memory + restore (it also shifts
    // the inactive panes so the swipe previews each tab at its own position),
    // so leave the window scroll to it and skip our restore there.
    if (!isCompact) restoreTabRef.current = next
    setTab(next)
  }

  useLayoutEffect(() => {
    if (restoreTabRef.current !== tab) return
    restoreTabRef.current = null
    window.scrollTo(0, scrollPositions.current[tab] ?? 0)
  }, [tab])

  // Jump from a hop in the event tab straight to its object on the overview:
  // focus the hop (so the arrow + hop inspector light up) and surface the
  // overview. The auto-scroll effect below then brings the object into view.
  const jumpToStep = (n) => {
    scrollPositions.current[tab] = window.scrollY
    focusStep(n)
    setTab('overview')
  }

  // From a detail popup's location badge: close the popup, surface the overview,
  // and spotlight the component there (OverviewTab scrolls to and pulses it).
  const revealInOverview = (id) => {
    scrollPositions.current[tab] = window.scrollY
    clearComponent()
    setTab('overview')
    revealComponent(id)
  }

  // Deep Dive selection: toggle a topic open/closed (re-selecting clears back to
  // the index), or clear to the index. Mirrors selectEvent / clearEvent. Either
  // way the active trace flow is dropped — flows belong to a single topic.
  const selectTopic = (id) => { clearFlow(); setDeepTopic(prev => (prev === id ? null : id)) }
  const clearTopic = () => { clearFlow(); setDeepTopic(null) }

  // Deep-link entry from a [systemd] node's detail popup: close the popup,
  // surface the Deep Dive tab, and open the requested page. Mirrors the
  // revealInOverview jump.
  const openDeepDive = (topicId) => {
    scrollPositions.current[tab] = window.scrollY
    clearComponent()
    clearFlow()
    setDeepTopic(topicId)
    setTab('deepdive')
  }

  // Resolve the open topic + its box index once, for the deep-dive hop inspector
  // that mounts at App root (so its fixed panel anchors to the viewport, not a
  // transformed swipe pane — same reason the Overview's HopInspector lives here).
  const deepTopicObj = useMemo(() => (deepTopic ? findDeepDive(deepTopic) : null), [deepTopic])
  const deepBoxIndex = useMemo(() => (deepTopicObj ? indexTopicBoxes(deepTopicObj) : {}), [deepTopicObj])

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
      // Works whether the overview scrolls the window (desktop) or its own pane
      // (the compact swipe pager).
      scrollIntoUpperThird(document.getElementById(focusId))
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
      onFocusStep={focusStep}
      onJumpToStep={jumpToStep}
    />
  )
  const deepDivePanel = (
    <DeepDiveTab
      activeTopic={deepTopic}
      onSelectTopic={selectTopic}
      onClearTopic={clearTopic}
      activeFlow={activeFlow}
      activeFlowStep={activeFlowStep}
      activeBoxIds={activeBoxIds}
      onSelectFlow={selectFlow}
      onClearFlow={clearFlow}
      onSelectFlowStep={selectFlowStep}
    />
  )
  const panelFor = (id) => {
    if (id === 'packetflow') return packetPanel
    if (id === 'deepdive') return deepDivePanel
    return overviewPanel
  }

  const chrome = (
    <>
      <Header />

      <div className="tabs-row">
        <Tabs tabs={visibleTabs} active={tab} onSelect={changeTab} />
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
    </>
  )

  return (
    <div className="relative">
      <div
        ref={shellRef}
        className={`mx-auto ${isCompact ? 'app-shell--compact' : 'px-3 sm:px-8 py-10'}`}
        style={{ maxWidth: 1500 }}
      >
        {isCompact ? (
          // Touch / small screens: swipe horizontally between tabs. The chrome
          // (header + tabs) floats over the top of the pager and slides away as
          // the active pane scrolls; the host fills the fixed-height shell so
          // each pane can scroll on its own.
          <>
            <div className="compact-chrome" ref={chromeRef}>
              {chrome}
            </div>
            <div className="swipe-host">
              <SwipeViews
                index={activeIndex}
                count={visibleTabs.length}
                onIndexChange={(i) => changeTab(visibleTabs[i].id)}
                onActiveScroll={handleActiveScroll}
              >
                {visibleTabs.map(t => panelFor(t.id))}
              </SwipeViews>
            </div>
          </>
        ) : (
          <>
            {chrome}
            {docked ? (
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
                  onFocusStep={focusStep}
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
          </>
        )}
      </div>

      <AncestryModal
        componentId={activeComponentId}
        onClose={clearComponent}
        onSelectComponent={selectComponent}
        onRevealInOverview={revealInOverview}
        onOpenDeepDive={openDeepDive}
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

      {/* The same bottom hop reader, for deep-dive trace flows. */}
      {tab === 'deepdive' && (
        <DeepDiveHopInspector
          boxIndex={deepBoxIndex}
          activeFlow={activeFlow}
          activeStep={activeFlowStep}
          onSelectStep={selectFlowStep}
          onClose={clearFlowStep}
        />
      )}
    </div>
  )
}
