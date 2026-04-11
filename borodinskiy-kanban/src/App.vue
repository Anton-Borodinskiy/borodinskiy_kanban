<script setup>
import { onMounted, ref, computed } from 'vue'
import { useBoardStore } from './stores/boardStore'
import Board from './components/Board.vue'
import ArchiveView from './components/ArchiveView.vue'
import TaskModal from './components/TaskModal.vue'
import GlobalDialog from './components/GlobalDialog.vue'
import SettingsModal from './components/SettingsModal.vue'
import { MagnifyingGlassIcon, SunIcon, MoonIcon, PlusIcon, Cog6ToothIcon, ViewColumnsIcon, DocumentDuplicateIcon, PencilIcon, ChevronLeftIcon, ChevronRightIcon, UsersIcon, ArchiveBoxIcon } from '@heroicons/vue/24/outline'

const store = useBoardStore()
const searchQuery = ref('')
const searchScope = ref('current')
const isFilterOpen = ref(false)

const searchResults = computed(() => {
  if (searchScope.value === 'all' && searchQuery.value.length > 1) return store.searchTasks(searchQuery.value, 'all')
  return []
})

const navigateToTask = (task) => {
  const column = store.columns.find(c => c.id === task.columnId)
  if (column) {
    store.settings.activeBoardId = column.boardId
    store.currentView = 'board'
    searchQuery.value = ''
    setTimeout(() => {
      store.setHighlight(task.id)
      const el = document.getElementById(`task-${task.id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }
}

const createNewBoard = async () => { const title = await store.requestDialog({ type: 'prompt', title: 'Create New Board', message: 'Enter a title for your new workspace:', confirmText: 'Create' }); if (title) store.addBoard(title) }
const renameActiveBoard = async () => { const title = await store.requestDialog({ type: 'prompt', title: 'Rename Board', message: 'Enter new title:', confirmText: 'Rename' }); if (title) store.renameBoard(store.settings.activeBoardId, title) }

onMounted(() => {
  store.loadData()
  store.$subscribe(() => { if (store.isLoaded) store.saveData() })
})
</script>

<template>
  <div v-if="store.isLoaded" class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">
    <header class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-between items-center z-30">

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-3 cursor-pointer" @click="store.currentView = 'board'" title="Go to Board">
          <div class="bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 rounded-lg shadow-sm"><ViewColumnsIcon class="w-5 h-5 text-white" /></div>
          <h1 class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white hidden sm:block">Borodinskiy <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Kanban</span></h1>
        </div>

        <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md pr-1 ml-2 border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-500 transition-colors">
          <button @click="store.moveBoard(store.settings.activeBoardId, -1)" class="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><ChevronLeftIcon class="w-4 h-4" /></button>
          <select v-model="store.settings.activeBoardId" class="bg-transparent border-none text-sm py-1.5 px-1 w-48 sm:w-64 focus:outline-none focus:ring-0 outline-none cursor-pointer text-gray-900 dark:text-white font-medium truncate">
            <option v-for="board in store.boards" :key="board.id" :value="board.id" class="dark:bg-gray-800">{{ board.title }}</option>
          </select>
          <button @click="store.moveBoard(store.settings.activeBoardId, 1)" class="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mr-1"><ChevronRightIcon class="w-4 h-4" /></button>
          <button @click="renameActiveBoard" class="p-1 text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 rounded outline-none" title="Rename Board"><PencilIcon class="w-4 h-4" /></button>
          <button @click="createNewBoard" class="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded outline-none" title="Create New Board"><PlusIcon class="w-4 h-4" /></button>
          <button @click="store.duplicateBoard" class="p-1 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 rounded outline-none" title="Duplicate Board"><DocumentDuplicateIcon class="w-4 h-4" /></button>
        </div>
      </div>

      <div class="flex items-center gap-3">

        <div class="relative">
          <button @click="isFilterOpen = !isFilterOpen" :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border', store.assigneeFilterIds.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600']">
            <UsersIcon class="w-4 h-4" /> Filter <span v-if="store.assigneeFilterIds.length" class="ml-1 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{{store.assigneeFilterIds.length}}</span>
          </button>

          <div v-if="isFilterOpen" class="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
            <div class="p-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
               <span class="text-xs font-bold text-gray-500 uppercase">Team Members</span>
               <button @click="store.assigneeFilterIds = []" class="text-xs text-blue-500 hover:underline">Clear</button>
            </div>
            <div class="max-h-64 overflow-y-auto p-2 space-y-1">
              <label v-for="user in store.assignees" :key="user.id" class="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                <input type="checkbox" :checked="store.assigneeFilterIds.includes(user.id)" @change="store.toggleAssigneeFilter(user.id)" class="rounded text-blue-600 border-gray-300 bg-gray-100 dark:bg-gray-700 dark:border-gray-600">
                <div class="w-6 h-6 rounded-full overflow-hidden shrink-0">
                  <img v-if="user.avatar" :src="user.avatar" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white" :style="{ backgroundColor: user.color }">{{ user.initials }}</div>
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-200">{{ user.name }}</span>
              </label>
            </div>
          </div>
        </div>
        <div v-if="isFilterOpen" @click="isFilterOpen = false" class="fixed inset-0 z-40"></div>

        <div class="relative flex items-center focus-within:ring-2 focus-within:ring-blue-500 transition-shadow rounded-lg z-30">
          <div class="pl-3 text-gray-400 absolute left-0 z-10"><MagnifyingGlassIcon class="w-4 h-4" /></div>
          <input v-model="searchQuery" type="text" placeholder="Search tasks..." class="bg-gray-100 dark:bg-gray-700 border-none text-sm py-1.5 pl-9 pr-3 w-48 lg:w-64 focus:outline-none focus:ring-0 outline-none text-gray-900 dark:text-white rounded-l-lg">
          <select v-model="searchScope" class="bg-gray-200 dark:bg-gray-600 border-none text-xs py-1.5 pl-2 pr-6 focus:outline-none focus:ring-0 outline-none cursor-pointer border-l border-gray-300 dark:border-gray-500 text-gray-700 dark:text-white rounded-r-lg">
            <option value="current" class="dark:bg-gray-700">Current Board</option>
            <option value="all" class="dark:bg-gray-700">All Boards</option>
          </select>
          <div v-if="searchResults.length > 0" class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
            <div v-for="task in searchResults" :key="task.id" @click="navigateToTask(task)" class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-0 border-gray-100 dark:border-gray-700">
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{ task.title }}</div>
              <div class="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">Board: {{ store.boards.find(b => b.id === (store.columns.find(c => c.id === task.columnId)?.boardId))?.title }}</div>
            </div>
          </div>
        </div>

        <button @click="store.currentView = store.currentView === 'board' ? 'archive' : 'board'" :class="['p-1.5 rounded-md transition-colors border', store.currentView === 'archive' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'text-gray-500 border-transparent hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600 bg-gray-100 dark:bg-gray-700']" title="Global Archive">
          <ArchiveBoxIcon class="w-5 h-5" />
        </button>

        <button @click="store.toggleTheme" class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"><MoonIcon v-if="store.settings.theme === 'light'" class="w-5 h-5" /><SunIcon v-else class="w-5 h-5" /></button>
        <button @click="store.openSettings" class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"><Cog6ToothIcon class="w-5 h-5" /></button>
        <button @click="store.openNewTaskModal()" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded-md shadow-sm transition-colors">+ New Task</button>
      </div>
    </header>

    <main class="flex-1 overflow-hidden">
      <Board v-if="store.currentView === 'board'" :searchQuery="searchQuery" :searchScope="searchScope" />
      <ArchiveView v-else />
    </main>

    <TaskModal />
    <GlobalDialog />
    <SettingsModal />
  </div>
  <div v-else class="h-screen bg-gray-50 dark:bg-gray-900"></div>
</template>