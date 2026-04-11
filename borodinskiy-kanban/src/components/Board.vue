<script setup>
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useBoardStore } from '../stores/boardStore'
import { PlusIcon, ArchiveBoxIcon, ViewColumnsIcon, ListBulletIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownOnSquareStackIcon } from '@heroicons/vue/24/outline'

const props = defineProps({ searchQuery: String, searchScope: String })
const store = useBoardStore()
const columnTasksCache = {}
const editingColId = ref(null)

DOMPurify.addHook('afterSanitizeAttributes', function(node) {
  if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});
const renderMarkdown = (text) => text ? DOMPurify.sanitize(marked.parse(text)) : ''
const getAssignee = (id) => store.assignees.find(a => a.id === id)

// Карта цветов для карточек
const colorClasses = {
  default: 'bg-white dark:bg-gray-700 border-transparent hover:border-blue-400',
  red: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 hover:border-red-400',
  green: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 hover:border-green-400',
  blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:border-blue-400',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 hover:border-yellow-400',
  purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 hover:border-purple-400',
}

const getTasks = (columnId) => {
  if (!columnTasksCache[columnId]) {
    columnTasksCache[columnId] = computed({
      get: () => {
        let tasks = store.tasks.filter(t => t.columnId === columnId && !t.isArchived).sort((a, b) => a.order - b.order)
        if (store.assigneeFilterIds.length > 0) { tasks = tasks.filter(t => t.assigneeIds && t.assigneeIds.some(id => store.assigneeFilterIds.includes(id))) }
        if (props.searchScope === 'current' && props.searchQuery.trim().length > 1) {
          const q = props.searchQuery.toLowerCase().trim()
          tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)) || (t.closingComment && t.closingComment.toLowerCase().includes(q)))
        }
        return tasks
      },
      set: (newTasks) => { newTasks.forEach((task, index) => { const storeTask = store.tasks.find(t => t.id === task.id); if (storeTask) { storeTask.columnId = columnId; storeTask.order = index } }) }
    })
  }
  return columnTasksCache[columnId]
}

const addNewColumn = async () => { const result = await store.requestDialog({ type: 'addColumn', title: 'Add New Column', confirmText: 'Add' }); if (result) store.addColumn(store.settings.activeBoardId, result.title, result.isArchive) }
const removeColumn = async (id) => { const confirmed = await store.requestDialog({ type: 'confirm', title: 'Delete Column', message: 'Delete column and ALL tasks? This cannot be undone.', confirmText: 'Delete', isDanger: true }); if (confirmed) store.deleteColumn(id) }
const setWipLimit = async (col) => { const result = await store.requestDialog({ type: 'prompt', title: 'Set WIP Limit', message: 'Enter max number of tasks (0 for no limit):', confirmText: 'Set Limit' }); if (result !== null) store.setColumnWip(col.id, result) }
const isSearchMatch = (task) => { if (!props.searchQuery || props.searchQuery.length < 2 || props.searchScope !== 'current') return false; const q = props.searchQuery.toLowerCase(); return task.title.toLowerCase().includes(q) || (task.description && task.description.toLowerCase().includes(q)); }

const clearArchiveColumn = async (columnId) => {
  const count = getTasks(columnId).value.length
  if (count === 0) return
  const confirmed = await store.requestDialog({ type: 'confirm', title: 'Clear Column', message: `Move ${count} tasks to the Global Archive? They will be removed from this board.`, confirmText: 'Archive' })
  if (confirmed) store.archiveAllInColumn(columnId)
}
</script>

<template>
  <div v-if="store.activeColumns.length === 0" class="h-full flex flex-col items-center justify-center text-center px-4">
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full">
      <ViewColumnsIcon class="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">This board is empty</h2>
      <button @click="addNewColumn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-colors">+ Create First Column</button>
    </div>
  </div>

  <div v-else class="flex flex-1 overflow-x-auto gap-6 p-6 items-start h-full">

    <div v-for="(column, index) in store.activeColumns" :key="column.id" :class="['flex-shrink-0 relative group/col-wrapper transition-all duration-300', column.width]">

      <button @click="store.moveColumn(column.id, -1)" class="absolute -left-5 top-1/2 -translate-y-1/2 w-5 py-4 flex flex-col justify-center items-center opacity-0 group-hover/col-wrapper:opacity-100 hover:bg-blue-500 hover:text-white rounded-l-lg bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 transition-all z-10 disabled:opacity-0" :disabled="index === 0"><ChevronLeftIcon class="w-4 h-4" /></button>
      <button @click="store.moveColumn(column.id, 1)" class="absolute -right-5 top-1/2 -translate-y-1/2 w-5 py-4 flex flex-col justify-center items-center opacity-0 group-hover/col-wrapper:opacity-100 hover:bg-blue-500 hover:text-white rounded-r-lg bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 transition-all z-10 disabled:opacity-0" :disabled="index === store.activeColumns.length - 1"><ChevronRightIcon class="w-4 h-4" /></button>

      <div :class="['flex-1 flex flex-col bg-gray-200 dark:bg-gray-800 rounded-xl max-h-full shadow-sm border-2', (column.wipLimit > 0 && getTasks(column.id).value.length > column.wipLimit) ? 'border-red-400 dark:border-red-600' : 'border-transparent']">

        <div class="p-4 font-semibold text-gray-700 dark:text-gray-200 flex justify-between items-center group">
          <div class="flex items-center gap-2 overflow-hidden flex-1 mr-2">
            <input v-if="editingColId === column.id" v-model="column.title" @blur="editingColId = null" @keyup.enter="editingColId = null" class="bg-white dark:bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-sm w-full outline-none focus:ring-0" autofocus>
            <span v-else @click="editingColId = column.id" class="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate">{{ column.title }}</span>
            <span :class="['text-xs px-2 py-0.5 rounded-full shrink-0', (column.wipLimit > 0 && getTasks(column.id).value.length > column.wipLimit) ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300']">{{ getTasks(column.id).value.length }}<span v-if="column.wipLimit > 0">/{{column.wipLimit}}</span></span>
          </div>

          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
             <button v-if="column.isArchive" @click="clearArchiveColumn(column.id)" class="w-5 h-5 bg-indigo-100 hover:bg-indigo-500 dark:bg-indigo-900/50 hover:text-white text-indigo-600 dark:text-indigo-400 rounded text-[10px] flex items-center justify-center font-bold transition-colors" title="Move All Tasks to Archive"><ArrowDownOnSquareStackIcon class="w-3 h-3"/></button>
             <button @click="setWipLimit(column)" class="w-5 h-5 bg-gray-300 hover:bg-orange-500 dark:bg-gray-600 hover:text-white rounded text-[10px] flex items-center justify-center font-bold transition-colors">W</button>
             <button @click="store.toggleColumnArchive(column.id)" :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', column.isArchive ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600']"><ArchiveBoxIcon class="w-3 h-3" /></button>
             <div class="w-px h-3 bg-gray-400 mx-0.5"></div>
             <button @click="store.updateColumn(column.id, { width: 'w-72' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 hover:text-white rounded text-[10px] flex items-center justify-center font-bold transition-colors">S</button>
             <button @click="store.updateColumn(column.id, { width: 'w-80' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 hover:text-white rounded text-[10px] flex items-center justify-center font-bold transition-colors">M</button>
             <button @click="store.updateColumn(column.id, { width: 'w-96' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 hover:text-white rounded text-[10px] flex items-center justify-center font-bold transition-colors">L</button>
             <button @click="removeColumn(column.id)" class="ml-0.5 text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
          </div>
        </div>

        <VueDraggable v-model="getTasks(column.id).value" group="tasks" class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[50px]" ghostClass="opacity-50" :animation="150">
          <div v-for="task in getTasks(column.id).value" :key="task.id" :id="`task-${task.id}`" @click="store.openEditTaskModal(task)" :class="['p-4 rounded-lg shadow-sm cursor-pointer border-2 transition-all duration-300 relative group/card', colorClasses[task.color || 'default'], store.highlightedTaskId === task.id ? '!border-yellow-400 ring-4 ring-yellow-400/30 scale-[1.02] z-10' : '', isSearchMatch(task) ? '!border-blue-400 ring-4 ring-blue-400/30' : '']">

            <div class="flex justify-between items-start mb-2 gap-2">
              <h4 class="font-medium text-gray-900 dark:text-white text-sm leading-snug">{{ task.title }}</h4>
              <div v-if="task.assigneeIds?.length > 0" class="shrink-0 flex -space-x-2 pt-1 pr-1">
                <div v-for="assigneeId in task.assigneeIds" :key="assigneeId" :title="getAssignee(assigneeId)?.name" class="w-7 h-7 rounded-full overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm relative z-10 hover:z-20 transition-transform hover:scale-110 bg-white">
                  <img v-if="getAssignee(assigneeId)?.avatar" :src="getAssignee(assigneeId).avatar" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white" :style="{ backgroundColor: getAssignee(assigneeId)?.color || '#999' }">{{ getAssignee(assigneeId)?.initials }}</div>
                </div>
              </div>
            </div>

            <div v-if="task.description" class="mt-2 text-[11px] leading-tight text-gray-500 dark:text-gray-300 italic line-clamp-2 border-l-2 border-gray-400/50 dark:border-gray-500 pl-2">{{ task.description }}</div>

            <div v-if="task.subtasks?.length" class="mt-3 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 font-medium">
               <ListBulletIcon class="w-4 h-4" />
               <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
            </div>

            <div v-if="column.isArchive && task.closingComment" class="mt-3 p-2 bg-white/50 dark:bg-black/20 border border-gray-300/50 dark:border-gray-600/50 rounded text-xs prose prose-sm prose-p:my-0 prose-a:text-blue-600 dark:prose-a:text-blue-400 max-w-none text-gray-800 dark:text-gray-200" v-html="renderMarkdown(task.closingComment)" @click.stop></div>
          </div>
        </VueDraggable>

        <button @click="store.openNewTaskModal(column.id)" class="m-3 p-2 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition-all"><PlusIcon class="w-4 h-4" /> Add Task</button>
      </div>
    </div>

    <button @click="addNewColumn" class="flex-shrink-0 w-80 bg-gray-200/50 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 transition-colors">+ Add Column</button>
  </div>
</template>