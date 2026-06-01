export class StdoutBuffer {
  private pending: string[] = []
  private timer: number | null = null
  constructor(private flushNow: (s: string) => void, private delayMs: number = 16) {}

  push(chunk: string) {
    if (!chunk) return
    this.pending.push(chunk)
    if (this.timer != null) return
    this.timer = setTimeout(() => {
      this.timer = null
      const text = this.pending.join("")
      this.pending = []
      if (text) this.flushNow(text)
    }, this.delayMs) as unknown as number
  }

  flush() {
    if (this.timer != null) {
      clearTimeout(this.timer as unknown as number)
      this.timer = null
    }
    const text = this.pending.join("")
    this.pending = []
    if (text) this.flushNow(text)
  }
} 