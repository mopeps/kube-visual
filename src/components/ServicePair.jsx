// Two cards stacked directly on top of each other, joined by a subtle dotted
// connector, rendering as a single flex item in their zone so they never split
// across a reflow. Used for two relations (see `relation`):
//   • 'exposes'  — a Service over the workload it load-balances
//   • 'programs' — an OVN-K8s Node over the Open vSwitch data plane it configures
// The connector is a short, *local* CSS line between the stacked cards —
// deliberately not a floating SVG trace connector (those stay reserved for the
// active packet trace; see DESIGN_GOAL.md "no floating connectors on the idle
// canvas"). Hovering either card lifts the partner too via CSS.
export default function ServicePair({ color, service, target, relation = 'exposes' }) {
  return (
    <div className={`service-pair service-pair--${relation}`} style={{ '--node-accent': color }}>
      {service}
      <span className="service-pair-link" aria-hidden="true" />
      {target}
    </div>
  )
}
