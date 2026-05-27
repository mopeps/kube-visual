import events from '../data/events.json'

export default function Sidebar({ activeEvent, onSelectEvent, isOpen, onClose }) {
  return (
    <aside
      className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        w-72 min-w-[18rem]
        bg-gray-900 border-r border-gray-700
        flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Cluster Events</h2>
        <button
          onClick={onClose}
          className="lg:hidden text-gray-400 hover:text-gray-200 text-xl leading-none p-1"
          aria-label="Close sidebar"
        >
          ×
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {events.map(event => {
          const isActive = activeEvent?.eventId === event.eventId
          return (
            <li key={event.eventId}>
              <button
                onClick={() => { onSelectEvent(event); onClose(); }}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-blue-900 text-blue-100'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <p className="font-medium text-sm">{event.eventName}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{event.description}</p>
              </button>
            </li>
          )
        })}
      </ul>

      {activeEvent && (
        <div className="border-t border-gray-700 px-4 py-3 overflow-y-auto max-h-72 bg-gray-950">
          <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">
            Steps
          </h3>
          <ol className="space-y-2">
            {activeEvent.steps.map(step => (
              <li key={step.step} className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-700 text-white text-xs flex items-center justify-center font-bold">
                  {step.step}
                </span>
                <p className="text-xs text-gray-300 leading-relaxed">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  )
}
