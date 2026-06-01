'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { UserStats } from "@/shared/services/api"

const GRADIENT = 'linear-gradient(135deg,#f7f7f7 0%,#eaeaea 100%)'
const BORDER = '2px solid #707070'
const SHADOW = '0 2px 0 #454545'
const DROP_SHADOW = 'drop-shadow(0px 2px 2px rgba(69, 69, 69, 0.15))'

export default function TopMenu({stats}: {stats: UserStats}) {
  const headerRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    const updateHeaderVar = () => {
      if (!headerRef.current) return
      const rect = headerRef.current.getBoundingClientRect()
      const total = Math.max(0, rect.height + rect.top)
      document.documentElement.style.setProperty('--workspace-topmenu-height', `${Math.ceil(total)}px`)
    }

    updateHeaderVar()

    const ro = new ResizeObserver(updateHeaderVar)
    if (headerRef.current) ro.observe(headerRef.current)
    window.addEventListener('resize', updateHeaderVar)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateHeaderVar)
      document.documentElement.style.removeProperty('--workspace-topmenu-height')
    }
  }, [])

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:px-0"
    >
      <div className="relative w-full sm:w-3/4 md:w-2/3 lg:w-1/2">
        <div className="relative grid w-full grid-cols-[1fr_auto_40px] sm:grid-cols-[1fr_auto_100px] lg:grid-cols-[1fr_auto_110px] items-center">
          <LeftRail stats={stats}/>
          <Avatar stats={stats} />
          <RightRail />
        </div>
      </div>
    </header>
  )
}

function LeftRail({stats}: {stats: UserStats}) {
  return (
    <div
      className="relative flex h-12 sm:h-14 md:h-16 lg:h-[71px] w-full
                 items-center pl-4 sm:pl-6 pr-6 sm:pr-8 text-[#454545]/90"
      style={railStyle('left')}
    >
      {/* logo */}
      <Link href={'#'}>
        <div className="flex h-5 sm:h-7 md:h-8 lg:h-[26.8px] items-center">
          <Image
            width={100}
            height={100}
            src="/logo.svg"
            alt="Sokrates"
            className="h-full w-auto select-none"
            draggable={false}
          />
        </div>
      </Link>

      {/* badges */}
      <div className="flex items-center pr-1 lg:pr-5 gap-2 sm:gap-3 ml-auto">
        <Badge>
          <span className="mr-1">🪙</span>
          {stats?.coins || 0}
        </Badge>
      </div>
    </div>
  )
}

function RightRail() {
  return (
    <div
      className="relative h-12 sm:h-14 md:h-16 lg:h-[71px] w-full"
      style={railStyle('right')}
    />
  )
}

/**
 * Avatar with an SVG progress ring.
 * Using an SVG circle + stroke-dasharray/stroke-dashoffset gives smooth animations
 * across rapid updates (unlike animating background gradients).
 */
function Avatar({stats}: {stats: UserStats}) {
  // xp is expected to be a 0..100 value
  const pct = Math.max(0, Math.min(100, Number(stats?.xp ?? 0)))
  const fraction = pct / 100

  // SVG geometry
  const strokeWidth = 5
  const radius = 42 // in the viewBox (0..100)
  const circumference = 2 * Math.PI * radius
  // Offset calculation: start at bottom-left = 225deg = 0.625 turn
  const offset = circumference * (1 - fraction)

  return (
    <div className="relative z-10 -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8">
      <div className="relative aspect-square w-24 sm:w-28 md:w-32 lg:w-[150px]">
        {/* SVG progress ring (behind the avatar) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{ transform: 'rotate(90deg)' }}
          aria-hidden
        >
          {/* track */}
          <circle
            cx={50}
            cy={50}
            r={radius}
            stroke="#eaeaea"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* glow ring (blurred, slightly thicker) */}
          <circle
            cx={50}
            cy={50}
            r={radius}
            stroke="#e25a26"
            strokeWidth={strokeWidth + 6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 700ms ease, opacity 700ms ease, filter 700ms ease',
              opacity: fraction > 0 ? 0.6 : 0,
            }}
          />

          {/* solid progress ring */}
          <circle
            cx={50}
            cy={50}
            r={radius}
            stroke="#e25a26"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 700ms ease',
              willChange: 'stroke-dashoffset'
            }}
          />
        </svg>

        {/* inner avatar */}
        <div
          className="absolute inset-[9%] rounded-full overflow-hidden border-2 cursor-default"
          style={{
            borderColor: '#707070',
            background: 'linear-gradient(135deg,#fff,#f3f3f3)'
          }}
        >
          <Image
            width={100}
            height={100}
            src="/sokrates-mascot.svg"
            alt="Sokrates mascot"
            className="absolute inset-0 p-4 w-full h-full object-contain"
            draggable={false}
          />
        </div>

        {/* level badge */}
        <div
          className="absolute bottom-2 left-1/2 translate-x-[-50%] translate-y-1/2 rounded-md border px-3 lg:px-6 py-1 lg:py-0.5 shadow bg-[#f4f4f4]"
          style={{ borderColor: '#707070', boxShadow: SHADOW }}
        >
          <span className="block text-xs sm:text-sm font-bold leading-none text-[#454545]">
            {stats?.level || 0}
          </span>
        </div>
      </div>
    </div>
  )
}

function railStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    background: GRADIENT,
    border: BORDER,
    boxShadow: SHADOW,
    filter: DROP_SHADOW,
    borderRadius: side === 'left'
      ? '0.75rem 0 0 0.75rem'
      : '0 0.75rem 0.75rem 0',
  } as React.CSSProperties
}

const Badge = ({
  children,
  style,
  className,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) => (
  <div
    className={`flex items-center text-[10px] sm:text-xs bg-white border border-[#707070] px-2 sm:px-3 py-1 font-bold rounded-lg select-none ${className || ''}` }
    style={style}
  >
    {children}
  </div>
)

/* Notes:
 - This replaces the conic-gradient approach with an SVG ring. SVG stroke-dashoffset is reliably animatable
   and works smoothly even when the value updates rapidly.
 - If you want the glow to pulse briefly on every XP change instead of just fading in, we can add a
   small `useEffect` that toggles a class on change and triggers a keyframed pulse.
*/
