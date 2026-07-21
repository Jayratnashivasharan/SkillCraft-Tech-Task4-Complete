/* =========================================================
   Ledger — To-Do App
   Vanilla JS + localStorage persistence
   ========================================================= */

const STORAGE_KEY = 'ledger.data.v1';

/* ---------- State ---------- */
let state = loadState();
let currentListId = 'all';
let currentFilter = 'all';
let searchTerm = '';

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{ return JSON.parse(raw); }catch(e){ /* fall through to default */ }
  }
  const defaultListId = uid();
  return {
    lists: [
      { id: defaultListId, name: 'Personal' },
      { id: uid(), name: 'Work' }
    ],
    tasks: []
  };
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(){
  return 't' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ---------- DOM refs ---------- */
const listNav = document.getElementById('listNav');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const currentListTitle = document.getElementById('currentListTitle');
const todayDate = document.getElementById('todayDate');
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskDateTime = document.getElementById('taskDateTime');
const taskPriority = document.getElementById('taskPriority');
const searchInput = document.getElementById('searchInput');
const statOpen = document.getElementById('statOpen');
const statDue = document.getElementById('statDue');
const statDone = document.getElementById('statDone');
const toastStack = document.getElementById('toastStack');

const editModalEl = document.getElementById('editModal');
const editModal = new bootstrap.Modal(editModalEl);
const editId = document.getElementById('editId');
const editText = document.getElementById('editText');
const editList = document.getElementById('editList');
const editDateTime = document.getElementById('editDateTime');
const editPriority = document.getElementById('editPriority');
const btnSaveEdit = document.getElementById('btnSaveEdit');

const listModalEl = document.getElementById('listModal');
const listModal = new bootstrap.Modal(listModalEl);
const newListName = document.getElementById('newListName');
const btnAddList = document.getElementById('btnAddList');
const btnCreateList = document.getElementById('btnCreateList');

/* ---------- Init ---------- */
function init(){
  todayDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
  renderLists();
  renderTasks();

  document.querySelectorAll('.btn-filter').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.btn-filter').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  searchInput.addEventListener('input', ()=>{
    searchTerm = searchInput.value.trim().toLowerCase();
    renderTasks();
  });

  taskForm.addEventListener('submit', onAddTask);

  btnAddList.addEventListener('click', ()=>{
    newListName.value = '';
    listModal.show();
    setTimeout(()=>newListName.focus(), 300);
  });
  btnCreateList.addEventListener('click', onCreateList);
  newListName.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); onCreateList(); } });

  btnSaveEdit.addEventListener('click', onSaveEdit);

  // Refresh overdue highlighting every 30s
  setInterval(renderTasks, 30000);
}

/* ---------- Lists ---------- */
function renderLists(){
  listNav.innerHTML = '';

  const allItem = makeListNavItem({ id:'all', name:'All Tasks' }, true);
  listNav.appendChild(allItem);

  state.lists.forEach(list=>{
    listNav.appendChild(makeListNavItem(list, false));
  });

  // keep edit-modal list select in sync
  editList.innerHTML = state.lists.map(l=>`<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
}

function makeListNavItem(list, isAll){
  const li = document.createElement('li');
  li.className = 'list-nav-item' + (currentListId === list.id ? ' active' : '');
  const count = isAll
    ? state.tasks.filter(t=>!t.completed).length
    : state.tasks.filter(t=>t.listId===list.id && !t.completed).length;

  li.innerHTML = `
    <span class="name">${escapeHtml(list.name)}</span>
    <span style="display:flex;align-items:center;gap:6px;">
      <span class="count">${count}</span>
      ${isAll ? '' : '<button class="del-list" title="Delete list" data-id="'+list.id+'">✕</button>'}
    </span>
  `;
  li.addEventListener('click', (e)=>{
    if(e.target.closest('.del-list')) return;
    currentListId = list.id;
    currentListTitle.textContent = list.name;
    renderLists();
    renderTasks();
  });

  if(!isAll){
    li.querySelector('.del-list').addEventListener('click', (e)=>{
      e.stopPropagation();
      deleteList(list.id);
    });
  }
  return li;
}

function onCreateList(){
  const name = newListName.value.trim();
  if(!name) return;
  const list = { id: uid(), name };
  state.lists.push(list);
  saveState();
  renderLists();
  listModal.hide();
  showToast(`List "${name}" created`);
}

function deleteList(id){
  const list = state.lists.find(l=>l.id===id);
  if(!list) return;
  if(!confirm(`Delete list "${list.name}" and all its tasks?`)) return;
  state.lists = state.lists.filter(l=>l.id!==id);
  state.tasks = state.tasks.filter(t=>t.listId!==id);
  if(currentListId === id){
    currentListId = 'all';
    currentListTitle.textContent = 'All Tasks';
  }
  saveState();
  renderLists();
  renderTasks();
  showToast(`List "${list.name}" deleted`);
}

/* ---------- Tasks ---------- */
function onAddTask(e){
  e.preventDefault();
  const text = taskInput.value.trim();
  if(!text) return;

  const listId = currentListId === 'all'
    ? (state.lists[0] ? state.lists[0].id : null)
    : currentListId;

  if(!listId){
    showToast('Create a list first');
    return;
  }

  const task = {
    id: uid(),
    text,
    listId,
    due: taskDateTime.value || null,
    priority: taskPriority.value,
    completed: false,
    createdAt: Date.now()
  };

  state.tasks.unshift(task);
  saveState();
  taskInput.value = '';
  taskDateTime.value = '';
  taskPriority.value = 'medium';
  renderLists();
  renderTasks();
  showToast('Task added');
  taskInput.focus();
}

function renderTasks(){
  let tasks = state.tasks.slice();

  if(currentListId !== 'all'){
    tasks = tasks.filter(t=>t.listId === currentListId);
  }
  if(currentFilter === 'active'){
    tasks = tasks.filter(t=>!t.completed);
  } else if(currentFilter === 'completed'){
    tasks = tasks.filter(t=>t.completed);
  }
  if(searchTerm){
    tasks = tasks.filter(t=>t.text.toLowerCase().includes(searchTerm));
  }

  // sort: incomplete first, then by due date (soonest first), then createdAt desc
  tasks.sort((a,b)=>{
    if(a.completed !== b.completed) return a.completed ? 1 : -1;
    if(a.due && b.due) return new Date(a.due) - new Date(b.due);
    if(a.due) return -1;
    if(b.due) return 1;
    return b.createdAt - a.createdAt;
  });

  taskList.innerHTML = '';
  tasks.forEach(t=>taskList.appendChild(renderTaskItem(t)));

  emptyState.classList.toggle('show', tasks.length === 0);
  updateStats();
}

function renderTaskItem(t){
  const li = document.createElement('li');
  const listObj = state.lists.find(l=>l.id===t.listId);
  const now = new Date();
  const dueDate = t.due ? new Date(t.due) : null;
  const isOverdue = dueDate && !t.completed && dueDate < now;
  const isSoon = dueDate && !t.completed && !isOverdue && (dueDate - now) < 24*3600*1000;

  li.className = `task-item priority-${t.priority}` +
    (t.completed ? ' completed' : '') +
    (isOverdue ? ' overdue' : '');

  const dueLabel = dueDate ? formatDue(dueDate) : null;

  li.innerHTML = `
    <div class="task-check ${t.completed ? 'checked' : ''}" role="checkbox" aria-checked="${t.completed}" tabindex="0"></div>
    <div class="task-body">
      <div class="task-text">${escapeHtml(t.text)}</div>
      <div class="task-meta">
        ${listObj ? `<span class="list-badge">${escapeHtml(listObj.name)}</span>` : ''}
        ${dueLabel ? `<span class="due-badge">${isOverdue ? '⚠ Overdue · ' : isSoon ? '⏰ ' : '🗓 '}${dueLabel}</span>` : ''}
        <span class="priority-badge">${t.priority}</span>
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-edit" title="Edit">✎</button>
      <button class="btn-delete" title="Delete">🗑</button>
    </div>
  `;

  li.querySelector('.task-check').addEventListener('click', ()=>toggleComplete(t.id));
  li.querySelector('.task-check').addEventListener('keydown', e=>{
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggleComplete(t.id); }
  });
  li.querySelector('.btn-edit').addEventListener('click', ()=>openEdit(t.id));
  li.querySelector('.btn-delete').addEventListener('click', ()=>deleteTask(t.id));

  return li;
}

function formatDue(date){
  return date.toLocaleString(undefined, {
    month:'short', day:'numeric', hour:'numeric', minute:'2-digit'
  });
}

function toggleComplete(id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;
  t.completed = !t.completed;
  saveState();
  renderLists();
  renderTasks();
}

function deleteTask(id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;
  state.tasks = state.tasks.filter(x=>x.id!==id);
  saveState();
  renderLists();
  renderTasks();
  showToast('Task deleted');
}

/* ---------- Edit modal ---------- */
function openEdit(id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;
  editId.value = t.id;
  editText.value = t.text;
  editList.value = t.listId;
  editDateTime.value = t.due || '';
  editPriority.value = t.priority;
  editModal.show();
}

function onSaveEdit(){
  const t = state.tasks.find(x=>x.id===editId.value);
  if(!t) return;
  const text = editText.value.trim();
  if(!text){ editText.focus(); return; }

  t.text = text;
  t.listId = editList.value;
  t.due = editDateTime.value || null;
  t.priority = editPriority.value;

  saveState();
  renderLists();
  renderTasks();
  editModal.hide();
  showToast('Task updated');
}

/* ---------- Stats ---------- */
function updateStats(){
  const open = state.tasks.filter(t=>!t.completed).length;
  const done = state.tasks.filter(t=>t.completed).length;
  const now = new Date();
  const due = state.tasks.filter(t=>{
    if(t.completed || !t.due) return false;
    const d = new Date(t.due);
    return (d - now) < 24*3600*1000;
  }).length;

  statOpen.textContent = open;
  statDue.textContent = due;
  statDone.textContent = done;
}

/* ---------- Toasts ---------- */
function showToast(msg){
  const el = document.createElement('div');
  el.className = 'app-toast';
  el.textContent = msg;
  toastStack.appendChild(el);
  setTimeout(()=>el.remove(), 2600);
}

/* ---------- Utils ---------- */
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Go ---------- */
document.addEventListener('DOMContentLoaded', init);
