declare module 'canvas-confetti' {
  export type ConfettiOptions = { [key: string]: unknown }
  export type CreateTypes = (options: ConfettiOptions) => Promise<void> | void
  const confetti: CreateTypes & { create: (canvas: HTMLCanvasElement, opts?: ConfettiOptions) => CreateTypes }
  export default confetti
} 