<script setup>
import { ref } from 'vue'
import { useBoardStore } from '../stores/boardStore'
import AssigneeManager from './AssigneeManager.vue'
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ExclamationTriangleIcon, PhotoIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const store = useBoardStore()
const activeTab = ref('team')
const fileInput = ref(null)

const exportData = () => {
  // ИСПРАВЛЕНИЕ: Глубокая очистка данных от Vue Proxy перед скачиванием
  const cleanData = JSON.parse(JSON.stringify({
    settings: store.settings,
    assignees: store.assignees,
    boards: store.boards,
    columns: store.columns,
    tasks: store.tasks
  }))

  const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url
  a.download = `borodinskiy-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url)
}

const handleImport = (event) => {
  const file = event.target.files[0];
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    let json = null

    // 1. Проверяем валидность самого JSON файла
    try {
      json = JSON.parse(e.target.result)
    } catch (err) {
      store.requestDialog({ type: 'confirm', title: 'Parse Error', message: 'The selected file is not a valid JSON.', confirmText: 'Close', isDanger: true })
      event.target.value = ''
      return
    }

    // 2. Пытаемся применить структуру к нашему Канбану
    try {
      const success = await store.importWorkspace(json)
      if (success) {
        store.requestDialog({ type: 'confirm', title: 'Success', message: 'Workspace imported successfully!', confirmText: 'Great' });
        store.closeSettings()
      } else {
         store.requestDialog({ type: 'confirm', title: 'Structure Error', message: 'JSON format is valid, but it does not match the Kanban workspace structure.', confirmText: 'Close', isDanger: true })
      }
    } catch (err) {
      console.error(err)
      store.requestDialog({ type: 'confirm', title: 'System Error', message: 'An internal error occurred while applying the data.', confirmText: 'Close', isDanger: true })
    }

    event.target.value = ''
  }
  reader.readAsText(file)
}

const handleBgUpload = (event) => {
  const file = event.target.files[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { store.updateBoardBackground(store.settings.activeBoardId, e.target.result) }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div v-if="store.isSettingsOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @mousedown.self="store.closeSettings">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">

      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
        <div class="flex gap-4">
          <button @click="activeTab = 'team'" :class="['text-lg font-semibold pb-1 border-b-2 transition-colors', activeTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700']">Team & Assignees</button>
          <button @click="activeTab = 'boards'" :class="['text-lg font-semibold pb-1 border-b-2 transition-colors', activeTab === 'boards' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700']">Board Backgrounds</button>
          <button @click="activeTab = 'data'" :class="['text-lg font-semibold pb-1 border-b-2 transition-colors', activeTab === 'data' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700']">Data (Export/Import)</button>
        </div>
        <button @click="store.closeSettings" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
      </div>

      <div class="p-6 overflow-y-auto flex-1">

        <div v-if="activeTab === 'team'">
          <p class="text-sm text-gray-500 mb-4">Manage team members. Added members can be assigned to tasks.</p>
          <AssigneeManager />
        </div>

        <div v-if="activeTab === 'boards'" class="space-y-6">
          <div>
            <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-2 uppercase">Background for "{{ store.activeBoard?.title }}"</h3>
            <p class="text-sm text-gray-500 mb-4">Set a custom background image or gradient for the active board.</p>

            <div class="flex gap-4 mb-4">
               <div v-if="store.activeBoard?.background" class="relative w-32 h-20 rounded-lg overflow-hidden border-2 border-blue-500 shadow">
                 <div class="w-full h-full bg-cover bg-center" :style="{ background: store.activeBoard.background.startsWith('data') ? `url(${store.activeBoard.background})` : store.activeBoard.background }"></div>
                 <button @click="store.updateBoardBackground(store.settings.activeBoardId, null)" class="absolute top-1 right-1 bg-red-500 text-white rounded p-0.5"><XMarkIcon class="w-3 h-3"/></button>
               </div>
               <div v-else class="w-32 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400">None</div>

               <div class="flex flex-col justify-center gap-2">
                 <label class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium px-3 py-1.5 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition flex items-center gap-2">
                   <PhotoIcon class="w-4 h-4" /> Upload Image
                   <input type="file" accept="image/*" class="hidden" @change="handleBgUpload">
                 </label>
               </div>
            </div>

            <div class="grid grid-cols-4 gap-2">
               <button @click="store.updateBoardBackground(store.settings.activeBoardId, 'linear-gradient(to right bottom, #4f46e5, #0ea5e9)')" class="h-10 rounded bg-gradient-to-br from-indigo-600 to-sky-500 shadow-sm"></button>
               <button @click="store.updateBoardBackground(store.settings.activeBoardId, 'linear-gradient(to right bottom, #db2777, #f97316)')" class="h-10 rounded bg-gradient-to-br from-pink-600 to-orange-500 shadow-sm"></button>
               <button @click="store.updateBoardBackground(store.settings.activeBoardId, 'linear-gradient(to right bottom, #16a34a, #facc15)')" class="h-10 rounded bg-gradient-to-br from-green-600 to-yellow-400 shadow-sm"></button>
               <button @click="store.updateBoardBackground(store.settings.activeBoardId, 'linear-gradient(to right bottom, #475569, #1e293b)')" class="h-10 rounded bg-gradient-to-br from-slate-600 to-slate-800 shadow-sm"></button>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'data'" class="space-y-6">
          <div class="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 class="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-2"><ArrowDownTrayIcon class="w-5 h-5" /> Export Workspace Backup</h4>
            <p class="text-sm text-blue-700 dark:text-blue-400 mb-4">Download a complete JSON file containing all your current boards, columns, tasks, global archives, and team members. Use this file to safely backup your progress or transfer your workspace to another browser.</p>
            <button @click="exportData" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-5 rounded shadow transition-colors">Download JSON Backup</button>
          </div>

          <div class="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h4 class="font-bold text-yellow-900 dark:text-yellow-300 flex items-center gap-2 mb-2"><ArrowUpTrayIcon class="w-5 h-5" /> Import Workspace Backup</h4>
            <p class="text-sm text-yellow-700 dark:text-yellow-400 mb-2">Restore your workspace from a previously saved JSON file.</p>
            <p class="text-sm text-yellow-800 dark:text-yellow-500 font-bold mb-4">⚠️ Warning: Importing will completely overwrite your current local data!</p>
            <input type="file" accept=".json" class="hidden" ref="fileInput" @change="handleImport">
            <button @click="fileInput.click()" class="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium py-2 px-5 rounded shadow transition-colors">Select JSON to Import...</button>
          </div>

          <div class="bg-red-50 dark:bg-red-900/20 p-5 rounded-lg border border-red-200 dark:border-red-800 mt-6">
            <h4 class="font-bold text-red-900 dark:text-red-300 flex items-center gap-2 mb-2"><ExclamationTriangleIcon class="w-5 h-5" /> Danger Zone: Factory Reset</h4>
            <p class="text-sm text-red-700 dark:text-red-400 mb-4">This action will permanently delete all boards, tasks, archives, and settings from your browser's local storage. This action cannot be undone.</p>
            <button @click="store.factoryReset()" class="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-5 rounded shadow transition-colors">Delete All Data</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>