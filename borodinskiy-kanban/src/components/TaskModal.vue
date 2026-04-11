<script setup>
import { useBoardStore } from '../stores/boardStore'
import { computed, ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const store = useBoardStore()

// Независимые вкладки для описания и комментария
const descTab = ref('edit')
const commentTab = ref('edit')

const isArchiveColumn = computed(() => {
  if (!store.editingTask) return false
  const column = store.columns.find(c => c.id === store.editingTask.columnId)
  return column?.isArchive || false
})

const renderMarkdown = (text) => {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text))
}

const save = () => {
  if (!store.editingTask.title.trim()) return
  store.saveTask(store.editingTask)
}

const remove = () => {
  if (confirm('Are you sure you want to delete this task?')) {
    store.deleteTask(store.editingTask.id)
  }
}
</script>

<template>
  <div v-if="store.isModalOpen && store.editingTask" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @mousedown.self="store.closeModal">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ store.editingTask.isNew ? 'Create New Task' : 'Edit Task' }}
        </h3>
        <button @click="store.closeModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
      </div>

      <div class="p-6 overflow-y-auto flex-1 space-y-4">

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
          <input
            v-model="store.editingTask.title"
            type="text"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
            placeholder="What needs to be done?"
            autofocus
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee</label>
          <select
            v-model="store.editingTask.assigneeId"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border cursor-pointer"
          >
            <option :value="null">Unassigned</option>
            <option v-for="user in store.assignees" :key="user.id" :value="user.id">
              {{ user.name }}
            </option>
          </select>
        </div>

        <div>
          <div class="flex justify-between items-end mb-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <div class="flex text-xs border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <button @click="descTab = 'edit'" :class="['px-3 py-1', descTab === 'edit' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Edit</button>
              <button @click="descTab = 'preview'" :class="['px-3 py-1', descTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Preview</button>
            </div>
          </div>

          <textarea
            v-if="descTab === 'edit'"
            v-model="store.editingTask.description"
            rows="5"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 border resize-y"
            placeholder="Add details, markdown supported..."
          ></textarea>
          <div
            v-else
            class="prose prose-sm dark:prose-invert max-w-none p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-md min-h-[120px] bg-gray-50 dark:bg-black/20"
            v-html="renderMarkdown(store.editingTask.description)"
          ></div>
        </div>

        <div :class="{'bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800': isArchiveColumn}">
          <div class="flex justify-between items-end mb-1">
            <label class="block text-sm font-medium" :class="isArchiveColumn ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'">
              Closing Comment / Links <span v-if="isArchiveColumn">(Required for Archive)</span>
            </label>
            <div class="flex text-xs border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <button @click="commentTab = 'edit'" :class="['px-3 py-1', commentTab === 'edit' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Edit</button>
              <button @click="commentTab = 'preview'" :class="['px-3 py-1', commentTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Preview</button>
            </div>
          </div>

          <textarea
            v-if="commentTab === 'edit'"
            v-model="store.editingTask.closingComment"
            rows="2"
            class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 border resize-y"
            placeholder="Links to docs, PRs, or final notes..."
          ></textarea>
          <div
            v-else
            class="prose prose-sm dark:prose-invert max-w-none p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-md min-h-[50px] bg-white/50 dark:bg-black/20"
            v-html="renderMarkdown(store.editingTask.closingComment)"
          ></div>
          <div v-if="commentTab === 'edit'" class="mt-2 text-[10px] text-gray-400">Markdown supported: [Title](https://link.com)</div>
        </div>

      </div>

      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
        <button v-if="!store.editingTask.isNew" @click="remove" class="text-red-600 hover:text-red-700 font-medium text-sm px-4 py-2">
          Delete Task
        </button>
        <div v-else></div>

        <div class="flex gap-3">
          <button @click="store.closeModal" class="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium text-sm px-4 py-2 rounded-md transition-colors">
            Cancel
          </button>
          <button @click="save" class="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-6 py-2 rounded-md shadow-sm transition-colors disabled:opacity-50" :disabled="!store.editingTask.title.trim()">
            Save
          </button>
        </div>
      </div>

    </div>
  </div>
</template>