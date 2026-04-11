<script setup>
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useBoardStore } from '../stores/boardStore'
import { PlusIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  searchQuery: String,
  searchScope: String
})

const store = useBoardStore()
const columnTasksCache = {}

const renderMarkdown = (text) => {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text))
}

const getTasks = (columnId) => {
  if (!columnTasksCache[columnId]) {
    columnTasksCache[columnId] = computed({
      get: () => {
        let tasks = store.tasks.filter(t => t.columnId === columnId).sort((a, b) => a.order - b.order)

        // Локальная фильтрация поиска
        if (props.searchScope === 'current' && props.searchQuery.trim().length > 1) {
          const q = props.searchQuery.toLowerCase().trim()
          tasks = tasks.filter(t =>
            t.title.toLowerCase().includes(q) ||
            (t.description && t.description.toLowerCase().includes(q))
          )
        }
        return tasks
      },
      set: (newTasks) => {
        newTasks.forEach((task, index) => {
          const storeTask = store.tasks.find(t => t.id === task.id)
          if (storeTask) {
            storeTask.columnId = columnId
            storeTask.order = index
          }
        })
      }
    })
  }
  return columnTasksCache[columnId]
}

const getAssignee = (id) => store.assignees.find(a => a.id === id)

const addNewColumn = async () => {
  const result = await store.requestDialog({ type: 'addColumn', title: 'Add New Column', confirmText: 'Add' })
  if (result) store.addColumn(store.settings.activeBoardId, result.title, result.isArchive)
}

const removeColumn = async (id) => {
  const confirmed = await store.requestDialog({ type: 'confirm', title: 'Delete Column', message: 'Delete column and ALL tasks? This cannot be undone.', confirmText: 'Delete', isDanger: true })
  if (confirmed) store.deleteColumn(id)
}
</script>

<template>
  <div class="flex flex-1 overflow-x-auto gap-6 p-6 items-start h-full">

    <div v-for="column in store.activeColumns" :key="column.id" :class="['flex-shrink-0 flex flex-col bg-gray-200 dark:bg-gray-800 rounded-xl max-h-full transition-all duration-300 shadow-sm', column.width]">

      <div class="p-4 font-semibold text-gray-700 dark:text-gray-200 flex justify-between items-center group">
        <div class="flex items-center gap-2">
          <span>{{ column.title }}</span>
          <span class="text-xs bg-gray-300 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
            {{ getTasks(column.id).value.length }}
          </span>
        </div>
        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
           <button @click="store.updateColumn(column.id, { width: 'w-64' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 rounded text-[10px] flex items-center justify-center font-bold transition-colors">S</button>
           <button @click="store.updateColumn(column.id, { width: 'w-72' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 rounded text-[10px] flex items-center justify-center font-bold transition-colors">M</button>
           <button @click="store.updateColumn(column.id, { width: 'w-96' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 rounded text-[10px] flex items-center justify-center font-bold transition-colors">L</button>
           <button @click="removeColumn(column.id)" class="ml-1 text-gray-400 hover:text-red-500 text-lg">&times;</button>
        </div>
      </div>

      <VueDraggable v-model="getTasks(column.id).value" group="tasks" class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[50px]" ghostClass="opacity-50" :animation="150">
        <div v-for="task in getTasks(column.id).value" :key="task.id" @click="store.openEditTaskModal(task)" class="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm hover:shadow-md cursor-pointer border border-transparent hover:border-blue-500 transition-all duration-200">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-medium text-gray-900 dark:text-white text-sm leading-snug">{{ task.title }}</h4>

            <div v-if="task.assigneeId" class="shrink-0 ml-3">
              <div v-if="getAssignee(task.assigneeId)?.avatar" class="w-8 h-8 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm">
                <img :src="getAssignee(task.assigneeId).avatar" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm border-2 border-white dark:border-gray-800" :style="{ backgroundColor: getAssignee(task.assigneeId)?.color || '#999' }">
                {{ getAssignee(task.assigneeId)?.initials }}
              </div>
            </div>
          </div>
          <div v-if="column.isArchive && task.closingComment" class="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-800 dark:text-green-300 prose prose-sm prose-p:my-0 prose-a:text-blue-600 dark:prose-a:text-blue-400 max-w-none" v-html="renderMarkdown(task.closingComment)" @click.stop></div>
        </div>
      </VueDraggable>

      <button @click="store.openNewTaskModal(column.id)" class="m-3 p-2 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition-all">
        <PlusIcon class="w-4 h-4" /> Add Task
      </button>
    </div>

    <button @click="addNewColumn" class="flex-shrink-0 w-72 bg-gray-200/50 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 transition-colors">+ Add Column</button>

  </div>
</template>