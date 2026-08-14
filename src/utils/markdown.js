import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Single place that turns stored Markdown into safe HTML, so every view renders
// identically and the "open links in a new tab" hook is registered exactly once.
let hookAdded = false
function ensureHook() {
  if (hookAdded) return
  hookAdded = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

// breaks: treat single newlines as <br> (friendlier, closer to what people type).
marked.setOptions({ gfm: true, breaks: true })

// All cards live in one component, so any unrelated change (typing in the search
// box, toggling compact mode, starting a drag) re-renders every card and used to
// re-run marked+DOMPurify for each one. Descriptions rarely change, so memoize.
const cache = new Map()
const MAX_CACHE = 500

export function renderMarkdown(text) {
  if (!text) return ''
  const hit = cache.get(text)
  if (hit !== undefined) return hit
  ensureHook()
  const html = DOMPurify.sanitize(marked.parse(text))
  // Simple FIFO eviction — insertion order is Map's iteration order.
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
  cache.set(text, html)
  return html
}
