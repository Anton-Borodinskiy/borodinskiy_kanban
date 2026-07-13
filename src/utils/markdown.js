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

export function renderMarkdown(text) {
  ensureHook()
  return text ? DOMPurify.sanitize(marked.parse(text)) : ''
}
