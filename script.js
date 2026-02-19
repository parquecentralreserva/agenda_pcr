/* --- CONFIGURAÇÃO E ESTADO --- */
let currentUser = null;
let tempBk = {};
const TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

const getToday = () => new Date().toISOString().split('T')[0];
const fmtDate = (s) => s.split('-').reverse().join('/');
const getInitials = (n) => n ? n.substring(0, 2).toUpperCase() : '??';

/* --- CHAMADAS AO BANCO D1 (API) --- */
const API = {
    getUsers: async () => {
        const r = await fetch('/api/users');
        return await r.json();
    },
    // Esta função serve tanto para CRIAR quanto para EDITAR (devido ao REPLACE no SQL)
    saveUser: async (userData) => {
        const r = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await r.json();
    },
    deleteUser: async (id) => {
        await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
    },
    getBookings: async () => {
        const r = await fetch('/api/bookings');
        return await r.json();
    }
};

/* --- AUTENTICAÇÃO --- */
async function login() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-pass').value;
    
    try {
        const users = await API.getUsers();
        const u = users.find(x => x.email === e && x.pass === p);
        
        if (u) {
            currentUser = u;
            document.getElementById('screen-auth').classList.add('hidden');
            document.getElementById('screen-app').classList.remove('hidden');
            updateUserUI();
            loadView();
        } else {
            alert("E-mail ou senha incorretos.");
        }
    } catch (err) {
        alert("Erro ao conectar com o banco de dados.");
    }
}

/* --- PERFIL (EDITAR MEUS DADOS) --- */
function openProfile() {
    document.getElementById('prof-name').value = currentUser.name;
    document.getElementById('prof-pass').value = currentUser.pass;
    document.getElementById('modal-profile').style.display = 'flex';
}

async function saveProfile() {
    const newName = document.getElementById('prof-name').value;
    const newPass = document.getElementById('prof-pass').value;

    if (!newName || !newPass) return alert("Preencha todos os campos");

    // Criamos o objeto mantendo o ID e ROLE originais
    const updatedData = {
        ...currentUser,
        name: newName,
        pass: newPass
    };

    const res = await API.saveUser(updatedData);
    if (res.success) {
        currentUser = updatedData;
        updateUserUI();
        alert("Perfil atualizado com sucesso!");
        document.getElementById('modal-profile').style.display = 'none';
    }
}

/* --- ADMINISTRAÇÃO (CRIAR PROFISSIONAIS) --- */
async function adminSaveUser() {
    const role = document.getElementById('adm-role').value;
    const idExistente = document.getElementById('adm-uid').value;

    const u = {
        id: idExistente || 'u' + Date.now(), // Se não tem ID, cria um novo
        name: document.getElementById('adm-name').value,
        email: document.getElementById('adm-email').value,
        pass: document.getElementById('adm-pass').value,
        role: role,
        unit: document.getElementById('adm-unit').value,
        gender: document.getElementById('adm-gender').value,
        desc: role === 'prof' ? 'Especialista PCR' : ''
    };

    if (!u.name || !u.email || !u.pass) return alert("Nome, Email e Senha são obrigatórios.");

    const res = await API.saveUser(u);
    if (res.success) {
        alert(role === 'prof' ? "Profissional salvo!" : "Usuário salvo!");
        document.getElementById('modal-admin-user').style.display = 'none';
        renderAdmin(); // Atualiza a lista na tela
    }
}

async function renderAdmin() {
    const users = await API.getUsers();
    const list = document.getElementById('admin-user-list');
    // Filtra para não mostrar o próprio admin na lista de edição comum
    const filtered = users.filter(u => u.id !== currentUser.id);
    
    list.innerHTML = filtered.map(u => `
        <div class="user-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee">
            <div>
                <strong>${u.name}</strong> <small>(${u.role})</small><br>
                <span>${u.unit} | ${u.email}</span>
            </div>
            <div>
                <button onclick="editUserPrompt('${u.id}')">Editar</button>
                <button onclick="deleteUserAction('${u.id}')" style="color:red">Excluir</button>
            </div>
        </div>
    `).join('');
}

/* --- SUPORTE INTERFACE --- */
function updateUserUI() {
    document.getElementById('user-name').innerText = currentUser.name.split(' ')[0];
    document.getElementById('pc-user-name').innerText = currentUser.name;
    document.getElementById('pc-user-unit').innerText = currentUser.unit;
}

function loadView() {
    const role = currentUser.role;
    document.getElementById('view-admin').classList.toggle('hidden', role !== 'admin');
    document.getElementById('view-morador').classList.toggle('hidden', role !== 'morador');
    document.getElementById('view-prof').classList.toggle('hidden', role !== 'prof');

    if (role === 'admin') renderAdmin();
}

function logout() { location.reload(); }
