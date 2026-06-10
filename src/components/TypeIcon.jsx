// Shared monochrome type glyphs — one line-icon per `typePrefix` used across the
// app (NodeCard labels, the Object Map table, the Hop Inspector route). Each is a
// single-stroke SVG drawn with `currentColor` so it inherits whatever colour the
// surrounding label uses, and sized at 1em so it tracks the adjacent text.
//
// This is the *backbone* glyph map: the same nine shapes encode the same nine
// kinds everywhere, so the type vocabulary stays consistent no matter which view
// you're reading. Keyed by the raw `typePrefix` string from components.json /
// zones.js (see TYPE_GLYPH_KEY for the prefix → glyph-id mapping).

// typePrefix → glyph id. An unknown prefix renders nothing (graceful no-op).
const TYPE_GLYPH_KEY = {
  'Pod': 'pod',
  'Static Pod': 'static-pod',
  'systemd': 'systemd',
  'Service': 'service',
  'API Object': 'api-object',
  'Custom Resource': 'custom-resource',
  'VirtualMachineInstance': 'vmi',
  'NWPOLICY': 'networkpolicy',
  'Client': 'client',
}

// glyph id → SVG body (24×24 viewBox, stroke = currentColor, 1.6 weight — same
// drawing conventions as the pipeline BandIcon and interaction KindIcon).
const TYPE_GLYPHS = {
  // Pod — the classic Kubernetes hexagon (a single packaged application).
  pod: <path d="M12 3 20 7.5v9L12 21 4 16.5v-9z" />,
  // Static Pod — a boxed application pinned to the node (kubelet-managed from disk,
  // not the API server): a container box with a thumbtack pushed into the top.
  'static-pod': (
    <>
      <rect x="4.5" y="8" width="15" height="11" rx="1.5" />
      <path d="M12 8V4.5" />
      <circle cx="12" cy="3.6" r="1.3" />
    </>
  ),
  // systemd — an OS-level daemon / init unit: a power symbol (running service).
  systemd: (
    <>
      <path d="M12 3v6.5" />
      <path d="M7.4 6.4a7 7 0 1 0 9.2 0" />
    </>
  ),
  // Service — a virtual front-end fanning traffic to endpoints: a hub + spokes.
  service: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="5" cy="6" r="1.7" />
      <circle cx="19" cy="6" r="1.7" />
      <circle cx="12" cy="20" r="1.7" />
      <path d="M10.4 10.4 6.3 7.1M13.6 10.4l4.1-3.3M12 14.4v3.9" />
    </>
  ),
  // API Object — a plain Kubernetes object / record: JSON braces.
  'api-object': (
    <>
      <path d="M9.5 4c-2 0-2.5 1-2.5 3v1.8c0 1.4-1 1.9-2 1.9 1 0 2 .5 2 1.9V17c0 2 .5 3 2.5 3" />
      <path d="M14.5 4c2 0 2.5 1 2.5 3v1.8c0 1.4 1 1.9 2 1.9-1 0-2 .5-2 1.9V17c0 2-.5 3-2.5 3" />
    </>
  ),
  // Custom Resource — an API extension installed by a CRD: a puzzle piece.
  'custom-resource': (
    <path d="M10 4.5a2 2 0 0 1 4 0V6h3.5v3.5H19a2 2 0 0 1 0 4h-1.5V17H14v-1.5a2 2 0 0 0-4 0V17H6.5v-3.5H5a2 2 0 0 1 0-4h1.5V6H10z" />
  ),
  // VirtualMachineInstance — a guest VM: a monitor with a stand.
  vmi: (
    <>
      <rect x="3.5" y="5" width="17" height="11" rx="1.5" />
      <path d="M9 19.5h6M12 16v3.5" />
    </>
  ),
  // NetworkPolicy — an L3/L4 allow/deny firewall rule: a shield.
  networkpolicy: <path d="M12 3 5 5.8v5.4c0 4.4 3 7.4 7 8.8 4-1.4 7-4.4 7-8.8V5.8z" />,
  // Client — an off-cluster human caller: a person.
  client: (
    <>
      <circle cx="12" cy="8" r="3.1" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
}

// The glyph drawn next to a node's bracketed [typePrefix] label. Each runtime
// form gets a distinct mark (Pod hexagon, systemd power symbol, VMI monitor…)
// so the form is recognisable at a glance; the Overview legend explains the
// vocabulary. Renders nothing for a prefix with no glyph (graceful no-op).
export default function TypeIcon({ typePrefix, className }) {
  const glyph = TYPE_GLYPHS[TYPE_GLYPH_KEY[typePrefix]]
  if (!glyph) return null
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  )
}

// Exposed so other views (legends, etc.) can tell whether a prefix has a glyph.
export function hasTypeGlyph(typePrefix) {
  return Boolean(TYPE_GLYPHS[TYPE_GLYPH_KEY[typePrefix]])
}

// Opt-in glyph renderer. The default TypeIcon above is suppressed app-wide, but a
// few views (e.g. the Packet Flow route chips) deliberately *do* want the type
// glyph drawn — they call this directly. 1em / currentColor, matching the other
// chip glyphs; renders nothing for a prefix with no glyph (graceful no-op).
export function TypeGlyph({ typePrefix }) {
  const glyph = TYPE_GLYPHS[TYPE_GLYPH_KEY[typePrefix]]
  if (!glyph) return null
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  )
}
