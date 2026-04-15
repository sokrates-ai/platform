'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Puzzle1 from 'public/puzzle-piece-1.svg'
import Puzzle2 from 'public/puzzle-piece-2.svg'
import SokratesLogo from 'public/dark_logo.svg'

type LegalMeta = {
  label: string
  value: string
}

type LegalSection = {
  title: string
  paragraphs?: Array<React.ReactNode>
  bullets?: Array<React.ReactNode>
}

type LegalLink = {
  label: string
  href: string
}

type LegalPageProps = {
  title: string
  subtitle: string
  intro?: string
  badgeLabel?: string
  summaryTitle?: string
  summary: string[]
  meta?: LegalMeta[]
  sections: LegalSection[]
  contactTitle?: string
  contactBody?: string
  relatedLinks?: LegalLink[]
  footnote?: string
}

export default function LegalPage({
  title,
  subtitle,
  intro,
  badgeLabel = 'Legal',
  summaryTitle = 'Quick summary',
  summary,
  meta = [],
  sections,
  contactTitle = 'Questions or requests?',
  contactBody = 'Reach out to your organization administrator or the Sokrates support team for help with these policies.',
  relatedLinks = [],
  footnote = 'This page is a plain-language overview. For legally binding terms, defer to the full policy text agreed with your organization.',
}: LegalPageProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.08 },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f2f2f2] text-[#424242]">
      <div
        className="absolute inset-0 bg-[url('/background-1.svg')] bg-repeat opacity-70"
        style={{ backgroundSize: '240px 240px' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/90 to-white" />

      <motion.div
        className="absolute -top-6 left-4 w-28 h-24 md:w-44 md:h-36 lg:w-52 lg:h-44 pointer-events-none"
        style={{ rotate: '-96deg' }}
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        <Image src={Puzzle1} alt="" fill className="object-contain" />
      </motion.div>

      <motion.div
        className="absolute bottom-10 left-0 w-48 h-40 md:w-72 md:h-56 lg:w-80 lg:h-64 pointer-events-none"
        style={{ rotate: '14deg' }}
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        <Image src={Puzzle2} alt="" fill className="object-contain" />
      </motion.div>

      <motion.div
        className="absolute top-24 right-6 w-32 h-28 md:w-52 md:h-44 lg:w-64 lg:h-52 pointer-events-none"
        style={{ rotate: '-10deg' }}
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        <Image src={Puzzle1} alt="" fill className="object-contain" />
      </motion.div>

      <div className="relative z-10 w-full px-4 py-12 sm:py-16 lg:py-20">
        <motion.div className="mx-auto flex max-w-6xl flex-col gap-8" variants={container} initial="hidden" animate="show">
          <motion.header variants={item} className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-[#6b6b6b] shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-SokratesOrange shadow-[0_0_0_3px_rgba(226,90,38,0.15)]" />
                {badgeLabel}
              </div>
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 rounded-full border border-[#2f2f2f]/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#2f2f2f] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Back to sign in
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black">
                  <Image src={SokratesLogo} alt="" width={28} height={28} />
                </div>
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7a7a7a]">
                  Sokrates platform
                </div>
              </div>
              <h1 className="text-3xl font-semibold text-[#1f1f1f] sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base text-[#5d5d5d] sm:text-lg">
                {subtitle}
              </p>
              {intro && (
                <p className="max-w-3xl text-sm text-[#6b6b6b] sm:text-base">
                  {intro}
                </p>
              )}
            </div>

            {meta.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {meta.map((itemMeta) => (
                  <div
                    key={`${itemMeta.label}-${itemMeta.value}`}
                    className="rounded-full border border-[#2f2f2f]/10 bg-white/80 px-4 py-2 text-xs font-semibold text-[#5a5a5a]"
                  >
                    <span className="uppercase tracking-[0.18em] text-[#8a8a8a]">{itemMeta.label}</span>
                    <span className="mx-2 text-[#c4c4c4]">|</span>
                    <span>{itemMeta.value}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
            <motion.aside
              variants={item}
              className="h-fit rounded-3xl border border-[#e4e4e4] bg-gradient-to-br from-white via-white to-[#f6f1ea] p-6 shadow-[0_18px_40px_rgba(51,51,51,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#1f1f1f]">{summaryTitle}</h2>
                <span className="rounded-full bg-[#f3e7db] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#a45b2a]">
                  Highlights
                </span>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-[#5a5a5a]">
                {summary.map((itemSummary) => (
                  <li key={itemSummary} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-SokratesOrange" />
                    <span>{itemSummary}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-2xl border border-[#e7e1d7] bg-white/70 p-4">
                <h3 className="text-sm font-semibold text-[#2f2f2f]">{contactTitle}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#6a6a6a]">
                  {contactBody}
                </p>
              </div>

              {relatedLinks.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.26em] text-[#8a8a8a]">
                    Related
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {relatedLinks.map((linkItem) => (
                      <Link
                        key={linkItem.href}
                        href={linkItem.href}
                        className="rounded-full border border-[#2f2f2f]/10 bg-white/80 px-4 py-2 text-xs font-semibold text-[#2f2f2f] transition hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        {linkItem.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </motion.aside>

            <motion.section
              variants={item}
              className="rounded-3xl border border-[#e4e4e4] bg-white/90 p-6 shadow-[0_18px_40px_rgba(51,51,51,0.1)] backdrop-blur"
            >
              <div className="space-y-8">
                {sections.map((section, index) => (
                  <div
                    key={`${section.title}-${index}`}
                    className="border-b border-dashed border-[#e5e5e5] pb-8 last:border-b-0 last:pb-0"
                  >
                    <h2 className="text-lg font-semibold text-[#1f1f1f] sm:text-xl">
                      {section.title}
                    </h2>
                    {section.paragraphs && (
                      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#5e5e5e]">
                        {section.paragraphs.map((paragraph, paragraphIndex) => (
                          <p key={`${section.title}-p-${paragraphIndex}`}>{paragraph}</p>
                        ))}
                      </div>
                    )}
                    {section.bullets && (
                      <ul className="mt-4 space-y-2 text-sm text-[#5b5b5b]">
                        {section.bullets.map((bullet, bulletIndex) => (
                          <li key={`${section.title}-b-${bulletIndex}`} className="flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#1f1f1f]" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          </div>

          <motion.footer variants={item} className="text-xs text-[#8a8a8a]">
            {footnote}
          </motion.footer>
        </motion.div>
      </div>
    </div>
  )
}
