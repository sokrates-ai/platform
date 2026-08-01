'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface Slide {
  color: string
  text: string
  bgImage?: string
}

interface AnnouncementCarouselProps {
  slides: Slide[]
  /** milliseconds between auto-rotations */
  intervalMs?: number
}

const AnnouncementCarousel: React.FC<AnnouncementCarouselProps> = ({
  slides,
  intervalMs = 5000,
}) => {
  const [currentSlide, setCurrentSlide] = React.useState(0)
  const [progress, setProgress] = React.useState(0) // % progress of current timer

  const rafRef = React.useRef<number | null>(null)
  const startTimeRef = React.useRef<number | null>(null)

  const startTimer = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setProgress(0)
    startTimeRef.current = performance.now()

    const tick = (now: number) => {
      if (!startTimeRef.current) return
      const elapsed = now - startTimeRef.current
      const pct = Math.min((elapsed / intervalMs) * 100, 100)
      setProgress(pct)

      if (pct >= 100) {
        // move to next slide and restart
        setCurrentSlide((i) => (i + 1) % slides.length)
        startTimer()
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [slides.length, intervalMs])

  React.useEffect(() => {
    startTimer()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [startTimer])

  const prevSlide = () => {
    setCurrentSlide((i) => (i - 1 + slides.length) % slides.length)
    startTimer()
  }

  const nextSlide = () => {
    setCurrentSlide((i) => (i + 1) % slides.length)
    startTimer()
  }

  const goToSlide = (idx: number) => {
    setCurrentSlide(idx)
    startTimer()
  }

  const current = slides[currentSlide]

  return (
    <div
      className="
        relative flex items-center justify-center w-full bg-[#EBEBEB]
        border-y-2 sm:border-b-2 mt-36 sm:mt-0 overflow-hidden
        h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh]
      "
      style={{ backgroundColor: current.color }}
    >
      {slides.map((slide, idx) => (
        slide.bgImage ? (
          <div
            key={`${slide.bgImage}-${idx}`}
            className={`
              absolute inset-0 bg-cover bg-center transition-opacity duration-500
              ${currentSlide === idx ? 'opacity-100' : 'opacity-0'}
            `}
            style={{ backgroundImage: `url(${slide.bgImage})` }}
            aria-hidden="true"
          />
        ) : null
      ))}

      {/* overlay only if bgImage exists */}
      {current.bgImage && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      )}

      <span className="z-10 px-4 text-center text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[#F5F5F5]">
        {current.text}
      </span>

      <button
        type="button"
        onClick={prevSlide}
        aria-label="Previous announcement"
        className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 lg:p-4 z-10"
      >
        <ChevronLeft
          size={30}
          className="text-[#F5F5F5] sm:w-8 sm:h-8 lg:w-10 lg:h-10"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        onClick={nextSlide}
        aria-label="Next announcement"
        className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 lg:p-4 z-10"
      >
        <ChevronRight
          size={30}
          className="text-[#F5F5F5] sm:w-8 sm:h-8 lg:w-10 lg:h-10"
          aria-hidden="true"
        />
      </button>

      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
        {slides.map((slide, idx) => {
          const isActive = currentSlide === idx
          return (
            <button
              key={idx}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`Go to slide ${idx + 1} of ${slides.length}: ${slide.text}`}
              aria-current={isActive ? 'true' : undefined}
              className={`
                relative overflow-hidden transition-all duration-200
                ${isActive
                  ? 'w-6 h-3 sm:w-8 sm:h-4 rounded-full'
                  : 'w-2 h-2 sm:w-3 sm:h-3 rounded-full opacity-50'}
                bg-[#F5F5F5]
              `}
            >
              {/* progress bar for active dot */}
              {isActive && (
                <div
                  className="absolute left-0 top-0 h-full bg-[#00000050]"
                  style={{ width: `${progress}%` }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AnnouncementCarousel
