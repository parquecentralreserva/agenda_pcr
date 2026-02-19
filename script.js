/* --- ESTADO GLOBAL --- */
let currentUser = null;
let tempBk = {};
const TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

/* --- CONEXÃO COM A API (D1) --- */
const API = {
    getUsers: () => fetch('/api/users').then(r => r.json()),
    saveUser: (u) => fetch('/api/users', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(u) 
    }).then(r => r.json()),
    getBookings: () => fetch('/api/bookings').then(r => r.json()),
    saveBooking: (b) => fetch('/api/bookings', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(b) 
    }).then(r => r.json())
};

/* --- FUNÇÃO DE CADASTRO INICIAL (MORADOR) --- */
async function register() {
    const n = document.getElementById('reg-name').value;
    const u = document.getElementById('reg-unit').value;
    const g = document.getElementById('reg-gender').value;
    const e = document.getElementById('reg-email').value;
    const p = document.getElementById('reg-pass').value;

    if (!n || !e || !p) return alert("Preencha Nome, Email e Senha!");

    const newUser = {
        id: 'u' + Date.now(),
        name: n,
        unit: u,
        gender: g,
        email: e,
        pass: p,
        role: 'morador',
        desc: ''
    };

    const res = await API.saveUser(newUser);
    if (res.success) {
        alert("Cadastro realizado! Agora faça login.");
        toggleAuth('login');
    } else {
        alert("Erro ao cadastrar. Tente outro e-mail.");
    }
}

/* --- LOGIN --- */
async function login() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-pass').value;
    
    const users = await API.getUsers();
    const u = users.find(x => x.email === e && x.pass === p);
    
    if (u) {
        currentUser = u;
        document.getElementById('screen-auth').classList.add('hidden');
        document.getElementById('screen-app').classList.remove('hidden');
        updateUserUI();
        loadView();
    } else {
        alert("Dados incorretos!");
    }
}

/* --- ADMIN: CRIAR/EDITAR PROFISSIONAIS --- */
async function adminSaveUser() {
    const role = document.getElementById('adm-role').value;
    const existingId = document.getElementById('adm-uid').value;

    const u = {
        id: existingId || 'u' + Date.now(),
        name: document.getElementById('adm-name').value,
        email: document.getElementById('adm-email').value,
        pass: document.getElementById('adm-pass').value,
        unit: document.getElementById('adm-unit').value,
        gender: document.getElementById('adm-gender').value,
        role: role,
        desc: role === 'prof' ? 'Profissional PCR' : ''
    };

    if (!u.name || !u.email) return alert("Nome e Email são obrigatórios!");

    const res = await API.saveUser(u);
    if (res.success) {
        alert("Salvo com sucesso no banco!");
        document.getElementById('modal-admin-user').style.display = 'none';
        renderAdmin(); // Recarrega a lista de usuários para o admin
    }
}

/* --- PERFIL: EDITAR MEUS PRÓPRIOS DADOS --- */
async function saveProfile() {
    const newName = document.getElementById('prof-name').value;
    const newPass = document.getElementById('prof-pass').value;

    const updated = { ...currentUser, name: newName, pass: newPass };

    const res = await API.saveUser(updated);
    if (res.success) {
        currentUser = updated;
        updateUserUI();
        alert("Perfil atualizado!");
        document.getElementById('modal-profile').style.display = 'none';
    }
}

/* --- AUXILIARES DE INTERFACE --- */
function updateUserUI() {
    document.getElementById('user-name').innerText = currentUser.name.split(' ')[0];
    document.getElementById('pc-user-name').innerText = currentUser.name;
    document.getElementById('pc-user-unit').innerText = currentUser.unit;
}

function loadView() {
    const role = currentUser.role;
    // Esconde todas as telas primeiro
    ['view-admin', 'view-morador', 'view-prof'].forEach(v => {
        const el = document.getElementById(v);
        if(el) el.classList.add('hidden');
    });

    // Mostra a tela correta
    if (role === 'admin') {
        document.getElementById('view-admin').classList.remove('hidden');
        renderAdmin();
    } else if (role === 'morador') {
        document.getElementById('view-morador').classList.remove('hidden');
        renderProfs();
    } else if (role === 'prof') {
        document.getElementById('view-prof').classList.remove('hidden');
    }
}

async function renderAdmin() {
    const users = await API.getUsers();
    const container = document.getElementById('admin-user-list');
    if (!container) return;

    container.innerHTML = users.filter(u => u.id !== currentUser.id).map(u => `
        <div class="user-card" style="border-bottom: 1px solid #ddd; padding: 10px; display: flex; justify-content: space-between;">
            <div><b>${u.name}</b> (${u.role})</div>
            <button onclick="editUser('${u.id}')">Editar</button>
        </div>
    `).join('');
}

function toggleAuth(mode) {
    document.getElementById('form-login').classList.toggle('hidden', mode !== 'login');
    document.getElementById('form-reg').classList.toggle('hidden', mode !== 'reg');
}

function logout() { location.reload(); }
