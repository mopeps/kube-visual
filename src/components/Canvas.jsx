import ComponentBox from './ComponentBox'
import PodLayer from './PodLayer'
import ArrowOverlay from './ArrowOverlay'
import Breadcrumb from './Breadcrumb'
import InspectorPanel from './InspectorPanel'

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
      {/* Top bar */}
      <div className="flex items-center">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden flex-shrink-0 p-2 mx-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
          aria-label="Open sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex-1">
          <Breadcrumb expandedPods={expandedPods} />
        </div>
      </div>

      <div
        id="canvas-root"
        className="flex-1 overflow-auto touch-auto p-6 relative"
        onClick={() => { onClearComponent(); }}
      >
        {/* Cluster Boundary */}
        <div className="rounded-lg border border-white/10 bg-black/20 p-4 min-w-[1024px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.6rem] font-display font-semibold text-white/40 uppercase tracking-[0.18em]">
              Cluster Boundary
            </span>
            {activeEvent && (
              <button
                onClick={(e) => { e.stopPropagation(); onClearEvent(); }}
                className="text-xs text-white/35 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
              >
                Clear Event
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Management Layer — sky blue */}
            <div className="rounded border border-[#0ea5e9]/30 bg-[#0ea5e9]/5 p-3">
              <p className="text-[0.6rem] font-display font-semibold text-[#0ea5e9] mb-2 uppercase tracking-[0.15em]">
                Management Layer
              </p>
              <div className="space-y-2">
                <ComponentBox
                  id="api-server"
                  label="API Server"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-[#0ea5e9]/50 bg-[#0ea5e9]/5"
                  accentColor="#0ea5e9"
                />
                <ComponentBox
                  id="scheduler"
                  label="Scheduler"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-[#0ea5e9]/50 bg-[#0ea5e9]/5"
                  accentColor="#0ea5e9"
                />
                <ComponentBox
                  id="kubelet"
                  label="Kubelet"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-[#0ea5e9]/50 bg-[#0ea5e9]/5"
                  accentColor="#0ea5e9"
                />
                <ComponentBox
                  id="crio"
                  label="CRI-O"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-[#0ea5e9]/50 bg-[#0ea5e9]/5"
                  accentColor="#0ea5e9"
                />
                <ComponentBox
                  id="ingress-router-haproxy"
                  label="Ingress Router (HAProxy)"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-[#7c3aed]/50 bg-[#7c3aed]/5"
                  accentColor="#7c3aed"
                />
              </div>
            </div>

            {/* Infrastructure Node Boundary — amber */}
            <div className="xl:col-span-2 rounded border-2 border-[#f59e0b]/30 bg-[#f59e0b]/5 p-3">
              <p className="text-[0.6rem] font-display font-semibold text-[#f59e0b] mb-2 uppercase tracking-[0.15em]">
                Infrastructure Node Boundary
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Namespace: app — purple */}
                <div className="rounded border border-dashed border-[#7c3aed]/40 bg-[#7c3aed]/5 p-3">
                  <p className="text-[0.6rem] font-display font-semibold text-[#7c3aed] mb-2 uppercase tracking-[0.15em]">
                    Namespace: app
                  </p>
                  <PodLayer
                    podId="app-pod"
                    label="Pod: web-app"
                    activeComponentIds={activeComponentIds}
                    activeComponentId={activeComponentId}
                    onSelectComponent={onSelectComponent}
                    isExpanded={expandedPods.has('app-pod')}
                    onToggleExpand={onTogglePod}
                  />
                </div>

                {/* Namespace: router — purple */}
                <div className="rounded border border-dashed border-[#7c3aed]/40 bg-[#7c3aed]/5 p-3">
                  <p className="text-[0.6rem] font-display font-semibold text-[#7c3aed] mb-2 uppercase tracking-[0.15em]">
                    Namespace: router
                  </p>
                  <PodLayer
                    podId="router-pod"
                    label="Pod: router"
                    activeComponentIds={activeComponentIds}
                    activeComponentId={activeComponentId}
                    onSelectComponent={onSelectComponent}
                    isExpanded={expandedPods.has('router-pod')}
                    onToggleExpand={onTogglePod}
                  />
                </div>

                {/* Host Networking Subsystem — emerald */}
                <div className="lg:col-span-2 rounded border border-[#10b981]/30 bg-[#10b981]/5 p-3">
                  <p className="text-[0.6rem] font-display font-semibold text-[#10b981] mb-2 uppercase tracking-[0.15em]">
                    Host Networking Subsystem
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <ComponentBox
                      id="ovs-bridge-br-int"
                      label="OVS Bridge (br-int)"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      colorClass="border-[#10b981]/50 bg-[#10b981]/5"
                      accentColor="#10b981"
                    />
                    <ComponentBox
                      id="host-veth-pair"
                      label="veth Pair"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      colorClass="border-[#10b981]/50 bg-[#10b981]/5"
                      accentColor="#10b981"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* External Client */}
          <div className="mt-4 pt-4 border-t border-white/8">
            <p className="text-[0.6rem] text-white/35 uppercase tracking-[0.15em] mb-2">External</p>
            <ComponentBox
              id="external-client"
              label="External Client"
              activeComponentIds={activeComponentIds}
              activeComponentId={activeComponentId}
              onSelect={onSelectComponent}
              colorClass="border-[#00e5ff]/30 bg-[#00e5ff]/5"
              accentColor="#00e5ff"
              className="max-w-[12rem]"
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
