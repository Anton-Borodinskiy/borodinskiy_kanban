<script setup>
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useBoardStore } from './stores/boardStore'
import Board from './components/Board.vue'
import ArchiveView from './components/ArchiveView.vue'
import DashboardView from './components/DashboardView.vue'
import TaskModal from './components/TaskModal.vue'
import GlobalDialog from './components/GlobalDialog.vue'
import SettingsModal from './components/SettingsModal.vue'
import { MagnifyingGlassIcon, SunIcon, MoonIcon, PlusIcon, Cog6ToothIcon, ViewColumnsIcon, DocumentDuplicateIcon, PencilIcon, ChevronLeftIcon, ChevronRightIcon, UsersIcon, ArchiveBoxIcon, TrashIcon, LockClosedIcon, LockOpenIcon, ChartPieIcon, Bars3Icon, Squares2X2Icon, SpeakerWaveIcon, SpeakerXMarkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, ArrowUturnLeftIcon, CloudIcon, QuestionMarkCircleIcon } from '@heroicons/vue/24/outline'

const store = useBoardStore()
const searchQuery = ref('')
const searchScope = ref('current')
const isFilterOpen = ref(false)
const searchInput = ref(null)
const allCardsExpanded = ref(false)
// Board filtering runs over every card, so debounce the query it receives —
// the input itself stays instant.
const debouncedQuery = ref('')
let searchDebounce = null
watch(searchQuery, (v) => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { debouncedQuery.value = v }, 150)
})

const isHelpOpen = ref(false)

// Surfaces sync trouble outside the settings panel, where it was invisible.
const syncState = computed(() => {
  if (!store.sync.gistId) return null
  if (store.sync.conflict) return { cls: 'text-amber-500', label: 'Cloud changed on another device — open Cloud Sync' }
  if (store.sync.status?.startsWith('Error')) return { cls: 'text-red-500', label: store.sync.status }
  const when = store.sync.lastSyncedAt ? new Date(store.sync.lastSyncedAt).toLocaleString() : 'never'
  return { cls: 'text-gray-400', label: `Cloud sync OK — last synced: ${when}` }
})
const openCloudSettings = () => { store.openSettings('cloud') }

const toggleExpandAll = () => {
  if (allCardsExpanded.value) store.collapseAllCards()
  else store.expandAllCards()
  allCardsExpanded.value = !allCardsExpanded.value
}

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
const renameActiveBoard = async () => { const board = store.activeBoard; if (!board) return; const title = await store.requestDialog({ type: 'prompt', title: 'Rename Board', message: 'Enter new title:', confirmText: 'Rename', inputValue: board.title }); if (title) store.renameBoard(board.id, title) }

const isTypingTarget = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

const handleKeydown = (e) => {
  // Esc closes the top-most overlay, even while focused in a field.
  if (e.key === 'Escape') {
    if (isHelpOpen.value) { isHelpOpen.value = false; return }
    if (store.dialog.isOpen) { store.closeDialog(false); return }
    if (store.isModalOpen) { store.attemptCloseModal(); return }
    if (store.isSettingsOpen) { store.closeSettings(); return }
    if (isFilterOpen.value) { isFilterOpen.value = false; return }
    return
  }
  // Other shortcuts are ignored while typing or when an overlay is open.
  if (isTypingTarget(e.target) || store.isModalOpen || store.isSettingsOpen || store.dialog.isOpen) return
  if (e.key === '/') { e.preventDefault(); searchInput.value?.focus(); return }
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); store.openNewTaskModal(); return }
  if (e.key === '?') { e.preventDefault(); isHelpOpen.value = true; return }
}

// Guard the browser tab itself: warn on close/reload while a card has unsaved edits.
const handleBeforeUnload = (e) => {
  if (store.isEditingDirty()) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(async () => {
  await store.loadData()
  // Watch only the persisted tables. A blanket $subscribe also fired for purely
  // transient UI state — including editingTask, which is mutated on every
  // keystroke in the task modal — re-serializing the whole workspace each time.
  watch(
    () => [store.settings, store.assignees, store.boards, store.columns, store.tasks],
    () => { if (store.isLoaded) store.saveData() },
    { deep: true }
  )
  store.setupSync()
  store.checkCloudOnStartup()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('beforeunload', handleBeforeUnload)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <div v-if="store.isLoaded" class="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors" :style="store.activeBoard?.background && store.currentView === 'board' ? { background: store.activeBoard.background.startsWith('data:') || store.activeBoard.background.startsWith('http') ? `url(${store.activeBoard.background}) center/cover no-repeat` : store.activeBoard.background } : {}">
    <header class="flex-shrink-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-3 xl:px-4 py-3 flex flex-wrap gap-y-3 justify-between items-center z-30">

      <div class="flex items-center gap-2 xl:gap-3 min-w-0">
        <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          <button @click="store.currentView = 'board'" :class="['p-1.5 rounded transition-colors', store.currentView === 'board' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white']" title="Board View"><ViewColumnsIcon class="w-5 h-5" /></button>
          <button @click="store.currentView = 'archive'" :class="['p-1.5 rounded transition-colors', store.currentView === 'archive' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white']" title="Global Archive"><ArchiveBoxIcon class="w-5 h-5" /></button>
          <button @click="store.currentView = 'dashboard'" :class="['p-1.5 rounded transition-colors', store.currentView === 'dashboard' ? 'bg-white dark:bg-gray-600 shadow-sm text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white']" title="Analytics Dashboard"><ChartPieIcon class="w-5 h-5" /></button>
        </div>
        <h1 class="text-xl font-extrabold tracking-tight text-gray-950 dark:text-white ml-1 hidden 2xl:block shrink-0">Borodinskiy <span class="text-blue-600 dark:text-blue-400">Kanban</span></h1>

        <div v-if="store.currentView === 'board'" class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md pr-1 border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-500 transition-colors overflow-hidden min-w-0">
          <button @click="store.moveBoard(store.settings.activeBoardId, -1)" class="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0" title="Move board left" aria-label="Move board left"><ChevronLeftIcon class="w-4 h-4" /></button>
          <select v-model="store.settings.activeBoardId" class="bg-transparent border-none text-sm py-1.5 px-1 w-32 xl:w-44 focus:outline-none focus:ring-0 outline-none cursor-pointer text-gray-900 dark:text-white font-medium truncate flex-1">
            <option v-for="board in store.boards" :key="board.id" :value="board.id" class="dark:bg-gray-800">{{ board.title }}</option>
          </select>
          <button @click="store.moveBoard(store.settings.activeBoardId, 1)" class="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mr-1 shrink-0" title="Move board right" aria-label="Move board right"><ChevronRightIcon class="w-4 h-4" /></button>
          <button @click="renameActiveBoard" class="p-1 text-gray-500 hover:text-orange-600 dark:text-gray-400 rounded outline-none shrink-0" title="Rename Board"><PencilIcon class="w-4 h-4" /></button>
          <button @click="createNewBoard" class="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 rounded outline-none shrink-0" title="Create New Board"><PlusIcon class="w-4 h-4" /></button>
          <button @click="store.duplicateBoard" class="p-1 text-gray-500 hover:text-green-600 dark:text-gray-400 rounded outline-none shrink-0" title="Duplicate Board"><DocumentDuplicateIcon class="w-4 h-4" /></button>
          <button @click="store.isColumnsLocked = !store.isColumnsLocked" class="p-1 text-gray-500 hover:text-indigo-600 dark:text-gray-400 rounded outline-none border-l border-gray-300 dark:border-gray-600 pl-2 ml-1 shrink-0" :title="store.isColumnsLocked ? 'Unlock Columns' : 'Lock Columns'"><LockClosedIcon v-if="store.isColumnsLocked" class="w-4 h-4" /><LockOpenIcon v-else class="w-4 h-4 text-indigo-500" /></button>
          <button @click="store.deleteActiveBoard()" class="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 rounded outline-none shrink-0" title="Delete Board"><TrashIcon class="w-4 h-4" /></button>
        </div>
      </div>

      <div class="flex items-center gap-2 min-w-0">
        <div class="relative flex-shrink-0">
          <button @click="isFilterOpen = !isFilterOpen" :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border', store.assigneeFilterIds.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30' : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300']">
            <UsersIcon class="w-4 h-4" /> Filter <span v-if="store.assigneeFilterIds.length" class="ml-1 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{{store.assigneeFilterIds.length}}</span>
          </button>
          <div v-if="isFilterOpen" class="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
            <div class="p-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center"><span class="text-xs font-bold text-gray-500 uppercase">Team</span><button @click="store.assigneeFilterIds = []" class="text-xs text-blue-500 hover:underline">Clear</button></div>
            <div class="max-h-64 overflow-y-auto p-2 space-y-1">
              <label v-for="user in store.assignees" :key="user.id" class="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                <input type="checkbox" :checked="store.assigneeFilterIds.includes(user.id)" @change="store.toggleAssigneeFilter(user.id)" class="rounded text-blue-600 border-gray-300 bg-gray-100 dark:bg-gray-700 dark:border-gray-600">
                <div class="w-6 h-6 rounded-full overflow-hidden shrink-0"><img v-if="user.avatar" :src="user.avatar" class="w-full h-full object-cover" /><div v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white" :style="{ backgroundColor: user.color }">{{ user.initials }}</div></div>
                <span class="text-sm text-gray-700 dark:text-gray-200 truncate">{{ user.name }}</span>
              </label>
            </div>
          </div>
        </div>
        <div v-if="isFilterOpen" @click="isFilterOpen = false" class="fixed inset-0 z-40"></div>

        <div class="relative flex items-center focus-within:ring-2 focus-within:ring-blue-500 transition-shadow rounded-lg z-30 flex-shrink-0">
          <div class="pl-3 text-gray-400 absolute left-0 z-10"><MagnifyingGlassIcon class="w-4 h-4" /></div>
          <input ref="searchInput" v-model="searchQuery" type="text" placeholder="Search... ( / )" class="bg-gray-100 dark:bg-gray-700 border-none text-sm py-1.5 pl-9 pr-3 w-32 xl:w-44 2xl:w-56 outline-none rounded-l-lg dark:text-white">
          <select v-model="searchScope" class="bg-gray-200 dark:bg-gray-600 border-none text-xs py-1.5 pl-2 pr-6 outline-none cursor-pointer border-l border-gray-300 dark:border-gray-500 text-gray-700 dark:text-white rounded-r-lg">
            <option value="current" class="dark:bg-gray-700">Board</option>
            <option value="all" class="dark:bg-gray-700">Global</option>
          </select>
          <div v-if="searchResults.length > 0" class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 max-h-96 overflow-y-auto z-50">
            <div v-for="task in searchResults" :key="task.id" @click="navigateToTask(task)" class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-lg mb-1 last:mb-0 transition-colors">
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{ task.title }}</div>
              <div class="text-[10px] text-blue-500 font-bold uppercase tracking-wider mt-1">
                Board: {{ store.boards.find(b => b.id === (store.columns.find(c => c.id === task.columnId)?.boardId))?.title }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1 flex-shrink-0">
          <button v-if="syncState" @click="openCloudSettings" :class="['p-1.5 bg-gray-100 dark:bg-gray-700 rounded-md transition-colors hover:opacity-80', syncState.cls]" :title="syncState.label" :aria-label="syncState.label">
            <CloudIcon class="w-5 h-5" />
          </button>
          <button v-if="store.currentView === 'board'" @click="toggleExpandAll" class="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md transition-colors" :title="allCardsExpanded ? 'Collapse all checklists & links' : 'Expand all checklists & links'" :aria-label="allCardsExpanded ? 'Collapse all checklists and links' : 'Expand all checklists and links'">
            <ArrowsPointingInIcon v-if="allCardsExpanded" class="w-5 h-5" />
            <ArrowsPointingOutIcon v-else class="w-5 h-5" />
          </button>
          <button @click="store.toggleCompactMode" class="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md transition-colors" :title="store.settings.isCompactMode ? 'Detailed View' : 'Compact View'" :aria-label="store.settings.isCompactMode ? 'Switch to detailed view' : 'Switch to compact view'">
             <Bars3Icon v-if="store.settings.isCompactMode" class="w-5 h-5" />
             <Squares2X2Icon v-else class="w-5 h-5" />
          </button>
          <button @click="store.toggleSound" class="p-1.5 text-gray-500 hover:text-gray-900 bg-gray-100 dark:bg-gray-700 rounded-md transition-colors" :title="store.settings.isSoundEnabled ? 'Mute Sounds' : 'Unmute Sounds'" :aria-label="store.settings.isSoundEnabled ? 'Mute sounds' : 'Unmute sounds'">
            <SpeakerWaveIcon v-if="store.settings.isSoundEnabled" class="w-5 h-5" />
            <SpeakerXMarkIcon v-else class="w-5 h-5 text-red-500" />
           </button>
          <button @click="store.toggleTheme" class="p-1.5 text-gray-500 hover:text-gray-900 bg-gray-100 dark:bg-gray-700 rounded-md transition-colors" :title="store.settings.theme === 'light' ? 'Dark mode' : 'Light mode'" :aria-label="store.settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"><MoonIcon v-if="store.settings.theme === 'light'" class="w-5 h-5" /><SunIcon v-else class="w-5 h-5" /></button>
          <button @click="isHelpOpen = true" class="p-1.5 text-gray-500 hover:text-gray-900 bg-gray-100 dark:bg-gray-700 rounded-md transition-colors" title="Keyboard shortcuts & tips ( ? )" aria-label="Keyboard shortcuts and tips"><QuestionMarkCircleIcon class="w-5 h-5" /></button>
          <button @click="store.openSettings()" class="p-1.5 text-gray-500 hover:text-gray-900 bg-gray-100 dark:bg-gray-700 rounded-md transition-colors" title="Settings" aria-label="Settings"><Cog6ToothIcon class="w-5 h-5" /></button>
        </div>
        <button @click="store.openNewTaskModal()" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded-md shadow-sm transition-colors flex-shrink-0">+ New Task</button>
      </div>
    </header>

    <main class="flex-1 overflow-hidden relative">
      <Board v-if="store.currentView === 'board'" :searchQuery="debouncedQuery" :searchScope="searchScope" @create-board="createNewBoard" />
      <ArchiveView v-else-if="store.currentView === 'archive'" />
      <DashboardView v-else-if="store.currentView === 'dashboard'" />
    </main>

    <TaskModal />
    <GlobalDialog />
    <SettingsModal />

    <div v-if="isHelpOpen" class="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @mousedown.self="isHelpOpen = false">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Shortcuts &amp; Tips</h3>
          <button @click="isHelpOpen = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none" aria-label="Close help">&times;</button>
        </div>
        <div class="p-6 space-y-5 text-sm">
          <div>
            <h4 class="font-bold text-gray-900 dark:text-white mb-2 uppercase text-xs tracking-wide">Keyboard</h4>
            <ul class="space-y-1.5 text-gray-600 dark:text-gray-300">
              <li><kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">N</kbd> — new task</li>
              <li><kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">/</kbd> — focus search</li>
              <li><kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">?</kbd> — this help</li>
              <li><kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">Esc</kbd> — close the top-most dialog</li>
              <li><kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">Tab</kbd> + <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">Enter</kbd> — move between cards and open one</li>
            </ul>
          </div>
          <div>
            <h4 class="font-bold text-gray-900 dark:text-white mb-2 uppercase text-xs tracking-wide">Not obvious</h4>
            <ul class="space-y-1.5 text-gray-600 dark:text-gray-300 list-disc list-inside">
              <li>While dragging a card, drop zones appear at the bottom to <strong>delete</strong> or <strong>archive</strong> it.</li>
              <li>Click a column title to rename it inline.</li>
              <li>Hover a column header for <strong>S / M / L</strong> width, the WIP limit, and delete.</li>
              <li>Deletions show an <strong>Undo</strong> toast for 7 seconds.</li>
              <li>Descriptions and closing comments support Markdown — use the toolbar.</li>
              <li>Settings → Data keeps automatic <strong>snapshots</strong> you can restore.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div v-if="store.undo.visible" class="undo-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-4 bg-gray-900 dark:bg-gray-700 text-white pl-5 pr-3 py-3 rounded-xl shadow-2xl border border-white/10">
      <span class="text-sm font-medium whitespace-nowrap">{{ store.undo.message }}</span>
      <button @click="store.performUndo" class="flex items-center gap-1.5 text-sm font-bold text-blue-300 hover:text-blue-200 transition-colors">
        <ArrowUturnLeftIcon class="w-4 h-4" /> Undo
      </button>
      <button @click="store.dismissUndo" class="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
    </div>
  </div>
  <div v-else class="h-screen bg-gray-50 dark:bg-gray-900"></div>
</template>