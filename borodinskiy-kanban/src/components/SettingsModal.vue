<script setup>
import { ref } from 'vue'
import { useBoardStore } from '../stores/boardStore'
import AssigneeManager from './AssigneeManager.vue'
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/vue/24/outline'

const store = useBoardStore()
const activeTab = ref('team') // 'team' или 'data'
const fileInput = ref(null)

// Логика Экспорта
const exportData = () => {
  const data = {
    settings: store.settings,
    assignees: store.assignees,
    boards: store.boards,
    columns: store.columns,
    tasks: store.tasks
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `borodinskiy-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Логика Импорта
const handleImport = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result)
      const success = await store.importWorkspace(json)

      if (success) {
        // Используем наш кастомный диалог вместо alert
        store.requestDialog({ type: 'confirm', title: 'Success', message: 'Workspace imported successfully!', confirmText: 'Great' })
        store.closeSettings()
      } else {
        store.requestDialog({ type: 'confirm', title: 'Error', message: 'Invalid JSON structure.', confirmText: 'Close', isDanger: true })
      }
    } catch (err) {
      store.requestDialog({ type: 'confirm', title: 'Error', message: 'Failed to parse JSON file.', confirmText: 'Close', isDanger: true })
    }
    event.target.value = '' // Сброс инпута
  }
  reader.readAsText(file)
}
</script>

<template>
  <div v-if="store.isSettingsOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" @mousedown.self="store.closeSettings">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">

      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
        <div class="flex gap-4">
          <button @click="activeTab = 'team'" :class="['text-lg font-semibold pb-1 border-b-2 transition-colors', activeTab === 'team' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300']">
            Team & Assignees
          </button>
          <button @click="activeTab = 'data'" :class="['text-lg font-semibold pb-1 border-b-2 transition-colors', activeTab === 'data' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300']">
            Data (Export/Import)
          </button>
        </div>
        <button @click="store.closeSettings" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
      </div>

      <div class="p-6 overflow-y-auto flex-1">

        <div v-if="activeTab === 'team'">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Manage your team members. Upload a logo or select a color for their badges.</p>
          <AssigneeManager />
        </div>

        <div v-if="activeTab === 'data'" class="space-y-6">
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 class="font-medium text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-2">
              <ArrowDownTrayIcon class="w-5 h-5" /> Export Workspace
            </h4>
            <p class="text-sm text-blue-700 dark:text-blue-400 mb-3">Download a complete JSON backup of all your boards, columns, tasks, and settings. You can share this file with colleagues.</p>
            <button @click="exportData" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded shadow transition-colors">
              Download JSON Backup
            </button>
          </div>

          <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <h4 class="font-medium text-red-900 dark:text-red-300 flex items-center gap-2 mb-2">
              <ArrowUpTrayIcon class="w-5 h-5" /> Import Workspace
            </h4>
            <p class="text-sm text-red-700 dark:text-red-400 mb-3 font-semibold">
              Warning: Importing a workspace will overwrite ALL your current local data! Make sure you have exported a backup first.
            </p>
            <input type="file" accept=".json" class="hidden" ref="fileInput" @change="handleImport">
            <button @click="fileInput.click()" class="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded shadow transition-colors">
              Select JSON to Import...
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>