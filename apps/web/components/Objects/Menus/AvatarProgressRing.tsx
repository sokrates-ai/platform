// AvatarProgressRing.tsx
import React from "react"

export function AvatarProgressRing({ level, progress, children }: { level: number, progress: number, children: React.ReactNode }) {
  const radius = 56
  const stroke = 8
  const borderStroke = 2
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex flex-col items-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="block"
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      >
        {/* Outer border */}
        <circle
          stroke="var(--color-SokratesGrayBorder)"
          fill="none"
          strokeWidth={borderStroke}
          r={normalizedRadius + stroke / 2}
          cx={radius}
          cy={radius}
          style={{ filter: "drop-shadow(0px 2px 0px var(--color-SokratesBlackBoxShadow))" }}
        />
        {/* Background ring */}
        <circle
          stroke="var(--color-SokratesLightGray)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress ring */}
        <circle
          stroke="var(--color-SokratesOrange)"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            transition: "stroke-dashoffset 0.4s"
          }}
        />
        {/* Inner border */}
        <circle
          stroke="var(--color-SokratesGrayBorder)"
          fill="none"
          strokeWidth={borderStroke}
          r={normalizedRadius - stroke / 2}
          cx={radius}
          cy={radius}
        />
      </svg>
      {/* Avatar */}
      <div
        className="flex items-center justify-center rounded-full bg-SokratesWhite"
        style={{
          width: radius * 2 - stroke * 2,
          height: radius * 2 - stroke * 2,
          margin: stroke,
          position: "relative",
          zIndex: 2,
        }}
      >
        {children}
      </div>
      {/* Level Badge */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: -5,
          zIndex: 3,
        }}
      >
        <div
          className="whitespace-nowrap min-w-[20px] text-center text-[10px] font-semibold bg-SokratesLightGray text-SokratesBlackBoxShadow"
          style={{
            borderRadius: 8,
            border: "1px solid var(--color-SokratesGrayBorder)",
            boxShadow: "0px 2px 0px 0px var(--color-SokratesBlackBoxShadow)",
            padding: "1px 5px",
            letterSpacing: "0.01em",
            display: "inline-block",
          }}
        >
          Lv. {level}
        </div>
      </div>
    </div>
  )
}