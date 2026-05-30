import { useState } from 'react'
import { COMPONENT_BADGES } from '../data/zones'
import { BADGE_GLOSSARY } from '../data/badge-glossary'
import { PRIMITIVES_BY_TYPE, SELF_PRIMITIVE_IDS } from '../data/primitives'
import ExploreCommands from './ExploreCommands'
import InteractionList from './InteractionList'
import ObjectText from './ObjectText'

// Single accent icon (a key) that fronts the "why it exists" callout — it
// telegraphs "this is the essential reason" without needing a text heading.
function WhyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="3.2" />
      <path d="M7.8 7.8 13 13" />
      <path d="M11 11l1.6-1.6M12.4 12.4 14 10.8" />
    </svg>
  )
}

function PrimitiveInline({ primitive, color, onSelectComponent, selfId }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: '10px 12px',
        borderRadius: 6,
        border: `1px solid ${color}40`,
        background: `${color}0d`,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.72rem', color, marginBottom: 4 }}>
        {primitive.label}
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--tx)', margin: '0 0 8px' }}>
        {primitive.description}
      </p>
      {primitive.interactions?.length > 0 && (
        <ul style={{ margin: '0 0 8px', paddingLeft: 16 }}>
          {primitive.interactions.map((line, i) => (
            <li key={i} style={{ fontSize: '0.7rem', color: 'var(--tx-muted)', marginBottom: 2 }}>
              <ObjectText text={line} onSelectComponent={onSelectComponent} selfId={selfId} />
            </li>
          ))}
        </ul>
      )}
      {primitive.commands?.length > 0 && (
        <ExploreCommands commands={primitive.commands} color={color} />
      )}
    </div>
  )
}

// The "everything else" body of the inspector: tag chips, OpenShift context,
// the legacy type-keyed kernel/OS primitives section, the merged "why it exists"
// callout + interaction rows, and copy-able shell commands. Rendered below the
// pipeline tree inside AncestryModal.
//
// `suppressLegacyPrimitives` hides the PRIMITIVES_BY_TYPE section for components
// whose kernel primitives are already shown in the modal's pipeline tree
// (Layer 4), so the same information isn't presented twice.
export default function DetailSections({ component, color, suppressLegacyPrimitives = false, onSelectComponent, pipelineSection = null }) {
  const [expandedPrimitive, setExpandedPrimitive] = useState(null)
  const [expandedBadge, setExpandedBadge] = useState(null)

  const componentId = component.componentId
  const badges = COMPONENT_BADGES[componentId] || []
  const explanation = expandedBadge ? BADGE_GLOSSARY[expandedBadge] : null

  const primitiveSet =
    suppressLegacyPrimitives ||
    SELF_PRIMITIVE_IDS.has(componentId) ||
    component.layer === 'External'
      ? null
      : PRIMITIVES_BY_TYPE[component.typePrefix] || null

  return (
    <>
      {/* One concise "why it exists" point (role badge + single sentence). No
          explicit heading — the callout is self-evident. */}
      <div className="detail-section">
        <div className="why-callout" style={{ borderColor: `${color}59`, background: `${color}12` }}>
          <span className="why-icon" style={{ color, borderColor: `${color}59`, background: `${color}1f` }} aria-hidden="true">
            <WhyIcon />
          </span>
          <div className="why-body">
            {component.role && (
              <span className="why-role" style={{ color, borderColor: `${color}66`, background: `${color}1a` }}>
                {component.role}
              </span>
            )}
            <p className="why-text">
              <ObjectText
                text={component.problemSolved}
                onSelectComponent={onSelectComponent}
                selfId={componentId}
              />
            </p>
          </div>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="detail-section">
          <h4>Tags</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: explanation ? 12 : 0 }}>
            {badges.map((b) => {
              const isOpen = expandedBadge === b.label
              const hasExplanation = !!BADGE_GLOSSARY[b.label]
              return (
                <button
                  key={b.label}
                  onClick={() => setExpandedBadge(isOpen ? null : b.label)}
                  className="node-badge"
                  style={{
                    color: isOpen ? 'var(--bg)' : b.color,
                    borderColor: isOpen ? b.color : `${b.color}66`,
                    background: isOpen ? b.color : `${b.color}1a`,
                    fontSize: '0.62rem',
                    padding: '4px 10px',
                    cursor: hasExplanation ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s, color 0.15s',
                    opacity: hasExplanation ? 1 : 0.6,
                  }}
                  onMouseEnter={e => {
                    if (hasExplanation && !isOpen) e.currentTarget.style.background = `${b.color}35`
                  }}
                  onMouseLeave={e => {
                    if (!isOpen) e.currentTarget.style.background = `${b.color}1a`
                  }}
                  title={hasExplanation ? 'Click for explanation' : undefined}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
          {explanation && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                border: `1px solid ${(badges.find(b => b.label === expandedBadge)?.color) || color}40`,
                background: 'rgba(0,0,0,0.35)',
                fontSize: '0.74rem',
                lineHeight: 1.7,
                color: 'var(--tx)',
              }}
            >
              {explanation}
            </div>
          )}
        </div>
      )}

      {component.interactions?.length > 0 && (
        <div className="detail-section">
          <InteractionList
            interactions={component.interactions}
            onSelectComponent={onSelectComponent}
            selfId={componentId}
          />
        </div>
      )}

      {component.logicalContext && (
        <div className="detail-section">
          <h4>OpenShift Context</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--tx-muted)' }}>
              Project:&nbsp;
              <span style={{ color, fontFamily: 'monospace' }}>
                {component.logicalContext.openShiftProject}
              </span>
            </div>
            {component.logicalContext.associatedObject && (
              <div style={{ fontSize: '0.72rem', color: 'var(--tx-muted)' }}>
                Object:&nbsp;
                <span style={{ color, fontFamily: 'monospace' }}>
                  {component.logicalContext.associatedObject}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {primitiveSet && (
        <div className="detail-section">
          <h4>{primitiveSet.sectionTitle}</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {primitiveSet.items.map(p => {
              const isExpanded = expandedPrimitive === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setExpandedPrimitive(isExpanded ? null : p.id)}
                  className="node-badge"
                  style={{
                    color: isExpanded ? 'var(--bg)' : primitiveSet.color,
                    borderColor: primitiveSet.color,
                    background: isExpanded ? primitiveSet.color : `${primitiveSet.color}1a`,
                    fontSize: '0.62rem',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isExpanded) e.currentTarget.style.background = `${primitiveSet.color}35`
                  }}
                  onMouseLeave={e => {
                    if (!isExpanded) e.currentTarget.style.background = `${primitiveSet.color}1a`
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {expandedPrimitive && (
            <PrimitiveInline
              primitive={primitiveSet.items.find(p => p.id === expandedPrimitive)}
              color={primitiveSet.color}
              onSelectComponent={onSelectComponent}
              selfId={componentId}
            />
          )}
        </div>
      )}

      {pipelineSection}

      {component.explorationCommands?.length > 0 && (
        <div className="detail-section">
          <h4>Explore</h4>
          <ExploreCommands commands={component.explorationCommands} color={color} />
        </div>
      )}
    </>
  )
}
