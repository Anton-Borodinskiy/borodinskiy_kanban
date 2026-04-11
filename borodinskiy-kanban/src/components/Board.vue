<script setup>
import { computed, ref, reactive } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useBoardStore } from '../stores/boardStore'
import { PlusIcon, ArchiveBoxIcon, ListBulletIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownOnSquareStackIcon, CalendarDaysIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline'

const props = defineProps({ searchQuery: String, searchScope: String })
const store = useBoardStore()
const columnTasksCache = {}
const editingColId = ref(null)
const expandedSubtasks = reactive({})

DOMPurify.addHook('afterSanitizeAttributes', function(node) {
  if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});
const renderMarkdown = (text) => text ? DOMPurify.sanitize(marked.parse(text)) : ''
const getAssignee = (id) => store.assignees.find(a => a.id === id)

const colorClasses = {
  default: 'bg-white dark:bg-gray-700 border-transparent hover:border-blue-400',
  red: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 hover:border-red-400',
  green: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 hover:border-green-400',
  blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:border-blue-400',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 hover:border-yellow-400',
  purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 hover:border-purple-400',
}

const getDueDateInfo = (dateString) => {
  if (!dateString) return null
  const now = new Date(); const due = new Date(dateString); const diff = due - now
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: 'Overdue', class: 'text-red-600 dark:text-red-400 font-bold' }
  if (days <= 2) return { label: 'Soon', class: 'text-orange-500 dark:text-orange-400 font-medium' }
  return { label: new Date(dateString).toLocaleDateString(), class: 'text-gray-500 dark:text-gray-400' }
}

const getTasks = (columnId) => {
  if (!columnTasksCache[columnId]) {
    columnTasksCache[columnId] = computed({
      get: () => {
        let tasks = store.tasks.filter(t => t.columnId === columnId && !t.isArchived).sort((a, b) => a.order - b.order)
        if (store.assigneeFilterIds.length > 0) tasks = tasks.filter(t => t.assigneeIds?.some(id => store.assigneeFilterIds.includes(id)))
        if (props.searchScope === 'current' && props.searchQuery?.trim().length > 1) {
          const q = props.searchQuery.toLowerCase().trim()
          tasks = tasks.filter(t => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.closingComment?.toLowerCase().includes(q))
        }
        return tasks
      },
      set: (newTasks) => { newTasks.forEach((task, index) => { const t = store.tasks.find(x => x.id === task.id); if (t) { t.columnId = columnId; t.order = index } }) }
    })
  }
  return columnTasksCache[columnId]
}

const toggleArchiveTask = async (task) => {
  const confirmed = await store.requestDialog({ type: 'confirm', title: 'Archive Task', message: 'Move this task to the Global Archive?', confirmText: 'Archive' })
  if (confirmed) store.archiveTask(task.id)
}
const addNewColumn = async () => { const result = await store.requestDialog({ type: 'addColumn', title: 'Add New Column', confirmText: 'Add' }); if (result) store.addColumn(store.settings.activeBoardId, result.title, result.isArchive) }
const removeColumn = async (id) => { const confirmed = await store.requestDialog({ type: 'confirm', title: 'Delete Column', message: 'Delete column and ALL tasks? This cannot be undone.', confirmText: 'Delete', isDanger: true }); if (confirmed) store.deleteColumn(id) }
const setWipLimit = async (col) => { const result = await store.requestDialog({ type: 'prompt', title: 'Set WIP Limit', message: 'Enter max number of tasks (0 for no limit):', confirmText: 'Set Limit' }); if (result !== null) store.setColumnWip(col.id, result) }
const clearArchiveColumn = async (columnId) => { const count = getTasks(columnId).value.length; if (count === 0) return; const confirmed = await store.requestDialog({ type: 'confirm', title: 'Clear Column', message: `Move ${count} tasks to the Global Archive?`, confirmText: 'Archive' }); if (confirmed) store.archiveAllInColumn(columnId) }

// ИСПРАВЛЕНИЕ: Безопасный поиск для рамки
const isSearchMatch = (task) => {
  if (!props.searchQuery || props.searchQuery.trim().length < 2 || props.searchScope !== 'current') return false;
  const q = props.searchQuery.toLowerCase().trim();
  return task.title?.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q) || task.closingComment?.toLowerCase().includes(q);
}
</script>

<template>
  <div v-if="store.activeColumns.length === 0" class="h-full flex flex-col items-center justify-center text-center px-4">
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">This board is empty</h2>
      <button @click="addNewColumn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-colors">+ Create First Column</button>
    </div>
  </div>

  <div v-else class="flex flex-1 overflow-x-auto gap-8 p-6 items-start h-full">

    <div v-for="(column, index) in store.activeColumns" :key="column.id" :class="['flex-shrink-0 relative group/col-wrapper transition-all duration-300', column.width]">

      <button @click="store.moveColumn(column.id, -1)" class="absolute -left-6 top-[5%] bottom-[5%] w-6 flex items-center justify-center opacity-0 group-hover/col-wrapper:opacity-100 hover:bg-blue-500/10 dark:hover:bg-blue-400/10 text-gray-400 hover:text-blue-600 rounded-l-xl transition-all z-10 disabled:hidden" :disabled="index === 0"><ChevronLeftIcon class="w-5 h-5" /></button>
      <button @click="store.moveColumn(column.id, 1)" class="absolute -right-6 top-[5%] bottom-[5%] w-6 flex items-center justify-center opacity-0 group-hover/col-wrapper:opacity-100 hover:bg-blue-500/10 dark:hover:bg-blue-400/10 text-gray-400 hover:text-blue-600 rounded-r-xl transition-all z-10 disabled:hidden" :disabled="index === store.activeColumns.length - 1"><ChevronRightIcon class="w-5 h-5" /></button>

      <div :class="['flex-1 flex flex-col bg-gray-200 dark:bg-gray-800 rounded-2xl max-h-full shadow-sm border-2 transition-colors', (column.wipLimit > 0 && getTasks(column.id).value.length > column.wipLimit) ? 'border-red-400' : 'border-transparent']">

        <div class="p-4 flex justify-between items-center group">
          <div class="flex items-center gap-2 overflow-hidden flex-1">
            <input v-if="editingColId === column.id" v-model="column.title" @blur="editingColId = null" @keyup.enter="editingColId = null" class="bg-white dark:bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-sm w-full outline-none" autofocus>
            <span v-else @click="editingColId = column.id" class="font-bold text-gray-700 dark:text-gray-200 cursor-pointer truncate">{{ column.title }}</span>
            <span :class="['text-xs px-2 py-0.5 rounded-full shrink-0', (column.wipLimit > 0 && getTasks(column.id).value.length > column.wipLimit) ? 'bg-red-500 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400']">{{ getTasks(column.id).value.length }}</span>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
             <button v-if="column.isArchive" @click="clearArchiveColumn(column.id)" class="w-5 h-5 text-indigo-500 hover:text-indigo-700" title="Archive All"><ArrowDownOnSquareStackIcon class="w-4 h-4"/></button>
             <button @click="store.toggleColumnArchive(column.id)" :class="['w-5 h-5 flex items-center justify-center transition-colors', column.isArchive ? 'text-green-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300']"><ArchiveBoxIcon class="w-4 h-4" /></button>
             <button @click="store.updateColumn(column.id, { width: 'w-72' })" class="w-5 h-5 text-xs font-bold text-gray-400 hover:text-blue-500">S</button>
             <button @click="store.updateColumn(column.id, { width: 'w-80' })" class="w-5 h-5 text-xs font-bold text-gray-400 hover:text-blue-500">M</button>
             <button @click="store.updateColumn(column.id, { width: 'w-96' })" class="w-5 h-5 text-xs font-bold text-gray-400 hover:text-blue-500">L</button>
          </div>
        </div>

        <VueDraggable v-model="getTasks(column.id).value" group="tasks" class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[100px]" ghostClass="opacity-40" :animation="150">
          <div v-for="task in getTasks(column.id).value" :key="task.id" @click="store.openEditTaskModal(task)" :class="['p-4 rounded-xl shadow-sm cursor-pointer border-2 transition-all relative group/card', colorClasses[task.color || 'default'], store.highlightedTaskId === task.id ? '!border-yellow-400 ring-4 ring-yellow-400/30 scale-[1.02] z-10' : '', isSearchMatch(task) ? '!border-blue-400 ring-4 ring-blue-400/30' : '']">

            <button @click.stop="toggleArchiveTask(task)" class="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 p-1 text-gray-400 hover:text-indigo-500 transition-opacity"><ArchiveBoxIcon class="w-3.5 h-3.5" /></button>

            <div class="flex justify-between items-start mb-2 pr-4">
              <h4 class="font-semibold text-gray-900 dark:text-white text-sm">{{ task.title }}</h4>
              <div v-if="task.assigneeIds?.length" class="flex -space-x-2 shrink-0 ml-2">
                <div v-for="id in task.assigneeIds" :key="id" class="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden bg-gray-200">
                  <img v-if="getAssignee(id)?.avatar" :src="getAssignee(id).avatar" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-[9px] text-white font-bold" :style="{ backgroundColor: getAssignee(id)?.color }">{{ getAssignee(id)?.initials }}</div>
                </div>
              </div>
            </div>

            <div v-if="task.dueDate" class="flex items-center gap-1.5 mb-2 text-[10px]" :class="getDueDateInfo(task.dueDate).class">
               <CalendarDaysIcon class="w-3.5 h-3.5" />
               <span>{{ getDueDateInfo(task.dueDate).label }}</span>
            </div>

            <p v-if="task.description" class="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{{ task.description }}</p>

            <div v-if="task.subtasks?.length" class="mt-2 border-t border-gray-100 dark:border-gray-600 pt-2" @click.stop>
               <button @click="expandedSubtasks[task.id] = !expandedSubtasks[task.id]" class="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-blue-500 transition-colors">
                  <ListBulletIcon class="w-4 h-4" />
                  <span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                  <ChevronDownIcon v-if="!expandedSubtasks[task.id]" class="w-3 h-3" />
                  <ChevronUpIcon v-else class="w-3 h-3" />
               </button>

               <div v-if="expandedSubtasks[task.id]" class="mt-2 space-y-1.5">
                  <div v-for="(sub, idx) in task.subtasks" :key="idx" @click="store.toggleSubtask(task.id, idx)" class="flex items-center gap-2 group/sub">
                    <input type="checkbox" :checked="sub.done" class="w-3.5 h-3.5 rounded border-gray-300 pointer-events-none">
                    <span :class="['text-[11px] flex-1 truncate', sub.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200']">{{ sub.title || '...' }}</span>
                  </div>
               </div>
            </div>
          </div>
        </VueDraggable>

        <button @click="store.openNewTaskModal(column.id)" class="m-3 p-2 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-white/50 dark:hover:bg-white/5 rounded-xl transition-all"><PlusIcon class="w-4 h-4" /> Add Task</button>
      </div>
    </div>

    <button @click="addNewColumn" class="flex-shrink-0 w-80 bg-gray-200/50 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 font-bold py-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 transition-all">+ Add Column</button>
  </div>
</template>