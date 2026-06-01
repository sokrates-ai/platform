import type { Extension } from "@codemirror/state"
import * as Y from "yjs"
import { yCollab } from "y-codemirror.next"
import type { Awareness } from "y-protocols/awareness"

export function makeCollab({
  ydoc,
  awareness,
}: {
  ydoc?: Y.Doc | null
  awareness?: Awareness | null
}): { ext?: Extension, ytext?: Y.Text } {
  if (!ydoc) return {}
  const ytext = ydoc.getText('codemirror')
  const ext = yCollab(ytext, awareness ?? undefined, { undoManager: new Y.UndoManager(ytext) }) as unknown as Extension
  return { ext, ytext }
} 