import { useState } from 'react'
import useEventState from './hooks/useEventState'
import Tabs from './components/Tabs'
import EventSelector from './components/EventSelector'
import OverviewTab from './components/OverviewTab'
import PacketFlowTab from './components/PacketFlowTab'
import ObjectMapTab from './components/ObjectMapTab'
import AncestryModal from './components/AncestryModal'
import HopInspector from './components/HopInspector'

const TABS = [
  { id: 'overview',   label: 'Architecture Overview' },
  { id: 'packetflow', label: 'Step-by-Step Packet Flow' },
  { id: 'objects',    label: 'K8s Object Map' },
]

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

        <Tabs tabs={TABS} active={tab} onSelect={setTab} />

        <div className="pt-6 animate-fade-in" key={tab}>
          {tab === 'overview' && (
            <OverviewTab
              activeEvent={activeEvent}
              activeComponentIds={activeComponentIds}
              onSelectComponent={selectComponent}
              activeStep={activeStep}
              onSelectStep={selectStep}
            />
          )}
          {tab === 'packetflow' && (
            <PacketFlowTab activeEvent={activeEvent} />
          )}
          {tab === 'objects' && <ObjectMapTab />}
        </div>

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

      {/* Bottom-docked hop inspector — only meaningful where the arrows live. */}
      {tab === 'overview' && (
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
