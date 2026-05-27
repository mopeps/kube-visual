import componentsData from '../data/components.json'
import { COMPONENT_COLOR } from '../data/zones'

// Only the host-net and pod-kernel zones map to "Linux primitives" pages.
const LINUX_LAYERS = ['Host Networking Subsystem', 'Linux Kernel Primitives']

const ICONS = {
  'ovs-bridge-br-int':   '🌐',
  'host-veth-pair':      '🔌',
  'pod-netns':           '🧭',
  'pod-cgroups':         '🧮',
  'container-process':   '⚙️',
  'ingress-router-haproxy': '🚦',
  'crio':                '📦',
  'kubelet':             '🛰️',
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
        <span>{component.displayName}</span>
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
  const items = componentsData.filter(c => LINUX_LAYERS.includes(c.layer))

  return (
    <div>
      <div className="mb-5">
        <div className="font-display text-[1.35rem] font-semibold mb-1">
          Linux / OpenShift Internals
        </div>
        <p className="text-[0.78rem]" style={{ color: 'var(--tx-muted)' }}>
          The kernel and host-networking primitives that back every Pod —
          one card per concept, with a starter command to inspect it on a
          live cluster.
        </p>
      </div>
      <div
        className="grid gap-5"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        }}
      >
        {items.map(c => <LayerCard key={c.componentId} component={c} />)}
      </div>
    </div>
  )
}
