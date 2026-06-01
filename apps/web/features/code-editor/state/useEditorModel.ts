"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Y from "yjs"

export function useEditorModel({ ydoc, initialCode }: { ydoc?: Y.Doc | null, initialCode: string }) {
  const [localValue, setLocalValue] = useState<string>(initialCode)
  const initialRef = useRef(initialCode)

  useEffect(() => {
    initialRef.current = initialCode
    if (!ydoc) setLocalValue(initialCode)
  }, [initialCode, ydoc])

  const getCurrentCode = useCallback(() => {
    try {
      if (ydoc) return ydoc.getText('codemirror').toString()
    } catch {}
    return initialRef.current || localValue || ""
  }, [ydoc, localValue])

  const reset = useCallback(() => {
    if (ydoc) {
      try {
        const ytext = ydoc.getText('codemirror')
        const len = (ytext as unknown as { length?: number }).length ?? ytext.toString().length
        ytext.delete(0, len)
        ytext.insert(0, initialRef.current)
      } catch {}
      return
    }
    setLocalValue(initialRef.current)
  }, [ydoc])

  return useMemo(() => ({
    value: localValue,
    setLocalValue,
    getCurrentCode,
    reset,
  }), [localValue, setLocalValue, getCurrentCode, reset])
}

