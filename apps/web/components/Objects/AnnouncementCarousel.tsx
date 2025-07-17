'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Slide {
  color: string
  text: string
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

  // auto-rotate
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((i) => (i + 1) % slides.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [slides.length, intervalMs])

  const prevSlide = () =>
    setCurrentSlide((i) => (i - 1 + slides.length) % slides.length)
  const nextSlide = () =>
    setCurrentSlide((i) => (i + 1) % slides.length)

  return (
    <div
      className="
        relative flex items-center justify-center w-full bg-[#EBEBEB]
        border-y-2 sm:border-b-2 mt-36 sm:mt-0 overflow-hidden
        h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh]
      "
      style={{ backgroundColor: slides[currentSlide].color }}
    >
      <span className="z-10 px-4 text-center text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[#F5F5F5]">
        {slides[currentSlide].text}
      </span>

      <button
        onClick={prevSlide}
        className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 lg:p-4 z-10"
      >
        <ChevronLeft
          size={30}
          className="text-[#F5F5F5] sm:w-8 sm:h-8 lg:w-10 lg:h-10"
        />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 lg:p-4 z-10"
      >
        <ChevronRight
          size={30}
          className="text-[#F5F5F5] sm:w-8 sm:h-8 lg:w-10 lg:h-10"
        />
      </button>

      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`
              transition-all duration-200
              ${currentSlide === idx
                ? 'w-6 h-3 sm:w-8 sm:h-4 rounded-full'
                : 'w-2 h-2 sm:w-3 sm:h-3 rounded-full opacity-50'}
              bg-[#F5F5F5]
            `}
          />
        ))}
      </div>
    </div>
  )
}

export default AnnouncementCarousel 