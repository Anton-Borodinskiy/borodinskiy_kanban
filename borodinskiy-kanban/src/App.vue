<script setup>
import { onMounted, ref, watch } from 'vue'
import { useBoardStore } from './stores/boardStore'
import Board from './components/Board.vue'
import { MagnifyingGlassIcon, SunIcon, MoonIcon } from '@heroicons/vue/24/outline'
import TaskModal from './components/TaskModal.vue'

const store = useBoardStore()
const searchQuery = ref('')
const searchScope = ref('current') // 'current' или 'all'

// Переключение темы
const toggleTheme = () => {
  store.settings.theme = store.settings.theme === 'dark' ? 'light' : 'dark'
  applyTheme()
}

const applyTheme = () => {
  const isDark = store.settings.theme === 'dark' ||
    (store.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

onMounted(() => {
  store.loadData()
  store.$subscribe(() => {
    store.saveData()
  })

  // Применяем тему после загрузки настроек
  watch(() => store.settings.theme, applyTheme)
  setTimeout(applyTheme, 100) // Страховочный таймаут для первой загрузки
})
</script>

<template>
  <div v-if="store.isLoaded" class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">

    <header class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-between items-center z-10">

      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
          Borodinskiy Kanban
        </h1>

        <select
          v-model="store.settings.activeBoardId"
          class="bg-gray-100 dark:bg-gray-700 border-none rounded-md text-sm py-1.5 pl-3 pr-8 focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option v-for="board in store.boards" :key="board.id" :value="board.id">
            {{ board.title }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-4">

        <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
          <div class="pl-3 text-gray-400">
            <MagnifyingGlassIcon class="w-4 h-4" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search tasks..."
            class="bg-transparent border-none text-sm py-1.5 px-3 w-48 focus:outline-none focus:ring-0"
          >
          <select
            v-model="searchScope"
            class="bg-gray-200 dark:bg-gray-600 border-none text-xs py-1.5 pl-2 pr-6 text-gray-600 dark:text-gray-300 focus:ring-0 cursor-pointer border-l border-gray-300 dark:border-gray-500"
          >
            <option value="current">Current Board</option>
            <option value="all">All Boards</option>
          </select>
        </div>

        <button
          @click="toggleTheme"
          class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
          title="Toggle Theme"
        >
          <MoonIcon v-if="store.settings.theme === 'light'" class="w-5 h-5" />
          <SunIcon v-else class="w-5 h-5" />
        </button>

        <button @click="store.openNewTaskModal" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded-md transition-colors shadow-sm">
          + New Task
        </button>

      </div>
    </header>

    <main class="flex-1 overflow-hidden">
      <Board />
    </main>

  </div>

  <div v-else class="h-screen flex justify-center items-center bg-gray-50 dark:bg-gray-900">
    <div class="animate-pulse flex flex-col items-center">
      <div class="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-gray-500 dark:text-gray-400">Loading workspace...</p>
    </div>
  </div>
<TaskModal />
</template>