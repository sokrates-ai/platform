import confetti, { CreateTypes } from 'canvas-confetti'

export type ConfettiVariant =
  | 'fireworks'
  | 'school'

type C = CreateTypes

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function raf(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

const paletteSets: string[][] = [
  ['#D83A52', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C', '#3498DB', '#7E5BEF', '#E84393'],
  ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF'],
  ['#845EC2', '#FF9671', '#FFC75F', '#F9F871'],
]

function fireworksSides(c: C) {
  const end = performance.now() + 800
  const colors = pick(paletteSets)
  const id = { current: 0 as number | null }

  const loop = () => {
    if (performance.now() > end) return
    c({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0, y: Math.random() * 0.6 + 0.2 }, colors })
    c({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1, y: Math.random() * 0.6 + 0.2 }, colors })
    id.current = window.setTimeout(loop, 50)
  }
  loop()
  window.setTimeout(() => { if (id.current) clearTimeout(id.current) }, Math.max(0, end - performance.now()))
}

function schoolPride(c: C) {
  const colors = pick(paletteSets)
  c({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0 }, colors })
  c({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1 }, colors })
}

// ---------- variant runner ----------
function runVariant(c: C, variant: ConfettiVariant) {
  switch (variant) {
    case 'fireworks': return fireworksSides(c)
    case 'school': return schoolPride(c)
  }
}

// ---------- main entry ----------
/**
 * Creates a temporary full-screen canvas, runs one variant, then cleans up.
 * - Sizes canvas immediately to avoid first-frame cutoff
 * - Defers the first burst to the next rAF so layout/worker are ready
 * - Respects prefers-reduced-motion
 */
export async function celebrateOnce(forcedVariant?: ConfettiVariant) {
  if (typeof window === 'undefined') return

  // Respect reduced motion
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.zIndex = '9999'
  canvas.style.pointerEvents = 'none'
  canvas.style.display = 'block'

  // Intrinsic size immediately to avoid initial cutoff/stretch
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  document.body.appendChild(canvas)

  // Confetti instance
  const c = confetti.create(canvas, { resize: true, useWorker: true })

  // Give the browser a tick before firing to avoid initial delay/cutoff
  await raf()
  await raf()

  const variant: ConfettiVariant =
    forcedVariant ??
    pick<ConfettiVariant>(['fireworks', 'school'])

  runVariant(c, variant)

  // Cleanup after 10s
  window.setTimeout(() => {
    try { (c as unknown as { reset?: () => void }).reset?.() } catch { }
    try { canvas.remove() } catch { }
  }, 10_000)
}
