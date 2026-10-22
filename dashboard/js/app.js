/* ═══════════════════════════════════════════════
   LIFE DASHBOARD — app.js
   Tech Stack : Vanilla JavaScript (ES6+)
   Storage    : localStorage (client-side only)
   Features   :
     1. Greeting (sapaan + jam real-time + tanggal)
     2. Focus Timer (Pomodoro: Start / Stop / Reset)
     3. To-Do List (tambah, edit, hapus, selesai)
     4. Quick Links (tambah & hapus, favicon)
     + Custom Name in Greeting
     + Light / Dark Mode toggle
   ═══════════════════════════════════════════════ */

'use strict';

// ─── UTILITY ─────────────────────────────────────────────────────────────────

/** Shorthand getElementById */
const $ = id => document.getElementById(id);

/** Save any value to localStorage (JSON-serialised) */
const saveLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

/** Load from localStorage; return fallback when key is absent */
const loadLS = (key, fallback) => {
  const raw = localStorage.getItem(key);
  return raw !== null ? JSON.parse(raw) : fallback;
};

/** Escape HTML to prevent XSS when inserting user-supplied text */
const esc = str =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Zero-pad a number to 2 digits */
const pad = n => String(n).padStart(2, '0');

/** Briefly display a toast notification at the bottom of the screen */
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}


// ═══════════════════════════════════════════════
// 1.  THEME (Light / Dark)
// ═══════════════════════════════════════════════

let isDark = loadLS('theme-dark', false);

/** Apply stored theme to <html> and update toggle button text */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const btn = $('theme-btn');
  btn.querySelector('.theme-icon').textContent  = isDark ? '☀️' : '🌙';
  btn.querySelector('.theme-label').textContent = isDark ? 'Light' : 'Dark';
}

function toggleTheme() {
  isDark = !isDark;
  saveLS('theme-dark', isDark);
  applyTheme();
}


// ═══════════════════════════════════════════════
// 2.  GREETING, CLOCK & CUSTOM NAME
// ═══════════════════════════════════════════════

let userName = loadLS('user-name', '');

/**
 * Return a localised greeting based on the current hour.
 * 05-11 → Pagi  | 12-14 → Siang  | 15-17 → Sore  | 18-04 → Malam
 */
function greetingFor(hour) {
  if (hour >= 5  && hour < 12) return 'Selamat Pagi';
  if (hour >= 12 && hour < 15) return 'Selamat Siang';
  if (hour >= 15 && hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

/** Indonesian full date string, e.g. "Kamis, 22 Oktober 2026" */
function formatDate(d) {
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Time string e.g. "09:05:33" */
function formatTime(d) {
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

/** Update greeting text, date, and live clock — called every second */
function tickClock() {
  const now    = new Date();
  const name   = userName ? `, ${userName}!` : '!';
  $('greeting-text').textContent = greetingFor(now.getHours()) + name;
  $('date-text').textContent     = formatDate(now);
  $('time-text').textContent     = formatTime(now);
}

// ── Name editing ──────────────────────────────

function openNameEditor() {
  $('greeting-text').style.display = 'none';
  $('greeting-hint').classList.add('hidden');
  const editor = $('name-editor');
  editor.classList.add('open');
  $('name-input').value = userName;
  $('name-input').focus();
  $('name-input').select();
}

function closeNameEditor() {
  $('name-editor').classList.remove('open');
  $('greeting-text').style.display = '';
  $('greeting-hint').classList.remove('hidden');
}

function saveName() {
  const val  = $('name-input').value.trim();
  userName   = val;
  saveLS('user-name', userName);
  closeNameEditor();
  tickClock();
  toast(userName ? `👋 Nama disimpan: "${userName}"` : '✔ Nama dihapus');
}

function initGreeting() {
  // Tick immediately, then every second
  tickClock();
  setInterval(tickClock, 1000);

  // Name editor events
  $('greeting-text').addEventListener('click', openNameEditor);
  $('greeting-text').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') openNameEditor();
  });
  $('name-save-btn').addEventListener('click', saveName);
  $('name-cancel-btn').addEventListener('click', closeNameEditor);
  $('name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveName();
    if (e.key === 'Escape') closeNameEditor();
  });
}


// ═══════════════════════════════════════════════
// 3.  FOCUS TIMER (Pomodoro)
// ═══════════════════════════════════════════════

/* SVG ring constants */
const RING_R      = 52;
const RING_CIRCUM = +(2 * Math.PI * RING_R).toFixed(2); // 326.73

let timerMin     = loadLS('timer-min', 25);  // user-chosen duration (minutes)
let timerTotal   = timerMin * 60;            // total seconds for current session
let timerLeft    = timerMin * 60;            // remaining seconds
let timerTick    = null;                     // setInterval handle
let timerRunning = false;

function initTimer() {
  // Configure ring SVG stroke dash
  const ring = $('ring-fill');
  ring.style.strokeDasharray  = RING_CIRCUM;
  ring.style.strokeDashoffset = 0;

  $('timer-duration').value = timerMin;
  renderTimer();

  $('btn-start').addEventListener('click', startTimer);
  $('btn-stop').addEventListener('click', stopTimer);
  $('btn-reset').addEventListener('click', resetTimer);
  $('timer-duration').addEventListener('change', changeTimerDuration);
}

/** Refresh the time display, ring progress, and status label */
function renderTimer() {
  const m = Math.floor(timerLeft / 60);
  const s = timerLeft % 60;
  $('timer-display').textContent = `${pad(m)}:${pad(s)}`;

  // Ring: offset 0 = full; offset = CIRCUM = empty
  const ratio  = timerTotal > 0 ? timerLeft / timerTotal : 1;
  $('ring-fill').style.strokeDashoffset = RING_CIRCUM * (1 - ratio);

  // Status label
  const statusEl = $('timer-status');
  if (timerRunning) {
    statusEl.textContent = '🔴 Sesi fokus sedang berjalan…';
  } else if (timerLeft === 0) {
    statusEl.textContent = '✅ Selesai! Waktunya istirahat.';
  } else {
    statusEl.textContent = `⏱ ${timerMin} menit — siap memulai`;
  }
}

function startTimer() {
  if (timerRunning || timerLeft === 0) return;
  timerRunning = true;
  $('btn-start').disabled = true;
  renderTimer();

  timerTick = setInterval(() => {
    timerLeft--;
    renderTimer();
    if (timerLeft <= 0) {
      clearInterval(timerTick);
      timerRunning = false;
      $('btn-start').disabled = false;
      renderTimer();
      toast('⏰ Sesi fokus selesai! Waktunya istirahat 🎉');
    }
  }, 1000);
}

function stopTimer() {
  if (!timerRunning) return;
  clearInterval(timerTick);
  timerRunning = false;
  $('btn-start').disabled = false;
  renderTimer();
}

function resetTimer() {
  stopTimer();
  timerLeft = timerTotal;
  renderTimer();
}

function changeTimerDuration() {
  let val = parseInt($('timer-duration').value, 10);
  if (isNaN(val) || val < 1)  val = 1;
  if (val > 180)              val = 180;
  $('timer-duration').value = val;

  timerMin   = val;
  timerTotal = val * 60;
  timerLeft  = timerTotal;
  saveLS('timer-min', timerMin);
  stopTimer();
  renderTimer();
}


// ═══════════════════════════════════════════════
// 4.  TO-DO LIST
// ═══════════════════════════════════════════════

/* Shape: { id: number, text: string, done: boolean }[] */
let todos    = loadLS('todos', []);
let sortMode = loadLS('todo-sort', 'default'); // 'default' | 'az' | 'pending'

function initTodo() {
  $('todo-add-btn').addEventListener('click', addTodo);
  $('todo-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
  });
  $('todo-input').addEventListener('input', clearDupWarn);

  // Sort pills
  $('sort-default').addEventListener('click', () => setSort('default'));
  $('sort-az').addEventListener('click',      () => setSort('az'));
  $('sort-pending').addEventListener('click', () => setSort('pending'));

  applySortPills();
  renderTodos();
}

function setSort(mode) {
  sortMode = mode;
  saveLS('todo-sort', sortMode);
  applySortPills();
  renderTodos();
}

function applySortPills() {
  ['default', 'az', 'pending'].forEach(m => {
    const btn = $(`sort-${m}`);
    const active = sortMode === m;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function sortedTodos() {
  const copy = [...todos];
  if (sortMode === 'az') {
    copy.sort((a, b) => a.text.localeCompare(b.text, 'id'));
  } else if (sortMode === 'pending') {
    // Pending (done=false) first, then completed
    copy.sort((a, b) => Number(a.done) - Number(b.done));
  }
  return copy;
}

function updateBadge() {
  const active = todos.filter(t => !t.done).length;
  $('todo-badge').textContent = active;
}

/* ── CRUD ─────────────────────────────────────── */

function addTodo() {
  const input = $('todo-input');
  const text  = input.value.trim();
  if (!text) return;

  // Block duplicate tasks (case-insensitive)
  if (todos.some(t => t.text.toLowerCase() === text.toLowerCase())) {
    $('dup-warning').textContent = '⚠️ Tugas tersebut sudah ada!';
    input.focus();
    return;
  }

  clearDupWarn();
  todos.push({ id: Date.now(), text, done: false });
  saveLS('todos', todos);
  input.value = '';
  renderTodos();
}

function clearDupWarn() {
  $('dup-warning').textContent = '';
}

function toggleDone(id) {
  const task = todos.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveLS('todos', todos);
  renderTodos();
}

function deleteTask(id) {
  todos = todos.filter(t => t.id !== id);
  saveLS('todos', todos);
  renderTodos();
  toast('🗑️ Tugas dihapus');
}

/* ── Inline editing ──────────────────────────── */

function startEdit(id) {
  const li      = document.querySelector(`.task-item[data-id="${id}"]`);
  if (!li) return;
  const textEl  = li.querySelector('.task-text');
  const fieldEl = li.querySelector('.task-edit-field');
  const editBtn = li.querySelector('.edit-btn');
  const saveBtn = li.querySelector('.save-btn');

  textEl.style.display  = 'none';
  fieldEl.style.display = 'block';
  fieldEl.value         = todos.find(t => t.id === id)?.text || '';
  editBtn.style.display = 'none';
  saveBtn.style.display = 'inline-flex';
  fieldEl.focus();
  fieldEl.select();

  // Keyboard shortcuts inside edit field
  function onKey(e) {
    if (e.key === 'Enter')  { commitEdit(id); fieldEl.removeEventListener('keydown', onKey); }
    if (e.key === 'Escape') { cancelEdit(li); fieldEl.removeEventListener('keydown', onKey); }
  }
  fieldEl.addEventListener('keydown', onKey);
}

function commitEdit(id) {
  const li      = document.querySelector(`.task-item[data-id="${id}"]`);
  if (!li) return;
  const fieldEl = li.querySelector('.task-edit-field');
  const newText = fieldEl.value.trim();

  if (!newText) {
    toast('⚠️ Teks tugas tidak boleh kosong');
    return;
  }

  // Duplicate check (exclude the task being edited)
  if (todos.some(t => t.id !== id && t.text.toLowerCase() === newText.toLowerCase())) {
    toast('⚠️ Tugas dengan nama tersebut sudah ada');
    return;
  }

  const task = todos.find(t => t.id === id);
  if (task) {
    task.text = newText;
    saveLS('todos', todos);
    renderTodos();
    toast('✅ Tugas diperbarui');
  }
}

function cancelEdit(li) {
  li.querySelector('.task-text').style.display        = '';
  li.querySelector('.task-edit-field').style.display  = 'none';
  li.querySelector('.edit-btn').style.display         = 'inline-flex';
  li.querySelector('.save-btn').style.display         = 'none';
}

/* ── Render ──────────────────────────────────── */

function renderTodos() {
  const list  = $('task-list');
  const items = sortedTodos();
  list.innerHTML = '';
  updateBadge();

  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className   = 'task-empty';
    empty.textContent = 'Belum ada tugas — tambahkan satu di atas!';
    list.appendChild(empty);
    return;
  }

  items.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item${task.done ? ' done' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
      <input type="checkbox" class="task-checkbox"
        ${task.done ? 'checked' : ''}
        aria-label="Tandai ${esc(task.text)} sebagai ${task.done ? 'belum selesai' : 'selesai'}" />
      <span class="task-text">${esc(task.text)}</span>
      <input type="text" class="task-edit-field field"
        maxlength="120" aria-label="Edit tugas" />
      <div class="task-actions">
        <button class="icon-btn edit-btn" title="Edit tugas" aria-label="Edit">✏️</button>
        <button class="icon-btn save-btn" title="Simpan" aria-label="Simpan edit" style="display:none">💾</button>
        <button class="icon-btn del"      title="Hapus tugas" aria-label="Hapus">🗑️</button>
      </div>
    `;

    li.querySelector('.task-checkbox').addEventListener('change', () => toggleDone(task.id));
    li.querySelector('.edit-btn').addEventListener('click', () => startEdit(task.id));
    li.querySelector('.save-btn').addEventListener('click', () => commitEdit(task.id));
    li.querySelector('.del').addEventListener('click',      () => deleteTask(task.id));

    list.appendChild(li);
  });
}


// ═══════════════════════════════════════════════
// 5.  QUICK LINKS
// ═══════════════════════════════════════════════

/* Default links shown on first visit */
const DEFAULT_LINKS = [
  { id: 1, name: 'Google',   url: 'https://google.com' },
  { id: 2, name: 'YouTube',  url: 'https://youtube.com' },
  { id: 3, name: 'GitHub',   url: 'https://github.com' },
  { id: 4, name: 'Gmail',    url: 'https://mail.google.com' },
];

/* Shape: { id: number, name: string, url: string }[] */
let links    = loadLS('quick-links', DEFAULT_LINKS);
let editMode = false;

function initLinks() {
  $('btn-add-link').addEventListener('click', toggleAddForm);
  $('btn-edit-links').addEventListener('click', toggleEditMode);
  $('btn-save-link').addEventListener('click', saveLink);
  $('btn-cancel-link').addEventListener('click', hideAddForm);

  $('link-url').addEventListener('keydown',  e => { if (e.key === 'Enter') saveLink(); });
  $('link-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveLink(); });

  renderLinks();
}

function toggleAddForm() {
  const form = $('add-link-form');
  form.classList.toggle('open');
  if (form.classList.contains('open')) $('link-name').focus();
  else clearAddForm();
}

function hideAddForm() {
  $('add-link-form').classList.remove('open');
  clearAddForm();
}

function clearAddForm() {
  $('link-name').value = '';
  $('link-url').value  = '';
}

function toggleEditMode() {
  editMode = !editMode;
  $('links-panel').classList.toggle('edit-mode', editMode);
  const btn = $('btn-edit-links');
  btn.textContent = editMode ? '✅ Selesai' : '✏️ Edit';
}

/** Build Google Favicon URL from a page URL */
function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch {
    return '';
  }
}

function saveLink() {
  let name = $('link-name').value.trim();
  let url  = $('link-url').value.trim();

  if (!url) { toast('⚠️ Masukkan URL terlebih dahulu'); return; }

  // Auto-prepend https:// if not present
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  // Auto-generate label from hostname when name is blank
  if (!name) {
    try { name = new URL(url).hostname.replace(/^www\./, ''); }
    catch { name = url; }
  }

  links.push({ id: Date.now(), name, url });
  saveLS('quick-links', links);
  hideAddForm();
  renderLinks();
  toast(`🔗 "${name}" ditambahkan`);
}

function deleteLink(id) {
  links = links.filter(l => l.id !== id);
  saveLS('quick-links', links);
  renderLinks();
  toast('🗑️ Link dihapus');
}

function renderLinks() {
  const grid = $('links-grid');
  grid.innerHTML = '';

  if (links.length === 0) {
    const msg = document.createElement('span');
    msg.className   = 'empty-msg';
    msg.textContent = 'Belum ada link — tambahkan di atas!';
    grid.appendChild(msg);
    return;
  }

  links.forEach(link => {
    const wrap = document.createElement('div');
    wrap.className = 'link-wrap';

    // Anchor chip
    const a       = document.createElement('a');
    a.href        = link.url;
    a.target      = '_blank';
    a.rel         = 'noopener noreferrer';
    a.className   = 'link-chip';
    a.setAttribute('role', 'listitem');
    a.setAttribute('aria-label', `Buka ${link.name}`);

    const src = faviconFor(link.url);
    if (src) {
      const img   = document.createElement('img');
      img.src     = src;
      img.alt     = '';
      img.className = 'link-favicon';
      img.onerror = () => { img.style.display = 'none'; };
      a.appendChild(img);
    } else {
      a.appendChild(document.createTextNode('🔗 '));
    }
    a.appendChild(document.createTextNode(link.name));

    // Delete badge (visible only in edit mode)
    const del     = document.createElement('button');
    del.className = 'link-del-btn';
    del.textContent = '×';
    del.title     = `Hapus ${link.name}`;
    del.setAttribute('aria-label', `Hapus link ${link.name}`);
    del.addEventListener('click', e => {
      e.preventDefault();
      deleteLink(link.id);
    });

    wrap.appendChild(a);
    wrap.appendChild(del);
    grid.appendChild(wrap);
  });
}


// ═══════════════════════════════════════════════
// INIT — wire everything up once DOM is ready
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Theme must be applied first to avoid flash of wrong theme
  applyTheme();
  $('theme-btn').addEventListener('click', toggleTheme);

  initGreeting();
  initTimer();
  initTodo();
  initLinks();
});
