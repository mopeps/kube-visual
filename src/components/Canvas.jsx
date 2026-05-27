import ComponentBox from './ComponentBox'
import PodLayer from './PodLayer'
import ArrowOverlay from './ArrowOverlay'
import Breadcrumb from './Breadcrumb'
import InspectorPanel from './InspectorPanel'

function LayerBoundary({ label, sub, color, dashed = false, children, className = '' }) {
  return (
    <div
      className={`relative rounded-lg p-3.5 ${className}`}
      style={{
        border: `1px ${dashed ? 'dashed' : 'solid'} ${color}30`,
        background: `linear-gradient(180deg, ${color}08 0%, ${color}02 100%)`,
      }}
    >
      <div className="flex items-baseline gap-2 mb-3">
        <span
          className="font-display text-[12px] font-semibold tracking-wide uppercase"
          style={{ color: `${color}` }}
        >
          {label}
        </span>
        {sub && (
          <span className="font-mono text-[10px] text-k-tx-mut">{sub}</span>
        )}
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}25, transparent)` }} />
      </div>
      {children}
    </div>
  )
}

function Toolbar({ activeEvent, onClearEvent, onOpenSidebar }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 border-b border-k-bd"
      style={{ background: 'rgba(7,11,20,0.6)', backdropFilter: 'blur(8px)' }}
    >
      <button
        onClick={onOpenSidebar}
        className="lg:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-k-tx-mut hover:text-k-tx-wh hover:bg-white/5 transition-colors"
        aria-label="Open sidebar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-2.5">
        <span
          className="w-1.5 h-1.5 rounded-full bg-k-green flex-shrink-0"
          style={{ boxShadow: '0 0 10px #34d399', animation: 'pulse-amber 2.4s ease-in-out infinite' }}
        />
        <span className="font-display text-[14px] font-semibold tracking-tight text-k-tx-wh">
          Topology
        </span>
        <span className="hidden sm:inline font-mono text-[11px] text-k-tx-mut">
          cluster-01 / openshift
        </span>
      </div>

      <div className="flex-1" />

      {activeEvent ? (
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center gap-2 rounded-md px-2.5 py-1"
            style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-k-amber" style={{ boxShadow: '0 0 8px #fbbf24' }} />
            <span className="font-mono text-[11px] font-medium text-k-amber">
              tracing
            </span>
            <span className="font-display text-[12px] font-medium text-k-tx-wh">
              {activeEvent.eventName}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClearEvent() }}
            className="font-mono text-[11px] px-2 py-1 rounded-md text-k-tx-mut hover:text-k-tx-wh hover:bg-white/5 transition-colors"
          >
            clear
          </button>
        </div>
      ) : (
        <span className="font-mono text-[11px] text-k-tx-dim">
          select an event to trace
        </span>
      )}
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="absolute top-4 right-4 z-10 hidden md:flex items-center gap-2 rounded-md px-3 py-1.5 animate-fade-in"
      style={{ background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.25)' }}
    >
      <svg className="w-3.5 h-3.5 text-k-cyan" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-mono text-[11px] text-k-tx-br">
        Pick an event from the left to trace the flow.
      </span>
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
      <Toolbar activeEvent={activeEvent} onClearEvent={onClearEvent} onOpenSidebar={onOpenSidebar} />
      <Breadcrumb expandedPods={expandedPods} />

      <div
        id="canvas-root"
        className="flex-1 overflow-auto touch-auto p-6 relative"
        onClick={() => { onClearComponent() }}
      >
        {!activeEvent && <EmptyHint />}

        {/* Cluster boundary */}
        <div
          className="rounded-xl p-5 min-w-[980px] relative"
          style={{
            border: '1px solid var(--c-bd-hi)',
            background:
              'linear-gradient(180deg, rgba(17, 27, 48, 0.5) 0%, rgba(12, 20, 36, 0.3) 100%)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.02) inset, 0 24px 60px -24px rgba(0,0,0,0.6)',
          }}
        >
          {/* Cluster header */}
          <div className="flex items-center gap-3 mb-5">
            <span className="font-display text-[18px] font-semibold tracking-tight text-k-tx-wh">
              Cluster Boundary
            </span>
            <span className="font-mono text-[11px] text-k-tx-mut">OpenShift · Kubernetes</span>
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Management Layer */}
            <LayerBoundary label="Management Layer" sub="control plane" color="#38bdf8">
              <div className="space-y-1.5">
                <ComponentBox
                  id="api-server"
                  label="API Server"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  accentColor="#38bdf8"
                />
                <ComponentBox
                  id="scheduler"
                  label="Scheduler"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  accentColor="#38bdf8"
                />
                <ComponentBox
                  id="kubelet"
                  label="Kubelet"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  accentColor="#38bdf8"
                />
                <ComponentBox
                  id="crio"
                  label="CRI-O"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  accentColor="#38bdf8"
                />
                <ComponentBox
                  id="ingress-router-haproxy"
                  label="Ingress Router · HAProxy"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  accentColor="#a78bfa"
                />
              </div>
            </LayerBoundary>

            {/* Infrastructure Node */}
            <div
              className="xl:col-span-2 relative rounded-lg p-3.5"
              style={{
                border: '1px solid rgba(251, 146, 60, 0.28)',
                background: 'linear-gradient(180deg, rgba(251, 146, 60, 0.05) 0%, rgba(251, 146, 60, 0.01) 100%)',
              }}
            >
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-display text-[12px] font-semibold tracking-wide uppercase text-k-orange">
                  Infrastructure Node
                </span>
                <span className="font-mono text-[10px] text-k-tx-mut">node-01 · worker</span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(251, 146, 60, 0.25), transparent)' }} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <LayerBoundary label="Namespace · app" sub="project" color="#a78bfa" dashed>
                  <PodLayer
                    podId="app-pod"
                    label="Pod · web-app"
                    activeComponentIds={activeComponentIds}
                    activeComponentId={activeComponentId}
                    onSelectComponent={onSelectComponent}
                    isExpanded={expandedPods.has('app-pod')}
                    onToggleExpand={onTogglePod}
                  />
                </LayerBoundary>

                <LayerBoundary label="Namespace · router" sub="project" color="#a78bfa" dashed>
                  <PodLayer
                    podId="router-pod"
                    label="Pod · router"
                    activeComponentIds={activeComponentIds}
                    activeComponentId={activeComponentId}
                    onSelectComponent={onSelectComponent}
                    isExpanded={expandedPods.has('router-pod')}
                    onToggleExpand={onTogglePod}
                  />
                </LayerBoundary>

                <LayerBoundary
                  label="Host Networking"
                  sub="kernel subsystem"
                  color="#34d399"
                  className="lg:col-span-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <ComponentBox
                      id="ovs-bridge-br-int"
                      label="OVS Bridge · br-int"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      accentColor="#34d399"
                    />
                    <ComponentBox
                      id="host-veth-pair"
                      label="veth Pair"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      accentColor="#34d399"
                    />
                  </div>
                </LayerBoundary>
              </div>
            </div>
          </div>

          {/* External client */}
          <div className="mt-5 pt-4 flex items-center gap-4" style={{ borderTop: '1px solid var(--c-bd)' }}>
            <span className="font-display text-[12px] font-semibold tracking-wide uppercase text-k-tx-mut">
              External
            </span>
            <ComponentBox
              id="external-client"
              label="External Client"
              activeComponentIds={activeComponentIds}
              activeComponentId={activeComponentId}
              onSelect={onSelectComponent}
              accentColor="#22d3ee"
              className="w-48"
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
