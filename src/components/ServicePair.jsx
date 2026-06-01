// A Service stacked directly above the workload it exposes, joined by a subtle
// dotted connector. The two render as a single flex item in their zone, so the
// Service always sits right above its target and the pair never splits across a
// reflow. The connector is a short, *local* CSS line between the stacked
// cards — deliberately not a floating SVG trace connector (those stay reserved
// for the active packet trace; see DESIGN_GOAL.md "no floating connectors on
// the idle canvas"). Hovering either card lifts the partner too via CSS.
export default function ServicePair({ color, service, target }) {
  return (
    <div className="service-pair" style={{ '--node-accent': color }}>
      {service}
      <span className="service-pair-link" aria-hidden="true" />
      {target}
    </div>
  )
}
