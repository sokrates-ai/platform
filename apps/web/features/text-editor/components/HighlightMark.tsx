import { Mark } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Slice, Fragment, Node as ProseMirrorNode, Mark as ProseMirrorMark } from '@tiptap/pm/model'

interface HighlightMarkOptions {
    HTMLAttributes: Record<string, unknown>
}

export interface HighlightMarkAttributes {
    id: string
    type: string
    message: string
    class: string
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        highlightMark: {
            setHighlightMark: (attributes: HighlightMarkAttributes) => ReturnType
            toggleHighlightMark: (attributes: HighlightMarkAttributes) => ReturnType
            unsetHighlightMark: () => ReturnType
        }
    }
}

export const HighlightMark = Mark.create<HighlightMarkOptions>({
    name: 'highlightMark',

    addOptions() {
        return {
            HTMLAttributes: {},
        }
    },

    addAttributes() {
        return {
            id: {
                default: null,
            },
            type: {
                default: null,
            },
            message: {
                default: null,
            },
            class: {
                default: 'hl-highlight'
            }
        }
    },

    inclusive: false,
    
    // Exclude from input rules to prevent automatic application
    excludeFromInputRules: true,
    
    // Exclude from paste rules to prevent highlighting pasted content
    excludeFromPasteRules: true,

    parseHTML() {
        return [
            // Don't parse highlight spans from HTML - highlights are purely decorative
            // and should not be restored from serialized content
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            {
                ...HTMLAttributes,
                class: `${HTMLAttributes.class} cursor-pointer`,
                'data-hl': HTMLAttributes.type,
                'data-hl-id': HTMLAttributes.id,
                'data-hl-message': HTMLAttributes.message,
            },
            0,
        ]
    },

    addCommands() {
        return {
            setHighlightMark:
                (attributes) =>
                ({ commands }) => {
                    return commands.setMark(this.name, attributes)
                },
            toggleHighlightMark:
                (attributes) =>
                ({ commands }) => {
                    return commands.toggleMark(this.name, attributes)
                },
            unsetHighlightMark:
                () =>
                ({ commands }) => {
                    return commands.unsetMark(this.name)
                },
        }
    },

    // Override serialization to exclude highlights from clipboard and getHTML
    addStorage() {
        return {
            // Custom serializer that excludes highlight marks
            toClipboard: true,
        }
    },

    // Custom paste handling to strip highlights from pasted content
    addPasteRules() {
        return []
    },

    // Override getHTML to exclude highlights from serialization
    addGlobalAttributes() {
        return [
            {
                types: [this.name],
                attributes: {
                    'data-highlight-decorative': {
                        default: 'true',
                        parseHTML: () => null, // Never parse this attribute
                        renderHTML: () => null, // Never render this attribute
                    },
                },
            },
        ]
    },

    // Add custom serialization logic
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('highlightClipboard'),
                props: {
                    // Transform copied content to remove highlights
                    transformCopied: (slice: Slice) => {
                        const { schema } = this.editor
                        const highlightMarkType = schema.marks[this.name]
                        
                        if (!highlightMarkType) return slice
                        
                        // Recursively transform nodes to remove highlight marks
                        const transformNode = (node: ProseMirrorNode): ProseMirrorNode => {
                            if (node.marks) {
                                const filteredMarks = node.marks.filter((mark: ProseMirrorMark) => mark.type !== highlightMarkType)
                                node = node.mark(filteredMarks)
                            }
                            
                            if (node.content.size > 0) {
                                const children: ProseMirrorNode[] = []
                                node.content.forEach((child: ProseMirrorNode) => {
                                    children.push(transformNode(child))
                                })
                                node = node.copy(Fragment.fromArray(children))
                            }
                            
                            return node
                        }
                        
                        const nodes: ProseMirrorNode[] = []
                        slice.content.forEach((node: ProseMirrorNode) => {
                            nodes.push(transformNode(node))
                        })
                        
                        return new Slice(
                            Fragment.fromArray(nodes),
                            slice.openStart,
                            slice.openEnd
                        )
                    },
                },
            }),
        ]
    },
}) 