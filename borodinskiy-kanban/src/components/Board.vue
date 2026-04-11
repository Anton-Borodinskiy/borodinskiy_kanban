<script setup>
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useBoardStore } from '../stores/boardStore'

const store = useBoardStore()
const columnTasksCache = {}

// Функция для безопасного рендера ссылок и текста
const renderMarkdown = (text) => {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text))
}

const getTasks = (columnId) => {
  if (!columnTasksCache[columnId]) {
    columnTasksCache[columnId] = computed({
      get: () => store.tasks.filter(t => t.columnId === columnId).sort((a, b) => a.order - b.order),
      set: (newTasks) => {
        newTasks.forEach((task, index) => {
          const storeTask = store.tasks.find(t => t.id === task.id)
          if (storeTask) {
            storeTask.columnId = columnId
            storeTask.order = index
          }
        })
      }
    })
  }
  return columnTasksCache[columnId]
}

const getAssignee = (id) => store.assignees.find(a => a.id === id)
</script>

<template>
  <div class="flex flex-1 overflow-x-auto gap-6 p-6 items-start h-full">

    <div
      v-for="column in store.activeColumns"
      :key="column.id"
      :class="['flex-shrink-0 flex flex-col bg-gray-200 dark:bg-gray-800 rounded-xl max-h-full', column.width]"
    >
      <div class="p-4 font-semibold text-gray-700 dark:text-gray-200 flex justify-between items-center">
        <span>{{ column.title }}</span>
        <span class="text-sm bg-gray-300 dark:bg-gray-700 px-2 py-1 rounded-full">
          {{ getTasks(column.id).value.length }}
        </span>
      </div>

      <VueDraggable
        v-model="getTasks(column.id).value"
        group="tasks"
        class="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]"
        ghostClass="opacity-50"
        :animation="150"
      >
        <div
          v-for="task in getTasks(column.id).value"
          :key="task.id"
          @click="store.openEditTaskModal(task)"
          class="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm hover:shadow-md cursor-pointer border border-transparent hover:border-blue-500 transition-all duration-200 group"
        >
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-medium text-gray-900 dark:text-white text-sm leading-snug">
              {{ task.title }}
            </h4>

            <div v-if="task.assigneeId" class="shrink-0 ml-2">
              <div
                v-if="getAssignee(task.assigneeId)?.avatar"
                class="w-6 h-6 rounded-full overflow-hidden border border-white dark:border-gray-800 shadow-sm"
              >
                <img :src="getAssignee(task.assigneeId).avatar" class="w-full h-full object-cover" />
              </div>
              <div
                v-else
                class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                :style="{ backgroundColor: getAssignee(task.assigneeId)?.color || '#999' }"
                :title="getAssignee(task.assigneeId)?.name"
              >
                {{ getAssignee(task.assigneeId)?.initials }}
              </div>
            </div>
          </div>

          <div
            v-if="column.isArchive && task.closingComment"
            class="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-800 dark:text-green-300 prose prose-sm prose-p:my-0 prose-a:text-blue-600 dark:prose-a:text-blue-400 max-w-none"
            v-html="renderMarkdown(task.closingComment)"
            @click.stop
          ></div>
        </div>
      </VueDraggable>
    </div>

    <button class="flex-shrink-0 w-72 bg-gray-200/50 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 transition-colors">
      + Add Column
    </button>

  </div>
</template>