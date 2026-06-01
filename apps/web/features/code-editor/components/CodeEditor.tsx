"use client"

import React from "react"
import CodeEditorContainer from "@/features/code-editor"
import type { CodeEditorRef } from "@/features/code-editor"

export default function CodeEditor(props: { editorRef?: React.Ref<CodeEditorRef> }) {
  const { editorRef } = props
  return <CodeEditorContainer ref={editorRef as any} />
}
