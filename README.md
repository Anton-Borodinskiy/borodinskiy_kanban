# Borodinskiy Kanban 📋

A modern, fast, and feature-rich Kanban board built as a Google Chrome Extension. It replaces your "New Tab" page or runs as a standalone window, helping you organize tasks, track progress, and manage your workflow without leaving your browser. All data is securely stored locally.

## ✨ Features

* **Intuitive Drag & Drop:** Easily move tasks and entire columns (powered by `vue-draggable-plus`). Drag a card to the bottom of the screen to delete or archive it.
* **Rich Task Management:**
    * Markdown descriptions and closing comments, with a formatting toolbar (bold, italic, headings, lists, links, code) and live preview.
    * Checklists (drag to reorder) and attached external links.
    * Task colors, due dates (with overdue/soon indicators), and assignees.
    * WIP limits per column, with an over-limit warning.
* **Dashboard & Analytics:** Built-in charts and statistics to visualize task completion and team workload.
* **Deep Customization:**
    * Light / Dark mode support.
    * Custom board backgrounds (gradients or images).
    * Compact UI mode, expand-all, and sound notifications toggle.
* **Privacy First:** Zero backend. All your data is saved locally in your browser using `chrome.storage.local`.

## 🛟 Your data is hard to lose

* **Undo** for every deletion — tasks, columns, boards, and bulk archive operations.
* **Restore points:** automatic local snapshots (hourly while you work, and always before an import, cloud download, or factory reset). Restore any of the last 10 from *Settings → Data*.
* **Unsaved-changes guards:** closing a card with edits — or the browser tab itself — asks first.
* **Safe import:** shows exactly what's in the file (boards / columns / tasks) versus what you have before replacing anything.
* **Schema migrations:** older saved data and older `.json` backups are upgraded automatically, so updating never drops your existing boards.

## ☁️ Cloud Sync (optional)

Sync your workspace across devices through a **private GitHub Gist** — no server required.

1. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=gist) with only the `gist` scope.
2. *Settings → Cloud Sync* → paste it → **Upload to Cloud**.
3. On another device, paste the same token and the Gist ID → **Download from Cloud**.

Optional auto-upload after every change. If the cloud copy was changed elsewhere, the app warns instead of overwriting, and a status icon in the header surfaces any sync problem. The token is stored locally and is never included in exports or backups.

## ⌨️ Shortcuts

| Key | Action |
| --- | --- |
| <kbd>N</kbd> | New task |
| <kbd>/</kbd> | Focus search |
| <kbd>?</kbd> | Shortcuts & tips |
| <kbd>Esc</kbd> | Close the top-most dialog |
| <kbd>Tab</kbd> + <kbd>Enter</kbd> | Move between cards and open one |

## 🚀 Build & Install

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.

## 🛠️ Tech Stack

* **Framework:** [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **State Management:** [Pinia](https://pinia.vuejs.org/)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
* **Icons:** [Heroicons](https://heroicons.com/)
* **Charts:** [Chart.js](https://www.chartjs.org/)
