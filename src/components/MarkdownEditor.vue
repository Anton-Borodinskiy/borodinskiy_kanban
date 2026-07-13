<script setup>
import { ref, nextTick } from 'vue'
import { renderMarkdown } from '../utils/markdown'
import { BoldIcon, ItalicIcon, ListBulletIcon, LinkIcon, CodeBracketIcon, H1Icon, NumberedListIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  modelValue: { type: String, default: '' },
  rows: { type: Number, default: 5 },
  placeholder: { type: String, default: 'Add details...' },
  minHeight: { type: String, default: '120px' }
})
const emit = defineEmits(['update:modelValue'])

const tab = ref('edit')
const textarea = ref(null)

// Insert markdown around/at the current selection and keep the caret sensible.
const surround = async (before, after, placeholder) => {
  const el = textarea.value
  const val = props.modelValue || ''
  const start = el ? el.selectionStart : val.length
  const end = el ? el.selectionEnd : val.length
  const selected = val.slice(start, end) || placeholder
  const next = val.slice(0, start) + before + selected + after + val.slice(end)
  emit('update:modelValue', next)
  await nextTick()
  if (!el) return
  el.focus()
  // Select the inner text so the user can immediately type over the placeholder.
  el.selectionStart = start + before.length
  el.selectionEnd = start + before.length + selected.length
}

// Prefix each selected line (used for lists / headings).
const prefixLines = async (makePrefix) => {
  const el = textarea.value
  const val = props.modelValue || ''
  const start = el ? el.selectionStart : 0
  const end = el ? el.selectionEnd : 0
  const lineStart = val.lastIndexOf('\n', start - 1) + 1
  const block = val.slice(lineStart, end)
  const lines = block.split('\n')
  const out = lines.map((l, i) => makePrefix(i) + l).join('\n')
  const next = val.slice(0, lineStart) + out + val.slice(end)
  emit('update:modelValue', next)
  await nextTick()
  if (!el) return
  el.focus()
  el.selectionStart = lineStart
  el.selectionEnd = lineStart + out.length
}

const actions = {
  bold: () => surround('**', '**', 'bold text'),
  italic: () => surround('*', '*', 'italic text'),
  code: () => surround('`', '`', 'code'),
  link: () => surround('[', '](https://)', 'link text'),
  heading: () => prefixLines(() => '## '),
  bullet: () => prefixLines(() => '- '),
  numbered: () => prefixLines((i) => `${i + 1}. `),
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-1.5">
      <div class="flex items-center gap-0.5 flex-wrap">
        <button type="button" @click="actions.bold" title="Bold (**text**)" class="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><BoldIcon class="w-4 h-4" /></button>
        <button type="button" @click="actions.italic" title="Italic (*text*)" class="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><ItalicIcon class="w-4 h-4" /></button>
        <button type="button" @click="actions.heading" title="Heading" class="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><H1Icon class="w-4 h-4" /></button>
        <span class="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></span>
        <button type="button" @click="actions.bullet" title="Bullet list" class="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><ListBulletIcon class="w-4 h-4" /></button>
        <button type="button" @click="actions.numbered" title="Numbered list" class="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><NumberedListIcon class="w-4 h-4" /></button>
        <span class="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1"></span>
        <button type="button" @click="actions.link" title="Insert link" class="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><LinkIcon class="w-4 h-4" /></button>
        <button type="button" @click="actions.code" title="Inline code" class="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><CodeBracketIcon class="w-4 h-4" /></button>
      </div>
      <div class="flex text-xs border border-gray-300 dark:border-gray-600 rounded overflow-hidden shrink-0">
        <button type="button" @click="tab = 'edit'" :class="['px-3 py-1', tab === 'edit' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Edit</button>
        <button type="button" @click="tab = 'preview'" :class="['px-3 py-1', tab === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Preview</button>
      </div>
    </div>

    <textarea
      v-if="tab === 'edit'"
      ref="textarea"
      :value="modelValue"
      @input="emit('update:modelValue', $event.target.value)"
      :rows="rows"
      :placeholder="placeholder"
      class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 border resize-y outline-none focus:ring-2 focus:ring-blue-500"
    ></textarea>
    <div
      v-else
      class="prose prose-sm dark:prose-invert max-w-none p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-black/20"
      :style="{ minHeight }"
      v-html="renderMarkdown(modelValue)"
    ></div>
  </div>
</template>
