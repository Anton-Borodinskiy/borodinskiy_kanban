import { defineStore } from 'pinia'

// Вспомогательная функция для кросс-платформенного сохранения
const storage = {
  async get(key) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const data = await chrome.storage.local.get(key)
      return data[key]
    }
    return JSON.parse(localStorage.getItem(key))
  },
  async set(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [key]: value })
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }
}

// Дефолтные данные
const defaultState = {
  settings: { theme: 'system', activeBoardId: 'board-1' },
  assignees: [
    { id: 'user-1', name: 'Alexander Borodin', initials: 'AB', color: '#3B82F6', avatar: null }
  ],
  boards: [
    { id: 'board-1', title: 'Главный проект', createdAt: new Date().toISOString() }
  ],
  columns: [
    { id: 'col-1', boardId: 'board-1', title: 'К выполнению', order: 0, width: 'w-72', isArchive: false },
    { id: 'col-2', boardId: 'board-1', title: 'В процессе', order: 1, width: 'w-72', isArchive: false },
    { id: 'col-3', boardId: 'board-1', title: 'Готово', order: 2, width: 'w-72', isArchive: true }
  ],
  tasks: [
    {
      id: 'task-1',
      columnId: 'col-1',
      assigneeId: 'user-1',
      title: 'Собрать каркас приложения',
      description: 'Настроить Vue, Tailwind и Pinia',
      order: 0,
      createdAt: new Date().toISOString(),
      closedAt: null,
      closingComment: null
    }
  ]
}

// Генератор уникальных ID
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

export const useBoardStore = defineStore('board', {
  state: () => ({
    settings: {},
    assignees: [],
    boards: [],
    columns: [],
    tasks: [],
    isLoaded: false,

    // UI State (не сохраняется в storage)
    isModalOpen: false,
    editingTask: null
  }),

  getters: {
    activeBoard: (state) => state.boards.find(b => b.id === state.settings.activeBoardId),
    activeColumns: (state) => {
      if (!state.settings.activeBoardId) return []
      return state.columns
        .filter(c => c.boardId === state.settings.activeBoardId)
        .sort((a, b) => a.order - b.order)
    }
  },

  actions: {
    // --- Инициализация и сохранение ---
    async loadData() {
      try {
        const data = await storage.get('kanban_data')
        if (data && Array.isArray(data.columns) && Array.isArray(data.tasks)) {
          this.$patch({
            settings: data.settings,
            assignees: data.assignees || [], // Защита от старых сохранений без сотрудников
            boards: data.boards,
            columns: data.columns,
            tasks: data.tasks
          })
        } else {
          this.$patch(defaultState)
        }
      } catch (error) {
        this.$patch(defaultState)
      } finally {
        this.isLoaded = true
      }
    },

    async saveData() {
      const { settings, assignees, boards, columns, tasks } = this.$state
      await storage.set('kanban_data', { settings, assignees, boards, columns, tasks })
    },

    // --- Управление задачами (Модалка) ---
    openNewTaskModal() {
      const firstColumn = this.activeColumns[0]
      if (!firstColumn) return

      this.editingTask = {
        id: generateId('task'),
        columnId: firstColumn.id,
        assigneeId: null,
        title: '',
        description: '',
        order: this.tasks.filter(t => t.columnId === firstColumn.id).length,
        createdAt: new Date().toISOString(),
        closedAt: null,
        closingComment: null,
        isNew: true
      }
      this.isModalOpen = true
    },

    openEditTaskModal(task) {
      this.editingTask = JSON.parse(JSON.stringify(task))
      this.isModalOpen = true
    },

    closeModal() {
      this.isModalOpen = false
      this.editingTask = null
    },

    saveTask(taskData) {
      if (taskData.isNew) {
        delete taskData.isNew
        this.tasks.push(taskData)
      } else {
        const index = this.tasks.findIndex(t => t.id === taskData.id)
        if (index !== -1) {
          this.tasks[index] = taskData
        }
      }
      this.closeModal()
    },

    deleteTask(taskId) {
      this.tasks = this.tasks.filter(t => t.id !== taskId)
      this.closeModal()
    },

    // --- Управление сотрудниками ---
    addAssignee() {
      const newUser = {
        id: generateId('user'),
        name: 'New Employee',
        initials: 'EE',
        color: '#6366f1',
        avatar: null
      }
      this.assignees.push(newUser)
      return newUser
    },

    updateAssignee(id, updates) {
      const index = this.assignees.findIndex(a => a.id === id)
      if (index !== -1) {
        this.assignees[index] = { ...this.assignees[index], ...updates }
      }
    },

    deleteAssignee(id) {
      this.tasks.forEach(task => {
        if (task.assigneeId === id) task.assigneeId = null
      })
      this.assignees = this.assignees.filter(a => a.id !== id)
    }
  }
})