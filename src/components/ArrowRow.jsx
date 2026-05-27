export default function ArrowRow({ steps, activeStepNums }) {
  return (
    <div className="arrow-zone">
      {steps.map(s => {
        const isActive = activeStepNums?.has?.(s.n)
        return (
          <div
            key={s.n}
            className={`arrow-step ${isActive ? 'is-active' : ''}`}
          >
            <span className="arrow-num">{s.n}</span>
            <span>{s.text}</span>
          </div>
        )
      })}
    </div>
  )
}
