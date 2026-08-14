<script setup>
import { ref, watch, nextTick } from 'vue'
import { useBoardStore } from '../stores/boardStore'

const store = useBoardStore()
const inputValue = ref('')
const isArchive = ref(false)
const inputRef = ref(null)

const confirmRef = ref(null)

watch(() => store.dialog.isOpen, async (isOpen) => {
  if (isOpen) {
    // ИСПРАВЛЕНИЕ: Берем значение из стора
    inputValue.value = store.dialog.inputValue || ''
    isArchive.value = false
    await nextTick()
    if (store.dialog.type === 'prompt' || store.dialog.type === 'addColumn') {
      inputRef.value?.focus()
      // ИСПРАВЛЕНИЕ: Сразу выделяем текст, чтобы можно было начать печатать поверх
      if (inputValue.value) inputRef.value?.select()
    } else {
      // Plain confirms had nothing focused, so Enter did nothing here and could
      // instead re-fire whatever button opened the dialog.
      confirmRef.value?.focus()
    }
  }
})

const handleConfirm = () => {
  if (store.dialog.type === 'prompt') {
    if (!inputValue.value.trim()) return
    store.closeDialog(inputValue.value.trim())
  } else if (store.dialog.type === 'addColumn') {
    if (!inputValue.value.trim()) return
    store.closeDialog({ title: inputValue.value.trim(), isArchive: isArchive.value })
  } else {
    store.closeDialog(true)
  }
}

const handleCancel = () => store.closeDialog(false)
</script>

<template>
  <div v-if="store.dialog.isOpen" role="dialog" aria-modal="true" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @mousedown.self="handleCancel" @keydown.enter="handleConfirm">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col transform transition-all">

      <div class="p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ store.dialog.title }}</h3>
        <p v-if="store.dialog.message" class="text-sm text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-line">{{ store.dialog.message }}</p>

        <div v-if="store.dialog.type === 'prompt' || store.dialog.type === 'addColumn'" class="space-y-4">
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border outline-none"
            placeholder="Type here..."
            @keyup.enter="handleConfirm"
          >
          <label v-if="store.dialog.type === 'addColumn'" class="flex items-center gap-2 cursor-pointer">
            <input v-model="isArchive" type="checkbox" class="rounded text-blue-600 focus:ring-blue-500 bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600">
            <span class="text-sm text-gray-700 dark:text-gray-300">Is this an Archive/Done column?</span>
          </label>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
        <button @click="handleCancel" class="text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-4 py-2 rounded-md font-medium text-sm transition-colors">
          Cancel
        </button>
        <button ref="confirmRef" @click="handleConfirm" :class="[store.dialog.isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700', 'text-white font-medium text-sm px-6 py-2 rounded-md shadow-sm transition-colors']">
          {{ store.dialog.confirmText }}
        </button>
      </div>

    </div>
  </div>
</template>