'use client'

import React from 'react'
import { useFeatureFlag } from '@components/Hooks/useFeatureFlag'

const Footer = () => {
  const showPride = useFeatureFlag('pride_mode')

  if (!showPride) return null

  return (
    <footer
      style={{
        width: '100%',
        padding: '1rem',
        textAlign: 'center',
        color: '#333',
        marginTop: '2rem',
        position: 'fixed',
        zIndex: 999,
        bottom: 0,
        overflowX: 'hidden',
        gap: '1rem',
      }}
    >
      <div className="font-semibold">MADE&nbsp;WITH ❤️🧡💛💚💙💜 IN&nbsp;POTSDAM</div>
    </footer>
  )
}

export default Footer
