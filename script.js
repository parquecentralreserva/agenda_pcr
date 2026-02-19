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

/* --- BANCO DE DADOS (INTERFACE COM db_agenda_pcr) --- */
const DB = {
    u: {
        get: () => JSON.parse(localStorage.getItem('db_pcr_users')) || [],
        set: (d) => localStorage.setItem('db_pcr_users', JSON.stringify(d))
    },
    b: {
        get: () => JSON.parse(localStorage.getItem('db_pcr_bookings')) || [],
        set: (d) => localStorage.setItem('db_pcr_bookings', JSON.stringify(d))
    },
    m: {
        add: (u, t) => {
            let m = JSON.parse(localStorage.getItem('db_pcr_msgs')) || [];
            m.push({ to: u, txt: t, read: false });
            localStorage.setItem('db_pcr_msgs', JSON.stringify(m));
        },
        get: (u) => {
            let m = JSON.parse(localStorage.getItem('db_pcr_msgs')) || [];
            const f = m.filter(x => x.to === u && !x.read);
            if (f.length) {
                f.forEach(x => x.read = true);
                localStorage.setItem('db_pcr_msgs', JSON.stringify(m));
                return f[0].txt;
            }
            return null;
        }
    }
};

function initDB() {
    // Agora o initDB apenas garante que as estruturas existam, sem dados fixos.
    if (!localStorage.getItem('db_pcr_users')) DB.u.set([]);
    if (!localStorage.getItem('db_pcr_bookings')) DB.b.set([]);
    if (!localStorage.getItem('db_pcr_msgs')) DB.m.set([]);
}

/* --- INTERFACE DE USUÁRIO (COMPONENTES) --- */
function createProfCard(p) {
    const color = p.gender === 'M' ? 'var(--male-color)' : 'var(--female-color)';
    return `
    <div class="prof-card" onclick="startBk('${p.id}')">
        <div class="avatar-box">${getInitials(p.name)}</div>
        <div style="flex:1">
            <h3 style="margin:0; font-size:1.15rem">${p.name}</h3>
            <span style="font-size:0.75rem; color:${color}; font-weight:800; text-transform:uppercase; letter-spacing:1px">Especialista</span>
            <p style="color:var(--text-light); font-size:0.9rem; margin-top:6px; line-height:1.4">${p.desc || ''}</p>
        </div>
        <i class="fa-solid fa-chevron-right" style="color:#cbd5e1"></i>
    </div>`;
}

function createTicket(b, del, color = false) {
    const bc = color ? (b.clientGender === 'M' ? 'var(--male-color)' : 'var(--female-color)') : 'var(--primary)';
    return `
    <div class="bk-ticket">
        <div style="display:flex; align-items:center; flex:1">
            <div class="bk-bar" style="background:${bc}"></div>
            <div style="flex:1">
                <div class="bk-time-badge">${b.time}</div>
                <div style="font-weight:700; color:var(--primary); font-size:1.05rem">${b.clientName} <small style="color:var(--text-light); font-weight:400">(${b.clientUnit})</small></div>
                <div style="font-size:0.85rem; color:var(--text-light); margin-top:4px">${fmtDate(b.date)} • ${b.desc} ${b.profName ? ' • ' + b.profName : ''}</div>
            </div>
        </div>
        ${del ? `<button onclick="cancelBk(${b.id})" style="border:none; background:#fee2e2; color:#ef4444; width:42px; height:42px; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s"><i class="fa-solid fa-trash-can"></i></button>` : ''}
    </div>`;
}

/* --- CORE: AUTENTICAÇÃO --- */
function toggleAuth(m) {
    document.getElementById('form-login').classList.toggle('hidden', m !== 'login');
    document.getElementById('form-reg').classList.toggle('hidden', m !== 'reg');
    document.getElementById('tab-login-btn').classList.toggle('active', m === 'login');
    document.getElementById('tab-reg-btn').classList.toggle('active', m === 'reg');
}

function login() {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value;
    const u = DB.u.get().find(x => x.email === e && x.pass === p);
    if (u) {
        currentUser = u;
        document.getElementById('screen-auth').classList.add('hidden');
        document.getElementById('screen-app').classList.remove('hidden');
        updateUserUI();
        if (u.role === 'morador') {
            const gb = document.getElementById('gender-badge');
            gb.innerText = u.gender === 'M' ? 'MASC' : 'FEM';
            gb.className = `tag ${u.gender === 'M' ? 'tag-m' : 'tag-f'}`;
        }
        loadView();
        const msg = DB.m.get(u.id);
        if (msg) {
            document.getElementById('alert-msg').innerText = msg;
            document.getElementById('modal-alert').style.display = 'flex';
        }
    } else showToast('Dados inválidos ou usuário inexistente');
}

function register() {
    const n = document.getElementById('reg-name').value, u = document.getElementById('reg-unit').value,
        g = document.getElementById('reg-gender').value, e = document.getElementById('reg-email').value,
        p = document.getElementById('reg-pass').value;
    if (!n || !u || !g || !e || !p) return showToast('Preencha tudo');
    
    let us = DB.u.get();
    if (us.find(x => x.email === e)) return showToast('Email já cadastrado');

    us.push({ id: 'u' + Date.now(), name: n, unit: u, gender: g, email: e, pass: p, role: 'morador' });
    DB.u.set(us);
    showToast('Sucesso! Entre com seu email e senha.');
    toggleAuth('login');
}

function logout() { location.reload(); }

/* --- PERFIL --- */
function openProfile() {
    document.getElementById('prof-name').value = currentUser.name;
    document.getElementById('prof-pass').value = '';
    document.getElementById('modal-profile').style.display = 'flex';
}

function saveProfile() {
    const newName = document.getElementById('prof-name').value;
    const newPass = document.getElementById('prof-pass').value;
    if (!newName) return showToast("Nome obrigatório");
    let us = DB.u.get();
    const idx = us.findIndex(u => u.id === currentUser.id);
    if (idx > -1) {
        us[idx].name = newName;
        if (newPass) us[idx].pass = newPass;
        DB.u.set(us);
        currentUser = us[idx];
        updateUserUI();
        showToast("Perfil atualizado!");
        document.getElementById('modal-profile').style.display = 'none';
    }
}

function updateUserUI() {
    document.getElementById('user-name').innerText = currentUser.name.split(' ')[0];
    document.getElementById('user-unit').innerText = currentUser.unit;
    document.getElementById('pc-user-name').innerText = currentUser.name;
    document.getElementById('pc-user-unit').innerText = currentUser.unit + (currentUser.role === 'prof' ? ' (Prof)' : '');
    document.getElementById('pc-avatar').innerText = getInitials(currentUser.name);
}

/* --- NAVEGAÇÃO --- */
function loadView() {
    ['view-morador', 'view-prof', 'view-admin'].forEach(x => document.getElementById(x).classList.add('hidden'));
    if (currentUser.role === 'morador') {
        document.getElementById('view-morador').classList.remove('hidden');
        renderProfs();
        renderMyBks();
    } else if (currentUser.role === 'prof') {
        document.getElementById('view-prof').classList.remove('hidden');
        renderProfAgenda();
    } else {
        document.getElementById('view-admin').classList.remove('hidden');
        renderAdmin();
    }
    switchTab('home');
}

function switchTab(t) {
    document.querySelectorAll('.nav-btn, .sidebar-item').forEach(x => x.classList.remove('active'));
    const mbtn = document.getElementById('mn-' + (t === 'home' ? 'home' : 'cal')); if (mbtn) mbtn.classList.add('active');
    const sbtn = document.getElementById('sb-' + (t === 'home' ? 'home' : 'cal')); if (sbtn) sbtn.classList.add('active');
    document.getElementById('tab-home').classList.toggle('hidden', t !== 'home');
    document.getElementById('tab-calendar').classList.toggle('hidden', t !== 'calendar');
    if (t === 'calendar') {
        document.getElementById('general-date').value = getToday();
        renderGeneralCalendar();
    }
}

/* --- LOGICA MORADOR --- */
function renderProfs() {
    const profs = DB.u.get().filter(u => u.role === 'prof');
    document.getElementById('list-profs').innerHTML = profs.length 
        ? profs.map(p => createProfCard(p)).join('')
        : '<p style="text-align:center; color:gray">Nenhum profissional cadastrado.</p>';
}

function startBk(pid) {
    tempBk = { pid: pid };
    const p = DB.u.get().find(x => x.id === pid);
    document.getElementById('sel-prof-name').innerText = p.name;
    document.getElementById('sel-prof-desc').innerText = p.desc || '';
    document.getElementById('sel-prof-avatar').innerText = getInitials(p.name);
    document.getElementById('date-picker').value = getToday();
    document.getElementById('step-prof').classList.add('hidden');
    document.getElementById('step-time').classList.remove('hidden');
    renderTimeGrid();
}

function backToProfs() {
    document.getElementById('step-prof').classList.remove('hidden');
    document.getElementById('step-time').classList.add('hidden');
    document.getElementById('btn-confirm').classList.add('hidden');
    document.getElementById('booking-desc').value = '';
}

function renderTimeGrid() {
    const d = document.getElementById('date-picker').value, p = DB.u.get().find(x => x.id === tempBk.pid), bks = DB.b.get();
    document.getElementById('grid-slots').innerHTML = TIMES.map(t => {
        const slot = bks.filter(b => b.date === d && b.time === t);
        if (slot.find(b => b.profId === p.id)) return `<div class="time-slot blocked-prof">--</div>`;
        const act = slot.find(b => b.type === 'appt');
        if (act && act.clientGender !== currentUser.gender) return `<div class="time-slot ${act.clientGender === 'M' ? 'blocked-male' : 'blocked-female'}">${act.clientGender === 'M' ? 'USO MASC' : 'USO FEM'}</div>`;
        if (slot.find(b => b.type === 'block')) return `<div class="time-slot blocked-prof">BLOQ</div>`;
        return `<div class="time-slot" onclick="selTime('${t}',this)">${t}</div>`;
    }).join('');
}

function selTime(t, el) {
    document.querySelectorAll('.time-slot').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    tempBk.time = t;
    document.getElementById('btn-confirm').classList.remove('hidden');
}

function confirmBooking() {
    const d = document.getElementById('booking-desc').value || 'Atendimento', p = DB.u.get().find(x => x.id === tempBk.pid);
    let b = DB.b.get();
    b.push({
        id: Date.now(), date: document.getElementById('date-picker').value, time: tempBk.time,
        profId: p.id, profName: p.name, clientId: currentUser.id, clientName: currentUser.name,
        clientUnit: currentUser.unit, clientGender: currentUser.gender, desc: d, type: 'appt'
    });
    DB.b.set(b);
    showToast('Agendado com sucesso!');
    backToProfs();
    renderMyBks();
}

function renderMyBks() {
    const bks = DB.b.get().filter(b => b.clientId === currentUser.id && b.type === 'appt'),
        act = bks.filter(b => !isPast(b.date)), his = bks.filter(b => isPast(b.date));
    document.getElementById('my-bookings-active').innerHTML = act.map(b => createTicket(b, true)).join('') || '<div style="text-align:center;color:#ccc;padding:20px">Sem agendamentos futuros</div>';
    document.getElementById('my-bookings-history').innerHTML = his.map(b => createTicket(b, false)).join('');
}

/* --- LOGICA PROFISSIONAL --- */
function renderBlockTimes() {
    const d = document.getElementById('block-date').value, bks = DB.b.get();
    document.getElementById('block-grid').innerHTML = TIMES.map(t => {
        const b = bks.find(x => x.date === d && x.time === t && x.profId === currentUser.id);
        return `<div class="time-slot ${b ? 'blocked-prof' : ''}" onclick="${!b ? `this.classList.toggle('selected')` : ''}">${t}</div>`;
    }).join('');
}

function saveBlock() {
    const d = document.getElementById('block-date').value, els = document.querySelectorAll('#block-grid .selected');
    if (!d || !els.length) return showToast('Selecione data/hora');
    let b = DB.b.get();
    els.forEach(e => b.push({ id: Date.now() + Math.random(), date: d, time: e.innerText, profId: currentUser.id, profName: currentUser.name, type: 'block' }));
    DB.b.set(b);
    showToast('Bloqueado');
    renderBlockTimes();
    renderProfAgenda();
}

function renderProfAgenda() {
    const all = DB.b.get().filter(b => b.profId === currentUser.id), act = all.filter(b => !isPast(b.date));
    document.getElementById('prof-list-active').innerHTML = act.filter(b => b.type === 'appt').sort((a, b) => a.time.localeCompare(b.time)).map(b => createTicket(b, true, true)).join('') || '<div style="text-align:center;color:#ccc;padding:20px">Agenda Livre</div>';
    const bl = act.filter(b => b.type === 'block'), gr = bl.reduce((a, b) => { (a[b.date] = a[b.date] || []).push(b); return a }, {});
    document.getElementById('prof-list-blocks').innerHTML = Object.keys(gr).map(d => `<div style="margin-bottom:10px; padding:15px; background:white; border-radius:12px; border:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center"><b style="color:var(--primary)">${fmtDate(d)}</b><div>${gr[d].map(k => `<span onclick="cancelBk(${k.id})" style="text-decoration:line-through;margin-left:8px;cursor:pointer;color:var(--text-light);font-size:0.8rem">${k.time}</span>`).join('')}</div></div>`).join('');
    document.getElementById('prof-list-history').innerHTML = all.filter(b => isPast(b.date) && b.type === 'appt').map(b => createTicket(b, false)).join('');
}

/* --- LOGICA ADMIN --- */
function renderAdminUsers() {
    const s = document.getElementById('admin-search').value.toLowerCase();
    const u = DB.u.get().filter(x => x.role !== 'admin' && (x.name.toLowerCase().includes(s) || x.unit.toLowerCase().includes(s)));
    document.getElementById('admin-user-list').innerHTML = u.map(x => `<div style="padding:15px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center"><div style="display:flex; gap:12px; align-items:center"><div class="avatar-box small">${getInitials(x.name)}</div><div><b style="font-size:0.95rem">${x.name}</b> <br><small style="color:var(--accent)">${x.unit} • ${x.role.toUpperCase()}</small></div></div><div style="display:flex;gap:8px"><button class="btn-ghost" style="padding:8px" onclick="adminEditUser('${x.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-ghost" style="padding:8px; color:#ef4444" onclick="delUser('${x.id}')"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');
}

function renderAdmin() {
    renderAdminUsers();
    document.getElementById('admin-list-active').innerHTML = DB.b.get().filter(b => b.type === 'appt' && !isPast(b.date)).map(b => createTicket(b, true, true)).join('') || '<div style="text-align:center;color:#ccc;padding:20px">Nenhuma reserva ativa</div>';
    document.getElementById('admin-list-history').innerHTML = DB.b.get().filter(b => b.type === 'appt' && isPast(b.date)).map(b => createTicket(b, false, true)).join('');
}

function adminEditUser(id) {
    document.getElementById('modal-admin-user').style.display = 'flex';
    const u = id ? DB.u.get().find(x => x.id === id) : { id: '', name: '', unit: '', email: '', pass: '', role: 'morador', gender: 'M' };
    document.getElementById('adm-uid').value = u.id || '';
    document.getElementById('adm-name').value = u.name;
    document.getElementById('adm-unit').value = u.unit;
    document.getElementById('adm-email').value = u.email;
    document.getElementById('adm-pass').value = u.pass;
    document.getElementById('adm-role').value = u.role;
    document.getElementById('adm-gender').value = u.gender;
}

function adminSaveUser() {
    const n = document.getElementById('adm-name').value, u = document.getElementById('adm-unit').value,
        e = document.getElementById('adm-email').value, p = document.getElementById('adm-pass').value,
        r = document.getElementById('adm-role').value, g = document.getElementById('adm-gender').value,
        id = document.getElementById('adm-uid').value;
    if (!n || !u || !e || !p) return showToast('Preencha tudo');
    let us = DB.u.get();
    if (id) {
        const i = us.findIndex(x => x.id === id);
        us[i] = { ...us[i], name: n, unit: u, email: e, pass: p, role: r, gender: g };
    } else us.push({ id: 'u' + Date.now(), name: n, unit: u, email: e, pass: p, role: r, gender: g });
    DB.u.set(us);
    showToast('Usuário Salvo');
    document.getElementById('modal-admin-user').style.display = 'none';
    renderAdmin();
}

function delUser(id) {
    if (confirm('Excluir permanentemente?')) {
        DB.u.set(DB.u.get().filter(x => x.id !== id));
        renderAdmin();
    }
}

/* --- CANCELAMENTOS --- */
function cancelBk(id) {
    let b = DB.b.get().find(x => x.id === id);
    if (!b) return;
    if (currentUser.role === 'morador') {
        if (confirm('Cancelar sua reserva?')) doCancel(id, null);
    } else if (b.type === 'appt') {
        pendingCancelId = id;
        document.getElementById('cancel-reason').value = '';
        document.getElementById('modal-cancel').style.display = 'flex';
    } else {
        if (confirm('Remover este bloqueio?')) doCancel(id, null);
    }
}

function finalizeCancel() {
    doCancel(pendingCancelId, document.getElementById('cancel-reason').value);
    document.getElementById('modal-cancel').style.display = 'none';
}
function closeCancelModal() { document.getElementById('modal-cancel').style.display = 'none'; }

function doCancel(id, r) {
    let bks = DB.b.get(), bk = bks.find(x => x.id === id);
    if (bk && bk.type === 'appt' && currentUser.role !== 'morador') DB.m.add(bk.clientId, `Reserva cancelada. ${r ? 'Motivo: ' + r : ''}`);
    DB.b.set(bks.filter(x => x.id !== id));
    showToast('Cancelado');
    loadView();
}

/* --- AGENDA GERAL --- */
function renderGeneralCalendar() {
    const d = document.getElementById('general-date').value, bks = DB.b.get().filter(b => b.date === d);
    document.getElementById('general-timeline').innerHTML = TIMES.map(t => {
        const s = bks.filter(x => x.time === t);
        let h = '<span style="color:#cbd5e1; font-size:0.85rem; font-style:italic">Disponível</span>';
        if (s.length) h = s.map(x => x.type === 'block' ? `<span class="tag" style="background:#f1f5f9; color:#94a3b8">BLOQUEIO PROF.</span>` : `<span class="tag ${x.clientGender === 'M' ? 'tag-m' : 'tag-f'}">${x.profName} • ${x.clientName} (${x.clientUnit})</span>`).join(' ');
        return `<div style="padding:18px 0; border-bottom:1px solid #f8fafc; display:flex; align-items:center"><div style="width:75px; font-weight:700; color:var(--primary); font-family:'Cinzel'">${t}</div><div style="flex:1">${h}</div></div>`;
    }).join('');
}

/* --- NOTIFICAÇÕES --- */
function toggleHistory(role) {
    const id = role === 'morador' ? 'my-bookings-history' : role === 'prof' ? 'prof-list-history' : 'admin-list-history';
    document.getElementById(id).classList.toggle('hidden');
}

function showToast(m) {
    const t = document.getElementById('toast');
    if(t) {
        document.getElementById('toast-msg').innerText = m;
        t.style.display = 'flex';
        setTimeout(() => t.style.display = 'none', 3000);
    } else {
        alert(m);
    }
}

/* --- INICIALIZAÇÃO --- */
initDB();
document.getElementById('date-picker').min = getToday();
document.getElementById('block-date').min = getToday();
