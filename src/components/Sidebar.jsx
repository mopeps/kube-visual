import events from '../data/events.json'

export default function Sidebar({ activeEvent, onSelectEvent, isOpen, onClose }) {
  return (
    <aside
      className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        w-72 min-w-[18rem]
        bg-k-bg2 border-r border-white/10
        flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-[0.6rem] font-display font-semibold tracking-[0.18em] text-white/55 uppercase">
          Cluster Events
        </h2>
        <button
          onClick={onClose}
          className="lg:hidden w-7 h-7 flex items-center justify-center rounded border border-white/20 text-white/55 hover:text-white text-lg leading-none"
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-white/5">
        {events.map(event => {
          const isActive = activeEvent?.eventId === event.eventId
          return (
            <li key={event.eventId}>
              <button
                onClick={() => { onSelectEvent(event); onClose(); }}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-k-cyan/10 border-l-2 border-k-cyan'
                    : 'border-l-2 border-transparent hover:bg-white/5'
                }`}
              >
                <p className={`font-display font-semibold text-sm ${isActive ? 'text-k-cyan' : 'text-white/80'}`}>
                  {event.eventName}
                </p>
                <p className="text-[0.68rem] text-white/45 mt-0.5 line-clamp-2 leading-relaxed">
                  {event.description}
                </p>
              </button>
            </li>
          )
        })}
      </ul>

      {activeEvent && (
        <div className="border-t border-white/10 px-4 py-3 overflow-y-auto max-h-72 bg-black/30">
          <h3 className="text-[0.6rem] font-display font-semibold tracking-[0.18em] text-white/45 uppercase mb-3">
            Steps
          </h3>
          <ol className="space-y-2.5">
            {activeEvent.steps.map(step => (
              <li key={step.step} className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-k-red/15 border border-k-red text-k-red text-[0.6rem] flex items-center justify-center font-bold font-display">
                  {step.step}
                </span>
                <p className="text-[0.68rem] text-white/65 leading-relaxed">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  )
}
