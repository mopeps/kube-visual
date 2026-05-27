import events from '../data/events.json'

// Each event gets a Catppuccin accent — color is data, not just decor.
const EVENT_THEMES = {
  'route-ingress-traffic': { hue: '#89dceb', label: 'ingress',   tag: 'NET' },
  'pod-spawning':          { hue: '#cba6f7', label: 'lifecycle', tag: 'LIFE' },
  'pod-to-pod-ovn':        { hue: '#a6e3a1', label: 'overlay',   tag: 'OVN' },
}

function AsciiMark() {
  // Tight ASCII logotype — three rows of block glyphs.
  return (
    <pre
      className="font-mono text-[8.5px] leading-[1.05] text-k-mauve select-none"
      style={{ textShadow: '0 0 12px rgba(203, 166, 247, 0.45)' }}
      aria-hidden="true"
    >
{`██╗  ██╗██╗   ██╗
██║ ██╔╝██║   ██║
█████╔╝ ██║   ██║
██╔═██╗ ╚██╗ ██╔╝
██║  ██╗ ╚████╔╝`}
    </pre>
  )
}

function SidebarHeader({ onClose }) {
  return (
    <div className="px-4 pt-4 pb-3 flex items-start gap-3 border-b border-k-bd relative">
      <AsciiMark />
      <div className="flex flex-col leading-tight pt-0.5 min-w-0 flex-1">
        <span className="font-display text-[13px] text-k-tx-wh tracking-[0.15em]">
          kube.vis
        </span>
        <span className="font-mono text-[10px] text-k-tx-mut mt-1">
          v1.0 · openshift
        </span>
        <span className="font-mono text-[10px] text-k-green mt-0.5">
          <span className="animate-blink">●</span> session attached
        </span>
      </div>
      <button
        onClick={onClose}
        className="lg:hidden absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-k-tx-mut hover:text-k-tx-wh hover:bg-k-s2 transition-colors"
        aria-label="Close sidebar"
      >
        <span className="font-mono text-[14px] leading-none">×</span>
      </button>
    </div>
  )
}

function BufferRow({ index, event, isActive, onClick }) {
  const theme = EVENT_THEMES[event.eventId] ?? { hue: '#bac2de', label: 'event', tag: 'EV' }

  return (
    <button
      onClick={onClick}
      className={`group relative block w-full text-left font-mono text-[11.5px] leading-snug px-3 py-2 transition-colors duration-100 border-l-2 ${
        isActive
          ? 'bg-k-s2/60 border-l-[2px]'
          : 'border-l-transparent hover:bg-k-s1/80 hover:border-l-k-bd-hi'
      }`}
      style={isActive ? { borderLeftColor: theme.hue } : undefined}
    >
      <div className="flex items-baseline gap-2">
        <span
          className="text-[11px] w-3 inline-block text-right"
          style={{ color: isActive ? theme.hue : 'var(--c-tx-dim)' }}
        >
          {isActive ? '>' : ' '}
        </span>
        <span className="text-k-tx-dim w-5 text-right tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span
          className="px-1.5 py-px text-[9.5px] font-semibold tracking-widest"
          style={{
            color: theme.hue,
            background: `${theme.hue}1a`,
            border: `1px solid ${theme.hue}55`,
          }}
        >
          {theme.tag}
        </span>
        <span
          className={`flex-1 truncate ${isActive ? 'text-k-tx-wh' : 'text-k-tx-br group-hover:text-k-tx-wh'}`}
        >
          {event.eventName}
        </span>
        {isActive && (
          <span className="text-k-peach text-[10px]">+</span>
        )}
      </div>
      <p className="text-[10.5px] text-k-tx-mut pl-[58px] pr-1 mt-1 truncate">
        {event.description}
      </p>
    </button>
  )
}

function FlowSteps({ event }) {
  const theme = EVENT_THEMES[event.eventId] ?? { hue: '#fab387' }
  return (
    <div className="border-t border-k-bd overflow-y-auto" style={{ maxHeight: '38vh' }}>
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 sticky top-0 bg-k-s1 z-10 border-b border-k-bd-dim">
        <span className="font-mono text-[10px] text-k-tx-mut">┌─</span>
        <span
          className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: theme.hue }}
        >
          trace
        </span>
        <span className="hr-dashed" />
        <span className="font-mono text-[10px] text-k-tx-dim">
          {String(event.steps.length).padStart(2, '0')} steps
        </span>
        <span className="font-mono text-[10px] text-k-tx-mut">─┐</span>
      </div>

      <ol className="px-4 pt-3 pb-4 font-mono text-[11px] leading-snug">
        {event.steps.map((step, i) => {
          const isLast = i === event.steps.length - 1
          return (
            <li key={step.step} className="flex gap-2.5">
              <div className="flex flex-col items-center flex-shrink-0">
                <span
                  className="w-[18px] h-[18px] flex items-center justify-center text-[9.5px] font-semibold border tabular-nums"
                  style={{
                    color: theme.hue,
                    borderColor: `${theme.hue}80`,
                    background: `${theme.hue}10`,
                  }}
                >
                  {String(step.step).padStart(2, '0')}
                </span>
                {!isLast && (
                  <span
                    className="w-px flex-1 my-1"
                    style={{ background: `${theme.hue}40` }}
                  />
                )}
              </div>
              <p className="text-k-tx pb-3 pt-0.5">
                {step.description}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function Sidebar({ activeEvent, onSelectEvent, isOpen, onClose }) {
  return (
    <aside
      className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        w-[18.5rem] min-w-[18.5rem] flex-shrink-0
        flex flex-col overflow-hidden
        transition-transform duration-200 ease-out
        ${isOpen ? 'translate-x-0 animate-slide-in-left' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{
        background: 'var(--c-s1)',
        borderRight: '1px solid var(--c-bd)',
      }}
    >
      <SidebarHeader onClose={onClose} />

      {/* Buffer list header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-k-bd-dim">
        <span className="font-mono text-[10px] text-k-tx-mut">:</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-k-tx-br">
          ls events
        </span>
        <span className="hr-dashed" />
        <span className="font-mono text-[10px] text-k-tx-dim tabular-nums">
          {String(events.length).padStart(2, '0')}
        </span>
      </div>

      {/* Event buffer list */}
      <div className="flex-1 overflow-y-auto py-1">
        {events.map((event, i) => (
          <BufferRow
            key={event.eventId}
            index={i}
            event={event}
            isActive={activeEvent?.eventId === event.eventId}
            onClick={() => { onSelectEvent(event); onClose(); }}
          />
        ))}
        {!activeEvent && (
          <div className="px-4 py-6 font-mono text-[10.5px] text-k-tx-dim leading-relaxed">
            <span className="text-k-mauve">~</span>
            <br />
            <span className="text-k-tx-mut">press</span>{' '}
            <span className="text-k-peach">[1-{events.length}]</span>{' '}
            <span className="text-k-tx-mut">or click</span>
            <br />
            <span className="text-k-tx-mut">a buffer to begin trace.</span>
            <span className="caret text-k-peach" aria-hidden="true" />
          </div>
        )}
      </div>

      {activeEvent && <FlowSteps event={activeEvent} />}

      {/* Status / footer */}
      <div className="px-4 py-2 border-t border-k-bd flex items-center gap-2 bg-k-crust">
        <span className="font-mono text-[10px] text-k-green">
          <span className="animate-blink">█</span>
        </span>
        <span className="font-mono text-[10px] text-k-tx-mut">cluster-01</span>
        <span className="text-k-tx-dim">│</span>
        <span className="font-mono text-[10px] text-k-tx-mut flex-1">11 nodes</span>
        <span className="font-mono text-[10px] text-k-tx-dim">utf-8</span>
      </div>
    </aside>
  )
}
