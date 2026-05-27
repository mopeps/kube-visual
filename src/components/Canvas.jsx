import ComponentBox from './ComponentBox'
import PodLayer from './PodLayer'
import ArrowOverlay from './ArrowOverlay'
import Breadcrumb from './Breadcrumb'
import InspectorPanel from './InspectorPanel'

// Catppuccin Mocha accents reused across layers
const C = {
  sky:      '#89dceb',
  sapphire: '#74c7ec',
  mauve:    '#cba6f7',
  green:    '#a6e3a1',
  teal:     '#94e2d5',
  peach:    '#fab387',
  yellow:   '#f9e2af',
  pink:     '#f5c2e7',
}

function LayerBoundary({ label, sub, color, dashed = false, children, className = '' }) {
  return (
    <div
      className={`relative p-3 ${className}`}
      style={{
        border: `1px ${dashed ? 'dashed' : 'solid'} ${color}66`,
        background: `linear-gradient(180deg, ${color}0c 0%, transparent 100%)`,
      }}
    >
      {/* Corner ticks — terminal-style chrome */}
      <span className="absolute -top-px -left-px w-2 h-2 border-t border-l" style={{ borderColor: color }} aria-hidden />
      <span className="absolute -top-px -right-px w-2 h-2 border-t border-r" style={{ borderColor: color }} aria-hidden />
      <span className="absolute -bottom-px -left-px w-2 h-2 border-b border-l" style={{ borderColor: color }} aria-hidden />
      <span className="absolute -bottom-px -right-px w-2 h-2 border-b border-r" style={{ borderColor: color }} aria-hidden />

      <div className="flex items-baseline gap-2 mb-3 -mt-1">
        <span className="font-mono text-[10.5px] text-k-tx-mut">┤</span>
        <span
          className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]"
          style={{ color, textShadow: `0 0 12px ${color}55` }}
        >
          {label}
        </span>
        {sub && (
          <span className="font-mono text-[10px] text-k-tx-mut">
            :: {sub}
          </span>
        )}
        <span className="font-mono text-[10.5px] text-k-tx-mut">├</span>
        <span className="hr-dashed" />
      </div>
      {children}
    </div>
  )
}

function Toolbar({ activeEvent, onClearEvent, onOpenSidebar }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 flex-shrink-0 border-b border-k-bd font-mono text-[11px]"
      style={{ background: 'var(--c-s1)' }}
    >
      <button
        onClick={onOpenSidebar}
        className="lg:hidden flex-shrink-0 w-7 h-7 flex items-center justify-center text-k-tx-mut hover:text-k-tx-wh hover:bg-k-s2 transition-colors"
        aria-label="Open sidebar"
      >
        <span className="text-[14px] leading-none">≡</span>
      </button>

      {/* Vim-like mode badge */}
      <div className="flex items-center gap-0">
        <span className="px-2 py-0.5 bg-k-mauve text-k-crust font-bold tracking-widest text-[10px]">
          NORMAL
        </span>
        <span
          className="w-0 h-0 border-y-[10px] border-l-[7px] border-y-transparent"
          style={{ borderLeftColor: 'var(--c-mauve)' }}
        />
      </div>

      <span className="text-k-tx-dim hidden sm:inline">
        <span className="text-k-blue">$</span> openshift
        <span className="text-k-tx-dim"> ── </span>
        <span className="text-k-tx-mut">topology.tsx</span>
      </span>

      <div className="flex-1" />

      {activeEvent ? (
        <div className="flex items-center gap-0 animate-fade-in">
          <span
            className="w-0 h-0 border-y-[10px] border-r-[7px] border-y-transparent"
            style={{ borderRightColor: 'var(--c-peach)' }}
          />
          <div className="flex items-center gap-2 px-2 py-0.5 bg-k-peach text-k-crust">
            <span className="font-bold tracking-widest text-[10px]">TRACE</span>
            <span className="text-[10.5px] truncate max-w-[180px]">
              {activeEvent.eventName}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClearEvent() }}
            className="ml-2 px-2 py-0.5 text-[10.5px] text-k-tx-mut hover:text-k-tx-wh hover:bg-k-s2 transition-colors"
            title="Clear trace"
          >
            :q
          </button>
        </div>
      ) : (
        <span className="text-k-tx-dim text-[10.5px] hidden md:flex items-center gap-1">
          <span className="text-k-peach">:</span>
          <span>select event</span>
          <span className="caret text-k-peach" aria-hidden="true" />
        </span>
      )}
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="absolute top-4 right-4 z-10 hidden md:flex items-center gap-2 px-2.5 py-1 animate-fade-in"
      style={{ background: 'var(--c-s2)', border: '1px solid var(--c-sapphire)' }}
    >
      <span className="font-mono text-[10px] text-k-sapphire font-bold">?</span>
      <span className="font-mono text-[10.5px] text-k-tx-br">
        pick an event from the buffer list to trace flow
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
    <div className="flex-1 flex flex-col overflow-hidden relative bg-k-base">
      <Toolbar activeEvent={activeEvent} onClearEvent={onClearEvent} onOpenSidebar={onOpenSidebar} />
      <Breadcrumb expandedPods={expandedPods} />

      <div
        id="canvas-root"
        className="flex-1 overflow-auto touch-auto p-4 sm:p-6 relative"
        onClick={() => { onClearComponent() }}
      >
        {!activeEvent && <EmptyHint />}

        {/* Cluster boundary — outer "window" */}
        <div
          className="p-4 min-w-[980px] relative"
          style={{
            border: '1px solid var(--c-bd-hi)',
            background: 'var(--c-s1)',
            boxShadow: '0 0 0 1px var(--c-crust) inset',
          }}
        >
          {/* Header strip */}
          <div className="flex items-center gap-2 mb-4 -mt-1">
            <span className="font-mono text-[11px] text-k-tx-mut">┌──</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-k-tx-wh">
              cluster
            </span>
            <span className="font-mono text-[11px] text-k-tx-mut">──</span>
            <span className="font-mono text-[10px] text-k-tx-mut">openshift · kubernetes</span>
            <span className="hr-dashed" />
            <span className="font-mono text-[10px] text-k-green">● up</span>
            <span className="font-mono text-[11px] text-k-tx-mut">──┐</span>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            {/* Management Layer */}
            <LayerBoundary label="management" sub="control plane" color={C.sapphire}>
              <div className="flex flex-wrap gap-1.5">
                <ComponentBox id="api-server"              label="api-server"          activeComponentIds={activeComponentIds} activeComponentId={activeComponentId} onSelect={onSelectComponent} accentColor={C.sapphire} />
                <ComponentBox id="scheduler"               label="scheduler"           activeComponentIds={activeComponentIds} activeComponentId={activeComponentId} onSelect={onSelectComponent} accentColor={C.sapphire} />
                <ComponentBox id="kubelet"                 label="kubelet"             activeComponentIds={activeComponentIds} activeComponentId={activeComponentId} onSelect={onSelectComponent} accentColor={C.sapphire} />
                <ComponentBox id="crio"                    label="cri-o"               activeComponentIds={activeComponentIds} activeComponentId={activeComponentId} onSelect={onSelectComponent} accentColor={C.sapphire} />
                <ComponentBox id="ingress-router-haproxy"  label="ingress.haproxy"     activeComponentIds={activeComponentIds} activeComponentId={activeComponentId} onSelect={onSelectComponent} accentColor={C.mauve} />
              </div>
            </LayerBoundary>

            {/* Infrastructure Node */}
            <div
              className="xl:col-span-2 relative p-3"
              style={{
                border: `1px solid ${C.peach}88`,
                background: `linear-gradient(180deg, ${C.peach}0e 0%, transparent 100%)`,
              }}
            >
              <span className="absolute -top-px -left-px w-2 h-2 border-t border-l" style={{ borderColor: C.peach }} aria-hidden />
              <span className="absolute -top-px -right-px w-2 h-2 border-t border-r" style={{ borderColor: C.peach }} aria-hidden />
              <span className="absolute -bottom-px -left-px w-2 h-2 border-b border-l" style={{ borderColor: C.peach }} aria-hidden />
              <span className="absolute -bottom-px -right-px w-2 h-2 border-b border-r" style={{ borderColor: C.peach }} aria-hidden />

              <div className="flex items-baseline gap-2 mb-3 -mt-1">
                <span className="font-mono text-[10.5px] text-k-tx-mut">┤</span>
                <span
                  className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: C.peach, textShadow: `0 0 12px ${C.peach}55` }}
                >
                  node
                </span>
                <span className="font-mono text-[10px] text-k-tx-mut">:: node-01 / worker</span>
                <span className="font-mono text-[10.5px] text-k-tx-mut">├</span>
                <span className="hr-dashed" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <LayerBoundary label="ns: app" sub="namespace" color={C.mauve} dashed>
                  <PodLayer
                    podId="app-pod"
                    label="pod/web-app"
                    activeComponentIds={activeComponentIds}
                    activeComponentId={activeComponentId}
                    onSelectComponent={onSelectComponent}
                    isExpanded={expandedPods.has('app-pod')}
                    onToggleExpand={onTogglePod}
                  />
                </LayerBoundary>

                <LayerBoundary label="ns: router" sub="namespace" color={C.mauve} dashed>
                  <PodLayer
                    podId="router-pod"
                    label="pod/router"
                    activeComponentIds={activeComponentIds}
                    activeComponentId={activeComponentId}
                    onSelectComponent={onSelectComponent}
                    isExpanded={expandedPods.has('router-pod')}
                    onToggleExpand={onTogglePod}
                  />
                </LayerBoundary>

                <LayerBoundary
                  label="host.net"
                  sub="kernel subsystem"
                  color={C.green}
                  className="lg:col-span-2"
                >
                  <div className="flex flex-wrap gap-2">
                    <ComponentBox
                      id="ovs-bridge-br-int"
                      label="ovs/br-int"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      accentColor={C.green}
                    />
                    <ComponentBox
                      id="host-veth-pair"
                      label="veth.pair"
                      activeComponentIds={activeComponentIds}
                      activeComponentId={activeComponentId}
                      onSelect={onSelectComponent}
                      accentColor={C.green}
                    />
                  </div>
                </LayerBoundary>
              </div>
            </div>
          </div>

          {/* External client */}
          <div className="mt-4 pt-3 flex items-center gap-3 border-t border-dashed border-k-bd">
            <span className="font-mono text-[10.5px] text-k-tx-mut">─┤</span>
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-k-sky">
              external
            </span>
            <span className="font-mono text-[10.5px] text-k-tx-mut">├─</span>
            <ComponentBox
              id="external-client"
              label="client"
              activeComponentIds={activeComponentIds}
              activeComponentId={activeComponentId}
              onSelect={onSelectComponent}
              accentColor={C.sky}
            />
          </div>

          {/* Footer rule */}
          <div className="flex items-center gap-2 mt-3 -mb-1">
            <span className="font-mono text-[11px] text-k-tx-mut">└──</span>
            <span className="hr-dashed" />
            <span className="font-mono text-[11px] text-k-tx-mut">──┘</span>
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
