import { defineStore } from 'pinia'

const storage = {
  async get(key) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get(key)
      return data[key]
    }
    const localData = localStorage.getItem(key)
    return localData ? JSON.parse(localData) : null
  },
  async set(key, value) {
    const rawValue = JSON.parse(JSON.stringify(value))
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [key]: rawValue })
    } else {
      localStorage.setItem(key, JSON.stringify(rawValue))
    }
  }
}

const defaultState = {
  settings: { theme: 'system', activeBoardId: 'board-1', isCompactMode: false, isSoundEnabled: true },
  assignees: [{ id: 'user-1', name: 'Anton Borodinskiy', initials: 'AB', color: '#3B82F6', avatar: null }],
  boards: [{ id: 'board-1', title: 'Main Project', background: null, createdAt: new Date().toISOString() }],
  columns: [
    { id: 'col-1', boardId: 'board-1', title: 'To Do', order: 0, width: 'w-80', isArchive: false, wipLimit: 0 },
    { id: 'col-2', boardId: 'board-1', title: 'Done', order: 1, width: 'w-80', isArchive: true, wipLimit: 0 }
  ],
  tasks: []
}

const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
let saveTimeout = null;

export const useBoardStore = defineStore('board', {
  state: () => ({
    settings: {},
    assignees: [],
    boards: [],
    columns: [],
    tasks: [],
    isLoaded: false,
    isModalOpen: false,
    editingTask: null,
    dialog: { isOpen: false, type: 'confirm', title: '', message: '', confirmText: 'OK', isDanger: false, inputValue: '', resolve: null },
    isSettingsOpen: false,
    highlightedTaskId: null,
    currentView: 'board',
    assigneeFilterIds: [],
    isColumnsLocked: true,
    isDraggingTask: false
  }),

  getters: {
    activeBoard: (state) => state.boards.find(b => b.id === state.settings.activeBoardId),
    activeColumns: (state) => {
      if (!state.settings.activeBoardId) return []
      return state.columns.filter(c => c.boardId === state.settings.activeBoardId).sort((a, b) => a.order - b.order)
    },
    archivedTasks: (state) => state.tasks.filter(t => t.isArchived)
  },

  actions: {
    // --- UI & DIALOGS ---
    requestDialog(options) {
      return new Promise((resolve) => {
        this.dialog = {
          isOpen: true,
          type: options.type || 'confirm',
          title: options.title || '',
          message: options.message || '',
          confirmText: options.confirmText || 'OK',
          isDanger: options.isDanger || false,
          inputValue: options.inputValue || '',
          resolve
        }
      })
    },
    closeDialog(result = null) {
      if (this.dialog.resolve) this.dialog.resolve(result)
      this.dialog.isOpen = false
      this.dialog.resolve = null
    },
    openSettings() { this.isSettingsOpen = true },
    closeSettings() { this.isSettingsOpen = false },
    toggleSound() {
      this.settings.isSoundEnabled = !this.settings.isSoundEnabled
      this.saveData()
    },
    applyTheme() {
      const isDark = this.settings.theme === 'dark' || (this.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      if (isDark) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    },
    toggleTheme() {
      this.settings.theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
      this.applyTheme()
      this.saveData()
    },
    toggleCompactMode() {
      this.settings.isCompactMode = !this.settings.isCompactMode
      this.saveData()
    },

    // --- DATA MANAGEMENT ---
    async loadData() {
      try {
        const data = await storage.get('kanban_data')
        if (data && Array.isArray(data.columns) && Array.isArray(data.tasks)) {
          data.tasks.forEach(t => {
            if (t.assigneeId !== undefined) { t.assigneeIds = t.assigneeId ? [t.assigneeId] : []; delete t.assigneeId }
            if (!t.subtasks) t.subtasks = []
            if (t.color === undefined) t.color = 'default'
            if (t.isArchived === undefined) t.isArchived = false
            if (!t.dueDate) t.dueDate = null
          })
          data.columns.forEach(c => {
            if (c.wipLimit === undefined) c.wipLimit = 0
            if (c.width === 'w-64' || c.width === 'w-72') c.width = 'w-80'
          })
          if (data.settings.isCompactMode === undefined) data.settings.isCompactMode = false

          this.$patch({ settings: data.settings, assignees: data.assignees || [], boards: data.boards, columns: data.columns, tasks: data.tasks })
        } else {
          this.factoryReset(true)
        }
      } catch (e) {
        this.factoryReset(true)
      } finally {
        this.applyTheme()
        this.isLoaded = true
      }
    },

    async saveData() {
      if (!this.isLoaded) return
      clearTimeout(saveTimeout)
      saveTimeout = setTimeout(async () => {
        await storage.set('kanban_data', { settings: this.settings, assignees: this.assignees, boards: this.boards, columns: this.columns, tasks: this.tasks })
      }, 300)
    },

    async importWorkspace(jsonData) {
      if (jsonData && Array.isArray(jsonData.boards)) {
        this.$patch({
          settings: jsonData.settings || this.settings,
          assignees: jsonData.assignees || [],
          boards: jsonData.boards,
          columns: jsonData.columns,
          tasks: jsonData.tasks
        })
        await this.saveData()
        this.applyTheme()
        return true
      }
      return false
    },

    async factoryReset(force = false) {
      const resetData = () => {
        this.$patch({
          settings: { theme: 'system', activeBoardId: 'board-1', isCompactMode: false },
          assignees: [], tasks: [], assigneeFilterIds: [], currentView: 'board', isColumnsLocked: true,
          boards: [{ id: 'board-1', title: 'Main Project', background: null, createdAt: new Date().toISOString() }],
          columns: [
            { id: 'col-1', boardId: 'board-1', title: 'To Do', order: 0, width: 'w-80', isArchive: false, wipLimit: 0 },
            { id: 'col-2', boardId: 'board-1', title: 'Done', order: 1, width: 'w-80', isArchive: true, wipLimit: 0 }
          ]
        })
      }
      if (force) { resetData(); return }
      const confirmed = await this.requestDialog({ type: 'confirm', title: 'FACTORY RESET', message: 'Are you absolutely sure? ALL your boards, tasks, and employees will be permanently deleted!', confirmText: 'Yes, Delete Everything', isDanger: true })
      if (confirmed) {
        resetData()
        await this.saveData()
        this.applyTheme()
        this.closeSettings()
      }
    },

    // --- BOARDS ---
    addBoard(title) {
      const newBoard = { id: generateId('board'), title, background: null, createdAt: new Date().toISOString() }
      this.boards.push(newBoard)
      this.settings.activeBoardId = newBoard.id
      this.addColumn(newBoard.id, 'To Do', false)
      this.addColumn(newBoard.id, 'Done', true)
    },
    renameBoard(id, newTitle) {
      const board = this.boards.find(b => b.id === id)
      if (board) board.title = newTitle
    },
    updateBoardBackground(id, bg) {
      const board = this.boards.find(b => b.id === id)
      if (board) { board.background = bg; this.saveData() }
    },
    async deleteActiveBoard() {
      const confirmed = await this.requestDialog({ type: 'confirm', title: 'Delete Board', message: 'Are you sure? Archived tasks will be saved, but active columns and tasks will be deleted.', confirmText: 'Delete Board', isDanger: true })
      if(confirmed) {
         const boardId = this.settings.activeBoardId
         const colIds = this.columns.filter(c => c.boardId === boardId).map(c => c.id)
         this.tasks = this.tasks.filter(t => t.isArchived || !colIds.includes(t.columnId))
         this.columns = this.columns.filter(c => c.boardId !== boardId)
         this.boards = this.boards.filter(b => b.id !== boardId)
         this.settings.activeBoardId = this.boards.length > 0 ? this.boards[0].id : null
      }
    },
    duplicateBoard() {
      const board = this.activeBoard
      if(!board) return
      const newBoardId = generateId('board')
      this.boards.push({ id: newBoardId, title: board.title + ' (Copy)', background: board.background, createdAt: new Date().toISOString() })
      const colMapping = {}
      this.columns.filter(c => c.boardId === board.id).forEach(c => {
         const newColId = generateId('col')
         colMapping[c.id] = newColId
         this.columns.push({ ...c, id: newColId, boardId: newBoardId })
      })
      this.tasks.filter(t => colMapping[t.columnId]).forEach(t => {
         this.tasks.push({ ...t, id: generateId('task'), columnId: colMapping[t.columnId] })
      })
      this.settings.activeBoardId = newBoardId
    },
    moveBoard(boardId, direction) {
      const idx = this.boards.findIndex(b => b.id === boardId)
      if (idx === -1) return
      const newIdx = idx + direction
      if (newIdx >= 0 && newIdx < this.boards.length) {
        const temp = this.boards[idx]
        this.boards[idx] = this.boards[newIdx]
        this.boards[newIdx] = temp
      }
    },

    // --- COLUMNS ---
    addColumn(boardId, title, isArchive = false) {
      this.columns.push({ id: generateId('col'), boardId, title, order: this.columns.filter(c => c.boardId === boardId).length, width: 'w-80', isArchive, wipLimit: 0 })
    },
    updateColumn(id, updates) {
      const index = this.columns.findIndex(c => c.id === id)
      if (index !== -1) this.columns[index] = { ...this.columns[index], ...updates }
    },
    deleteColumn(id) {
      this.columns = this.columns.filter(c => c.id !== id)
      this.tasks = this.tasks.filter(t => t.columnId !== id)
    },
    toggleColumnArchive(columnId) {
      const col = this.columns.find(c => c.id === columnId)
      if (col) col.isArchive = !col.isArchive
    },
    setColumnWip(columnId, limit) {
      const col = this.columns.find(c => c.id === columnId)
      if (col) col.wipLimit = parseInt(limit) || 0
    },
    moveColumn(columnId, direction) {
      const columns = this.activeColumns
      const idx = columns.findIndex(c => c.id === columnId)
      if (idx === -1) return
      const newIdx = idx + direction
      if (newIdx >= 0 && newIdx < columns.length) {
        const tempOrder = columns[idx].order
        columns[idx].order = columns[newIdx].order
        columns[newIdx].order = tempOrder
      }
    },

    // --- TASKS ---
    archiveTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId)
      if (task) {
        task.isArchived = true
        task.archivedAt = new Date().toISOString()
        const col = this.columns.find(c => c.id === task.columnId)
        if (col) task.originalBoardId = col.boardId
      }
    },
    unarchiveTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId)
      if (task && this.activeColumns.length > 0) {
        task.isArchived = false
        task.columnId = this.activeColumns[0].id
      }
    },
    archiveAllInColumn(columnId) {
      const col = this.columns.find(c => c.id === columnId)
      this.tasks.filter(t => t.columnId === columnId && !t.isArchived).forEach(t => {
        t.isArchived = true
        t.archivedAt = new Date().toISOString()
        t.originalBoardId = col ? col.boardId : null
      })
    },

    openNewTaskModal(columnId = null) {
      const targetColId = columnId || (this.activeColumns[0]?.id)
      if (!targetColId) return
      this.editingTask = {
        id: generateId('task'), columnId: targetColId, assigneeIds: [], color: 'default',
        subtasks: [], links: [], title: '', description: '', dueDate: null, // <-- Добавили links: []
        order: this.tasks.filter(t => t.columnId === targetColId).length,
        createdAt: new Date().toISOString(), closedAt: null, closingComment: null,
        isNew: true, isArchived: false
      }
      this.isModalOpen = true
    },
    openEditTaskModal(task) {
      this.editingTask = JSON.parse(JSON.stringify(task))
      if(!this.editingTask.assigneeIds) this.editingTask.assigneeIds = []
      if(!this.editingTask.subtasks) this.editingTask.subtasks = []
      if(!this.editingTask.links) this.editingTask.links = [] // <-- Добавили поддержку ссылок для старых задач
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
        const i = this.tasks.findIndex(t => t.id === taskData.id)
        if (i !== -1) this.tasks[i] = taskData
      }
      this.closeModal()
    },
    toggleSubtask(taskId, subtaskIdx) {
      const task = this.tasks.find(t => t.id === taskId)
      if (task && task.subtasks[subtaskIdx]) {
        task.subtasks[subtaskIdx].done = !task.subtasks[subtaskIdx].done
        this.saveData()
      }
    },
    deleteTask(taskId) {
      this.tasks = this.tasks.filter(t => t.id !== taskId)
      this.closeModal()
    },

    searchTasks(query, scope = 'current') {
      const q = query.toLowerCase().trim()
      if (!q) return []
      let tasksToSearch = scope === 'current'
        ? this.tasks.filter(t => this.activeColumns.map(c=>c.id).includes(t.columnId) && !t.isArchived)
        : this.tasks.filter(t => !t.isArchived)

      return tasksToSearch.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.closingComment?.toLowerCase().includes(q)
      )
    },
    setHighlight(taskId) {
      this.highlightedTaskId = taskId
      setTimeout(() => {
        if (this.highlightedTaskId === taskId) this.highlightedTaskId = null
      }, 3000)
    },

    // --- ASSIGNEES ---
    addAssignee() {
      const newUser = { id: generateId('user'), name: 'New Employee', initials: 'EE', color: '#6366f1', avatar: null }
      this.assignees.push(newUser)
      return newUser
    },
    updateAssignee(id, updates) {
      const i = this.assignees.findIndex(a => a.id === id)
      if (i !== -1) this.assignees[i] = { ...this.assignees[i], ...updates }
    },
    deleteAssignee(id) {
      this.tasks.forEach(t => {
        if (t.assigneeIds) t.assigneeIds = t.assigneeIds.filter(aId => aId !== id)
      })
      this.assignees = this.assignees.filter(a => a.id !== id)
      this.assigneeFilterIds = this.assigneeFilterIds.filter(fId => fId !== id)
    },
    toggleAssigneeFilter(id) {
      const idx = this.assigneeFilterIds.indexOf(id)
      if (idx === -1) this.assigneeFilterIds.push(id)
      else this.assigneeFilterIds.splice(idx, 1)
    }
  }
})