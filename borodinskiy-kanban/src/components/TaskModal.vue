<script setup>
import { useBoardStore } from '../stores/boardStore'
import { computed, ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { TrashIcon, PlusIcon } from '@heroicons/vue/24/outline'

const store = useBoardStore()
const descTab = ref('edit')
const commentTab = ref('edit')

const isArchiveColumn = computed(() => {
  if (!store.editingTask) return false
  const column = store.columns.find(c => c.id === store.editingTask.columnId)
  return column?.isArchive || false
})

const renderMarkdown = (text) => text ? DOMPurify.sanitize(marked.parse(text)) : ''

const toggleAssignee = (id) => {
  if (!store.editingTask.assigneeIds) store.editingTask.assigneeIds = []
  const idx = store.editingTask.assigneeIds.indexOf(id)
  if (idx === -1) store.editingTask.assigneeIds.push(id)
  else store.editingTask.assigneeIds.splice(idx, 1)
}

const addSubtask = () => { store.editingTask.subtasks.push({ title: '', done: false }) }
const removeSubtask = (idx) => store.editingTask.subtasks.splice(idx, 1)
const save = () => { if (!store.editingTask.title.trim()) return; store.saveTask(store.editingTask) }
const remove = () => { if (confirm('Are you sure you want to delete this task?')) store.deleteTask(store.editingTask.id) }

// Палитра цветов
const taskColors = [
  { id: 'default', class: 'bg-gray-200 dark:bg-gray-600' },
  { id: 'red', class: 'bg-red-400' },
  { id: 'green', class: 'bg-green-400' },
  { id: 'blue', class: 'bg-blue-400' },
  { id: 'yellow', class: 'bg-yellow-400' },
  { id: 'purple', class: 'bg-purple-400' },
]
</script>

<template>
  <div v-if="store.isModalOpen && store.editingTask" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @mousedown.self="store.closeModal">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ store.editingTask.isNew ? 'Create New Task' : 'Edit Task' }}</h3>
        <button @click="store.closeModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
      </div>

      <div class="p-6 overflow-y-auto flex-1 space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
          <input v-model="store.editingTask.title" type="text" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" placeholder="What needs to be done?" autofocus>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignees</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="user in store.assignees" :key="user.id" @click="toggleAssignee(user.id)" :class="['flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200', store.editingTask.assigneeIds.includes(user.id) ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/40 dark:border-blue-400 dark:text-blue-300 shadow-sm' : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 opacity-60 hover:opacity-100']">
                <div v-if="user.avatar" class="w-5 h-5 rounded-full overflow-hidden shrink-0"><img :src="user.avatar" class="w-full h-full object-cover" /></div>
                <div v-else class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" :style="{ backgroundColor: user.color }">{{ user.initials }}</div>
                {{ user.name }}
              </button>
            </div>
          </div>

          <div>
             <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Task Color</label>
             <div class="flex flex-wrap gap-2">
                <button
                  v-for="color in taskColors" :key="color.id"
                  @click="store.editingTask.color = color.id"
                  :class="['w-8 h-8 rounded-full border-2 transition-transform', color.class, store.editingTask.color === color.id ? 'border-gray-900 dark:border-white scale-110 shadow-md' : 'border-transparent hover:scale-105 opacity-70']"
                  :title="color.id"
                ></button>
             </div>
          </div>
        </div>

        <div>
          <div class="flex justify-between items-end mb-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <div class="flex text-xs border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <button @click="descTab = 'edit'" :class="['px-3 py-1', descTab === 'edit' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Edit</button>
              <button @click="descTab = 'preview'" :class="['px-3 py-1', descTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Preview</button>
            </div>
          </div>
          <textarea v-if="descTab === 'edit'" v-model="store.editingTask.description" rows="5" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 border resize-y" placeholder="Add details, markdown supported..."></textarea>
          <div v-else class="prose prose-sm dark:prose-invert max-w-none p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-md min-h-[120px] bg-gray-50 dark:bg-black/20" v-html="renderMarkdown(store.editingTask.description)"></div>
        </div>

        <div>
           <div class="flex justify-between items-center mb-2">
             <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Checklist</label>
             <button @click="addSubtask" class="text-xs text-blue-600 hover:underline flex items-center gap-1"><PlusIcon class="w-3 h-3"/> Add Item</button>
           </div>
           <div class="space-y-2">
             <div v-for="(subtask, idx) in store.editingTask.subtasks" :key="idx" class="flex items-center gap-2">
               <input type="checkbox" v-model="subtask.done" class="rounded text-blue-600 w-4 h-4 cursor-pointer border-gray-300 dark:border-gray-600 dark:bg-gray-700">
               <input type="text" v-model="subtask.title" :class="['flex-1 text-sm border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600 bg-transparent outline-none transition-all', subtask.done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200']" placeholder="To do item...">
               <button @click="removeSubtask(idx)" class="text-gray-400 hover:text-red-500"><TrashIcon class="w-4 h-4" /></button>
             </div>
           </div>
        </div>

        <div :class="{'bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800': isArchiveColumn}">
          <div class="flex justify-between items-end mb-1">
            <label class="block text-sm font-medium" :class="isArchiveColumn ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'">Closing Comment / Links <span v-if="isArchiveColumn">(Required for Archive)</span></label>
            <div class="flex text-xs border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <button @click="commentTab = 'edit'" :class="['px-3 py-1', commentTab === 'edit' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Edit</button>
              <button @click="commentTab = 'preview'" :class="['px-3 py-1', commentTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700']">Preview</button>
            </div>
          </div>
          <textarea v-if="commentTab === 'edit'" v-model="store.editingTask.closingComment" rows="2" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 border resize-y" placeholder="Links to docs, PRs, or final notes..."></textarea>
          <div v-else class="prose prose-sm dark:prose-invert max-w-none p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-md min-h-[50px] bg-white/50 dark:bg-black/20" v-html="renderMarkdown(store.editingTask.closingComment)"></div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
        <button v-if="!store.editingTask.isNew" @click="remove" class="text-red-600 hover:text-red-700 font-medium text-sm px-4 py-2">Delete Task</button>
        <div v-else></div>
        <div class="flex gap-3">
          <button @click="store.closeModal" class="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium text-sm px-4 py-2 rounded-md transition-colors">Cancel</button>
          <button @click="save" class="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-6 py-2 rounded-md shadow-sm transition-colors disabled:opacity-50" :disabled="!store.editingTask.title.trim()">Save</button>
        </div>
      </div>

    </div>
  </div>
</template>