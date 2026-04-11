<script setup>
import { onMounted, ref, watch } from 'vue'
import { useBoardStore } from './stores/boardStore'
import Board from './components/Board.vue'
import TaskModal from './components/TaskModal.vue'
import GlobalDialog from './components/GlobalDialog.vue'
import SettingsModal from './components/SettingsModal.vue' // ДОБАВЛЕНО
import { MagnifyingGlassIcon, SunIcon, MoonIcon, PlusIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline' // ДОБАВЛЕНО

const store = useBoardStore()
const searchQuery = ref('')
const searchScope = ref('current')

const toggleTheme = () => {
  store.settings.theme = store.settings.theme === 'dark' ? 'light' : 'dark'
  applyTheme()
}

const applyTheme = () => {
  const isDark = store.settings.theme === 'dark' || (store.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark) document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}

// Используем наш новый красивый диалог вместо prompt()
const createNewBoard = async () => {
  const title = await store.requestDialog({
    type: 'prompt',
    title: 'Create New Board',
    message: 'Enter a title for your new workspace:',
    confirmText: 'Create'
  })
  if (title) store.addBoard(title)
}

onMounted(() => {
  store.loadData()
  store.$subscribe(() => store.saveData())
  watch(() => store.settings.theme, applyTheme)
  setTimeout(applyTheme, 100)
})
</script>

<template>
  <div v-if="store.isLoaded" class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">
    <header class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-between items-center z-10">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
          Borodinskiy Kanban
        </h1>

        <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md pr-1">
          <select
            v-model="store.settings.activeBoardId"
            class="bg-transparent border-none text-sm py-1.5 pl-3 pr-8 focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-900 dark:text-white"
          >
            <option v-for="board in store.boards" :key="board.id" :value="board.id" class="text-gray-900 dark:text-white dark:bg-gray-800">
              {{ board.title }}
            </option>
          </select>
          <button @click="createNewBoard" class="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded transition-colors" title="Create New Board">
            <PlusIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
          <div class="pl-3 text-gray-400"><MagnifyingGlassIcon class="w-4 h-4" /></div>
          <input v-model="searchQuery" type="text" placeholder="Search tasks..." class="bg-transparent border-none text-sm py-1.5 px-3 w-48 focus:outline-none focus:ring-0 text-gray-900 dark:text-white">
          <select v-model="searchScope" class="bg-gray-200 dark:bg-gray-600 border-none text-xs py-1.5 pl-2 pr-6 focus:ring-0 cursor-pointer border-l border-gray-300 dark:border-gray-500 text-gray-700 dark:text-white">
            <option value="current" class="dark:bg-gray-700">Current Board</option>
            <option value="all" class="dark:bg-gray-700">All Boards</option>
          </select>
        </div>
        <button @click="toggleTheme" class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors" title="Toggle Theme">
          <MoonIcon v-if="store.settings.theme === 'light'" class="w-5 h-5" />
          <SunIcon v-else class="w-5 h-5" />
        </button>
        <button @click="store.openSettings" class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors" title="Workspace Settings">
          <Cog6ToothIcon class="w-5 h-5" />
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
    <p class="text-gray-500 dark:text-gray-400">Loading workspace...</p>
  </div>

  <TaskModal />
  <GlobalDialog />
  <SettingsModal />
</template>