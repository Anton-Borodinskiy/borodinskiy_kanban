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

const getTasks = (columnId) => {
  if (!columnTasksCache[columnId]) {
    columnTasksCache[columnId] = computed({
      get: () => {
        // ИСПРАВЛЕНИЕ: Фильтруем заархивированные задачи
        let tasks = store.tasks.filter(t => t.columnId === columnId && !t.isArchived).sort((a, b) => a.order - b.order)
        if (store.assigneeFilterIds.length > 0) {
          tasks = tasks.filter(t => t.assigneeIds && t.assigneeIds.some(id => store.assigneeFilterIds.includes(id)))
        }
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

// НОВОЕ: Очистка архивной колонки
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
      <p class="text-gray-500 dark:text-gray-400 mb-6">Create your first column to start organizing tasks.</p>
      <button @click="addNewColumn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-colors">+ Create First Column</button>
    </div>
  </div>

  <div v-else class="flex flex-1 overflow-x-auto gap-4 p-6 items-start h-full">

    <div v-for="(column, index) in store.activeColumns" :key="column.id" :class="['flex-shrink-0 flex group/col-wrapper transition-all duration-300', column.width]">

      <button @click="store.moveColumn(column.id, -1)" class="w-4 flex flex-col justify-center items-center opacity-0 group-hover/col-wrapper:opacity-100 hover:bg-blue-500 hover:text-white rounded-l-xl bg-gray-200/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 transition-all disabled:opacity-0" :disabled="index === 0"><ChevronLeftIcon class="w-3 h-3" /></button>

      <div :class="['flex-1 flex flex-col bg-gray-200 dark:bg-gray-800 max-h-full shadow-sm border-2', index === 0 ? 'rounded-r-xl' : index === store.activeColumns.length - 1 ? 'rounded-l-xl' : '', (column.wipLimit > 0 && getTasks(column.id).value.length > column.wipLimit) ? 'border-red-400 dark:border-red-600' : 'border-transparent']">

        <div class="p-4 font-semibold text-gray-700 dark:text-gray-200 flex justify-between items-center group">
          <div class="flex items-center gap-2 overflow-hidden flex-1 mr-2">
            <input v-if="editingColId === column.id" v-model="column.title" @blur="editingColId = null" @keyup.enter="editingColId = null" class="bg-white dark:bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-sm w-full outline-none focus:ring-0" autofocus>
            <span v-else @click="editingColId = column.id" class="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate" title="Click to rename">{{ column.title }}</span>
            <span :class="['text-xs px-2 py-0.5 rounded-full shrink-0', (column.wipLimit > 0 && getTasks(column.id).value.length > column.wipLimit) ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300']">
              {{ getTasks(column.id).value.length }}<span v-if="column.wipLimit > 0">/{{column.wipLimit}}</span>
            </span>
          </div>

          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
             <button v-if="column.isArchive" @click="clearArchiveColumn(column.id)" class="w-5 h-5 bg-indigo-100 hover:bg-indigo-500 dark:bg-indigo-900/50 hover:text-white text-indigo-600 dark:text-indigo-400 rounded text-[10px] flex items-center justify-center font-bold transition-colors" title="Move All Tasks to Global Archive"><ArrowDownOnSquareStackIcon class="w-3 h-3"/></button>

             <button @click="setWipLimit(column)" class="w-5 h-5 bg-gray-300 hover:bg-orange-500 dark:bg-gray-600 hover:text-white rounded text-[10px] flex items-center justify-center font-bold transition-colors" title="Set WIP Limit">W</button>
             <button @click="store.toggleColumnArchive(column.id)" :class="['w-5 h-5 rounded flex items-center justify-center transition-colors', column.isArchive ? 'bg-green-500 hover:bg-green-600 text-white shadow-inner' : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-600']" title="Toggle Archive Mode"><ArchiveBoxIcon class="w-3 h-3" /></button>
             <div class="w-px h-3 bg-gray-400 mx-0.5"></div>
             <button @click="store.updateColumn(column.id, { width: 'w-72' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 hover:text-white rounded text-[10px] flex items-center justify-center font-bold transition-colors">S</button>
             <button @click="store.updateColumn(column.id, { width: 'w-80' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 hover:text-white rounded text-[10px] flex items-center justify-center font-bold transition-colors">M</button>
             <button @click="store.updateColumn(column.id, { width: 'w-96' })" class="w-5 h-5 bg-gray-300 hover:bg-blue-500 dark:bg-gray-600 hover:text-white rounded text-[10px] flex items-center justify-center font-bold transition-colors">L</button>
             <button @click="removeColumn(column.id)" class="ml-0.5 text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
          </div>
        </div>

        <VueDraggable v-model="getTasks(column.id).value" group="tasks" class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[50px]" ghostClass="opacity-50" :animation="150">
          <div v-for="task in getTasks(column.id).value" :key="task.id" :id="`task-${task.id}`" @click="store.openEditTaskModal(task)" :class="['bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm cursor-pointer border-2 transition-all duration-300 relative group/card', store.highlightedTaskId === task.id ? 'border-yellow-400 ring-4 ring-yellow-400/30 scale-[1.02] z-10' : isSearchMatch(task) ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent hover:border-blue-300 dark:hover:border-blue-500']">

            <div v-if="task.tags?.length" class="flex flex-wrap gap-1 mb-2">
              <span v-for="(tag, idx) in task.tags" :key="idx" class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">{{ tag }}</span>
            </div>

            <div class="flex justify-between items-start mb-2 gap-2">
              <h4 class="font-medium text-gray-900 dark:text-white text-sm leading-snug">{{ task.title }}</h4>
              <div v-if="task.assigneeIds?.length > 0" class="shrink-0 flex -space-x-2 pt-1 pr-1">
                <div v-for="assigneeId in task.assigneeIds" :key="assigneeId" :title="getAssignee(assigneeId)?.name" class="w-7 h-7 rounded-full overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm relative z-10 hover:z-20 transition-transform hover:scale-110 bg-white">
                  <img v-if="getAssignee(assigneeId)?.avatar" :src="getAssignee(assigneeId).avatar" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white" :style="{ backgroundColor: getAssignee(assigneeId)?.color || '#999' }">{{ getAssignee(assigneeId)?.initials }}</div>
                </div>
              </div>
            </div>

            <div v-if="task.description" class="mt-2 text-[11px] leading-tight text-gray-500 dark:text-gray-400 italic line-clamp-2 border-l-2 border-gray-300 dark:border-gray-600 pl-2">{{ task.description }}</div>

            <div v-if="task.subtasks?.length" class="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
               <ListBulletIcon class="w-4 h-4" />
               <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
            </div>

            <div v-if="column.isArchive && task.closingComment" class="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-800 dark:text-green-300 prose prose-sm prose-p:my-0 prose-a:text-blue-600 dark:prose-a:text-blue-400 max-w-none" v-html="renderMarkdown(task.closingComment)" @click.stop></div>
          </div>
        </VueDraggable>

        <button @click="store.openNewTaskModal(column.id)" class="m-3 p-2 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-white/5 rounded-lg transition-all"><PlusIcon class="w-4 h-4" /> Add Task</button>
      </div>

      <button @click="store.moveColumn(column.id, 1)" class="w-4 flex flex-col justify-center items-center opacity-0 group-hover/col-wrapper:opacity-100 hover:bg-blue-500 hover:text-white rounded-r-xl bg-gray-200/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 transition-all disabled:opacity-0" :disabled="index === store.activeColumns.length - 1"><ChevronRightIcon class="w-3 h-3" /></button>

    </div>

    <button @click="addNewColumn" class="flex-shrink-0 w-80 bg-gray-200/50 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 transition-colors">+ Add Column</button>
  </div>
</template>