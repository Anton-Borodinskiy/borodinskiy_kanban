# Borodinskiy Kanban 📋

A modern, fast, and feature-rich Kanban board built as a Google Chrome Extension. It replaces your "New Tab" page or runs as a standalone window, helping you organize tasks, track progress, and manage your workflow without leaving your browser. All data is securely stored locally.

## ✨ Features

* **Intuitive Drag & Drop:** Easily move tasks and entire columns (powered by `vue-draggable-plus`).
* **Rich Task Management:**
    * Markdown support for descriptions.
    * Checklists (subtasks) and attached external links.
    * Task colors, due dates (with overdue/soon indicators), and assignees.
* **Dashboard & Analytics:** Built-in charts and statistics to visualize task completion and team workload.
* **Deep Customization:**
    * Light / Dark mode support.
    * Custom board backgrounds (gradients or images).
    * Compact UI mode and sound notifications toggle.
* **Privacy First:** Zero backend. All your data is saved locally in your browser using `chrome.storage.local`.
* **Data Portability:** Export your entire board state as a `.json` file and import it anywhere.

## 🛠️ Tech Stack

* **Framework:** [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **State Management:** [Pinia](https://pinia.vuejs.org/)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
* **Icons:** [Heroicons](https://heroicons.com/)
* **Charts:** [Chart.js](https://www.chartjs.org/)
