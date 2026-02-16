import { NodeViewWrapper } from '@tiptap/react'
import React from 'react'
import 'katex/dist/katex.min.css'
import { InlineMath } from 'react-katex'
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext'

function MathEquationInlineComponent(props: any) {
  const editorState = useEditorProvider() as any
  const isEditable = editorState.isEditable
  const equation = props.node.attrs.math_equation || ''

  const handleEdit = () => {
    if (!isEditable) {
      return
    }

    const nextEquation = window.prompt('Enter inline LaTeX', equation)

    if (nextEquation === null) {
      return
    }

    props.updateAttributes({
      math_equation: nextEquation,
    })
  }

  return (
    <NodeViewWrapper
      as="span"
      className="inline-math-equation"
      onDoubleClick={handleEdit}
      title={isEditable ? 'Double click to edit LaTeX' : undefined}
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      <InlineMath>{equation}</InlineMath>
    </NodeViewWrapper>
  )
}

export default MathEquationInlineComponent
