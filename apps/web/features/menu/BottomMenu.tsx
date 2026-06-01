"use client";

import React from "react";
import { Button } from "@/shared/ui/button";
import { ArrowLeft, Upload, Share2, Copy, ArrowUp, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import QRCode from "react-qr-code";
import { useSession } from "@/shared/hooks/useSession";

export interface BottomMenuProps {
  canUpload: boolean;
  onBack: () => void;
  onUpload: () => void;
  onCheck?: () => void;
  showCheck: boolean;
  checking?: boolean;
  onComplete?: () => void;
  completing?: boolean;
}
export default function BottomMenu({ canUpload, onBack, onUpload, onCheck, showCheck, checking, onComplete, completing }: BottomMenuProps) {
  const [shareUrl, setShareUrl] = React.useState("");
  const [shareOpen, setShareOpen] = React.useState(false);
  const { rateLimit, refreshRateLimit } = useSession();

  // Countdown + progress for rate-limit
  const [countdownMs, setCountdownMs] = React.useState(0);
  const initialWindowSecRef = React.useRef<number>(0);
  const remainingRef = React.useRef<number>(0);
  React.useEffect(() => {
    const isRl = (rateLimit?.remaining ?? 1) <= 0 && (rateLimit?.resetSec ?? 0) > 0;
    if (!isRl) {
      setCountdownMs(0);
      initialWindowSecRef.current = 0;
      remainingRef.current = 0;
      return;
    }
    const resetSec = Math.max(0, Number(rateLimit?.resetSec ?? 0));
    const startMs = Math.ceil(resetSec * 1000);
    setCountdownMs(startMs);
    remainingRef.current = startMs;
    const windowSec = Number(rateLimit?.limit?.windowSec ?? 0) || resetSec || initialWindowSecRef.current || 0;
    if (!initialWindowSecRef.current) initialWindowSecRef.current = windowSec;

    let raf: number | null = null;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last; // ms
      last = now;
      const next = Math.max(0, remainingRef.current - dt);
      remainingRef.current = next;
      setCountdownMs(next);
      if (next > 0) raf = requestAnimationFrame(tick);
      else refreshRateLimit().catch(() => {});
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [rateLimit, refreshRateLimit]);

  React.useEffect(() => {
    if (typeof window !== "undefined") setShareUrl(window.location.href);
  }, []);

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch {}
  };

  const isRateLimited = (rateLimit?.remaining ?? 1) <= 0 && (rateLimit?.resetSec ?? 0) > 0;
  const waitSec = Math.max(0, Math.ceil(countdownMs / 1000));
  const checkDisabled = isRateLimited || !!checking || !!completing;
  const checkTitle = isRateLimited
    ? `Please wait${waitSec ? ` ${waitSec}s` : ''} before trying again`
    : undefined;

  const windowSec = initialWindowSecRef.current || Number(rateLimit?.limit?.windowSec ?? 0) || Number(rateLimit?.resetSec ?? 0) || 0;
  const progress = isRateLimited && !checking && windowSec > 0 ? Math.max(0, Math.min(1, 1 - (countdownMs / (windowSec * 1000)))) : undefined;

  return (
    <div
      className="w-full fixed inset-x-0 bottom-0 z-50 flex justify-center"
      style={{
        background: "linear-gradient(135deg,#f7f7f7 0%,#eaeaea 100%)",
        borderTop: "0.25px solid #707070",
        boxShadow: "0 -2px 0 #454545",
        filter: "drop-shadow(0px 2px 2px rgba(69, 69, 69, 0.15))",
      }}
    >
      <div className="flex items-center justify-between py-6 w-11/12 sm:w-9/12 px-2 sm:px-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="secondary"
            className="h-10 w-10 sm:h-11 sm:w-12"
            onClick={onBack}
          >
            <ArrowLeft strokeWidth={2.5} className="size-5" />
          </Button>

          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                className="hidden h-10 w-10 sm:flex sm:h-11 sm:w-12"
              >
                <Share2 strokeWidth={2.5} className="size-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="p-0 overflow-hidden sm:max-w-3xl" showCloseButton>
              <div className="border-b-4 border-b-[#707070] bg-[#EBEBEB] p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="text-[#151515] flex justify-center text-lg sm:text-xl">Share Workspace</DialogTitle>
                </DialogHeader>
              </div>

              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1px_1fr] items-stretch gap-6">
                  <div className="min-w-0 flex flex-col justify-between border-4 border-[#707070] rounded-[0.875rem] bg-white/50 py-4 sm:p-6 min-h-[220px]">
                    <div className="space-y-3">
                      <p className="text-[#454545] text-base font-bold sm:text-xl">Copy the link</p>
                      <p className="text-[#707070] text-sm sm:text-base leading-relaxed">You are the only one who gets progression. Shared links cannot be revoked.</p>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 truncate rounded-md border-2 border-[#707070] bg-white px-3 py-2 text-sm sm:text-base text-[#151515]" title={shareUrl}>
                          {shareUrl || "Loading…"}
                        </div>
                        <Button variant="secondary" size="sm" className="h-10 w-10" onClick={handleCopyLink}>
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block bg-[#CFCFCF] w-px" aria-hidden="true" />

                  <div className="min-w-0 flex items-center justify-center border-4 border-[#707070] rounded-[0.875rem] bg-white/50 p-4 sm:p-6 min-h-[220px]">
                    {shareUrl ? (
                      <div className="flex flex-col items-center gap-3 w-full py-4">
                        <div className="w-full max-w-[200px] bg-white p-4 rounded-[0.5rem] border-2 border-[#707070] shadow-sm">
                          <QRCode value={shareUrl} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                        </div>
                        <p className="text-[#707070] text-xs sm:text-sm">Scan to open on another device</p>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Loading…</div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="secondary"
            className="h-10 w-10 sm:h-11 sm:w-12"
            onClick={onUpload}
            hidden={!canUpload}
          >
            <Upload strokeWidth={2.5} className="size-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {showCheck && (
            <>
              <Button
                variant="default"
                className="relative h-10 min-w-[10rem] justify-center px-4 text-sm font-bold overflow-hidden sm:min-w-[13rem] sm:px-8 sm:text-base"
                onClick={onCheck}
                disabled={checkDisabled}
                title={checkTitle}
                progress={progress}
                type="button"
              >
                <div className="flex items-center gap-2 sm:px-4">
                  {checking ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden sm:inline">finding…</span>
                      <span className="sm:hidden">…</span>
                    </span>
                  ) : isRateLimited ? (
                    <span className="tabular-nums">{waitSec}s</span>
                  ) : (
                    <>
                      <ArrowUp strokeWidth={2.5} className="size-5 inline sm:hidden" />
                      <span className="hidden sm:inline">Find Improvements</span>
                    </>
                  )}
                </div>
              </Button>
              {typeof onComplete === "function" && (
                <Button
                  variant="secondary"
                  className="h-10 min-w-[8.5rem] justify-center px-4 text-sm font-semibold sm:min-w-[10rem] sm:px-6 sm:text-base"
                  onClick={onComplete}
                  disabled={!!completing}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    {completing ? (
                      <>
                        <Loader2 strokeWidth={2.5} className="size-5 animate-spin" />
                        <span className="hidden sm:inline">Completing…</span>
                        <span className="sm:hidden">…</span>
                      </>
                    ) : (
                      <>
                        <Check strokeWidth={2.5} className="size-5" />
                        <span className="hidden sm:inline">Complete</span>
                        <span className="sm:hidden">Complete</span>
                      </>
                    )}
                  </div>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
