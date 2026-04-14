'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type TabSwitchOption = {
  value: string
  label: string
}

type TabSwitchProps = {
  value: string
  onValueChange: (value: string) => void
  options: TabSwitchOption[]
  className?: string
}

function TabSwitch({ value, onValueChange, options, className }: TabSwitchProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border-2 border-SokratesGrayBorder bg-SokratesLightGray/60 p-1 shadow-[0_2px_0_0_var(--color-SokratesBlackBoxShadow)]',
        className,
      )}
      role="tablist"
      aria-label="Switch tabs"
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
              'rounded-full px-5 py-1 text-sm font-semibold transition',
              isActive
                ? 'bg-orange-500 text-white shadow-[0_2px_0_0_rgba(0,0,0,0.2)]'
                : 'text-SokratesGrayText hover:text-SokratesBlack',
            )}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default TabSwitch
