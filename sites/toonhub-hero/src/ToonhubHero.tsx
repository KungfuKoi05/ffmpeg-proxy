import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const IMAGES = [
  { src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/1.02464a56.png', bg: '#F4845F', panel: '#F79B7F' },
  { src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/2.b977faab.png', bg: '#6BBF7A', panel: '#85CC92' },
  { src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/3.4df853b4.png', bg: '#E882B4', panel: '#ED9DC4' },
  { src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/4.4457fbce.png', bg: '#6EB5FF', panel: '#8DC4FF' },
]

const COUNT = IMAGES.length
const DURATION_MS = 650
const EASE = 'cubic-bezier(0.4,0,0.2,1)'
const MOBILE_MAX_WIDTH = 640

// height and bottom are animated too; without them a side figure jumps from 28% to 92% tall on the first frame.
// z-index steps through its integers, so the outgoing centre figure stays in front until mid-swap.
const ITEM_TRANSITION = ['transform', 'filter', 'opacity', 'left', 'height', 'bottom', 'z-index']
  .map((prop) => `${prop} ${DURATION_MS}ms ${EASE}`)
  .join(', ')

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")"

type Direction = 'next' | 'prev'
type Role = 'center' | 'left' | 'right' | 'back'

function roleOf(index: number, activeIndex: number): Role {
  if (index === activeIndex) return 'center'
  if (index === (activeIndex + 3) % COUNT) return 'left'
  if (index === (activeIndex + 1) % COUNT) return 'right'
  return 'back'
}

function roleStyle(role: Role, isMobile: boolean): CSSProperties {
  switch (role) {
    case 'center':
      return {
        transform: `translateX(-50%) scale(${isMobile ? 1.25 : 1.68})`,
        filter: 'blur(0px)',
        opacity: 1,
        zIndex: 20,
        left: '50%',
        height: isMobile ? '60%' : '92%',
        bottom: isMobile ? '22%' : 0,
      }
    case 'left':
    case 'right':
      return {
        transform: 'translateX(-50%) scale(1)',
        filter: 'blur(2px)',
        opacity: 0.85,
        zIndex: 10,
        left: role === 'left' ? (isMobile ? '20%' : '30%') : isMobile ? '80%' : '70%',
        height: isMobile ? '16%' : '28%',
        bottom: isMobile ? '32%' : '12%',
      }
    case 'back':
      return {
        transform: 'translateX(-50%) scale(1)',
        filter: 'blur(4px)',
        opacity: 1,
        zIndex: 5,
        left: '50%',
        height: isMobile ? '13%' : '22%',
        bottom: isMobile ? '32%' : '12%',
      }
  }
}

export default function ToonhubHero() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_MAX_WIDTH)
  const unlockTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    for (const { src } of IMAGES) {
      const img = new Image()
      img.src = src
    }
  }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_MAX_WIDTH)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => () => window.clearTimeout(unlockTimer.current), [])

  const navigate = useCallback(
    (direction: Direction) => {
      if (isAnimating) return
      setIsAnimating(true)
      setActiveIndex((prev) => (direction === 'next' ? (prev + 1) % COUNT : (prev + 3) % COUNT))
      unlockTimer.current = window.setTimeout(() => setIsAnimating(false), DURATION_MS)
    },
    [isAnimating],
  )

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: IMAGES[activeIndex].bg,
        transition: `background-color ${DURATION_MS}ms ${EASE}`,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <section
        className="relative w-full"
        style={{ height: '100vh', overflow: 'hidden' }}
        aria-roledescription="carousel"
        aria-label="TOONHUB figurines"
      >
        {/* Grain overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ zIndex: 50, opacity: 0.4, backgroundImage: GRAIN, backgroundSize: '200px 200px', backgroundRepeat: 'repeat' }}
          aria-hidden="true"
        />

        {/* Giant ghost text */}
        <div
          className="pointer-events-none absolute inset-x-0 flex items-center justify-center select-none"
          style={{ zIndex: 2, top: '18%' }}
          aria-hidden="true"
        >
          <span
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 'clamp(90px, 28vw, 380px)',
              fontWeight: 900,
              color: '#fff',
              opacity: 1,
              lineHeight: 1,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            3D Shape
          </span>
        </div>

        {/* Brand label */}
        <p
          className="absolute top-6 left-4 text-xs font-semibold text-white uppercase sm:left-8"
          style={{ zIndex: 60, opacity: 0.9, letterSpacing: '0.18em' }}
        >
          Toonhub
        </p>

        {/* Carousel */}
        <div className="absolute inset-0" style={{ zIndex: 3 }}>
          {IMAGES.map((image, index) => {
            const role = roleOf(index, activeIndex)
            return (
              <div
                key={image.src}
                style={{
                  position: 'absolute',
                  aspectRatio: '0.6 / 1',
                  transition: ITEM_TRANSITION,
                  willChange: 'transform, filter, opacity',
                  ...roleStyle(role, isMobile),
                }}
                aria-hidden={role !== 'center'}
              >
                <img
                  src={image.src}
                  alt={role === 'center' ? `TOONHUB figurine ${index + 1} of ${COUNT}` : ''}
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom center' }}
                />
              </div>
            )
          })}
        </div>

        {/* Bottom-left copy + navigation */}
        <div
          className="absolute bottom-6 left-4 sm:bottom-20 sm:left-24"
          style={{ zIndex: 60, maxWidth: 320 }}
        >
          <p
            className="mb-2 text-base font-bold tracking-widest text-white uppercase sm:mb-3 sm:text-[22px]"
            style={{ opacity: 0.95, letterSpacing: '0.02em' }}
          >
            Toonhub Figurines
          </p>
          <p className="mb-4 hidden text-xs text-white sm:mb-5 sm:block sm:text-sm" style={{ opacity: 0.85, lineHeight: 1.6 }}>
            The artwork is stunning, shipped fully prepared. The finish is a vision, the 3D craft is flawless. Many
            thanks! Wishing you the win. Order now.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              aria-label="Previous figurine"
              onClick={() => navigate('prev')}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-transparent text-white transition-[transform,background-color] duration-150 hover:bg-[rgba(255,255,255,0.12)] hover:[transform:scale(1.08)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:h-16 sm:w-16"
            >
              <ArrowLeft size={26} strokeWidth={2.25} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next figurine"
              onClick={() => navigate('next')}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-transparent text-white transition-[transform,background-color] duration-150 hover:bg-[rgba(255,255,255,0.12)] hover:[transform:scale(1.08)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:h-16 sm:w-16"
            >
              <ArrowRight size={26} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Bottom-right link */}
        <div className="absolute right-4 bottom-6 sm:right-10 sm:bottom-20" style={{ zIndex: 60 }}>
          <a
            href="#"
            className="flex items-center text-white uppercase no-underline opacity-95 transition-opacity duration-200 hover:opacity-100"
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 'clamp(20px, 4vw, 56px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            Discover It
            <ArrowRight className="h-5 w-5 sm:h-8 sm:w-8" strokeWidth={2.25} aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  )
}
