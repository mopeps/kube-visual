// Monochrome line glyphs for the Packet Flow tab's hop keywords (see
// hop-kinds.js). Each is a single-stroke SVG drawn with `currentColor` so it
// inherits the hop accent, sized at 1em so it tracks the keyword chip's
// font-size. Same drawing conventions (16-unit viewBox, ~1.6 stroke) as the
// detail-modal interaction icons (KindIcon) and the pipeline band icons, so a
// hop reads in the same visual language as the rest of the app.
export default function HopIcon({ name }) {
  const common = {
    width: '1em',
    height: '1em',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  switch (name) {
    case 'dns': // a globe — name resolution / lookup
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
        </svg>
      )
    case 'route': // a path branching to a node — routing / steering a packet
      return (
        <svg {...common}>
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="13" cy="3.6" r="1.4" />
          <circle cx="13" cy="12.4" r="1.4" />
          <path d="M4.4 8h3.2M11.6 4.4 8 6.2 11.6 11.6" />
        </svg>
      )
    case 'forward': // arrow leaving a wall — pushed onward
      return (
        <svg {...common}>
          <path d="M3 2.5v11" />
          <path d="M6.5 8H14" />
          <path d="M11 5l3 3-3 3" />
        </svg>
      )
    case 'tunnel': // an arch with an arrow passing through — a tunnel
      return (
        <svg {...common}>
          <path d="M2 13V8a6 6 0 0 1 12 0v5" />
          <path d="M4.5 13h7" />
          <path d="M8 6v6" />
          <path d="M6 10l2 2 2-2" />
        </svg>
      )
    case 'lock': // padlock — TLS / authentication
      return (
        <svg {...common}>
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
          <circle cx="8" cy="10" r="0.3" />
        </svg>
      )
    case 'deliver': // arrow entering a wall — delivered to its destination
      return (
        <svg {...common}>
          <path d="M2 8h7.5" />
          <path d="M6.5 5 9.5 8l-3 3" />
          <path d="M13 2.5v11" />
        </svg>
      )
    case 'download': // arrow into a tray — fetching / pulling over the wire
      return (
        <svg {...common}>
          <path d="M8 2v7" />
          <path d="M5 6.5 8 9.5l3-3" />
          <path d="M3 11.5v1.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5" />
        </svg>
      )
    case 'eye': // a watch / observe relationship
      return (
        <svg {...common}>
          <path d="M1.5 8S3.8 3.5 8 3.5 14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8Z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      )
    case 'loop': // circular arrows — a reconcile loop
      return (
        <svg {...common}>
          <path d="M13 7a5 5 0 0 0-9-2" />
          <path d="M3 9a5 5 0 0 0 9 2" />
          <path d="M4 2.5V5h2.5" />
          <path d="M12 13.5V11H9.5" />
        </svg>
      )
    case 'document': // a manifest page — declared desired state
      return (
        <svg {...common}>
          <path d="M4 2.2h5l3 3v8.6H4z" />
          <path d="M9 2.2v3h3" />
          <path d="M6 8.5h4M6 10.8h4" />
        </svg>
      )
    case 'disk': // a database cylinder — persisted to etcd
      return (
        <svg {...common}>
          <ellipse cx="8" cy="3.8" rx="5" ry="1.8" />
          <path d="M3 3.8v8.4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V3.8" />
          <path d="M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" />
        </svg>
      )
    case 'cube': // a packaged object — scheduled / placed
      return (
        <svg {...common}>
          <path d="M8 2 14 5v6l-6 3-6-3V5z" />
          <path d="m2 5 6 3 6-3" />
          <path d="M8 8v6" />
        </svg>
      )
    case 'spark': // two plus-marks — bringing new things into being
      return (
        <svg {...common}>
          <path d="M6.5 2.2v6.6M3.2 5.5h6.6" />
          <path d="M11.8 9.4v4M9.8 11.4h4" />
        </svg>
      )
    case 'run': // a play triangle — runs a process / command
      return (
        <svg {...common}>
          <path d="M5 3.2 12.5 8 5 12.8z" />
        </svg>
      )
    case 'report': // arrow rising out of a tray — status surfaced upward
      return (
        <svg {...common}>
          <path d="M8 13.5V6.5" />
          <path d="M5 9.5 8 6.5l3 3" />
          <path d="M3 4h10" />
        </svg>
      )
    case 'trash': // a bin — teardown / removal
      return (
        <svg {...common}>
          <path d="M3 4.5h10" />
          <path d="M6 4.5V3h4v1.5" />
          <path d="M4.2 4.5 5 13.5h6l.8-9" />
          <path d="M7 7v4M9 7v4" />
        </svg>
      )
    case 'alert': // warning triangle — a fault
      return (
        <svg {...common}>
          <path d="M8 2.5 14.5 13.5H1.5z" />
          <path d="M8 6.5v3.5" />
          <circle cx="8" cy="11.8" r="0.3" />
        </svg>
      )
    case 'flow': // a plain arrow — a neutral "carries on" hop
    default:
      return (
        <svg {...common}>
          <path d="M2 8h10" />
          <path d="M9 5l3 3-3 3" />
        </svg>
      )
  }
}
