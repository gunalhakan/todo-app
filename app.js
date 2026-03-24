const SUPABASE_URL = 'https://ofvplzrqnklqnllopdvn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdnBsenJxbmtscW5sbG9wZHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjgzNDEsImV4cCI6MjA4OTk0NDM0MX0.c62sHNF6GfmApfBoxmaRc5FEmfin-bNVtT1M4lHd9BE';
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

let accessToken = null;
let currentUser = null;
let todos = [];
let currentFilter = 'all';

// DOM Elements - Auth
const authContainer = document.getElementById('auth-container');
const todoContainer = document.getElementById('todo-container');
const authMessage = document.getElementById('auth-message');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authTabs = document.querySelectorAll('.auth-tab');

// DOM Elements - Todo
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const todoCount = document.getElementById('todo-count');
const clearCompletedBtn = document.getElementById('clear-completed');
const filterBtns = document.querySelectorAll('.filter-btn');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

// ---- AUTH ----

function getAuthHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

function showMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = 'block';
}

function hideMessage() {
    authMessage.style.display = 'none';
}

function showTodoApp() {
    authContainer.style.display = 'none';
    todoContainer.style.display = 'block';
    userEmailSpan.textContent = currentUser.email;
    fetchTodos();
}

function showAuthScreen() {
    authContainer.style.display = 'block';
    todoContainer.style.display = 'none';
    accessToken = null;
    currentUser = null;
    todos = [];
}

// URL'den token bilgilerini yakala (hem hash # hem query ? destekli)
async function handleEmailConfirmation() {
    // Hash fragmenttan parametreleri al (#access_token=...)
    const hash = window.location.hash;
    const hashParams = hash ? new URLSearchParams(hash.substring(1)) : new URLSearchParams();

    // Query string'den parametreleri al (?access_token=...)
    const queryParams = new URLSearchParams(window.location.search);

    // Her iki kaynaktan da token'i dene
    const token = hashParams.get('access_token') || queryParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

    if (!token) return false;

    accessToken = token;
    try {
        const res = await fetch(`${AUTH_URL}/user`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        if (res.ok) {
            currentUser = await res.json();
            localStorage.setItem('supabase_access_token', accessToken);
            if (refreshToken) {
                localStorage.setItem('supabase_refresh_token', refreshToken);
            }
            // URL'yi temizle
            history.replaceState(null, '', window.location.pathname);
            return true;
        }
    } catch (err) {
        console.error('Onay hatasi:', err);
    }

    return false;
}

// Mevcut oturumu kontrol et
async function checkSession() {
    const token = localStorage.getItem('supabase_access_token');
    if (!token) return false;

    try {
        const res = await fetch(`${AUTH_URL}/user`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${token}`
            }
        });
        if (res.ok) {
            currentUser = await res.json();
            accessToken = token;
            return true;
        }
        // Token gecersiz, refresh dene
        return await refreshSession();
    } catch {
        return false;
    }
}

async function refreshSession() {
    const refreshToken = localStorage.getItem('supabase_refresh_token');
    if (!refreshToken) {
        localStorage.removeItem('supabase_access_token');
        return false;
    }

    try {
        const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (res.ok) {
            const data = await res.json();
            accessToken = data.access_token;
            currentUser = data.user;
            localStorage.setItem('supabase_access_token', data.access_token);
            localStorage.setItem('supabase_refresh_token', data.refresh_token);
            return true;
        }
    } catch (err) {
        console.error('Refresh hatasi:', err);
    }

    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('supabase_refresh_token');
    return false;
}

// Kayit ol
async function register(email, password) {
    const btn = registerForm.querySelector('.auth-btn');
    btn.disabled = true;
    btn.textContent = 'Gonderiliyor...';
    try {
        const res = await fetch(`${AUTH_URL}/signup`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                data: {},
                gotrue_meta_security: {}
            })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.msg || data.error_description || data.message || 'Kayit basarisiz');
        }
        // Onay e-postasi gonderildi
        showMessage('Kayit basarili! Lutfen e-postanizi kontrol edin ve onay linkine tiklayin.', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Kayit Ol';
    }
}

// Giris yap
async function login(email, password) {
    try {
        const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) {
            if (data.error === 'email_not_confirmed') {
                throw new Error('E-posta adresiniz henuz onaylanmadi. Lutfen e-postanizi kontrol edin.');
            }
            throw new Error(data.msg || data.error_description || data.message || 'Giris basarisiz');
        }
        accessToken = data.access_token;
        currentUser = data.user;
        localStorage.setItem('supabase_access_token', data.access_token);
        localStorage.setItem('supabase_refresh_token', data.refresh_token);
        hideMessage();
        showTodoApp();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

function logout() {
    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('supabase_refresh_token');
    showAuthScreen();
}

// ---- TODOS ----

async function fetchTodos() {
    try {
        const res = await fetch(`${REST_URL}/todos?order=created_at.asc`, {
            headers: getAuthHeaders()
        });
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
        const res = await fetch(`${REST_URL}/todos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                text: text.trim(),
                completed: false,
                user_id: currentUser.id
            })
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
        await fetch(`${REST_URL}/todos?id=eq.${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
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
        await fetch(`${REST_URL}/todos?id=eq.${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
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
        await fetch(`${REST_URL}/todos?id=in.(${completedIds.join(',')})`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        todos = todos.filter(t => !t.completed);
        renderTodos();
    } catch (err) {
        console.error('Tamamlananlar temizlenemedi:', err);
    }
}

// ---- EVENT LISTENERS ----

// Auth tabs
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        hideMessage();
        if (tab.dataset.tab === 'login') {
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'flex';
        }
    });
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    login(email, password);
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    register(email, password);
});

logoutBtn.addEventListener('click', logout);

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

// ---- INIT ----

async function init() {
    // Once URL'deki onay token'ini kontrol et
    const confirmed = await handleEmailConfirmation();
    if (confirmed) {
        showTodoApp();
        return;
    }

    // Mevcut oturumu kontrol et
    const hasSession = await checkSession();
    if (hasSession) {
        showTodoApp();
    } else {
        showAuthScreen();
    }
}

init();
