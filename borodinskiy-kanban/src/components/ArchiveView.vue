<script setup>
import { useBoardStore } from '../stores/boardStore'
import { ref, computed } from 'vue'
import { MagnifyingGlassIcon, ArrowUturnLeftIcon, TrashIcon } from '@heroicons/vue/24/outline'

const store = useBoardStore()
const search = ref('')

const filteredArchived = computed(() => {
  const q = search.value.toLowerCase()
  return store.archivedTasks.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.closingComment && t.closingComment.toLowerCase().includes(q))
  )
})

const restore = (id) => store.unarchiveTask(id)
const remove = (id) => { if(confirm('Permanently delete this task?')) store.deleteTask(id) }
</script>

<template>
  <div class="p-8 max-w-5xl mx-auto w-full h-full flex flex-col">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Board Archive</h2>

      <div class="relative flex items-center">
        <MagnifyingGlassIcon class="w-4 h-4 text-gray-400 absolute left-3" />
        <input v-model="search" type="text" placeholder="Search archive..." class="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 w-64 dark:text-white">
      </div>
    </div>

    <div v-if="filteredArchived.length === 0" class="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
       <ArchiveBoxIcon class="w-12 h-12 mb-2 opacity-50" />
       <p>No archived tasks found.</p>
    </div>

    <div v-else class="flex-1 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <th class="p-4">Task Title</th>
            <th class="p-4">Closing Comment</th>
            <th class="p-4 w-32 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in filteredArchived" :key="task.id" class="border-b last:border-0 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <td class="p-4 font-medium text-gray-900 dark:text-white cursor-pointer" @click="store.openEditTaskModal(task)">
              {{ task.title }}
            </td>
            <td class="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" :title="task.closingComment">
              {{ task.closingComment || '-' }}
            </td>
            <td class="p-4 flex justify-end gap-2">
              <button @click="restore(task.id)" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Restore to Board"><ArrowUturnLeftIcon class="w-4 h-4" /></button>
              <button @click="remove(task.id)" class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete Permanently"><TrashIcon class="w-4 h-4" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>