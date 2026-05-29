import { useState } from 'react'
import { COMPONENT_BADGES } from '../data/zones'
import { BADGE_GLOSSARY } from '../data/badge-glossary'
import { PRIMITIVES_BY_TYPE, SELF_PRIMITIVE_IDS } from '../data/primitives'
import ExploreCommands from './ExploreCommands'
import InteractionList from './InteractionList'
import ObjectText from './ObjectText'

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
// the legacy type-keyed kernel/OS primitives section, problem-solved prose,
// interactions, and copy-able shell commands. Rendered below the pipeline tree
// inside AncestryModal.
//
// `suppressLegacyPrimitives` hides the PRIMITIVES_BY_TYPE section for components
// whose kernel primitives are already shown in the modal's pipeline tree
// (Layer 4), so the same information isn't presented twice.
export default function DetailSections({ component, color, suppressLegacyPrimitives = false, onSelectComponent }) {
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

      <div className="detail-section">
        <h4>Problem solved</h4>
        <p>
          <ObjectText
            text={component.problemSolved}
            onSelectComponent={onSelectComponent}
            selfId={componentId}
          />
        </p>
      </div>

      {component.interactions?.length > 0 && (
        <InteractionList
          interactions={component.interactions}
          onSelectComponent={onSelectComponent}
          selfId={componentId}
        />
      )}

      {component.explorationCommands?.length > 0 && (
        <div className="detail-section">
          <h4>Explore</h4>
          <ExploreCommands commands={component.explorationCommands} color={color} />
        </div>
      )}
    </>
  )
}
