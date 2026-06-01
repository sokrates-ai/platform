"use client"

import { useCallback, useMemo, useState } from "react"
import type { MobileConsoleTab } from "../types"

export function useConsoleState() {
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [results, setResults] = useState<string>("")
  const [showConsole, setShowConsole] = useState(true)
  const [mobileTab, setMobileTab] = useState<MobileConsoleTab>("terminal")

  const appendLine = useCallback((s: string) => {
    if (!s) return
    setTerminalLines((ls) => [...ls, s])
  }, [])

  return useMemo(() => ({
    terminalLines,
    appendLine,
    results,
    setResults,
    showConsole,
    setShowConsole,
    mobileTab,
    setMobileTab,
    setTerminalLines,
  }), [terminalLines, appendLine, results, showConsole, mobileTab])
} 