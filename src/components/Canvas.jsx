import ComponentBox from './ComponentBox'
import PodLayer from './PodLayer'
import ArrowOverlay from './ArrowOverlay'
import Breadcrumb from './Breadcrumb'
import InspectorPanel from './InspectorPanel'

function LayerBoundary({ label, color, tag, dashed = false, children, className = '' }) {
  return (
    <div
      className={`p-3 ${className}`}
      style={{
        border: `1px ${dashed ? 'dashed' : 'solid'} ${color}35`,
        background: `${color}04`,
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="font-mono text-[0.48rem] tracking-[0.18em] px-1 border flex-shrink-0"
          style={{ color: `${color}80`, borderColor: `${color}30` }}
        >
          {tag}
        </span>
        <span
          className="font-display text-base tracking-widest leading-none"
          style={{ color: `${color}90` }}
        >
          {label}
        </span>
        <div className="flex-1 h-px" style={{ background: `${color}15` }} />
      </div>
      {children}
    </div>
  )
}

export default function Canvas({
  activeEvent,
  activeComponentIds,
  activeComponentId,
  expandedPods,
  onSelectComponent,
  onClearComponent,
  onTogglePod,
  onClearEvent,
  onOpenSidebar,
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">

      {/* Top toolbar */}
      <div
        className="flex items-center gap-3 px-3 py-2 flex-shrink-0 border-b"
        style={{ borderColor: '#192540', background: 'rgba(7,11,20,0.8)' }}
      >
        {/* Mobile: hamburger */}
        <button
          onClick={onOpenSidebar}
          className="lg:hidden flex-shrink-0 w-7 h-7 flex items-center justify-center border transition-colors"
          style={{ borderColor: '#1f3054', color: '#456688' }}
          aria-label="Open sidebar"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Cluster label */}
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 flex-shrink-0"
            style={{ background: '#34d399', animation: 'pulse-amber 2.4s ease-in-out infinite' }}
          />
          <span className="font-display text-base tracking-widest" style={{ color: '#cce0f4' }}>
            KUBE-VISUAL
          </span>
          <span className="font-mono text-[0.5rem]" style={{ color: '#2e4a70' }}>
            · CLUSTER-01
          </span>
        </div>

        <div className="flex-1" />

        {/* Active event indicator */}
        {activeEvent ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.55rem] tracking-widest" style={{ color: '#fb923c' }}>
              {activeEvent.eventName.toUpperCase()}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClearEvent() }}
              className="font-mono text-[0.5rem] tracking-[0.1em] px-2 py-1 border transition-all duration-150"
              style={{ borderColor: '#fb923c50', color: '#fb923c80' }}
            >
              CLEAR ✕
            </button>
          </div>
        ) : (
          <span className="font-mono text-[0.5rem] tracking-widest" style={{ color: '#1f3054' }}>
            NO EVENT ACTIVE
          </span>
        )}
      </div>

      {/* Breadcrumb */}
      <Breadcrumb expandedPods={expandedPods} />

      {/* Canvas scrollable area */}
      <div
        id="canvas-root"
        className="flex-1 overflow-auto touch-auto p-5 relative"
        onClick={() => { onClearComponent() }}
      >
        {/* Cluster boundary */}
        <div
          className="border p-4 min-w-[980px]"
          style={{ borderColor: '#1f3054', background: 'rgba(11,18,32,0.4)' }}
        >
          {/* Cluster header */}
          <div className="flex items-center gap-2 mb-4">
            <span className="font-display text-2xl tracking-widest leading-none" style={{ color: '#cce0f4' }}>
              CLUSTER BOUNDARY
            </span>
            <div className="flex-1 h-px" style={{ background: '#1f3054' }} />
            <span className="font-mono text-[0.5rem] tracking-widest" style={{ color: '#2e4a70' }}>
              OPENSHIFT / KUBERNETES
            </span>
          </div>

          {/* Main grid: management + infrastructure */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">

            {/* Management Layer */}
            <LayerBoundary
              label="MANAGEMENT LAYER"
              tag="CTL"
              color="#38bdf8"
            >
              <div className="space-y-1.5">
                <ComponentBox
                  id="api-server"
                  label="API Server"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-k-bd"
                  accentColor="#38bdf8"
                />
                <ComponentBox
                  id="scheduler"
                  label="Scheduler"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-k-bd"
                  accentColor="#38bdf8"
                />
                <ComponentBox
                  id="kubelet"
                  label="Kubelet"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-k-bd"
                  accentColor="#38bdf8"
                />
                <ComponentBox
                  id="crio"
                  label="CRI-O"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-k-bd"
                  accentColor="#38bdf8"
                />
                <ComponentBox
                  id="ingress-router-haproxy"
                  label="Ingress Router (HAProxy)"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-k-bd"
                  accentColor="#a78bfa"
                />
              </div>
            </LayerBoundary>

            {/* Infrastructure Node */}
            <div
              className="xl:col-span-2 p-3"
              style={{ border: '2px solid rgba(251,146,60,0.2)', background: 'rgba(251,146,60,0.02)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="font-mono text-[0.48rem] tracking-[0.18em] px-1 border flex-shrink-0"
                  style={{ color: 'rgba(251,146,60,0.6)', borderColor: 'rgba(251,146,60,0.25)' }}
                >
                  NODE
                </span>
                <span className="font-display text-base tracking-widest" style={{ color: 'rgba(251,146,60,0.7)' }}>
                  INFRASTRUCTURE NODE BOUNDARY
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(251,146,60,0.12)' }} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {/* Namespace: app */}
                <LayerBoundary
                  label="NAMESPACE: APP"
                  tag="NS"
                  color="#a78bfa"
                  dashed
                >
                  <PodLayer
                    podId="app-pod"
                    label="Pod: web-app"
                    activeComponentIds={activeComponentIds}
                    activeComponentId={activeComponentId}
                    onSelectComponent={onSelectComponent}
                    isExpanded={expandedPods.has('app-pod')}
                    onToggleExpand={onTogglePod}
                  />
                </LayerBoundary>

                {/* Namespace: router */}
                <LayerBoundary
                  label="NAMESPACE: ROUTER"
                  tag="NS"
                  color="#a78bfa"
                  dashed
                >
                  <PodLayer
                    podId="router-pod"
                    label="Pod: router"
                    activeComponentIds={activeComponentIds}
                    activeComponentId={activeComponentId}
                    onSelectComponent={onSelectComponent}
                    isExpanded={expandedPods.has('router-pod')}
                    onToggleExpand={onTogglePod}
                  />
                </LayerBoundary>

                {/* Host networking */}
                <LayerBoundary
                  label="HOST NETWORKING SUBSYSTEM"
                  tag="NET"
                  color="#34d399"
                  className="lg:col-span-2"
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    <ComponentBox
                      id="ovs-bridge-br-int"
                      label="OVS Bridge (br-int)"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      colorClass="border-k-bd"
                      accentColor="#34d399"
                    />
                    <ComponentBox
                      id="host-veth-pair"
                      label="veth Pair"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      colorClass="border-k-bd"
                      accentColor="#34d399"
                    />
                  </div>
                </LayerBoundary>
              </div>
            </div>
          </div>

          {/* External client */}
          <div
            className="mt-3 pt-3 flex items-center gap-4"
            style={{ borderTop: '1px solid #192540' }}
          >
            <span className="font-display text-sm tracking-widest" style={{ color: '#2e4a70' }}>EXTERNAL</span>
            <div style={{ width: '1px', height: '1rem', background: '#1f3054' }} />
            <ComponentBox
              id="external-client"
              label="External Client"
              activeComponentIds={activeComponentIds}
              activeComponentId={activeComponentId}
              onSelect={onSelectComponent}
              colorClass="border-k-bd"
              accentColor="#22d3ee"
              className="w-44"
            />
          </div>
        </div>

        <ArrowOverlay activeEvent={activeEvent} expandedPods={expandedPods} />
      </div>

      {activeComponentId && (
        <InspectorPanel componentId={activeComponentId} onClose={onClearComponent} />
      )}
    </div>
  )
}
