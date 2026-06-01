"use client"

import React from "react"
import { Terminal, Eraser } from "lucide-react"
import type { MobileConsoleTab } from "../types"
import { Button } from "@/shared/ui/button"

export function ConsoleMobile({
  resultsHtml,
  terminalLines,
  mobileTab,
  setMobileTab,
  onClearTerminal,
}: {
  resultsHtml: string
  terminalLines: string[]
  mobileTab: MobileConsoleTab
  setMobileTab: (t: MobileConsoleTab) => void
  onClearTerminal: () => void
}) {
  const onlyTerminalVisible = !resultsHtml
  return (
    <div className="lg:hidden flex flex-col w-full border-t border-[#707070]/60 bg-[#F4F4F4] h-[24svh] min-h-[120px]">
      {!onlyTerminalVisible && (
        <div className="flex items-stretch gap-1 px-2 pt-2 bg-[#EBEBEB]">
          {!!resultsHtml && (
            <Button
              onClick={() => setMobileTab("results")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-t-md transition ${mobileTab === "results" ? "bg-white text-[#2b2b2b] border border-[#707070] border-b-0" : "text-[#6a6a6a] hover:bg-[#f3f3f3]"}`}
            >
              Results
            </Button>
          )}
          <Button
            onClick={() => setMobileTab("terminal")}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-t-md transition ${mobileTab === "terminal" || !resultsHtml ? "bg-white text-[#2b2b2b] border border-[#707070] border-b-0" : "text-[#6a6a6a] hover:bg-[#f3f3f3]"}`}
          >
            Terminal
          </Button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden border-t border-[#707070]/60">
        {mobileTab === "results" && !!resultsHtml && (
          <div className="h-full overflow-auto p-3 text-sm text-[#3b3b3b]">
            <div dangerouslySetInnerHTML={{ __html: resultsHtml }} />
          </div>
        )}
        {(mobileTab === "terminal" || !resultsHtml) && (
          <div className="h-full flex flex-col bg-[#1e1e1e]">
            <div className="px-3 py-1.5 border-b border-[#3a3a3a] bg-[#2a2a2a] text-sm font-medium text-[#EAEAEA] flex items-center gap-2">
              <Terminal size={14} />
              <span>Terminal</span>
              <Button   
                size="sm"
                variant="outline"
                onClick={onClearTerminal}
                className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[12px] rounded border border-[#3a3a3a] text-[#EAEAEA] hover:bg-[#343434]"
                title="Clear terminal"
                aria-label="Clear terminal"
              >
                <Eraser size={14} /> Clear
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 text-[12.5px] leading-relaxed font-mono text-[#EAEAEA]">
              {terminalLines.length ? (
                terminalLines.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {/^▶ Running/.test(l) && (
                      <div className="flex items-center my-2 text-[#A0A0A0]">
                        <div className="flex-1 border-t border-[#3a3a3a]" />
                        <span className="px-2 text-[10px] uppercase tracking-wider">Run</span>
                        <div className="flex-1 border-t border-[#3a3a3a]" />
                      </div>
                    )}
                    <span className={/^■ Stopped/.test(l) ? "text-[#A0A0A0]" : undefined}>{l}</span>
                  </div>
                ))
              ) : (
                <div className="text-[#A0A0A0] italic">No output.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 