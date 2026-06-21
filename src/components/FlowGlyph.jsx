const GLYPHS = {
  'api-ingress': <><path d="M4 12h11"/><path d="m12 8 4 4-4 4"/><rect x="17" y="5" width="3" height="14" rx="1"/></>,
  'app-ingress': <><circle cx="6" cy="12" r="3"/><path d="M9 12h9M15 9l3 3-3 3"/><path d="M3.8 9.8 8.2 14.2M8.2 9.8 3.8 14.2"/></>,
  spawn: <><path d="M12 4 19 8v8l-7 4-7-4V8z"/><path d="M12 8v8M8 12h8"/></>,
  'east-west': <><path d="M4 8h15m-3-3 3 3-3 3"/><path d="M20 16H5m3 3-3-3 3-3"/></>,
  provision: <><path d="M5 7h10v10H5zM9 3h10v10"/><path d="M14 17v4M12 19h4"/></>,
  'scale-up': <><path d="M4 17h5V9H4zM11 17h5V5h-5z"/><path d="M19 12v6M16 15h6"/></>,
  'scale-down': <><path d="M4 17h5V9H4zM11 17h5V5h-5z"/><path d="M16 15h6"/></>,
  exec: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 10 3 2-3 2M12 15h5"/></>,
  dns: <><circle cx="9" cy="11" r="5"/><path d="m13 15 5 5M9 8v6M6 11h6"/></>,
  'vm-failure': <><rect x="3" y="5" width="18" height="12" rx="2"/><path d="m8 9 8 6M16 9l-8 6M9 21h6"/></>,
  'pod-evicted': <><path d="M12 3 20 7.5v9L12 21 4 16.5v-9z"/><path d="m8 9 8 6M16 9l-8 6"/></>,
  'control-failure': <><circle cx="12" cy="12" r="8"/><path d="M12 7v6M12 17h.01"/><path d="M4 4l16 16"/></>,
  config: <><path d="M6 3h9l3 3v15H6zM15 3v4h4"/><path d="M9 12h6M9 16h4"/><path d="m4 9 2 2-2 2"/></>,
  storage: <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
  health: <><path d="M3 12h4l2-6 3.5 12 2.5-9 1.5 3H21"/></>,
  metrics: <><path d="M3 21h18"/><path d="M6 21v-6M11 21V8M16 21v-9M21 21V4" transform="translate(-1 0)"/></>,
}

export default function FlowGlyph({ name, className = '' }) {
  const glyph = GLYPHS[name]
  if (!glyph) return null
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {glyph}
    </svg>
  )
}
