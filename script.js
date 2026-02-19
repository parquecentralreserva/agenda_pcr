/* --- CONFIGURAÇÃO E ESTADO --- */
let currentUser = null;
let tempBk = {};
let pendingCancelId = null;
const TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

/* --- UTILITÁRIOS --- */
const getToday = () => new Date().toISOString().split('T')[0];
const isPast = (d) => d < getToday();
const fmtDate = (s) => s.split('-').reverse().join('/');
const getInitials = (n) => n ? n.substring(0, 2).toUpperCase() : '??';

/* --- BANCO DE DADOS (CONEXÃO D1 VIA API) --- */
const DB = {
    u: {
        get: async () => {
            const r = await fetch('/api/users');
            return await r.json();
        },
        save: async (u) => {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(u)
            });
        }
    },
    b: {
        get: async () => {
            const r = await fetch('/api/bookings');
            return await r.json();
        },
        add: async (b) => {
            await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(b)
            });
        },
        delete: async (id) => {
            await fetch(`/api/bookings?id=${id}`, { method: 'DELETE' });
        }
    }
};

/* --- CORE: AUTENTICAÇÃO --- */
async function login() {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-pass').value;
    
    const users = await DB.u.get();
    const u = users.find(x => x.email === e && x.pass === p);
    
    if (u) {
        currentUser = u;
        document.getElementById('screen-auth').classList.add('hidden');
        document.getElementById('screen-app').classList.remove('hidden');
        updateUserUI();
        loadView();
    } else {
        showToast('Dados inválidos no db_agenda_pcr');
    }
}

async function register() {
    const n = document.getElementById('reg-name').value;
    const u = document.getElementById('reg-unit').value;
    const g = document.getElementById('reg-gender').value;
    const e = document.getElementById('reg-email').value;
    const p = document.getElementById('reg-pass').value;

    if (!n || !u || !e || !p) return showToast('Preencha tudo');

    const newUser = { 
        id: 'u' + Date.now(), 
        name: n, unit: u, gender: g, email: e, pass: p, role: 'morador', desc: ''
    };

    await DB.u.save(newUser);
    showToast('Sucesso! Entre agora.');
    toggleAuth('login');
}

/* --- INTERFACE DE USUÁRIO --- */
function updateUserUI() {
    document.getElementById('user-name').innerText = currentUser.name.split(' ')[0];
    document.getElementById('user-unit').innerText = currentUser.unit;
    document.getElementById('pc-user-name').innerText = currentUser.name;
    document.getElementById('pc-user-unit').innerText = currentUser.unit + (currentUser.role === 'prof' ? ' (Prof)' : '');
    document.getElementById('pc-avatar').innerText = getInitials(currentUser.name);
}

async function loadView() {
    ['view-morador', 'view-prof', 'view-admin'].forEach(x => document.getElementById(x).classList.add('hidden'));
    
    if (currentUser.role === 'morador') {
        document.getElementById('view-morador').classList.remove('hidden');
        await renderProfs();
        await renderMyBks();
    } else if (currentUser.role === 'prof') {
        document.getElementById('view-prof').classList.remove('hidden');
        await renderProfAgenda();
    } else {
        document.getElementById('view-admin').classList.remove('hidden');
        await renderAdmin();
    }
    switchTab('home');
}

/* --- LÓGICA DE AGENDAMENTO --- */
async function renderProfs() {
    const users = await DB.u.get();
    const profs = users.filter(u => u.role === 'prof');
    document.getElementById('list-profs').innerHTML = profs.map(p => `
        <div class="prof-card" onclick="startBk('${p.id}')">
            <div class="avatar-box">${getInitials(p.name)}</div>
            <div style="flex:1">
                <h3 style="margin:0">${p.name}</h3>
                <p style="font-size:0.8rem; color:gray">${p.desc || 'Especialista'}</p>
            </div>
            <i class="fa-solid fa-chevron-right"></i>
        </div>`).join('') || '<p>Nenhum profissional no banco.</p>';
}

async function startBk(pid) {
    tempBk = { pid: pid };
    const users = await DB.u.get();
    const p = users.find(x => x.id === pid);
    document.getElementById('sel-prof-name').innerText = p.name;
    document.getElementById('date-picker').value = getToday();
    document.getElementById('step-prof').classList.add('hidden');
    document.getElementById('step-time').classList.remove('hidden');
    await renderTimeGrid();
}

async function renderTimeGrid() {
    const d = document.getElementById('date-picker').value;
    const bks = await DB.b.get();
    
    document.getElementById('grid-slots').innerHTML = TIMES.map(t => {
        const slot = bks.filter(b => b.date === d && b.time === t);
        const isOccupied = slot.find(b => b.profId === tempBk.pid);
        
        if (isOccupied) return `<div class="time-slot blocked-prof">--</div>`;
        return `<div class="time-slot" onclick="selTime('${t}',this)">${t}</div>`;
    }).join('');
}

function selTime(t, el) {
    document.querySelectorAll('.time-slot').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    tempBk.time = t;
    document.getElementById('btn-confirm').classList.remove('hidden');
}

async function confirmBooking() {
    const desc = document.getElementById('booking-desc').value || 'Atendimento';
    const users = await DB.u.get();
    const p = users.find(x => x.id === tempBk.pid);

    const newBk = {
        date: document.getElementById('date-picker').value,
        time: tempBk.time,
        profId: p.id,
        profName: p.name,
        clientId: currentUser.id,
        clientName: currentUser.name,
        clientUnit: currentUser.unit,
        clientGender: currentUser.gender,
        desc: desc,
        type: 'appt'
    };

    await DB.b.add(newBk);
    showToast('Agendado com sucesso!');
    document.getElementById('step-time').classList.add('hidden');
    document.getElementById('step-prof').classList.remove('hidden');
    await renderMyBks();
}

/* --- COMPONENTES DE TICKET --- */
function createTicket(b, del) {
    return `
    <div class="bk-ticket">
        <div style="flex:1">
            <div class="bk-time-badge">${b.time}</div>
            <div style="font-weight:700">${b.profName}</div>
            <div style="font-size:0.8rem">${fmtDate(b.date)} • ${b.desc}</div>
        </div>
        ${del ? `<button onclick="cancelBk(${b.id})" class="btn-del">Excluir</button>` : ''}
    </div>`;
}

async function renderMyBks() {
    const bks = await DB.b.get();
    const my = bks.filter(b => b.clientId === currentUser.id);
    document.getElementById('my-bookings-active').innerHTML = my.map(b => createTicket(b, true)).join('');
}

async function cancelBk(id) {
    if (confirm("Deseja cancelar?")) {
        await DB.b.delete(id);
        showToast("Cancelado");
        await loadView();
    }
}

/* --- NAVEGAÇÃO BÁSICA --- */
function switchTab(t) {
    document.getElementById('tab-home').classList.toggle('hidden', t !== 'home');
    document.getElementById('tab-calendar').classList.toggle('hidden', t !== 'calendar');
}

function toggleAuth(m) {
    document.getElementById('form-login').classList.toggle('hidden', m !== 'login');
    document.getElementById('form-reg').classList.toggle('hidden', m !== 'reg');
}

function showToast(m) { alert(m); }
function logout() { location.reload(); }

/* --- INIT --- */
document.getElementById('date-picker').min = getToday();
