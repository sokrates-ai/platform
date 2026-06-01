"use client"

import React from "react"
import { Terminal, Eraser } from "lucide-react"
import { Button } from "@/shared/ui/button"

export function ConsoleDesktop({
  resultsHtml,
  terminalLines,
  onClearTerminal,
}: {
  resultsHtml: string
  terminalLines: string[]
  onClearTerminal: () => void
}) {
  return (
    <div className="hidden lg:flex lg:flex-col lg:w-[380px] lg:shrink-0 min-h-0 border-l border-[#707070]/60 bg-[#F4F4F4]">
      {!!resultsHtml && (
        <div className="min-h-[120px] max-h-[40%] overflow-auto">
          <div className="px-3 py-1.5 border-b border-[#707070]/60 bg-[#EBEBEB] text-sm font-medium text-[#454545]">
            Results
          </div>
          <div className="p-3 text-sm text-[#3b3b3b]">
            <div dangerouslySetInnerHTML={{ __html: resultsHtml }} />
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col bg-[#1e1e1e]">
        <div className="px-3 py-1.5 border-b border-[#3a3a3a] bg-[#2a2a2a] text-sm font-medium text-[#EAEAEA] flex items-center gap-2">
          <Terminal size={14} />
          <span>Terminal</span>
          <Button
            size="sm"
            variant="outline"
            onClick={onClearTerminal}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[12px] rounded border border-[#3a3a3a] text-[#EAEAEA] hover:text-[#EAEAEA] hover:bg-[#343434] focus:outline-none focus:ring-0"
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
    </div>
  )
} 