<script setup>
import { computed } from 'vue'
import { useBoardStore } from '../stores/boardStore'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js'
import { Pie, Bar } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

const store = useBoardStore()

const taskStatusData = computed(() => {
  const active = store.tasks.filter(t => !t.isArchived).length
  const archived = store.archivedTasks.length
  return {
    labels: ['Active Tasks', 'Completed (Archived)'],
    datasets: [{
      backgroundColor: ['#3B82F6', '#10B981'],
      data: [active, archived]
    }]
  }
})

const assigneeData = computed(() => {
  const labels = store.assignees.map(a => a.name)
  const data = store.assignees.map(a => store.tasks.filter(t => t.assigneeIds?.includes(a.id)).length)
  return {
    labels,
    datasets: [{
      label: 'Tasks Assigned',
      backgroundColor: store.assignees.map(a => a.color),
      data
    }]
  }
})

const chartOptions = { responsive: true, maintainAspectRatio: false }
</script>

<template>
  <div class="p-8 max-w-6xl mx-auto w-full h-full overflow-y-auto">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Workspace Dashboard</h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Tasks</h3>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ store.tasks.length }}</p>
      </div>
      <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Active Boards</h3>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ store.boards.length }}</p>
      </div>
      <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Team Members</h3>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ store.assignees.length }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Task Status</h3>
        <div class="flex-1 relative"><Pie :data="taskStatusData" :options="chartOptions" /></div>
      </div>
      <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workload by Assignee</h3>
        <div class="flex-1 relative"><Bar :data="assigneeData" :options="chartOptions" /></div>
      </div>
    </div>
  </div>
</template>