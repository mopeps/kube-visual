import events from '../data/events.json'

function SidebarHeader({ onClose }) {
  return (
    <div
      className="px-4 pt-4 pb-3 flex items-start justify-between border-b"
      style={{ borderColor: '#192540' }}
    >
      <div>
        <p className="font-mono text-[0.5rem] tracking-[0.22em] uppercase mb-1" style={{ color: '#2e4a70' }}>
          CLUSTER-01 · LIVE
        </p>
        <h2 className="font-display text-2xl tracking-widest leading-none" style={{ color: '#9abcd8' }}>
          EVENT LOG
        </h2>
      </div>
      <button
        onClick={onClose}
        className="lg:hidden mt-0.5 w-6 h-6 flex items-center justify-center border font-mono text-xs transition-colors"
        style={{ borderColor: '#1f3054', color: '#456688' }}
        aria-label="Close sidebar"
      >
        ✕
      </button>
    </div>
  )
}

function EventItem({ event, isActive, onClick }) {
  const colors = {
    'event-external-ingress': { color: '#22d3ee',  dimColor: 'rgba(34,211,238,0.08)',  borderColor: '#22d3ee' },
    'event-pod-spawning':     { color: '#a78bfa',  dimColor: 'rgba(167,139,250,0.08)', borderColor: '#a78bfa' },
    'event-ovn-pod-to-pod':   { color: '#34d399',  dimColor: 'rgba(52,211,153,0.08)',  borderColor: '#34d399' },
  }
  const c = colors[event.eventId] ?? { color: '#9abcd8', dimColor: 'rgba(154,188,216,0.08)', borderColor: '#9abcd8' }

  return (
    <li>
      <button
        onClick={onClick}
        className="w-full text-left px-4 py-3 transition-all duration-150 border-l-2"
        style={{
          borderLeftColor: isActive ? c.color : 'transparent',
          background: isActive ? c.dimColor : 'transparent',
        }}
      >
        {/* Event ID tag */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className="font-mono text-[0.5rem] tracking-[0.15em] px-1 border"
            style={{
              color: isActive ? c.color : '#2e4a70',
              borderColor: isActive ? `${c.color}50` : '#192540',
              background: isActive ? `${c.color}0f` : 'transparent',
            }}
          >
            {event.eventId.replace('event-', '').toUpperCase().replace(/-/g, '_')}
          </span>
        </div>

        <p
          className="font-mono font-medium text-[0.72rem] leading-snug"
          style={{ color: isActive ? c.color : '#6c92b4' }}
        >
          {event.eventName}
        </p>
        <p className="text-[0.62rem] font-mono mt-0.5 leading-relaxed line-clamp-2" style={{ color: '#2e4a70' }}>
          {event.description}
        </p>
      </button>
    </li>
  )
}

export default function Sidebar({ activeEvent, onSelectEvent, isOpen, onClose }) {
  return (
    <aside
      className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        w-64 min-w-[16rem] flex-shrink-0
        flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 animate-slide-in-left' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{ background: '#070b14', borderRight: '1px solid #192540' }}
    >
      <SidebarHeader onClose={onClose} />

      {/* Event list */}
      <ul className="flex-1 overflow-y-auto divide-y" style={{ borderColor: '#192540' }}>
        {events.map(event => (
          <EventItem
            key={event.eventId}
            event={event}
            isActive={activeEvent?.eventId === event.eventId}
            onClick={() => { onSelectEvent(event); onClose(); }}
          />
        ))}
      </ul>

      {/* Active event steps */}
      {activeEvent && (
        <div
          className="border-t overflow-y-auto"
          style={{ borderColor: '#192540', maxHeight: '280px', background: 'rgba(11,18,32,0.9)' }}
        >
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="font-display text-sm tracking-widest" style={{ color: '#fb923c' }}>FLOW</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(251,146,60,0.2)' }} />
              <span className="font-mono text-[0.5rem]" style={{ color: '#2e4a70' }}>
                {activeEvent.steps.length} STEPS
              </span>
            </div>
            <ol className="space-y-2">
              {activeEvent.steps.map(step => (
                <li key={step.step} className="flex gap-2.5">
                  <span
                    className="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center border text-[0.55rem] font-mono font-semibold"
                    style={{ borderColor: '#fb923c', color: '#fb923c', background: 'rgba(251,146,60,0.1)' }}
                  >
                    {step.step}
                  </span>
                  <p className="text-[0.62rem] font-mono leading-relaxed" style={{ color: '#456688' }}>
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div
        className="px-4 py-2 flex items-center justify-between border-t"
        style={{ borderColor: '#192540' }}
      >
        <span className="font-mono text-[0.5rem] tracking-widest uppercase" style={{ color: '#1f3054' }}>
          {events.length} EVENTS · 11 COMPONENTS
        </span>
        <span
          className="w-1.5 h-1.5 flex-shrink-0"
          style={{ background: '#34d399', animation: 'pulse-amber 2s ease-in-out infinite' }}
        />
      </div>
    </aside>
  )
}
