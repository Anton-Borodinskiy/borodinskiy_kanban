<script setup>
import { useBoardStore } from '../stores/boardStore'
import { ref, computed } from 'vue'
import { MagnifyingGlassIcon, ArrowUturnLeftIcon, TrashIcon, ArrowsUpDownIcon } from '@heroicons/vue/24/outline'

const store = useBoardStore()
const search = ref('')
const sortBy = ref('date_desc')
const itemsPerPage = ref(50)
const currentPage = ref(1)

const filteredAndSorted = computed(() => {
  let result = [...store.archivedTasks]

  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(t => t.title.toLowerCase().includes(q) || (t.closingComment && t.closingComment.toLowerCase().includes(q)))
  }

  result.sort((a, b) => {
    if (sortBy.value === 'date_desc') return new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0)
    if (sortBy.value === 'date_asc') return new Date(a.archivedAt || 0) - new Date(b.archivedAt || 0)
    if (sortBy.value === 'title_asc') return a.title.localeCompare(b.title)
    return 0
  })

  return result
})

const totalPages = computed(() => Math.ceil(filteredAndSorted.value.length / itemsPerPage.value) || 1)

const paginatedTasks = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredAndSorted.value.slice(start, start + itemsPerPage.value)
})

const formatDate = (isoString) => {
  if (!isoString) return '-'
  const d = new Date(isoString)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getBoardName = (boardId) => {
  const board = store.boards.find(b => b.id === boardId)
  return board ? board.title : 'Board deleted'
}

const restore = (id) => store.unarchiveTask(id)
const remove = (id) => { if(confirm('Permanently delete this task?')) store.deleteTask(id) }
</script>

<template>
  <div class="p-8 max-w-6xl mx-auto w-full h-full flex flex-col">
    <div class="flex justify-between items-end mb-6 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Global Archive</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Total tasks: {{ filteredAndSorted.length }}</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="relative flex items-center">
          <MagnifyingGlassIcon class="w-4 h-4 text-gray-400 absolute left-3" />
          <input v-model="search" type="text" placeholder="Search archive..." class="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 w-64 dark:text-white">
        </div>

        <div class="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 gap-2">
          <ArrowsUpDownIcon class="w-4 h-4 text-gray-500" />
          <select v-model="sortBy" class="bg-transparent border-none text-sm outline-none cursor-pointer dark:text-white">
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="title_asc">Title A-Z</option>
          </select>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col">
      <table class="w-full text-left border-collapse flex-1">
        <thead class="sticky top-0 bg-gray-50 dark:bg-gray-900/90 backdrop-blur z-10 shadow-sm">
          <tr class="border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <th class="p-4 w-1/3">Task Title</th>
            <th class="p-4 w-1/6">Origin Board</th>
            <th class="p-4 w-1/6">Date Archived</th>
            <th class="p-4 w-1/4">Closing Comment</th>
            <th class="p-4 w-24 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in paginatedTasks" :key="task.id" class="border-b last:border-0 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <td class="p-4 font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600" @click="store.openEditTaskModal(task)">{{ task.title }}</td>
            <td class="p-4 text-sm text-gray-500 dark:text-gray-400">
              <span :class="['px-2 py-1 rounded text-xs font-semibold', getBoardName(task.originalBoardId) === 'Board deleted' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300']">
                {{ getBoardName(task.originalBoardId) }}
              </span>
            </td>
            <td class="p-4 text-sm text-gray-500 dark:text-gray-400">{{ formatDate(task.archivedAt) }}</td>
            <td class="p-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]" :title="task.closingComment">{{ task.closingComment || '-' }}</td>
            <td class="p-4 flex justify-end gap-2">
              <button @click="restore(task.id)" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Restore to current Active Board"><ArrowUturnLeftIcon class="w-4 h-4" /></button>
              <button @click="remove(task.id)" class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete Permanently"><TrashIcon class="w-4 h-4" /></button>
            </td>
          </tr>
          <tr v-if="paginatedTasks.length === 0">
            <td colspan="5" class="p-8 text-center text-gray-500 dark:text-gray-400">No archived tasks found.</td>
          </tr>
        </tbody>
      </table>

      <div class="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Show:</span>
          <select v-model="itemsPerPage" @change="currentPage = 1" class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 outline-none cursor-pointer">
            <option :value="10">10</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>

        <div class="flex gap-1">
          <button @click="currentPage--" :disabled="currentPage === 1" class="px-3 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">Prev</button>
          <span class="px-4 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">Page {{ currentPage }} of {{ totalPages }}</span>
          <button @click="currentPage++" :disabled="currentPage === totalPages" class="px-3 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">Next</button>
        </div>
      </div>

    </div>
  </div>
</template>