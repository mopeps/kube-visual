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
      {/* Top bar: hamburger (mobile/tablet only) + breadcrumb */}
      <div className="flex items-center">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden flex-shrink-0 p-2 mx-1 text-gray-400 hover:text-gray-200 rounded hover:bg-gray-800 transition-colors"
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
        className="flex-1 overflow-auto touch-auto p-6 bg-gray-950 relative"
        onClick={() => { onClearComponent(); }}
      >
        {/* Cluster Boundary — fixed min-width prevents squash; overflow-auto parent enables pan */}
        <div className="rounded-lg border-2 border-gray-600 bg-gray-900 p-4 min-w-[1024px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cluster Boundary</span>
            {activeEvent && (
              <button
                onClick={(e) => { e.stopPropagation(); onClearEvent(); }}
                className="text-xs text-gray-500 hover:text-gray-200 px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                Clear Event
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Management Layer */}
            <div className="rounded border border-purple-700 bg-gray-850 p-3 bg-gray-900">
              <p className="text-xs font-semibold text-purple-300 mb-2 tracking-wide">Management Layer</p>
              <div className="space-y-2">
                <ComponentBox
                  id="api-server"
                  label="API Server"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-purple-600 bg-purple-950"
                />
                <ComponentBox
                  id="scheduler"
                  label="Scheduler"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-purple-600 bg-purple-950"
                />
                <ComponentBox
                  id="kubelet"
                  label="Kubelet"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-purple-600 bg-purple-950"
                />
                <ComponentBox
                  id="crio"
                  label="CRI-O"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-purple-600 bg-purple-950"
                />
                <ComponentBox
                  id="ingress-router-haproxy"
                  label="Ingress Router (HAProxy)"
                  activeComponentIds={activeComponentIds}
                  activeComponentId={activeComponentId}
                  onSelect={onSelectComponent}
                  colorClass="border-red-700 bg-red-950"
                />
              </div>
            </div>

            {/* Infrastructure Node Boundary */}
            <div className="xl:col-span-2 rounded border-2 border-green-700 bg-gray-900 p-3">
              <p className="text-xs font-semibold text-green-300 mb-2 tracking-wide">Infrastructure Node Boundary</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Namespace / Projects */}
                <div className="rounded border border-dashed border-blue-600 bg-gray-950 p-3">
                  <p className="text-xs font-semibold text-blue-300 mb-2 tracking-wide">Namespace: app</p>
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

                <div className="rounded border border-dashed border-blue-600 bg-gray-950 p-3">
                  <p className="text-xs font-semibold text-blue-300 mb-2 tracking-wide">Namespace: router</p>
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

                {/* Host Networking Subsystem */}
                <div className="lg:col-span-2 rounded border border-green-800 bg-green-950/20 p-3">
                  <p className="text-xs font-semibold text-green-300 mb-2 tracking-wide">Host Networking Subsystem</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ComponentBox
                      id="ovs-bridge-br-int"
                      label="OVS Bridge (br-int)"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      colorClass="border-green-700 bg-green-950"
                    />
                    <ComponentBox
                      id="host-veth-pair"
                      label="veth Pair"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      colorClass="border-green-700 bg-green-950"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* External Client (outside cluster, at bottom) */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">External</p>
            <ComponentBox
              id="external-client"
              label="External Client"
              activeComponentIds={activeComponentIds}
              activeComponentId={activeComponentId}
              onSelect={onSelectComponent}
              colorClass="border-gray-500 bg-gray-800"
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
