"use client"

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import Puzzle1 from 'public/puzzle-piece-1.svg'
import Puzzle2 from 'public/puzzle-piece-2.svg'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full min-h-screen bg-[#f2f2f2] overflow-hidden flex flex-col items-center justify-center text-[#7a7a7a] bg-[url('/background-1.svg')] bg-repeat bg-auto">
      {/* Light grey overlay over the dotted pattern */}
      <div className="absolute inset-0 pointer-events-none bg-[#f2f2f2]/80" />

      {/* Top-left puzzle piece */}
      <motion.div
        className="absolute -top-3 left-3 w-32 h-28 md:w-48 md:h-40 lg:w-56 lg:h-48 xl:w-64 xl:h-52 pointer-events-none"
        style={{ rotate: '-101deg' }}
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src={Puzzle1} alt="" fill className="object-contain" />
      </motion.div>

      {/* Bottom-left puzzle piece */}
      <motion.div
        className="absolute top-1/2 -left-8 md:-left-12 lg:-left-16 w-60 h-52 md:w-80 md:h-64 lg:w-96 lg:h-72 xl:w-[32rem] xl:h-80 pointer-events-none"
        style={{ rotate: '15deg' }}
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src={Puzzle2} alt="" fill className="object-contain" />
      </motion.div>

      {/* Top-right puzzle piece */}
      <motion.div
        className="absolute top-20 md:top-32 lg:top-36 right-2 md:right-6 lg:right-8 w-40 h-36 md:w-52 md:h-44 lg:w-64 lg:h-52 xl:w-72 xl:h-60 pointer-events-none"
        style={{ rotate: '-8.362deg' }}
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src={Puzzle1} alt="" fill className="object-contain" />
      </motion.div>

      {/* Bottom-right puzzle piece */}
      <motion.div
        className="absolute bottom-4 md:bottom-6 -right-6 md:-right-8 lg:-right-10 w-52 h-48 md:w-64 md:h-56 lg:w-80 lg:h-64 xl:w-96 xl:h-72 pointer-events-none"
        style={{ rotate: '-24.829deg' }}
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src={Puzzle2} alt="" fill className="object-contain" />
      </motion.div>

      {/* Form container */}
      <div className="relative z-10 w-full max-w-sm md:max-w-md lg:max-w-lg px-4 md:px-6">
        {children}
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 md:bottom-8 text-xs md:text-sm font-semibold z-10 px-4 text-center">
        <a href="/terms" className="underline hover:no-underline transition-all">
          Terms of Service
        </a>
        {" "}and{" "}
        <a href="/privacy" className="underline hover:no-underline transition-all">
          Privacy Policy
        </a>
      </div>
    </div>
  )
}
