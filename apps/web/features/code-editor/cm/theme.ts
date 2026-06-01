import { createTheme } from "@uiw/codemirror-themes"
import { tags as t } from "@lezer/highlight"
import { EditorView } from "@codemirror/view"

const palette = ["#D83A52", "#E67E22", "#F1C40F", "#2ECC71", "#1ABC9C", "#3498DB", "#7E5BEF", "#E84393"]

export const sokratesTheme = createTheme({
  theme: "light",
  settings: {
    background: "#F4F4F4",
    foreground: "#2b2b2b",
    caret: "#3b3b3b",
    selection: "#CFE8FF",
    selectionMatch: "#CFE8FF88",
    lineHighlight: "rgba(0,0,0,0.03)",
    gutterBackground: "#F4F4F4",
    gutterForeground: "#6a6a6a",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  styles: [
    { tag: [t.keyword, t.modifier, t.controlKeyword], color: palette[0], fontWeight: "bold" },
    { tag: [t.definitionKeyword], color: palette[1], fontWeight: 600 },
    { tag: [t.string, t.special(t.string)], color: palette[2] },
    { tag: [t.number, t.bool, t.null], color: "#2B8A3E", fontWeight: "bold" },
    { tag: [t.comment], color: "#7a7a7a", fontStyle: "italic" },
    { tag: [t.variableName], color: "#2b2b2b" },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: palette[5], fontWeight: 600 },
    { tag: [t.typeName, t.className, t.namespace], color: palette[6] },
    { tag: [t.propertyName, t.attributeName], color: palette[4] },
    { tag: [t.operator, t.operatorKeyword], color: "#2b2b2b" },
    { tag: [t.regexp], color: palette[7] },
    { tag: [t.invalid], color: "#E03131" },
  ],
})

export const completionTheme = EditorView.theme({
  ".cm-tooltip": {
    backgroundColor: "#F4F4F4",
    color: "#2b2b2b",
    border: "1px solid #707070",
    boxShadow: "none",
    borderRadius: "8px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "#F4F4F4",
    color: "#2b2b2b",
    border: "1px solid #707070",
    boxShadow: "none",
    borderRadius: "8px",
    padding: "4px",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    margin: "8px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete ul": {
    maxHeight: "260px",
    overflow: "hidden",
    padding: 0,
    margin: 0,
    overscrollBehavior: "contain",
  },
  ".cm-tooltip.cm-tooltip-autocomplete li": {
    padding: "6px 8px",
    borderRadius: "6px",
    margin: "2px",
    pointerEvents: "none",
  },
  '.cm-tooltip.cm-tooltip-autocomplete li[aria-selected="true"]': {
    backgroundColor: "#E8E8E8",
    outline: `2px solid ${palette[5]}44`,
  },
  ".cm-completionLabel": { fontWeight: 500 },
  ".cm-completionDetail": { color: "#6a6a6a" },
  ".cm-completionMatchedText": { textDecoration: "underline", textDecorationThickness: "2px" },
  ".cm-tooltip.cm-completionInfo": {
    marginLeft: "8px",
  },
  ".cm-completionIcon-function": { color: palette[5] },
  ".cm-completionIcon-variable": { color: "#2b2b2b" },
  ".cm-completionIcon-keyword": { color: palette[0] },
  ".cm-tooltip .documentation": {
    lineHeight: 1.45,
    padding: "8px",
    borderRadius: "8px",
  },
  ".cm-tooltip .documentation pre": {
    backgroundColor: "#EBEBEB",
    padding: "8px",
    borderRadius: "6px",
    overflowX: "auto",
  },
  ".cm-tooltip .documentation code": {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: "12.5px",
  },
  ".cm-tooltip .documentation .hljs-keyword": { color: palette[0], fontWeight: 700 },
  ".cm-tooltip .documentation .hljs-title, .cm-tooltip .documentation .hljs-title.function_": { color: palette[5] },
  ".cm-tooltip .documentation .hljs-built_in, .cm-tooltip .documentation .hljs-type": { color: palette[6] },
  ".cm-tooltip .documentation .hljs-string": { color: palette[2] },
  ".cm-tooltip .documentation .hljs-number, .cm-tooltip .documentation .hljs-literal": { color: "#2B8A3E" },
  ".cm-tooltip .documentation .hljs-comment": { color: "#7a7a7a", fontStyle: "italic" },

  ".cm-line.cm-activeLine": {
    backgroundColor: "rgba(0,0,0,0.03)",
  },
})

export const completionMobileFix = EditorView.baseTheme({
  "@media (pointer: coarse), (max-width: 768px)": {
    ".cm-tooltip.cm-tooltip-autocomplete": {
      maxWidth: "92vw",
    },
    ".cm-tooltip.cm-tooltip-autocomplete ul": {
      maxHeight: "40vh",
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      paddingRight: "2px",
    },
  },
}) 