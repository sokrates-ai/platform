import { ViewPlugin } from "@codemirror/view"
import DOMPurify from "dompurify"
import hljs from "highlight.js/lib/core"
import pythonHl from "highlight.js/lib/languages/python"

hljs.registerLanguage("python", pythonHl)

export const sanitizeDocumentation = ViewPlugin.define((view) => {
  const sanitize = (root: ParentNode | HTMLElement) => {
    const nodes: HTMLElement[] = root instanceof HTMLElement && root.classList.contains("documentation")
      ? [root]
      : Array.from((root as ParentNode).querySelectorAll?.(".documentation") ?? []) as HTMLElement[]
    for (const el of nodes) {
      el.innerHTML = DOMPurify.sanitize(el.innerHTML)
      el.querySelectorAll("pre code").forEach((block) => {
        try { hljs.highlightElement(block as HTMLElement) } catch { }
      })
    }
  }
  sanitize(view.dom)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) sanitize(n)
      })
    }
  })
  observer.observe(view.dom, { subtree: true, childList: true })
  return { destroy() { observer.disconnect() } }
}) 