"use client"

import React from 'react'

type AuthCardProps = {
  children: React.ReactNode
  className?: string
}

export default function AuthCard({ children, className = '' }: AuthCardProps) {
  return (
    <div className={`bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] border-2 border-[#707070] rounded-xl shadow-[0_4px_0_#454545] w-full max-w-[95vw] sm:max-w-[45rem] md:max-w-[52.5rem] p-10 sm:p-12 md:p-16 ${className}`}>
      {children}
    </div>
  )
}