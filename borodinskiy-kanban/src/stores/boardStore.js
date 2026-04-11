import { defineStore } from 'pinia'

const storage = {
  async get(key) {
    if (typeof chrome !== 'undefined' && chrome.storage) return (await chrome.storage.local.get(key))[key]
    return JSON.parse(localStorage.getItem(key))
  },
  async set(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage) await chrome.storage.local.set({ [key]: value })
    else localStorage.setItem(key, JSON.stringify(value))
  }
}

const defaultState = {
  settings: { theme: 'system', activeBoardId: 'board-1' },
  assignees: [{ id: 'user-1', name: 'Alexander Borodin', initials: 'AB', color: '#3B82F6', avatar: null }],
  boards: [{ id: 'board-1', title: 'Main Project', createdAt: new Date().toISOString() }],
  columns: [
    { id: 'col-1', boardId: 'board-1', title: 'To Do', order: 0, width: 'w-72', isArchive: false },
    { id: 'col-2', boardId: 'board-1', title: 'Done', order: 1, width: 'w-72', isArchive: true }
  ],
  tasks: []
}

const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

export const useBoardStore = defineStore('board', {
  state: () => ({
    settings: {}, assignees: [], boards: [], columns: [], tasks: [], isLoaded: false,
    isModalOpen: false, editingTask: null,

    // --- Состояние Глобального Диалога ---
    dialog: { isOpen: false, type: 'confirm', title: '', message: '', confirmText: 'OK', isDanger: false, resolve: null }
  }),

  getters: {
    activeBoard: (state) => state.boards.find(b => b.id === state.settings.activeBoardId),
    activeColumns: (state) => {
      if (!state.settings.activeBoardId) return []
      return state.columns.filter(c => c.boardId === state.settings.activeBoardId).sort((a, b) => a.order - b.order)
    }
  },

  actions: {
    // --- UI Dialog System ---
    // Умная функция, которая возвращает Promise (как нативный confirm)
    requestDialog(options) {
      return new Promise((resolve) => {
        this.dialog = {
          isOpen: true, type: options.type || 'confirm', title: options.title || '',
          message: options.message || '', confirmText: options.confirmText || 'OK',
          isDanger: options.isDanger || false, resolve
        }
      })
    },
    closeDialog(result = null) {
      if (this.dialog.resolve) this.dialog.resolve(result)
      this.dialog.isOpen = false
      this.dialog.resolve = null
    },

    // --- Данные ---
    async loadData() {
      try {
        const data = await storage.get('kanban_data')
        if (data && Array.isArray(data.columns) && Array.isArray(data.tasks)) {
          this.$patch({ settings: data.settings, assignees: data.assignees || [], boards: data.boards, columns: data.columns, tasks: data.tasks })
        } else this.$patch(defaultState)
      } catch (e) { this.$patch(defaultState) } finally { this.isLoaded = true }
    },
    async saveData() {
      const { settings, assignees, boards, columns, tasks } = this.$state
      await storage.set('kanban_data', { settings, assignees, boards, columns, tasks })
    },

    // --- Доски, Колонки, Задачи ---
    addBoard(title) {
      const newBoard = { id: generateId('board'), title, createdAt: new Date().toISOString() }
      this.boards.push(newBoard)
      this.settings.activeBoardId = newBoard.id
      this.addColumn(newBoard.id, 'To Do', false)
      this.addColumn(newBoard.id, 'Done (Archive)', true)
    },
    addColumn(boardId, title, isArchive = false) {
      this.columns.push({ id: generateId('col'), boardId, title, order: this.columns.filter(c => c.boardId === boardId).length, width: 'w-72', isArchive })
    },
    updateColumn(id, updates) {
      const index = this.columns.findIndex(c => c.id === id)
      if (index !== -1) this.columns[index] = { ...this.columns[index], ...updates }
    },
    deleteColumn(id) {
      this.columns = this.columns.filter(c => c.id !== id)
      this.tasks = this.tasks.filter(t => t.columnId !== id)
    },
    openNewTaskModal() {
      const firstCol = this.activeColumns[0]
      if (!firstCol) return
      this.editingTask = { id: generateId('task'), columnId: firstCol.id, assigneeId: null, title: '', description: '', order: this.tasks.filter(t => t.columnId === firstCol.id).length, createdAt: new Date().toISOString(), closedAt: null, closingComment: null, isNew: true }
      this.isModalOpen = true
    },
    openEditTaskModal(task) { this.editingTask = JSON.parse(JSON.stringify(task)); this.isModalOpen = true },
    closeModal() { this.isModalOpen = false; this.editingTask = null },
    saveTask(taskData) {
      if (taskData.isNew) { delete taskData.isNew; this.tasks.push(taskData) }
      else { const i = this.tasks.findIndex(t => t.id === taskData.id); if (i !== -1) this.tasks[i] = taskData }
      this.closeModal()
    },
    deleteTask(taskId) { this.tasks = this.tasks.filter(t => t.id !== taskId); this.closeModal() },
    addAssignee() { const newUser = { id: generateId('user'), name: 'New Employee', initials: 'EE', color: '#6366f1', avatar: null }; this.assignees.push(newUser); return newUser },
    updateAssignee(id, updates) { const i = this.assignees.findIndex(a => a.id === id); if (i !== -1) this.assignees[i] = { ...this.assignees[i], ...updates } },
    deleteAssignee(id) { this.tasks.forEach(t => { if (t.assigneeId === id) t.assigneeId = null }); this.assignees = this.assignees.filter(a => a.id !== id) }
  }
})