"use client";

import React, { useRef } from "react";
import type { SheetRef } from "@/features/text-editor/components/Sheet";
import Sheet from "@/features/text-editor/components/Sheet";

export interface TextWorkspaceProps {
  onActionStarted: () => void;
  triggerUpload: boolean;
  setTriggerUpload: (v: boolean) => void;
  sheetRef?: React.RefObject<SheetRef | null>;
  onCompleted?: () => void;
}

export default function TextWorkspace({ onActionStarted, triggerUpload, setTriggerUpload, sheetRef, onCompleted }: TextWorkspaceProps) {
  const internalRef = useRef<SheetRef>(null);
  const ref = (sheetRef as React.RefObject<SheetRef>) || internalRef;

  return (
    <Sheet
      ref={ref}
      onActionStarted={onActionStarted}
      onUploadDialogOpen={() => setTriggerUpload(false)}
      triggerUpload={triggerUpload}
      onCompleted={onCompleted}
    />
  );
}
