import { useMemo } from 'react'
import { marked } from 'marked'
import * as katex from 'katex'
import 'katex/dist/katex.min.css'

marked.setOptions({ gfm: true, breaks: true })

interface MathToken {
  tex: string
  display: boolean
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMarkdownHtml(text: string): string {
  const tokens: MathToken[] = []
  let src = text ?? ''

  // 块级公式 $$...$$
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => {
    tokens.push({ tex: tex.trim(), display: true })
    return `\n@@MATH${tokens.length - 1}@@\n`
  })
  // 行内公式 $...$（非 $$）
  src = src.replace(/(^|[^$])\$([^$\n]+?)\$/g, (_m, pre: string, tex: string) => {
    tokens.push({ tex: tex.trim(), display: false })
    return `${pre}@@MATH${tokens.length - 1}@@`
  })

  let html = marked.parse(src, { async: false }) as string

  html = html.replace(/@@MATH(\d+)@@/g, (_m, idx: string) => {
    const t = tokens[Number(idx)]
    if (!t) return ''
    try {
      return katex.renderToString(t.tex, { displayMode: t.display, throwOnError: false })
    } catch {
      return `<code>${escapeHtml(t.tex)}</code>`
    }
  })

  return html
}

export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdownHtml(text), [text])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}
