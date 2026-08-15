import { defineStore } from 'pinia'
import { pushGist, pullGist, fetchGistMeta } from '../utils/cloudSync'

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

// Fresh default workspace. A factory (not a shared const) so every reset gets
// its own object references and a current createdAt timestamp.
const createDefaultState = () => ({
  settings: { theme: 'system', activeBoardId: 'board-1', isCompactMode: false, isSoundEnabled: true },
  assignees: [{ id: 'user-1', name: 'Anton Borodinskiy', initials: 'AB', color: '#3B82F6', avatar: null }],
  boards: [{ id: 'board-1', title: 'Main Project', background: null, createdAt: new Date().toISOString() }],
  columns: [
    { id: 'col-1', boardId: 'board-1', title: 'To Do', order: 0, width: 'w-80', isArchive: false, wipLimit: 0 },
    { id: 'col-2', boardId: 'board-1', title: 'Done', order: 1, width: 'w-80', isArchive: true, wipLimit: 0 }
  ],
  tasks: []
})

// Upgrades data saved by any older version to the current shape. This is the
// single place migrations live, so loading and importing behave identically and
// no existing tables/tasks are ever lost when the format evolves.
const migrateData = (data) => {
  const defaults = createDefaultState()
  const settings = { ...defaults.settings, ...(data.settings && typeof data.settings === 'object' ? data.settings : {}) }
  const assignees = Array.isArray(data.assignees) ? data.assignees : defaults.assignees
  const boards = Array.isArray(data.boards) && data.boards.length ? data.boards : defaults.boards
  const columns = Array.isArray(data.columns) ? data.columns : []
  const tasks = Array.isArray(data.tasks) ? data.tasks : []

  tasks.forEach(t => {
    if (t.assigneeId !== undefined) { t.assigneeIds = t.assigneeId ? [t.assigneeId] : []; delete t.assigneeId }
    if (!Array.isArray(t.assigneeIds)) t.assigneeIds = []
    if (!Array.isArray(t.subtasks)) t.subtasks = []
    if (!Array.isArray(t.links)) t.links = []
    if (t.color === undefined) t.color = 'default'
    if (t.isArchived === undefined) t.isArchived = false
    if (!t.dueDate) t.dueDate = null
  })
  columns.forEach(c => {
    if (c.wipLimit === undefined) c.wipLimit = 0
    if (c.width === 'w-64' || c.width === 'w-72') c.width = 'w-80'
  })

  // Keep the active board pointing at something that still exists.
  if (!boards.some(b => b.id === settings.activeBoardId)) settings.activeBoardId = boards[0]?.id || null

  return { settings, assignees, boards, columns, tasks }
}

// Monotonic counter guarantees uniqueness even when many ids are minted inside a
// single synchronous loop (e.g. duplicateBoard), where Date.now() is constant and
// the random suffix alone collides often (~71% for 50 items).
let idCounter = 0
const generateId = (prefix) => `${prefix}-${Date.now()}-${(idCounter++).toString(36)}-${Math.floor(Math.random() * 1000)}`
let saveTimeout = null;
// When true, saveData() is a no-op — used while applying an external change from
// another tab so we don't echo it straight back to storage.
let suppressSave = false
// Guards so the cross-tab listener is bound once and the quota warning isn't spammed.
let syncBound = false
let storageErrorShown = false
// Debounce for auto-pushing to the cloud after local changes.
let cloudPushTimeout = null
// Undo state kept in module scope: holds the restore closure + its timer so the
// (non-serializable) function never lands in reactive state or gets persisted.
let undoRestore = null
let undoTimer = null
// Local restore points.
const MAX_SNAPSHOTS = 10
const SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000
let lastSnapshotAt = 0
// Serialized copy of what we last wrote, so the cross-tab echo check doesn't
// have to re-stringify the whole reactive state on every save.
let lastWrittenJson = null

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
    // Serialized snapshot of the task as opened, to detect unsaved edits on close.
    editingTaskSnapshot: null,
    dialog: { isOpen: false, type: 'confirm', title: '', message: '', confirmText: 'OK', isDanger: false, inputValue: '', resolve: null },
    isSettingsOpen: false,
    settingsTab: 'team',
    highlightedTaskId: null,
    currentView: 'board',
    assigneeFilterIds: [],
    isColumnsLocked: true,
    isDraggingTask: false,
    // Cloud sync config — stored separately from the workspace so the token is
    // never included in exported/imported backups. cloudUpdatedAt is the gist's
    // server-side updated_at at our last sync, used to detect remote changes.
    sync: { token: '', gistId: '', autoPush: false, lastSyncedAt: null, cloudUpdatedAt: null, status: '', busy: false, conflict: false },
    // Transient "Deleted · Undo" toast.
    undo: { visible: false, message: '' },
    // Per-card expanded checklist/links/description sections, keyed by task id (UI only).
    expandedSubtasks: {},
    expandedLinks: {},
    expandedDesc: {}
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
    openSettings(tab = null) {
      if (tab) this.settingsTab = tab
      this.isSettingsOpen = true
    },
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
        // Only require the core `columns` table to recognise this as our data;
        // migrateData fills in everything else so partial/old saves survive.
        if (data && Array.isArray(data.columns)) {
          this.$patch(migrateData(data))
        } else {
          this.factoryReset(true)
        }
      } catch (e) {
        console.error('Failed to load kanban data:', e)
        this.factoryReset(true)
      } finally {
        await this.loadSync()
        this.applyTheme()
        this.isLoaded = true
      }
    },

    async saveData() {
      if (!this.isLoaded || suppressSave) return
      clearTimeout(saveTimeout)
      saveTimeout = setTimeout(async () => {
        try {
          const payload = { settings: this.settings, assignees: this.assignees, boards: this.boards, columns: this.columns, tasks: this.tasks }
          // Stringify once and reuse for the cross-tab echo check below.
          lastWrittenJson = JSON.stringify(payload)
          await storage.set('kanban_data', payload)
          this.maybeAutoSnapshot()
          this.maybeAutoPush()
        } catch (e) {
          console.error('Failed to save kanban data:', e)
          this.notifyStorageError()
        }
      }, 300)
    },

    // --- SNAPSHOTS (local restore points) ---
    // Kept under their own storage key so they never ride along in exports or
    // cloud pushes. Bounded to MAX_SNAPSHOTS newest-first.
    async saveSnapshot(reason) {
      try {
        const existing = (await storage.get('kanban_snapshots')) || []
        const entry = {
          at: new Date().toISOString(),
          reason,
          counts: { boards: this.boards.length, columns: this.columns.length, tasks: this.tasks.length },
          data: { settings: this.settings, assignees: this.assignees, boards: this.boards, columns: this.columns, tasks: this.tasks }
        }
        await storage.set('kanban_snapshots', [entry, ...existing].slice(0, MAX_SNAPSHOTS))
      } catch (e) { console.error('Failed to save snapshot:', e) }
    },
    async listSnapshots() {
      try {
        const list = (await storage.get('kanban_snapshots')) || []
        return list.map(({ at, reason, counts }) => ({ at, reason, counts }))
      } catch (e) { return [] }
    },
    async restoreSnapshot(index) {
      const list = (await storage.get('kanban_snapshots')) || []
      const entry = list[index]
      if (!entry || !Array.isArray(entry.data?.columns)) return false
      await this.saveSnapshot('before restore')
      this.$patch(migrateData(entry.data))
      this.applyTheme()
      await this.saveData()
      return true
    },
    // Auto-snapshot at most once an hour on normal edits.
    maybeAutoSnapshot() {
      const now = Date.now()
      if (now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return
      lastSnapshotAt = now
      this.saveSnapshot('auto')
    },

    // Warn once when storage is full so changes aren't silently dropped.
    notifyStorageError() {
      if (storageErrorShown) return
      storageErrorShown = true
      this.requestDialog({
        type: 'confirm',
        title: 'Storage Full',
        message: 'Your latest changes could not be saved because the browser storage limit was reached. Remove large board backgrounds or avatars, or export a backup and delete old boards to free space.',
        confirmText: 'OK'
      }).then(() => { storageErrorShown = false })
    },

    // Keep multiple open tabs of the extension in sync: when another tab writes
    // new data, adopt it here (unless we're mid-edit) instead of clobbering it.
    setupSync() {
      if (syncBound || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) return
      syncBound = true
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.kanban_data) return
        const newVal = changes.kanban_data.newValue
        if (!newVal) return
        // Compare against what we last wrote instead of re-stringifying the whole
        // reactive state (which walked every getter on every single save).
        if (JSON.stringify(newVal) === lastWrittenJson) return // our own write / no-op echo
        if (this.isModalOpen || this.isSettingsOpen || this.dialog.isOpen) return // don't interrupt an edit
        suppressSave = true
        try { this.$patch(migrateData(newVal)) } finally { suppressSave = false }
        this.applyTheme()
      })
    },

    // --- CLOUD SYNC (GitHub Gist) ---
    async loadSync() {
      try {
        const s = await storage.get('kanban_sync')
        if (s && typeof s === 'object') {
          this.sync = { ...this.sync, token: s.token || '', gistId: s.gistId || '', autoPush: !!s.autoPush, lastSyncedAt: s.lastSyncedAt || null, cloudUpdatedAt: s.cloudUpdatedAt || null }
        }
      } catch (e) { console.error('Failed to load sync config:', e) }
    },
    async saveSyncConfig() {
      await storage.set('kanban_sync', {
        token: this.sync.token, gistId: this.sync.gistId, autoPush: this.sync.autoPush, lastSyncedAt: this.sync.lastSyncedAt, cloudUpdatedAt: this.sync.cloudUpdatedAt
      })
    },
    // auto=true suppresses dialogs (used by background auto-push): on conflict it
    // pauses instead of prompting or blindly overwriting.
    async cloudPush(auto = false) {
      if (this.sync.busy) return false
      const token = this.sync.token.trim(), gistId = this.sync.gistId.trim()
      // Conflict guard: has the gist changed elsewhere since our last sync?
      if (gistId && this.sync.cloudUpdatedAt) {
        try {
          const meta = await fetchGistMeta(token, gistId)
          if (meta.updatedAt && new Date(meta.updatedAt) > new Date(this.sync.cloudUpdatedAt)) {
            if (auto) {
              this.sync.conflict = true
              this.sync.status = 'Auto-upload paused: cloud was changed on another device. Open Cloud Sync to resolve.'
              return false
            }
            const overwrite = await this.requestDialog({ type: 'confirm', title: 'Cloud changed elsewhere', message: 'The cloud copy was updated on another device after your last sync. Overwrite it with this device’s version?', confirmText: 'Overwrite cloud', isDanger: true })
            if (!overwrite) { this.sync.status = 'Upload cancelled.'; return false }
          }
        } catch (e) { /* offline / meta failed — fall through and try the push */ }
      }
      this.sync.busy = true
      this.sync.status = gistId ? 'Uploading…' : 'Creating cloud backup…'
      try {
        const data = { settings: this.settings, assignees: this.assignees, boards: this.boards, columns: this.columns, tasks: this.tasks }
        const res = await pushGist(token, gistId, data)
        this.sync.gistId = res.id
        this.sync.cloudUpdatedAt = res.updatedAt
        this.sync.lastSyncedAt = new Date().toISOString()
        this.sync.conflict = false
        this.sync.status = 'Uploaded ✓'
        await this.saveSyncConfig()
        return true
      } catch (e) {
        this.sync.status = 'Error: ' + e.message
        return false
      } finally { this.sync.busy = false }
    },
    async cloudPull(skipConfirm = false) {
      if (this.sync.busy) return false
      if (!skipConfirm) {
        const confirmed = await this.requestDialog({ type: 'confirm', title: 'Pull from Cloud', message: 'This replaces your current local workspace with the cloud backup. Continue?', confirmText: 'Pull & Overwrite', isDanger: true })
        if (!confirmed) return false
      }
      this.sync.busy = true
      this.sync.status = 'Downloading…'
      try {
        await this.saveSnapshot('before cloud download')
        const res = await pullGist(this.sync.token.trim(), this.sync.gistId.trim())
        if (!res.data || !Array.isArray(res.data.columns)) throw new Error('Cloud backup is not a valid workspace.')
        this.$patch(migrateData(res.data))
        this.applyTheme()
        await this.saveData()
        this.sync.cloudUpdatedAt = res.updatedAt
        this.sync.lastSyncedAt = new Date().toISOString()
        this.sync.conflict = false
        this.sync.status = 'Downloaded ✓'
        await this.saveSyncConfig()
        return true
      } catch (e) {
        this.sync.status = 'Error: ' + e.message
        return false
      } finally { this.sync.busy = false }
    },
    // On startup, if the gist is newer than our last sync, offer to pull it.
    async checkCloudOnStartup() {
      const token = this.sync.token.trim(), gistId = this.sync.gistId.trim()
      if (!token || !gistId || !this.sync.cloudUpdatedAt) return
      try {
        const meta = await fetchGistMeta(token, gistId)
        if (meta.updatedAt && new Date(meta.updatedAt) > new Date(this.sync.cloudUpdatedAt)) {
          this.sync.conflict = true
          const pull = await this.requestDialog({ type: 'confirm', title: 'Cloud has newer data', message: 'Your workspace was updated on another device. Load the latest version from the cloud? (Your current local data will be replaced.)', confirmText: 'Load from cloud' })
          if (pull) await this.cloudPull(true)
          else this.sync.status = 'Using local copy — cloud has newer changes.'
        }
      } catch (e) { /* offline — ignore */ }
    },
    async setAutoPush(enabled) {
      this.sync.autoPush = enabled
      await this.saveSyncConfig()
    },
    async disconnectCloud() {
      this.sync = { token: '', gistId: '', autoPush: false, lastSyncedAt: null, cloudUpdatedAt: null, status: '', busy: false, conflict: false }
      await this.saveSyncConfig()
    },
    // Debounced background upload after local edits (only when enabled & connected).
    maybeAutoPush() {
      if (!this.sync.autoPush || !this.sync.token || !this.sync.gistId || this.sync.busy) return
      clearTimeout(cloudPushTimeout)
      cloudPushTimeout = setTimeout(() => { this.cloudPush(true) }, 3000)
    },

    // Describes an incoming backup so the user can confirm before it replaces
    // everything. Returns null when the file isn't a recognizable workspace.
    describeWorkspace(jsonData) {
      // `columns` is the core table (same requirement as loadData) — accepting a
      // file without it would wipe every column and orphan every task.
      if (!jsonData || typeof jsonData !== 'object' || !Array.isArray(jsonData.columns)) return null
      return {
        boards: Array.isArray(jsonData.boards) ? jsonData.boards.length : 0,
        columns: jsonData.columns.length,
        tasks: Array.isArray(jsonData.tasks) ? jsonData.tasks.length : 0
      }
    },
    async importWorkspace(jsonData) {
      if (!this.describeWorkspace(jsonData)) return false
      // Snapshot first so a wrong-file import is recoverable.
      await this.saveSnapshot('before import')
      this.$patch(migrateData(jsonData))
      await this.saveData()
      this.applyTheme()
      return true
    },

    async factoryReset(force = false) {
      const resetData = () => {
        this.$patch({ ...createDefaultState(), assigneeFilterIds: [], currentView: 'board', isColumnsLocked: true })
      }
      if (force) { resetData(); return }
      const confirmed = await this.requestDialog({ type: 'confirm', title: 'FACTORY RESET', message: 'Are you absolutely sure? ALL your boards, tasks, and employees will be permanently deleted!', confirmText: 'Yes, Delete Everything', isDanger: true })
      if (confirmed) {
        await this.saveSnapshot('before factory reset')
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
         const removedBoard = this.boards.find(b => b.id === boardId)
         const removedColumns = this.columns.filter(c => c.boardId === boardId)
         const colIds = removedColumns.map(c => c.id)
         const removedTasks = this.tasks.filter(t => !t.isArchived && colIds.includes(t.columnId))
         this.tasks = this.tasks.filter(t => t.isArchived || !colIds.includes(t.columnId))
         this.columns = this.columns.filter(c => c.boardId !== boardId)
         this.boards = this.boards.filter(b => b.id !== boardId)
         this.settings.activeBoardId = this.boards.length > 0 ? this.boards[0].id : null
         this.pushUndo('Board deleted', () => {
           if (removedBoard) this.boards.push(removedBoard)
           this.columns.push(...removedColumns)
           this.tasks.push(...removedTasks)
           this.settings.activeBoardId = boardId
         })
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
      // Only active tasks: archived ones merely retain their old columnId and
      // belong to the Global Archive — copying them would duplicate the archive.
      this.tasks.filter(t => !t.isArchived && colMapping[t.columnId]).forEach(t => {
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
      // Guard: without a board the column would be invisible forever.
      if (!boardId) return
      // max+1 rather than a count, which went stale after a deletion and produced
      // two columns sharing an order (making the reorder arrows silently no-op).
      const siblings = this.columns.filter(c => c.boardId === boardId)
      const nextOrder = siblings.length ? Math.max(...siblings.map(c => c.order ?? 0)) + 1 : 0
      this.columns.push({ id: generateId('col'), boardId, title, order: nextOrder, width: 'w-80', isArchive, wipLimit: 0 })
    },
    updateColumn(id, updates) {
      const index = this.columns.findIndex(c => c.id === id)
      if (index !== -1) this.columns[index] = { ...this.columns[index], ...updates }
    },
    deleteColumn(id) {
      const removedColumn = this.columns.find(c => c.id === id)
      if (!removedColumn) return
      // Archived tasks keep their original columnId but belong to the Global
      // Archive — they must survive, exactly as deleteActiveBoard preserves them.
      const removedTasks = this.tasks.filter(t => t.columnId === id && !t.isArchived)
      this.columns = this.columns.filter(c => c.id !== id)
      this.tasks = this.tasks.filter(t => !(t.columnId === id && !t.isArchived))
      this.pushUndo('Column deleted', () => {
        this.columns.push(removedColumn)
        this.tasks.push(...removedTasks)
      })
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
      const columns = [...this.activeColumns]
      const idx = columns.findIndex(c => c.id === columnId)
      if (idx === -1) return
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= columns.length) return
      // Reposition then renumber sequentially. Swapping order *values* was a
      // silent no-op whenever two columns happened to share the same order.
      const [moved] = columns.splice(idx, 1)
      columns.splice(newIdx, 0, moved)
      columns.forEach((c, i) => { c.order = i })
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
      if (!task) return
      // Prefer restoring into the board the task came from; fall back to the
      // active board only if that original board no longer exists.
      let target = this.columns.filter(c => c.boardId === task.originalBoardId).sort((a, b) => a.order - b.order)
      if (target.length === 0) target = this.activeColumns
      if (target.length === 0) return
      const columnId = target[0].id
      task.isArchived = false
      task.columnId = columnId
      // Place at the end. Keeping the order it had when archived made a restored
      // card reappear above cards that were already there.
      const siblings = this.tasks.filter(t => t.columnId === columnId && !t.isArchived && t.id !== task.id)
      task.order = siblings.length ? Math.max(...siblings.map(t => t.order ?? 0)) + 1 : 0
      // It's no longer archived, so a stale archivedAt would skew the archive's
      // date sorting if it is ever archived again.
      task.archivedAt = null
      this.syncClosedAt(task.id)
    },
    archiveAllInColumn(columnId) {
      const col = this.columns.find(c => c.id === columnId)
      const affected = this.tasks.filter(t => t.columnId === columnId && !t.isArchived)
      if (affected.length === 0) return
      // Remember prior values so the archive can be undone like a deletion.
      const before = affected.map(t => ({ id: t.id, archivedAt: t.archivedAt, originalBoardId: t.originalBoardId }))
      affected.forEach(t => {
        t.isArchived = true
        t.archivedAt = new Date().toISOString()
        t.originalBoardId = col ? col.boardId : null
      })
      this.pushUndo(`${affected.length} tasks archived`, () => {
        before.forEach(prev => {
          const t = this.tasks.find(x => x.id === prev.id)
          if (t) { t.isArchived = false; t.archivedAt = prev.archivedAt; t.originalBoardId = prev.originalBoardId }
        })
      })
    },
    // A task entering a Done/archive column is "closed"; leaving one reopens it.
    // Keeps the previously dead `closedAt` field meaningful for analytics.
    syncClosedAt(taskId) {
      const task = this.tasks.find(t => t.id === taskId)
      if (!task) return
      const col = this.columns.find(c => c.id === task.columnId)
      if (col?.isArchive) { if (!task.closedAt) task.closedAt = new Date().toISOString() }
      else if (task.closedAt) task.closedAt = null
    },

    openNewTaskModal(columnId = null) {
      const targetColId = columnId || (this.activeColumns[0]?.id)
      if (!targetColId) return
      // Place after the current last task. A plain count went stale after any
      // deletion (and counted archived tasks), colliding with an existing order
      // and dropping new cards into the middle of the column.
      const active = this.tasks.filter(t => t.columnId === targetColId && !t.isArchived)
      const nextOrder = active.length ? Math.max(...active.map(t => t.order ?? 0)) + 1 : 0
      this.editingTask = {
        id: generateId('task'), columnId: targetColId, assigneeIds: [], color: 'default',
        subtasks: [], links: [], title: '', description: '', dueDate: null, // <-- Добавили links: []
        order: nextOrder,
        createdAt: new Date().toISOString(), closedAt: null, closingComment: null,
        isNew: true, isArchived: false
      }
      this.isModalOpen = true
      this.editingTaskSnapshot = JSON.stringify(this.editingTask)
    },
    openEditTaskModal(task) {
      this.editingTask = JSON.parse(JSON.stringify(task))
      if(!this.editingTask.assigneeIds) this.editingTask.assigneeIds = []
      if(!this.editingTask.subtasks) this.editingTask.subtasks = []
      if(!this.editingTask.links) this.editingTask.links = [] // <-- Добавили поддержку ссылок для старых задач
      this.isModalOpen = true
      // Snapshot AFTER defaults are applied, so simply opening a task isn't "dirty".
      this.editingTaskSnapshot = JSON.stringify(this.editingTask)
    },
    // True when the open task has edits that differ from how it was opened.
    isEditingDirty() {
      if (!this.isModalOpen || !this.editingTask) return false
      return JSON.stringify(this.editingTask) !== this.editingTaskSnapshot
    },
    // Close entry point that warns before throwing away unsaved edits.
    async attemptCloseModal() {
      if (this.isEditingDirty()) {
        const discard = await this.requestDialog({
          type: 'confirm',
          title: 'Discard changes?',
          message: 'You have unsaved changes in this task. Close without saving?',
          confirmText: 'Discard',
          isDanger: true
        })
        if (!discard) return
      }
      this.closeModal()
    },
    closeModal() {
      this.isModalOpen = false
      this.editingTask = null
      this.editingTaskSnapshot = null
    },

    // --- UNDO (deletions) ---
    pushUndo(message, restoreFn) {
      clearTimeout(undoTimer)
      undoRestore = restoreFn
      this.undo = { visible: true, message }
      undoTimer = setTimeout(() => this.dismissUndo(), 7000)
    },
    performUndo() {
      clearTimeout(undoTimer)
      if (undoRestore) { undoRestore(); undoRestore = null }
      this.undo = { visible: false, message: '' }
    },
    dismissUndo() {
      clearTimeout(undoTimer)
      undoRestore = null
      this.undo = { visible: false, message: '' }
    },

    // --- CARD EXPAND/COLLAPSE ---
    toggleCardSection(kind, taskId) {
      const map = kind === 'links' ? this.expandedLinks : kind === 'desc' ? this.expandedDesc : this.expandedSubtasks
      map[taskId] = !map[taskId]
    },
    expandAllCards() {
      this.tasks.forEach(t => {
        if (t.subtasks?.length) this.expandedSubtasks[t.id] = true
        if (t.links?.length) this.expandedLinks[t.id] = true
        if (t.description) this.expandedDesc[t.id] = true
      })
    },
    collapseAllCards() {
      // Mutate in place (don't reassign) so components holding a reference stay live.
      Object.keys(this.expandedSubtasks).forEach(k => delete this.expandedSubtasks[k])
      Object.keys(this.expandedLinks).forEach(k => delete this.expandedLinks[k])
      Object.keys(this.expandedDesc).forEach(k => delete this.expandedDesc[k])
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
    // Bulk delete with a single undo entry — deleting archived tasks one by one
    // meant one confirm dialog per task.
    deleteTasks(taskIds) {
      const ids = new Set(taskIds)
      const removed = this.tasks.filter(t => ids.has(t.id))
      if (removed.length === 0) return
      this.tasks = this.tasks.filter(t => !ids.has(t.id))
      this.pushUndo(`${removed.length} tasks deleted`, () => { this.tasks.push(...removed) })
    },
    toggleSubtask(taskId, subtaskIdx) {
      const task = this.tasks.find(t => t.id === taskId)
      if (task && task.subtasks[subtaskIdx]) {
        task.subtasks[subtaskIdx].done = !task.subtasks[subtaskIdx].done
        this.saveData()
      }
    },
    deleteTask(taskId) {
      const idx = this.tasks.findIndex(t => t.id === taskId)
      if (idx === -1) { this.closeModal(); return }
      const removed = this.tasks[idx]
      this.tasks.splice(idx, 1)
      this.closeModal()
      this.pushUndo('Task deleted', () => { this.tasks.push(removed) })
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