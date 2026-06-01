"use client"

import React from "react"
import CodeMirror from "@uiw/react-codemirror"
import type { Extension } from "@codemirror/state"
import { startCompletion } from "@codemirror/autocomplete"

export function EditorPane({
  value,
  extensions,
  onChange,
  onTypedSpaceImportTrigger,
  className,
}: {
  value?: string | null
  extensions?: Extension[] | null
  onChange: (value: string) => void
  onTypedSpaceImportTrigger?: (view: any) => void
  className?: string
}) {
  const controlled = typeof value === "string"
  const safeExtensions = Array.isArray(extensions) ? extensions : []

  return (
    <CodeMirror
      height="100%"
      {...(controlled ? { value: value as string } : {})}
      extensions={safeExtensions}
      basicSetup={{ autocompletion: false }}
      onChange={onChange}
      onUpdate={(vu) => {
        if (!vu.docChanged) return
        const typed = vu.transactions.some((t: any) => t.isUserEvent("input.type"))
        if (!typed) return
        let inserted = ""
        for (const tr of vu.transactions) {
          tr.changes.iterChanges((_fa: any, _ta: any, _fb: any, _tb: any, ins: any) => {
            inserted += ins.sliceString(0)
          })
        }
        if (inserted !== " ") return
        const pos = vu.state.selection.main.head
        const line = vu.state.doc.lineAt(pos)
        const before = vu.state.sliceDoc(line.from, pos)
        if (/^\s*(import|from)\s+$/.test(before)) {
          startCompletion(vu.view)
          onTypedSpaceImportTrigger?.(vu.view)
        }
      }}
      style={{ height: "100%" }}
      className={className}
    />
  )
} 