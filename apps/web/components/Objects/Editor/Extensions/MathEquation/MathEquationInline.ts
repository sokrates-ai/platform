import { mergeAttributes, Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'

import MathEquationInlineComponent from './MathEquationInlineComponent'

const findInlineMathEquation = (text: string) => {
  const end = text.lastIndexOf('$')

  if (end <= 0) {
    return null
  }

  if (text[end - 1] === '$') {
    return null
  }

  const start = text.lastIndexOf('$', end - 1)

  if (start === -1) {
    return null
  }

  if (start > 0 && text[start - 1] === '$') {
    return null
  }

  if (start > 0 && text[start - 1] === '\\') {
    return null
  }

  const math = text.slice(start + 1, end)

  if (!math || math.includes('\n') || math.includes('$')) {
    return null
  }

  return {
    start,
    end,
    math,
  }
}

export default Node.create({
  name: 'inlineMathEquation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      math_equation: {
        default: '',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'inline-math-equation',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['inline-math-equation', mergeAttributes(HTMLAttributes), 0]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('inlineMathEquationInput'),
        props: {
          handleTextInput: (view, from, to, text) => {
            if (text !== '$' || from !== to) {
              return false
            }

            const { state } = view
            const $from = state.doc.resolve(from)

            if ($from.parent.type.spec.code) {
              return false
            }

            if (
              ($from.nodeBefore || $from.nodeAfter)?.marks.some(
                (mark) => mark.type.spec.code
              )
            ) {
              return false
            }

            const textBefore = $from.parent.textBetween(
              0,
              $from.parentOffset,
              '\n',
              '\n',
            )
            const match = findInlineMathEquation(textBefore + text)

            if (!match) {
              return false
            }

            const startPos = from - (textBefore.length - match.start)

            view.dispatch(
              state.tr.replaceWith(
                startPos,
                from,
                this.type.create({ math_equation: match.math }),
              ),
            )

            return true
          },
        },
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathEquationInlineComponent)
  },
})
