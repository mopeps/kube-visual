export default function CategorizedIndex({ categories, options, onSelect }) {
  return (
    <div className="catalogue-index">
      {categories.map((category) => {
        const rows = options.filter((option) => option.category === category.id)
        if (!rows.length) return null
        return (
          <section className="catalogue-group" key={category.id}>
            <div className="catalogue-group-label">{category.label}</div>
            <div className="catalogue-rows">
              {rows.map((option) => (
                <button
                  type="button"
                  className="catalogue-row"
                  key={option.id}
                  style={{ '--catalogue-accent': option.accent }}
                  onClick={() => onSelect(option)}
                >
                  <span className="catalogue-row-title">{option.title}</span>
                  <span className="catalogue-row-meta">{option.meta}</span>
                  <span className="catalogue-row-go" aria-hidden>↗</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
