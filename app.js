const SUPABASE_URL = 'https://ofvplzrqnklqnllopdvn.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdnBsenJxbmtscW5sbG9wZHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjgzNDEsImV4cCI6MjA4OTk0NDM0MX0.c62sHNF6GfmApfBoxmaRc5FEmfin-bNVtT1M4lHd9BE';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const todoCount = document.getElementById('todo-count');
const clearCompletedBtn = document.getElementById('clear-completed');
const filterBtns = document.querySelectorAll('.filter-btn');

let todos = [];
let currentFilter = 'all';

async function fetchTodos() {
    try {
        const res = await fetch(`${SUPABASE_URL}/todos?order=created_at.asc`, { headers });
        todos = await res.json();
        renderTodos();
    } catch (err) {
        console.error('Gorevler yuklenemedi:', err);
    }
}

function renderTodos() {
    const filtered = todos.filter(todo => {
        if (currentFilter === 'active') return !todo.completed;
        if (currentFilter === 'completed') return todo.completed;
        return true;
    });

    if (filtered.length === 0) {
        todoList.innerHTML = '<li class="empty-state">Gorev bulunamadi</li>';
    } else {
        todoList.innerHTML = filtered.map(todo => `
            <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
                <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" onclick="toggleTodo(${todo.id})"></div>
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                <button class="todo-delete" onclick="deleteTodo(${todo.id})">&times;</button>
            </li>
        `).join('');
    }

    const activeCount = todos.filter(t => !t.completed).length;
    todoCount.textContent = `${activeCount} gorev kaldi`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function addTodo(text) {
    try {
        const res = await fetch(`${SUPABASE_URL}/todos`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: text.trim(), completed: false })
        });
        const [newTodo] = await res.json();
        todos.push(newTodo);
        renderTodos();
    } catch (err) {
        console.error('Gorev eklenemedi:', err);
    }
}

async function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const newStatus = !todo.completed;
    try {
        await fetch(`${SUPABASE_URL}/todos?id=eq.${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ completed: newStatus })
        });
        todo.completed = newStatus;
        renderTodos();
    } catch (err) {
        console.error('Gorev guncellenemedi:', err);
    }
}

async function deleteTodo(id) {
    try {
        await fetch(`${SUPABASE_URL}/todos?id=eq.${id}`, {
            method: 'DELETE',
            headers
        });
        todos = todos.filter(t => t.id !== id);
        renderTodos();
    } catch (err) {
        console.error('Gorev silinemedi:', err);
    }
}

async function clearCompleted() {
    const completedIds = todos.filter(t => t.completed).map(t => t.id);
    if (completedIds.length === 0) return;
    try {
        await fetch(`${SUPABASE_URL}/todos?id=in.(${completedIds.join(',')})`, {
            method: 'DELETE',
            headers
        });
        todos = todos.filter(t => !t.completed);
        renderTodos();
    } catch (err) {
        console.error('Tamamlananlar temizlenemedi:', err);
    }
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
        addTodo(text);
        input.value = '';
        input.focus();
    }
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTodos();
    });
});

clearCompletedBtn.addEventListener('click', clearCompleted);

fetchTodos();
