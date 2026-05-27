import events from '../data/events.json'

const EVENT_THEMES = {
  'route-ingress-traffic': { hue: '#22d3ee', label: 'Ingress' },
  'pod-spawning':          { hue: '#a78bfa', label: 'Lifecycle' },
  'pod-to-pod-ovn':        { hue: '#34d399', label: 'Network' },
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative w-8 h-8 rounded-md flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)',
          boxShadow: '0 0 18px rgba(34, 211, 238, 0.25)',
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-k-base" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display font-semibold text-[15px] tracking-tight text-k-tx-wh">
          kube-visual
        </span>
        <span className="font-mono text-[10px] mt-1 text-k-tx-mut">
          v1.0 · cluster-01
        </span>
      </div>
    </div>
  )
}

function SidebarHeader({ onClose }) {
  return (
    <div className="px-5 pt-5 pb-4 flex items-start justify-between border-b border-k-bd">
      <Logo />
      <button
        onClick={onClose}
        className="lg:hidden mt-1 w-7 h-7 flex items-center justify-center rounded-md text-k-tx-mut hover:text-k-tx-wh hover:bg-white/5 transition-colors"
        aria-label="Close sidebar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function EventCard({ event, isActive, onClick }) {
  const theme = EVENT_THEMES[event.eventId] ?? { hue: '#94a3b8', label: 'Event' }

  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left rounded-lg px-3.5 py-3 transition-all duration-200 border ${
        isActive
          ? 'bg-white/[0.04]'
          : 'border-transparent hover:bg-white/[0.025] hover:border-k-bd'
      }`}
      style={isActive ? {
        borderColor: `${theme.hue}40`,
        boxShadow: `0 0 0 1px ${theme.hue}20, 0 4px 20px -8px ${theme.hue}25`,
      } : undefined}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium"
          style={{
            color: theme.hue,
            background: `${theme.hue}14`,
          }}
        >
          <span
            className="w-1 h-1 rounded-full"
            style={{ background: theme.hue, boxShadow: `0 0 6px ${theme.hue}` }}
          />
          {theme.label}
        </span>
        {isActive && (
          <span className="font-mono text-[10px] text-k-tx-mut">active</span>
        )}
      </div>

      <p className={`font-display text-[13px] font-medium leading-tight mb-1 transition-colors ${
        isActive ? 'text-k-tx-wh' : 'text-k-tx-br group-hover:text-k-tx-wh'
      }`}>
        {event.eventName}
      </p>
      <p className="text-[11px] leading-relaxed text-k-tx-mut line-clamp-2">
        {event.description}
      </p>
    </button>
  )
}

function FlowSteps({ event }) {
  const theme = EVENT_THEMES[event.eventId] ?? { hue: '#fbbf24' }

  return (
    <div className="border-t border-k-bd overflow-y-auto" style={{ maxHeight: '320px' }}>
      <div className="px-5 pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: theme.hue, boxShadow: `0 0 8px ${theme.hue}` }}
            />
            <span className="font-display text-[11px] font-semibold tracking-wider uppercase text-k-tx-br">
              Flow Trace
            </span>
          </div>
          <span className="font-mono text-[10px] text-k-tx-mut">
            {event.steps.length} steps
          </span>
        </div>

        <ol className="space-y-2.5 relative">
          <div
            className="absolute left-[11px] top-1 bottom-1 w-px"
            style={{ background: `linear-gradient(180deg, ${theme.hue}40, transparent)` }}
          />
          {event.steps.map(step => (
            <li key={step.step} className="flex gap-3 relative">
              <span
                className="relative z-10 flex-shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-full text-[10px] font-mono font-semibold"
                style={{
                  background: `${theme.hue}18`,
                  border: `1px solid ${theme.hue}60`,
                  color: theme.hue,
                }}
              >
                {step.step}
              </span>
              <p className="text-[11.5px] leading-relaxed text-k-tx pt-0.5">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default function Sidebar({ activeEvent, onSelectEvent, isOpen, onClose }) {
  return (
    <aside
      className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        w-72 min-w-[18rem] flex-shrink-0
        flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 animate-slide-in-left' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{
        background: 'linear-gradient(180deg, rgba(17, 27, 48, 0.6) 0%, rgba(7, 11, 20, 0.95) 100%)',
        borderRight: '1px solid var(--c-bd)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <SidebarHeader onClose={onClose} />

      {/* Section title */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <span className="font-display text-[11px] font-semibold tracking-wider uppercase text-k-tx-br">
          Cluster Events
        </span>
        <span className="font-mono text-[10px] text-k-tx-mut">{events.length}</span>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {events.map(event => (
          <EventCard
            key={event.eventId}
            event={event}
            isActive={activeEvent?.eventId === event.eventId}
            onClick={() => { onSelectEvent(event); onClose(); }}
          />
        ))}
      </div>

      {activeEvent && <FlowSteps event={activeEvent} />}

      {/* Footer / status */}
      <div className="px-5 py-3 border-t border-k-bd flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full bg-k-green"
            style={{ boxShadow: '0 0 8px #34d399', animation: 'pulse-amber 2.4s ease-in-out infinite' }}
          />
          <span className="font-mono text-[10px] text-k-tx-mut">connected</span>
        </div>
        <span className="font-mono text-[10px] text-k-tx-dim">
          11 components
        </span>
      </div>
    </aside>
  )
}
