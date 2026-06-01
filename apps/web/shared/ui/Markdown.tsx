"use client"

import React from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import katex from 'katex'

interface MarkdownProps {
  children?: string
  className?: string
}

function renderMath(input: string): string {
  // Protect code blocks and inline code first
  const codeBlockRegex = /```[\s\S]*?```/g
  const inlineCodeRegex = /`[^`]*`/g

  const placeholders: string[] = []
  const savePlaceholder = (text: string) => {
    const idx = placeholders.push(text) - 1
    return `@@__CODE_PLACEHOLDER_${idx}__@@`
  }

  let text = input.replace(codeBlockRegex, (m) => savePlaceholder(m))
  text = text.replace(inlineCodeRegex, (m) => savePlaceholder(m))

  // Block math $$...$$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, p1: string) => {
    try {
      return katex.renderToString(p1, { displayMode: true, throwOnError: false })
    } catch {
      return _m
    }
  })

  // Inline math $...$
  text = text.replace(/\$(.+?)\$/g, (_m, p1: string) => {
    try {
      return katex.renderToString(p1, { displayMode: false, throwOnError: false })
    } catch {
      return _m
    }
  })

  // Restore code placeholders
  text = text.replace(/@@__CODE_PLACEHOLDER_(\d+)__@@/g, (_m, idxStr: string) => placeholders[Number(idxStr)] || _m)

  return text
}

export const Markdown: React.FC<MarkdownProps> = ({ children = '', className = '' }) => {
  const withMath = React.useMemo(() => renderMath(children), [children])
  const html = React.useMemo(() => marked.parse(withMath), [withMath])
  const safe = React.useMemo(() => DOMPurify.sanitize(html as string), [html])

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />
  )
}

export default Markdown 