<script setup>
import { computed, ref, reactive, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { renderMarkdown } from '../utils/markdown'
import { useBoardStore } from '../stores/boardStore'
import { PlusIcon, ArchiveBoxIcon, ListBulletIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownOnSquareStackIcon, CalendarDaysIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, LinkIcon  } from '@heroicons/vue/24/outline'

const props = defineProps({ searchQuery: String, searchScope: String })
defineEmits(['createBoard'])
const store = useBoardStore()
const columnTasksCache = {}
const editingColId = ref(null)
// Expanded checklist/links state lives in the store so the header "Expand all"
// button and the per-card chevrons operate on the same source of truth.
const expandedSubtasks = store.expandedSubtasks
const expandedLinks = store.expandedLinks

// Tracks which task descriptions actually overflow the 3-line clamp, so the
// "Show more" toggle only appears when there's hidden text. Measured while
// clamped; skipped when expanded so the value (and "Show less") persists.
const descOverflow = reactive({})
const measureClamp = (el, id) => {
  if (store.expandedDesc[id]) return
  descOverflow[id] = el.scrollHeight > el.clientHeight + 2
}
const vClamp = {
  mounted: (el, binding) => measureClamp(el, binding.value),
  updated: (el, binding) => measureClamp(el, binding.value)
}

const getAssignee = (id) => store.assignees.find(a => a.id === id)

const colorClasses = {
  default: 'bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 hover:border-blue-400',
  red: 'bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 border-red-200 dark:border-red-800 hover:border-red-400',
  green: 'bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 border-green-200 dark:border-green-800 hover:border-green-400',
  blue: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800 hover:border-blue-400',
  yellow: 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 border-yellow-200 dark:border-yellow-800 hover:border-yellow-400',
  purple: 'bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 border-violet-200 dark:border-violet-800 hover:border-violet-400',
}

const getDueDateInfo = (dateString, isArchive = false) => {
  if (!dateString) return null
  const due = new Date(dateString)

  // Если задача в архиве, просто показываем дату без проверки на просрочку
  if (isArchive) return { label: due.toLocaleDateString(), class: 'text-gray-500 dark:text-gray-400' }

  const now = new Date()
  const diff = due - now
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (diff < 0) return { label: 'Overdue', class: 'text-red-600 dark:text-red-400 font-bold' }
  if (days <= 2) return { label: 'Soon', class: 'text-orange-500 dark:text-orange-400 font-medium' }

  return { label: due.toLocaleDateString(), class: 'text-gray-500 dark:text-gray-400' }
}

// Single visibility predicate shared by the getter and the setter — they must
// agree, or reordering a filtered view corrupts the order of hidden tasks.
const isTaskVisible = (t) => {
  if (store.assigneeFilterIds.length > 0 && !t.assigneeIds?.some(id => store.assigneeFilterIds.includes(id))) return false
  if (props.searchScope === 'current' && props.searchQuery?.trim().length > 1) {
    const q = props.searchQuery.toLowerCase().trim()
    if (!(t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.closingComment?.toLowerCase().includes(q))) return false
  }
  return true
}
const columnTasks = (columnId) => store.tasks.filter(t => t.columnId === columnId && !t.isArchived).sort((a, b) => a.order - b.order)

const getTasks = (columnId) => {
  if (!columnTasksCache[columnId]) {
    columnTasksCache[columnId] = computed({
      get: () => columnTasks(columnId).filter(isTaskVisible),
      set: (newTasks) => {
        const all = columnTasks(columnId)
        const hidden = all.filter(t => !isTaskVisible(t))
        // Fast path: nothing is filtered out, so the visible order IS the order.
        if (hidden.length === 0) {
          newTasks.forEach((task, index) => { const t = store.tasks.find(x => x.id === task.id); if (t) { t.columnId = columnId; t.order = index } })
          return
        }
        // Filtered view: drop the reordered visible tasks back into the slots the
        // visible tasks previously occupied, leaving hidden tasks where they were.
        const queue = [...newTasks]
        const result = []
        all.forEach(t => {
          if (isTaskVisible(t)) { const next = queue.shift(); if (next) result.push(next) }
          else result.push(t)
        })
        result.push(...queue) // tasks dragged in from another column
        result.forEach((task, index) => {
          const t = store.tasks.find(x => x.id === task.id)
          if (t) { t.columnId = columnId; t.order = index }
        })
      }
    })
  }
  return columnTasksCache[columnId]
}
// Unfiltered active count — used for the WIP badge/border so turning on a filter
// doesn't make an over-limit column look fine.
const columnCount = (columnId) => columnTasks(columnId).length

// Звуковое уведомление (синтезируется браузером)
const playDing = () => {
  if (!store.settings.isSoundEnabled) return
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const osc = audioCtx.createOscillator(); const gainNode = audioCtx.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1)
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3)
    osc.connect(gainNode); gainNode.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.3)
  } catch(e) {}
}
// A card dropped into a Done/archive column is closed (and reopened when moved
// back out) — previously the only reaction was the sound.
const handleAdd = (evt, col) => {
  if (col.isArchive) playDing()
  const id = evt?.item?.id?.replace(/^task-/, '')
  if (id) store.syncClosedAt(id)
}

const toggleArchiveTask = async (task) => { const confirmed = await store.requestDialog({ type: 'confirm', title: 'Archive Task', message: 'Move this task to the Global Archive?', confirmText: 'Archive' }); if (confirmed) store.archiveTask(task.id) }
const addNewColumn = async () => { const result = await store.requestDialog({ type: 'addColumn', title: 'Add New Column', confirmText: 'Add' }); if (result) store.addColumn(store.settings.activeBoardId, result.title, result.isArchive) }
const removeColumn = async (id) => { const confirmed = await store.requestDialog({ type: 'confirm', title: 'Delete Column', message: 'Delete this column and its active tasks? Archived tasks are kept in the Global Archive.', confirmText: 'Delete', isDanger: true }); if (confirmed) store.deleteColumn(id) }
// Cancel resolves to `false` (never null), so the old `!== null` guard let a
// cancel through and wiped the limit via parseInt(false) -> NaN -> 0.
const setWipLimit = async (col) => {
  const result = await store.requestDialog({ type: 'prompt', title: 'Set WIP Limit', message: 'Enter max number of tasks (0 for no limit):', confirmText: 'Set Limit', inputValue: String(col.wipLimit || 0) })
  if (result === false || result === null) return
  store.setColumnWip(col.id, result)
}
// Count the tasks that will actually be archived (all active ones), not just the
// ones currently visible through a filter.
const clearArchiveColumn = async (columnId) => {
  const count = columnCount(columnId)
  if (count === 0) return
  const confirmed = await store.requestDialog({ type: 'confirm', title: 'Clear Column', message: `Move ${count} tasks to the Global Archive?`, confirmText: 'Archive' })
  if (confirmed) store.archiveAllInColumn(columnId)
}

const isSearchMatch = (task) => {
  if (!props.searchQuery || props.searchQuery.trim().length < 2 || props.searchScope !== 'current') return false;
  const q = props.searchQuery.toLowerCase().trim();
  return task.title?.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q) || task.closingComment?.toLowerCase().includes(q);
}

// Логика Drop-зон
const dropzoneDeleteTasks = ref([])
const dropzoneArchiveTasks = ref([])
watch(dropzoneDeleteTasks, (newVal) => { if(newVal.length > 0) { store.deleteTask(newVal[0].id); dropzoneDeleteTasks.value = [] } })
watch(dropzoneArchiveTasks, (newVal) => { if(newVal.length > 0) { store.archiveTask(newVal[0].id); dropzoneArchiveTasks.value = [] } })
</script>

<template>
  <div v-if="store.activeColumns.length === 0" class="h-full flex flex-col items-center justify-center text-center px-4">
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full">
      <!-- With no board at all, creating a column would silently produce an
           orphan (boardId: null) that no view can ever show. -->
      <template v-if="!store.settings.activeBoardId">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">No boards yet</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Create a board to start adding columns and tasks.</p>
        <button @click="$emit('createBoard')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-colors">+ Create Board</button>
      </template>
      <template v-else>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">This board is empty</h2>
        <button @click="addNewColumn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-colors">+ Create First Column</button>
      </template>
    </div>
  </div>

  <div v-else class="flex flex-1 overflow-x-auto gap-8 p-6 items-start h-full">
    <div v-for="(column, index) in store.activeColumns" :key="column.id" :class="['flex-shrink-0 relative group/col-wrapper transition-all duration-300', column.width]">

      <button v-if="!store.isColumnsLocked" @click="store.moveColumn(column.id, -1)" class="absolute -left-6 top-[5%] bottom-[5%] w-6 flex items-center justify-center opacity-0 group-hover/col-wrapper:opacity-100 hover:bg-blue-500/10 dark:hover:bg-blue-400/10 text-gray-400 hover:text-blue-600 rounded-l-xl transition-all z-10 disabled:hidden" :disabled="index === 0"><ChevronLeftIcon class="w-5 h-5" /></button>
      <button v-if="!store.isColumnsLocked" @click="store.moveColumn(column.id, 1)" class="absolute -right-6 top-[5%] bottom-[5%] w-6 flex items-center justify-center opacity-0 group-hover/col-wrapper:opacity-100 hover:bg-blue-500/10 dark:hover:bg-blue-400/10 text-gray-400 hover:text-blue-600 rounded-r-xl transition-all z-10 disabled:hidden" :disabled="index === store.activeColumns.length - 1"><ChevronRightIcon class="w-5 h-5" /></button>

      <div :class="['flex-1 flex flex-col bg-gray-200/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl max-h-full shadow-sm border-2 transition-colors', (column.wipLimit > 0 && columnCount(column.id) > column.wipLimit) ? 'border-red-400' : 'border-transparent']">

        <div class="p-4 flex justify-between items-center group">
          <div class="flex items-center gap-2 overflow-hidden flex-1">
            <input v-if="editingColId === column.id" v-model="column.title" @blur="editingColId = null" @keyup.enter="editingColId = null" class="bg-white dark:bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-sm w-full outline-none" autofocus>
            <span v-else @click="editingColId = column.id" class="font-bold text-gray-700 dark:text-gray-200 cursor-pointer truncate">{{ column.title }}</span>
            <span :class="['text-xs px-2 py-0.5 rounded-full shrink-0', (column.wipLimit > 0 && columnCount(column.id) > column.wipLimit) ? 'bg-red-500 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400']">{{ columnCount(column.id) }}</span>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
             <button v-if="column.isArchive" @click="clearArchiveColumn(column.id)" class="w-5 h-5 text-indigo-500 hover:text-indigo-700" title="Archive All" aria-label="Archive all tasks in this column"><ArrowDownOnSquareStackIcon class="w-4 h-4"/></button>
             <button @click="store.toggleColumnArchive(column.id)" :class="['w-5 h-5 flex items-center justify-center transition-colors', column.isArchive ? 'text-green-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300']" :title="column.isArchive ? 'Unmark as Done column' : 'Mark as Done column'" :aria-label="column.isArchive ? 'Unmark as Done column' : 'Mark as Done column'"><ArchiveBoxIcon class="w-4 h-4" /></button>
             <button @click="setWipLimit(column)" :class="['w-5 h-5 text-[10px] font-bold', column.wipLimit > 0 ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500']" :title="column.wipLimit > 0 ? `WIP limit: ${column.wipLimit}` : 'Set WIP limit'" aria-label="Set WIP limit">{{ column.wipLimit > 0 ? column.wipLimit : '∞' }}</button>
             <button @click="store.updateColumn(column.id, { width: 'w-72' })" class="w-5 h-5 text-xs font-bold text-gray-400 hover:text-blue-500" title="Narrow column" aria-label="Narrow column">S</button>
             <button @click="store.updateColumn(column.id, { width: 'w-80' })" class="w-5 h-5 text-xs font-bold text-gray-400 hover:text-blue-500" title="Medium column" aria-label="Medium column">M</button>
             <button @click="store.updateColumn(column.id, { width: 'w-96' })" class="w-5 h-5 text-xs font-bold text-gray-400 hover:text-blue-500" title="Wide column" aria-label="Wide column">L</button>
             <button @click="removeColumn(column.id)" class="w-5 h-5 text-gray-400 hover:text-red-500" title="Delete column" aria-label="Delete column"><TrashIcon class="w-4 h-4" /></button>
          </div>
        </div>

        <VueDraggable v-model="getTasks(column.id).value" group="tasks" @start="store.isDraggingTask = true" @end="store.isDraggingTask = false" @add="(e) => handleAdd(e, column)" class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[100px]" ghostClass="opacity-40" :animation="150">
          <div v-for="task in getTasks(column.id).value" :key="task.id" :id="`task-${task.id}`" @click="store.openEditTaskModal(task)" tabindex="0" role="button" :aria-label="`Open task: ${task.title}`" @keydown.enter.prevent="store.openEditTaskModal(task)" @keydown.space.prevent="store.openEditTaskModal(task)" :class="['rounded-xl shadow-sm cursor-pointer border-2 transition-all relative group/card focus:outline-none focus:ring-2 focus:ring-blue-500', store.settings.isCompactMode ? 'p-3' : 'p-4', task.color && task.color.startsWith('#') ? 'bg-white dark:bg-gray-700 border-transparent hover:border-blue-400' : colorClasses[task.color || 'default'], store.highlightedTaskId === task.id ? '!border-yellow-400 ring-4 ring-yellow-400/30 scale-[1.02] z-10' : '', isSearchMatch(task) ? '!border-blue-400 ring-4 ring-blue-400/30' : '']" :style="task.color && task.color.startsWith('#') ? { backgroundColor: task.color, borderColor: 'rgba(0,0,0,0.1)' } : {}">

            <button v-if="column.isArchive" @click.stop="toggleArchiveTask(task)" class="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 focus:opacity-100 p-1 text-gray-400 hover:text-indigo-500 transition-opacity" title="Move to Global Archive" aria-label="Move to Global Archive"><ArchiveBoxIcon class="w-3.5 h-3.5" /></button>

            <div class="flex justify-between items-start pr-4">
              <h4 :class="['font-semibold text-gray-900 dark:text-white leading-snug', store.settings.isCompactMode ? 'text-xs' : 'text-sm mb-2']">{{ task.title }}</h4>
              <div v-if="task.assigneeIds?.length" class="flex -space-x-2 shrink-0 ml-2">
                <div v-for="id in task.assigneeIds" :key="id" class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden bg-gray-200">
                  <img v-if="getAssignee(id)?.avatar" :src="getAssignee(id).avatar" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-[9px] text-white font-bold" :style="{ backgroundColor: getAssignee(id)?.color }">{{ getAssignee(id)?.initials }}</div>
                </div>
              </div>
            </div>

            <template v-if="!store.settings.isCompactMode">
              <div v-if="task.dueDate" class="flex items-center gap-1.5 mb-2 text-[10px]" :class="getDueDateInfo(task.dueDate, column.isArchive).class">
                <CalendarDaysIcon class="w-3.5 h-3.5" /><span>{{ getDueDateInfo(task.dueDate, column.isArchive).label }}</span>
              </div>
              <div v-if="task.description" class="mb-2">
                <div v-clamp="task.id" :class="['text-[11px] text-gray-500 dark:text-gray-400 prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-headings:my-0.5 prose-headings:text-xs prose-ul:my-0 prose-ol:my-0 prose-li:my-0 prose-a:text-blue-600 prose-code:text-[10px]', store.expandedDesc[task.id] ? '' : 'line-clamp-3']" v-html="renderMarkdown(task.description)"></div>
                <button v-if="descOverflow[task.id] || store.expandedDesc[task.id]" @click.stop="store.toggleCardSection('desc', task.id)" class="text-[10px] font-bold text-blue-500 hover:text-blue-600 mt-0.5">
                  {{ store.expandedDesc[task.id] ? 'Show less' : 'Show more' }}
                </button>
              </div>

              <div v-if="task.subtasks?.length" class="mt-2 border-t border-gray-100 dark:border-gray-600/50 pt-2" @click.stop>
                 <button @click="expandedSubtasks[task.id] = !expandedSubtasks[task.id]" class="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-blue-500 transition-colors">
                    <ListBulletIcon class="w-4 h-4" /><span>{{ task.subtasks.filter(s => s.done).length }}/{{ task.subtasks.length }}</span>
                    <ChevronDownIcon v-if="!expandedSubtasks[task.id]" class="w-3 h-3" /><ChevronUpIcon v-else class="w-3 h-3" />
                 </button>
                 <div v-if="expandedSubtasks[task.id]" class="mt-2 space-y-1.5">
                    <div v-for="(sub, idx) in task.subtasks" :key="idx" @click="store.toggleSubtask(task.id, idx)" class="flex items-center gap-2 group/sub cursor-pointer">
                      <input type="checkbox" :checked="sub.done" class="w-3.5 h-3.5 rounded border-gray-300 pointer-events-none">
                      <span :class="['text-[11px] flex-1 truncate', sub.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200']">{{ sub.title || '...' }}</span>
                    </div>
                 </div>
              </div>
              <div v-if="task.links?.length" class="mt-2 border-t border-gray-100 dark:border-gray-600/50 pt-2" @click.stop>
                 <button @click="expandedLinks[task.id] = !expandedLinks[task.id]" class="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-blue-500 transition-colors">
                    <LinkIcon class="w-4 h-4" />
                    <span>{{ task.links.length }} {{ task.links.length === 1 ? 'Link' : 'Links' }}</span>
                    <ChevronDownIcon v-if="!expandedLinks[task.id]" class="w-3 h-3" />
                    <ChevronUpIcon v-else class="w-3 h-3" />
                 </button>

                 <div v-if="expandedLinks[task.id]" class="mt-2 space-y-1.5">
                    <div v-for="(link, idx) in task.links" :key="idx" class="flex items-center gap-2 group/link">
                      <LinkIcon class="w-3 h-3 text-gray-400 shrink-0" />
                      <a :href="link.url"
                         target="_blank"
                         rel="noopener noreferrer"
                         class="text-[11px] text-blue-600 hover:underline truncate flex-1"
                         :title="link.url">
                        {{ link.title || link.url }}
                      </a>
                    </div>
                 </div>
              </div>
              <div v-if="column.isArchive && task.closingComment" class="mt-3 p-2 bg-white/50 dark:bg-black/20 border border-gray-300/50 dark:border-gray-600/50 rounded text-xs prose prose-sm prose-p:my-0 prose-a:text-blue-600 max-w-none text-gray-800 dark:text-gray-200" v-html="renderMarkdown(task.closingComment)" @click.stop></div>
            </template>
          </div>
        </VueDraggable>

        <button @click="store.openNewTaskModal(column.id)" class="m-3 p-2 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-white/50 dark:hover:bg-white/5 rounded-xl transition-all"><PlusIcon class="w-4 h-4" /> Add Task</button>
      </div>
    </div>

    <button @click="addNewColumn" class="flex-shrink-0 w-80 bg-gray-200/90 dark:bg-gray-800/90 backdrop-blur text-gray-500 font-bold py-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 transition-all">+ Add Column</button>

    <div v-show="store.isDraggingTask" class="fixed bottom-0 left-0 w-full p-4 flex gap-4 justify-center pointer-events-none z-50">
      <VueDraggable v-model="dropzoneDeleteTasks" group="tasks" class="w-64 h-24 bg-red-500/90 backdrop-blur text-white rounded-2xl flex flex-col items-center justify-center border-2 border-red-600 shadow-2xl pointer-events-auto transform transition-transform hover:scale-105">
        <TrashIcon class="w-8 h-8 mb-1" />
        <span class="font-bold">Drop to Delete</span>
      </VueDraggable>
      <VueDraggable v-model="dropzoneArchiveTasks" group="tasks" class="w-64 h-24 bg-indigo-500/90 backdrop-blur text-white rounded-2xl flex flex-col items-center justify-center border-2 border-indigo-600 shadow-2xl pointer-events-auto transform transition-transform hover:scale-105">
        <ArchiveBoxIcon class="w-8 h-8 mb-1" />
        <span class="font-bold">Drop to Archive</span>
      </VueDraggable>
    </div>
  </div>
</template>