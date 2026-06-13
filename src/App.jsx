import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import useEventState from './hooks/useEventState'
import useFlowState from './hooks/useFlowState'
import useMediaQuery from './hooks/useMediaQuery'
import Tabs from './components/Tabs'
import OverviewTab from './components/OverviewTab'
import PacketFlowTab from './components/PacketFlowTab'
import DeepDiveTab from './components/DeepDiveTab'
import AncestryModal from './components/AncestryModal'
import SearchPalette from './components/SearchPalette'
import HopInspector from './components/HopInspector'
import DeepDiveHopInspector from './components/DeepDiveHopInspector'
import ReconControls from './components/ReconControls'
import SwipeViews from './components/SwipeViews'
import useReconciliationLoop from './hooks/useReconciliationLoop'
import { findDeepDive, indexTopicBoxes } from './data/deep-dives'
import { scrollIntoUpperThird } from './lib/scroll'

const TABS = [
  { id: 'deepdive',   label: 'Deep Dive' },
  { id: 'overview',   label: 'Overview' },
  { id: 'packetflow', label: 'Packet Flow' },
]

const DOCK_KEY = 'kv-dock-open'
const NET_KEY = 'kv-net-overlay'
const REPLICAS_KEY = 'kv-replicas-open'

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
  // A deep-dive box the tab should auto-open (set when a search result for a box
  // routes here); consumed by DeepDiveTab once its topic resolves.
  const [deepTarget, setDeepTarget] = useState(null)
  // The global fuzzy-search command palette.
  const [searchOpen, setSearchOpen] = useState(false)
  const {
    activeEvent,
    activeComponentId,
    activeComponentIds,
    activeStep,
    highlightedId,
    selectEvent,
    clearEvent,
    selectComponent,
    focusComponent,
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
    focusFlow,
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

  // The OVN network overlay on the Overview — a wide-desktop affordance like
  // the dock (on phones the OVN deep dive carries the same story instead).
  const [netOpen, setNetOpen] = useState(() => {
    try { return localStorage.getItem(NET_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(NET_KEY, netOpen ? '1' : '0') } catch { /* ignore */ }
  }, [netOpen])
  const netOverlay = isWide && netOpen

  // Condensed replica nodes (master-2/3, worker-2/3) are off by default so the
  // main overview stays clean; a wide-desktop toggle reveals them. The network
  // overlay anchors its per-node chips to them, so it forces them on.
  const [replicasOpen, setReplicasOpen] = useState(() => {
    try { return localStorage.getItem(REPLICAS_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(REPLICAS_KEY, replicasOpen ? '1' : '0') } catch { /* ignore */ }
  }, [replicasOpen])
  // Network mode lays out its own three parallel node columns, so the normal
  // canvas's trailing replica rows are suppressed there.
  const showReplicas = isWide && replicasOpen && !netOverlay

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
  // the index), or clear to the index. Mirrors selectEvent / clearEvent. The
  // active trace flow is owned by the auto-engage effect below, keyed on the
  // resolved topic — so the handlers only move the topic.
  const selectTopic = (id) => setDeepTopic(prev => (prev === id ? null : id))
  const clearTopic = () => setDeepTopic(null)

  // Deep-link entry from a [systemd] node's detail popup: close the popup,
  // surface the Deep Dive tab, and open the requested page. Mirrors the
  // revealInOverview jump.
  const openDeepDive = (topicId, boxId = null) => {
    scrollPositions.current[tab] = window.scrollY
    clearComponent()
    setDeepTopic(topicId)
    setDeepTarget(boxId)
    setTab('deepdive')
  }

  // Global fuzzy search: ⌘K / Ctrl+K (or `/` when not already typing) opens the
  // palette; it floats over whatever tab is showing.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (e.key === '/' && !searchOpen) {
        const el = document.activeElement
        const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
        if (!typing) { e.preventDefault(); setSearchOpen(true) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  // Route a chosen search result to its home: open a component's detail sheet,
  // surface a trace on the packet-flow tab, open a deep-dive topic, or open a
  // specific deep-dive box (topic + auto-opened popup).
  const onSearchSelect = (rec) => {
    setSearchOpen(false)
    if (rec.kind === 'component') {
      focusComponent(rec.id)
    } else if (rec.kind === 'event') {
      clearEvent()
      selectEvent(rec.event)
      setTab(docked ? 'overview' : 'packetflow')
    } else if (rec.kind === 'topic') {
      openDeepDive(rec.id)
    } else if (rec.kind === 'box') {
      openDeepDive(rec.topicId, rec.id)
    }
  }

  // Resolve the open topic + its box index once, for the deep-dive hop inspector
  // that mounts at App root (so its fixed panel anchors to the viewport, not a
  // transformed swipe pane — same reason the Overview's HopInspector lives here).
  const deepTopicObj = useMemo(() => (deepTopic ? findDeepDive(deepTopic) : null), [deepTopic])
  const deepBoxIndex = useMemo(() => (deepTopicObj ? indexTopicBoxes(deepTopicObj) : {}), [deepTopicObj])

  // The systemd reconciliation walkthrough state lives here (not inside the
  // canvas) so its step controls can dock to the bottom of the viewport as a
  // fixed navigator — exactly like the hop inspectors — instead of an inline
  // panel on the canvas. The hook resets itself when the open topic changes.
  const recon = deepTopicObj?.reconciliation || null
  const reconLoop = useReconciliationLoop(recon)

  // Auto-engage the trace when a deep-dive topic opens: a topic exists to walk
  // its one canonical flow, so we land with the arrows already lit instead of a
  // static, unengaged diagram. The hop reader stays closed until a badge/hop is
  // clicked (focusFlow leaves the step null). Topics without a flow (e.g.
  // systemd, which has its own reconciliation loop) just clear the trace.
  useEffect(() => {
    if (deepTopicObj?.flows?.length) focusFlow(deepTopicObj.flows[0])
    else clearFlow()
  }, [deepTopicObj, focusFlow, clearFlow])

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
      netOverlay={netOverlay}
      showReplicas={showReplicas}
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
      onSelectComponent={selectComponent}
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
      loop={reconLoop}
      targetBoxId={deepTarget}
      onConsumeTarget={() => setDeepTarget(null)}
      onSelectComponent={selectComponent}
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
        <button
          type="button"
          className="search-trigger"
          onClick={() => setSearchOpen(true)}
          title="Search objects & technologies (⌘K)"
          aria-label="Search"
        >
          <span aria-hidden>⌕</span>
          <span className="search-trigger-text">Search</span>
          <kbd className="search-trigger-kbd" aria-hidden>⌘K</kbd>
        </button>
        {isWide && tab === 'overview' && (
          <button
            type="button"
            className={`dock-toggle ${replicasOpen ? 'is-active' : ''}`}
            onClick={() => setReplicasOpen(v => !v)}
            aria-pressed={replicasOpen}
            disabled={netOverlay}
            title={netOverlay
              ? 'Network mode already shows all three node pairs in parallel'
              : replicasOpen
                ? 'Hide the additional master/worker nodes'
                : 'Show all master/worker nodes (3 + 3)'}
          >
            <span aria-hidden>⧉</span>
            {replicasOpen && !netOverlay ? 'Hide replicas' : 'All nodes'}
          </button>
        )}
        {isWide && (
          <button
            type="button"
            className={`dock-toggle ${netOpen ? 'is-active' : ''}`}
            onClick={() => setNetOpen(v => !v)}
            aria-pressed={netOpen}
            title={netOpen
              ? 'Hide the OVN logical network overlay'
              : 'Overlay the OVN logical network topology on the overview'}
          >
            <span aria-hidden>⌗</span>
            {netOpen ? 'Hide network' : 'Network'}
          </button>
        )}
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
                  onSelectComponent={selectComponent}
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

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={onSearchSelect}
      />

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
          onSelectComponent={selectComponent}
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

      {/* The systemd reconciliation walkthrough, docked at the bottom like the
          hop readers above (only the systemd topic arms a scenario). */}
      {tab === 'deepdive' && recon && <ReconControls loop={reconLoop} />}
    </div>
  )
}
