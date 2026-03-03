import GrammarEnhancer from './GrammarEnhancer'

/**
 * GrammarChecker wrapper component
 * Forwards to GrammarEnhancer with proper props
 */
const GrammarChecker = ({ text, documentId, onClose, onApplyChanges }) => {
  return (
    <GrammarEnhancer
      text={text}
      documentId={documentId}
      onClose={onClose}
      onApplyChanges={onApplyChanges}
    />
  )
}

export default GrammarChecker
