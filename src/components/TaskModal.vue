<script setup>
import { useBoardStore } from '../stores/boardStore'
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import MarkdownEditor from './MarkdownEditor.vue'
import { TrashIcon, PlusIcon, LinkIcon, Bars2Icon } from '@heroicons/vue/24/outline'


const store = useBoardStore()
const customColor = ref('#ffffff')

watch(() => store.editingTask?.color, (newVal) => {
  if (newVal && newVal.startsWith('#')) customColor.value = newVal
}, { immediate: true })

const isArchiveColumn = computed(() => {
  if (!store.editingTask) return false
  const column = store.columns.find(c => c.id === store.editingTask.columnId)
  return column?.isArchive || false
})

const toggleAssignee = (id) => {
  if (!store.editingTask.assigneeIds) store.editingTask.assigneeIds = []
  const idx = store.editingTask.assigneeIds.indexOf(id)
  if (idx === -1) store.editingTask.assigneeIds.push(id)
  else store.editingTask.assigneeIds.splice(idx, 1)
}

const addSubtask = () => { store.editingTask.subtasks.push({ title: '', done: false }) }
const removeSubtask = (idx) => store.editingTask.subtasks.splice(idx, 1)
const save = () => {
  if (!store.editingTask.title.trim()) return
  // The label promises a closing comment is required in Done/Archive columns — enforce it.
  if (isArchiveColumn.value && !store.editingTask.closingComment?.trim()) {
    store.requestDialog({ type: 'confirm', title: 'Closing Comment Required', message: 'Please add a closing comment before saving a task in a Done/Archive column.', confirmText: 'Got it' })
    return
  }
  store.saveTask(store.editingTask)
}
const remove = async () => {
  const confirmed = await store.requestDialog({ type: 'confirm', title: 'Delete Task', message: 'Are you sure you want to delete this task? This cannot be undone.', confirmText: 'Delete', isDanger: true })
  if (confirmed) store.deleteTask(store.editingTask.id)
}

// Логика для добавления ссылок
const newLinkUrl = ref('')
const newLinkTitle = ref('')

const addLink = () => {
  if (!newLinkUrl.value.trim()) return
  let url = newLinkUrl.value.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url // авто-добавление протокола
  store.editingTask.links.push({ url, title: newLinkTitle.value.trim() || url })
  newLinkUrl.value = ''
  newLinkTitle.value = ''
}
const removeLink = (idx) => store.editingTask.links.splice(idx, 1)
// ИСПРАВЛЕНИЕ: Заменен purple на violet для гарантии компиляции
const taskColors = [
  { id: 'default', class: 'bg-gray-200 dark:bg-gray-600' },
  { id: 'red', class: 'bg-red-400' },
  { id: 'green', class: 'bg-green-400' },
  { id: 'blue', class: 'bg-blue-400' },
  { id: 'yellow', class: 'bg-yellow-400' },
  { id: 'purple', class: 'bg-violet-400' },
]

const handleCustomColor = (e) => { store.editingTask.color = e.target.value }
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
          <input v-model="store.editingTask.title" @keyup.enter="save" type="text" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border outline-none" placeholder="What needs to be done?" autofocus>
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

          <div class="flex flex-col justify-between">
             <div>
               <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Task Color</label>
               <div class="flex flex-wrap items-center gap-2 mb-4">
                  <button v-for="color in taskColors" :key="color.id" @click="store.editingTask.color = color.id" :class="['w-8 h-8 rounded-full border-2 transition-transform', color.class, store.editingTask.color === color.id ? 'border-gray-900 dark:border-white scale-110 shadow-md' : 'border-transparent hover:scale-105 opacity-70']" :title="color.id"></button>
                  <label class="w-8 h-8 rounded-full border-2 cursor-pointer shadow-sm transition-transform flex items-center justify-center relative overflow-hidden" :class="store.editingTask.color?.startsWith('#') ? 'border-gray-900 dark:border-white scale-110' : 'border-dashed border-gray-400 opacity-70 hover:scale-105'" title="Pick Custom Color" :style="{ background: store.editingTask.color?.startsWith('#') ? store.editingTask.color : 'conic-gradient(from 90deg, red, yellow, green, blue, purple, red)' }">
                     <input type="color" v-model="customColor" @input="handleCustomColor" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full">
                  </label>
               </div>
             </div>

             <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                <input v-model="store.editingTask.dueDate" type="date" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-2 border focus:ring-2 focus:ring-blue-500 cursor-pointer outline-none">
             </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <MarkdownEditor v-model="store.editingTask.description" :rows="5" placeholder="Add details..." min-height="120px" />
        </div>

        <div>
           <div class="flex justify-between items-center mb-2">
             <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Checklist</label>
             <button @click="addSubtask" class="text-xs text-blue-600 hover:underline flex items-center gap-1"><PlusIcon class="w-3 h-3"/> Add Item</button>
           </div>
           <VueDraggable v-model="store.editingTask.subtasks" handle=".subtask-handle" :animation="150" class="space-y-2">
             <div v-for="(subtask, idx) in store.editingTask.subtasks" :key="idx" class="flex items-center gap-2 group/sub">
               <button type="button" class="subtask-handle cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 shrink-0" title="Drag to reorder"><Bars2Icon class="w-4 h-4" /></button>
               <input type="checkbox" v-model="subtask.done" class="rounded text-blue-600 w-4 h-4 cursor-pointer border-gray-300 dark:border-gray-600 dark:bg-gray-700">
               <input type="text" v-model="subtask.title" :class="['flex-1 text-sm border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600 bg-transparent outline-none transition-all', subtask.done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200']" placeholder="To do item...">
               <button @click="removeSubtask(idx)" class="text-gray-400 hover:text-red-500 shrink-0"><TrashIcon class="w-4 h-4" /></button>
             </div>
           </VueDraggable>
        </div>
        <div>
           <div class="flex justify-between items-center mb-2">
             <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Attached Links</label>
           </div>
           <div class="space-y-2 mb-2">
             <div v-for="(link, idx) in store.editingTask.links" :key="idx" class="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded border border-gray-100 dark:border-gray-600">
               <LinkIcon class="w-4 h-4 text-gray-400 shrink-0" />
               <a :href="link.url" target="_blank" class="flex-1 text-sm text-blue-600 hover:underline truncate" :title="link.url">{{ link.title }}</a>
               <button @click="removeLink(idx)" class="text-gray-400 hover:text-red-500"><TrashIcon class="w-4 h-4" /></button>
             </div>
           </div>
           <div class="flex gap-2">
              <input type="text" v-model="newLinkTitle" placeholder="Title (e.g. Jira)" class="w-1/3 text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-1.5 border outline-none focus:border-blue-500">
              <input type="text" v-model="newLinkUrl" @keyup.enter="addLink" placeholder="https://..." class="flex-1 text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white p-1.5 border outline-none focus:border-blue-500">
              <button @click="addLink" class="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded text-sm font-medium flex items-center justify-center shrink-0"><PlusIcon class="w-4 h-4"/></button>
           </div>
        </div>
        <div :class="{'bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800': isArchiveColumn}">
          <label class="block text-sm font-medium mb-1" :class="isArchiveColumn ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'">Closing Comment <span v-if="isArchiveColumn">(Required)</span></label>
          <MarkdownEditor v-model="store.editingTask.closingComment" :rows="3" placeholder="Final notes..." min-height="60px" />
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
        <button v-if="!store.editingTask.isNew" @click="remove" class="text-red-600 hover:text-red-700 font-medium text-sm px-4 py-2">Delete</button>
        <div v-else></div>
        <div class="flex gap-3">
          <button @click="store.closeModal" class="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 font-medium text-sm px-4 py-2 rounded-md transition-colors">Cancel</button>
          <button @click="save" class="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-6 py-2 rounded-md shadow-sm disabled:opacity-50" :disabled="!store.editingTask.title.trim()">Save</button>
        </div>
      </div>

    </div>
  </div>
</template>