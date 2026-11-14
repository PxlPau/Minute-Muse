/* =============================================================================
   ui/tasks.js — the session task list
   A small, forgiving list: add, tick, rename in place, remove. Completed items
   sink to the bottom; the list is the session's intention, not a backlog.
   ========================================================================== */

import { $, escapeHtml, toast } from '../util.js';
import {
  tasks, addTask, toggleTask, removeTask, renameTask, clearCompletedTasks,
} from '../store.js';

export class TaskPanel {
  constructor({ onChange = () => {} } = {}) {
    this.list = $('#task-list');
    this.empty = $('#task-empty');
    this.form = $('#task-form');
    this.input = $('#task-input');
    this.count = $('#tasks-count');
    this.progress = $('#tasks-progress');
    this.summary = $('#tasks-summary');
    this.clearDone = $('#btn-clear-done');
    this.onChange = onChange;
    this.editingId = null;
  }

  init() {
    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const task = addTask(this.input.value);
      if (task) {
        this.input.value = '';
        this.render({ focusInput: true });
        this.onChange(tasks.value);
      }
    });

    this.list?.addEventListener('click', (event) => {
      const item = event.target.closest('[data-task-id]');
      if (!item) return;
      const { taskId } = item.dataset;
      const button = event.target.closest('button');
      if (!button) return;
      if (button.classList.contains('task__toggle')) {
        toggleTask(taskId);
        this.render();
        this.onChange(tasks.value);
      } else if (button.classList.contains('task__delete')) {
        removeTask(taskId);
        this.render();
        this.onChange(tasks.value);
      } else if (button.classList.contains('task__text')) {
        // A double-click (or Enter/Space, which fires click) begins renaming.
        this.beginEdit(taskId);
      }
    });

    this.list?.addEventListener('keydown', (event) => {
      if (!event.target.matches('.task__text') || this.editingId !== event.target.closest('[data-task-id]')?.dataset.taskId) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.editingId = null;
        this.render();
      }
    });

    this.list?.addEventListener('focusout', (event) => {
      if (event.target.matches('.task__text') && this.editingId) {
        const id = this.editingId;
        this.editingId = null;
        renameTask(id, event.target.textContent);
        this.render();
        this.onChange(tasks.value);
      }
    });

    this.clearDone?.addEventListener('click', async () => {
      if (!tasks.value.some((task) => task.done)) return;
      clearCompletedTasks();
      this.render();
      this.onChange(tasks.value);
      toast('Completed tasks cleared.', { icon: 'check-square' });
    });

    this.render();
  }

  beginEdit(id) {
    const button = this.list?.querySelector(`[data-task-id="${CSS.escape(id)}"] .task__text`);
    if (!button) return;
    this.editingId = id;
    button.contentEditable = 'true';
    button.focus();
    const range = document.createRange();
    range.selectNodeContents(button);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /** The first unfinished task — used as the session's intention. */
  activeTask() {
    return tasks.value.find((task) => !task.done) || null;
  }

  render({ focusInput = false } = {}) {
    if (!this.list) return;
    const all = tasks.value;
    const ordered = [...all].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const doneCount = all.filter((task) => task.done).length;

    this.list.innerHTML = ordered
      .map((task) => {
        const editing = this.editingId === task.id;
        return `
          <li class="task${task.done ? ' task--done' : ''}" data-task-id="${task.id}">
            <button class="task__toggle" type="button" aria-pressed="${task.done}" aria-label="${task.done ? 'Mark as not done' : 'Mark as done'}">
              <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
            </button>
            <button class="task__text" type="button" aria-label="Rename task: ${escapeHtml(task.text)}">${escapeHtml(task.text)}</button>
            <button class="task__delete" type="button" aria-label="Delete task">
              <svg class="icon icon--sm" aria-hidden="true"><use href="#i-x"></use></svg>
            </button>
          </li>`;
      })
      .join('');

    if (this.empty) this.empty.hidden = all.length > 0;
    if (this.count) this.count.textContent = `${doneCount} / ${all.length}`;
    if (this.progress) {
      const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0;
      this.progress.style.width = `${pct}%`;
    }
    if (this.summary) {
      if (!all.length) this.summary.textContent = 'No tasks yet';
      else if (doneCount === all.length) this.summary.textContent = 'Everything done — take the break';
      else this.summary.textContent = `${all.length - doneCount} to go`;
    }
    if (this.clearDone) this.clearDone.hidden = doneCount === 0;

    if (this.editingId) this.beginEdit(this.editingId);
    if (focusInput) this.input?.focus();
  }
}
