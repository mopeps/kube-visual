import { useMemo, useState } from 'react'
import componentsData from '../data/components.json'
import { COMPONENT_COLOR } from '../data/zones'

// Show kernel-adjacent layers: KVM/VMI, host OS services, and Linux kernel primitives.
const LINUX_LAYERS = ['KubeVirt', 'Bare Metal Worker Node', 'Guest Worker Node', 'Linux Kernel Primitives']

const ICONS = {
  'kubevirt-launcher':           '🖥️',
  'guest-worker-node-vm':        '⚡',
  'virt-handler':                '🎛️',
  'kubelet-host':                '🛰️',
  'crio-host':                   '📦',
  'ovs-host':                    '🌐',
  'ovn-node-host':               '🔀',
  'cluster-monitoring':          '📊',
  'kubelet-guest':               '🛰️',
  'crio-guest':                  '📦',
  'ovs-guest':                   '🌐',
  'ovn-node-guest':              '🔀',
  'konnectivity-agent':          '🔗',
  'coredns-node':                '📡',
  'openshift-ingress-router-guest': '🚦',
  'frontend-workload-pod':       '🌍',
  'backend-workload-pod':        '⚙️',
  'pod-netns':                   '🧭',
  'pod-cgroups':                 '🧮',
  'container-process':           '▣',
}

// Lowercased haystack of everything in a card a viewer might search by:
// name, type prefix, layer, description, and the starter command.
function searchText(c) {
  return [
    c.displayName,
    c.typePrefix,
    c.layer,
    c.problemSolved,
    c.explorationCommands?.[0],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function LayerCard({ component }) {
  const color = COMPONENT_COLOR[component.componentId] || 'var(--k-green)'
  const icon = ICONS[component.componentId] || '▣'

  return (
    <div className="layer-card" style={{ borderColor: `${color}40` }}>
      <div
        className="layer-card-header"
        style={{ color, background: `${color}14` }}
      >
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span>
          {component.typePrefix && (
            <span style={{ fontSize: '0.55rem', opacity: 0.6, marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              [{component.typePrefix}]
            </span>
          )}
          {component.displayName}
        </span>
      </div>
      <div className="layer-card-body">
        <p>{component.problemSolved}</p>
        {component.explorationCommands?.[0] && (
          <pre className="code-block">{component.explorationCommands[0]}</pre>
        )}
      </div>
    </div>
  )
}

export default function LinuxInternalsTab() {
  const [query, setQuery] = useState('')

  // Static list of the kernel-adjacent components, with a precomputed search
  // haystack so filtering is a cheap substring test per keystroke.
  const items = useMemo(
    () =>
      componentsData
        .filter(c => LINUX_LAYERS.includes(c.layer))
        .map(c => ({ component: c, haystack: searchText(c) })),
    [],
  )

  const q = query.trim().toLowerCase()
  const visible = q ? items.filter(it => it.haystack.includes(q)) : items

  return (
    <div>
      <div className="mb-5">
        <div className="font-display text-[1.35rem] font-semibold mb-1">
          Linux / KVM Internals
        </div>
        <p className="text-[0.78rem]" style={{ color: 'var(--tx-muted)' }}>
          The KubeVirt, host OS, and Linux kernel primitives backing the Guest Worker Node —
          one card per concept, with a starter command to inspect it live.
        </p>
      </div>

      <div className="mb-5" style={{ position: 'relative', maxWidth: 420 }}>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, primitive, layer, or command…"
          aria-label="Search Linux / KVM internals"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '0.78rem',
            fontFamily: 'inherit',
            color: 'var(--tx)',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border-w)',
            borderRadius: 8,
            outline: 'none',
          }}
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-[0.78rem]" style={{ color: 'var(--tx-muted)' }}>
          No components match “{query.trim()}”.
        </p>
      ) : (
        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          }}
        >
          {visible.map(({ component }) => (
            <LayerCard key={component.componentId} component={component} />
          ))}
        </div>
      )}
    </div>
  )
}
