<script setup>
import { useBoardStore } from '../stores/boardStore'
import { TrashIcon, PhotoIcon } from '@heroicons/vue/24/outline'

const store = useBoardStore()

const handleAvatarUpload = (event, userId) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    store.updateAssignee(userId, { avatar: e.target.result })
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="space-y-4">
    <div v-for="user in store.assignees" :key="user.id" class="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">

      <div class="flex flex-col items-center gap-1 w-12 shrink-0">
        <div class="relative group w-12 h-12">
          <div v-if="user.avatar" class="w-12 h-12 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm">
            <img :src="user.avatar" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm" :style="{ backgroundColor: user.color }">
            {{ user.initials }}
          </div>

          <label class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
            <PhotoIcon class="w-5 h-5 text-white" />
            <input type="file" class="hidden" accept="image/*" @change="e => handleAvatarUpload(e, user.id)" />
          </label>
        </div>
        <button @click="user.avatar = null" v-if="user.avatar" class="text-[10px] text-red-500 hover:text-red-700 leading-none">Reset</button>
      </div>

      <div class="flex-1 grid grid-cols-2 gap-2">
        <input v-model="user.name" type="text" placeholder="Full Name" class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm">
        <input v-model="user.initials" type="text" placeholder="Initials" maxlength="3" class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm uppercase">
        <div class="flex items-center gap-2">
           <input type="color" v-model="user.color" class="w-8 h-8 rounded cursor-pointer bg-transparent border-none">
           <span class="text-xs text-gray-500 uppercase">{{ user.color }}</span>
        </div>
      </div>

      <div class="shrink-0 flex items-center justify-center">
        <button @click="store.deleteAssignee(user.id)" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded transition-colors" title="Delete employee">
          <TrashIcon class="w-5 h-5" />
        </button>
      </div>
    </div>

    <button @click="store.addAssignee" class="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:text-blue-500 hover:border-blue-500 transition-all rounded-lg text-sm font-medium">
      + Add Employee
    </button>
  </div>
</template>