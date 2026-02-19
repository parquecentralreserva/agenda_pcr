/* --- CONFIGURAÇÃO E ESTADO --- */
let currentUser = null, tempBk = {}, pendingCancelId = null;
const TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const getToday = () => new Date().toISOString().split('T')[0];
const isPast = (d) => d < getToday();
const fmtDate = (s) => s.split('-').reverse().join('/');
const getInitials = (n) => n ? n.substring(0, 2).toUpperCase() : '??';

/* --- CONEXÃO COM O BANCO DE DADOS D1 (API) --- */
const API = {
    u: {
        get: async () => {
            try { const r = await fetch('/api/users'); return await r.json(); } catch(e) { return []; }
        },
        save: async (d) => {
            await fetch('/api/users', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) });
        },
        del: async (id) => {
            await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
        }
    },
    b: {
        get: async () => {
            try { const r = await fetch('/api/bookings'); return await r.json(); } catch(e) { return []; }
        },
        save: async (d) => {
            await fetch('/api/bookings', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) });
        },
        del: async (id) => {
            await fetch(`/api/bookings?id=${id}`, { method: 'DELETE' });
        }
    }
};

/* Sistema de Notificações mantido no LocalStorage para não exigir nova tabela agora */
const DB = {
    m: { 
        add: (u, t) => { let m = JSON.parse(localStorage.getItem('db_v27_m')) || []; m.push({to: u, txt: t, read: false}); localStorage.setItem('db_v27_m', JSON.stringify(m)); },
        get: (u) => { let m = JSON.parse(localStorage.getItem('db_v27_m')) || []; const f = m.filter(x => x.to === u && !x.read); if(f.length){ f.forEach(x => x.read = true); localStorage.setItem('db_v27_m', JSON.stringify(m)); return f[0].txt; } return null; }
    }
};

/* --- ELEMENTOS UI ORIGINAIS --- */
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

function createTicket(b, del, color=false) {
    const bc = color ? (b.clientGender === 'M' ? 'var(--male-color)' : 'var(--female-color)') : 'var(--primary)';
    return `
    <div class="bk-ticket">
        <div style="display:flex; align-items:center; flex:1">
            <div class="bk-bar" style="background:${bc}"></div>
            <div style="flex:1">
                <div class="bk-time-badge">${b.time}</div>
                <div style="font-weight:700; color:var(--primary); font-size:1.05rem">${b.clientName || 'Bloqueio'} <small style="color:var(--text-light); font-weight:400">${b.clientUnit ? `(${b.clientUnit})` : ''}</small></div>
                <div style="font-size:0.85rem; color:var(--text-light); margin-top:4px">${fmtDate(b.date)} • ${b.desc || 'Bloqueio'} ${b.profName ? ' • ' + b.profName : ''}</div>
            </div>
        </div>
        ${del ? `<button onclick="cancelBk('${b.id}')" style="border:none; background:#fee2e2; color:#ef4444; width:42px; height:42px; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s"><i class="fa-solid fa-trash-can"></i></button>` : ''}
    </div>`;
}

function toggleAuth(m) {
    document.getElementById('form-login').classList.toggle('hidden', m !== 'login');
    document.getElementById('form-reg').classList.toggle('hidden', m !== 'reg');
    document.getElementById('tab-login-btn').style = m === 'login' ? "background:white; color:var(--primary); box-shadow:0 4px 10px rgba(0,0,0,0.05)" : "background:transparent; color:#999";
    document.getElementById('tab-reg-btn').style = m === 'reg' ? "background:white; color:var(--primary); box-shadow:0 4px 10px rgba(0,0,0,0.05)" : "background:transparent; color:#999";
}

/* --- CORE: AUTENTICAÇÃO E PERFIL --- */
async function login() {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value;
    const users = await API.u.get();
    const u = users.find(x => x.email === e && x.pass === p);
    
    if(u) {
        currentUser = u; 
        document.getElementById('screen-auth').classList.add('hidden'); 
        document.getElementById('screen-app').classList.remove('hidden');
        updateUserUI();
        
        if(u.role === 'morador') {
            const gb = document.getElementById('gender-badge'); 
            gb.innerText = u.gender === 'M' ? 'MASC' : 'FEM'; 
            gb.className = `tag ${u.gender === 'M' ? 'tag-m' : 'tag-f'}`;
        }
        
        await loadView();
        
        const m = DB.m.get(u.id); 
        if(m) {
            document.getElementById('alert-msg').innerText = m;
            document.getElementById('modal-alert').style.display = 'flex';
        }
    } else showToast('Dados inválidos');
}

async function register() {
    const n = document.getElementById('reg-name').value, u = document.getElementById('reg-unit').value, 
          g = document.getElementById('reg-gender').value, e = document.getElementById('reg-email').value, 
          p = document.getElementById('reg-pass').value;
    
    if(!n || !u || !g || !e || !p) return showToast('Preencha tudo');
    
    const newUser = { id: 'u' + Date.now(), name: n, unit: u, gender: g, email: e, pass: p, role: 'morador', desc: '', maca: 0 };
    await API.u.save(newUser);
    
    showToast('Sucesso! Entre.'); 
    toggleAuth('login');
}

function logout() { location.reload(); }

function openProfile() {
    document.getElementById('prof-name').value = currentUser.name;
    document.getElementById('prof-pass').value = currentUser.pass;
    const descInput = document.getElementById('prof-desc');
    if(descInput) descInput.value = currentUser.desc || '';
    document.getElementById('modal-profile').style.display = 'flex';
}

async function saveProfile() {
    const newName = document.getElementById('prof-name').value;
    const newPass = document.getElementById('prof-pass').value;
    const newDesc = document.getElementById('prof-desc') ? document.getElementById('prof-desc').value : currentUser.desc;

    if(!newName) return showToast("Nome obrigatório");
    
    currentUser.name = newName;
    if(newPass) currentUser.pass = newPass;
    currentUser.desc = newDesc;
    
    await API.u.save(currentUser);
    updateUserUI();
    showToast("Perfil atualizado!");
    document.getElementById('modal-profile').style.display = 'none';
}

function updateUserUI() {
    document.getElementById('user-name').innerText = currentUser.name.split(' ')[0]; 
    document.getElementById('user-unit').innerText = currentUser.unit;
    document.getElementById('pc-user-name').innerText = currentUser.name;
    document.getElementById('pc-user-unit').innerText = currentUser.unit + (currentUser.role === 'prof' ? ' (Prof)' : '');
    document.getElementById('pc-avatar').innerText = getInitials(currentUser.name);
}

/* --- NAVEGAÇÃO --- */
async function loadView() {
    ['view-morador','view-prof','view-admin'].forEach(x => document.getElementById(x).classList.add('hidden'));
    
    if(currentUser.role === 'morador') { 
        document.getElementById('view-morador').classList.remove('hidden'); 
        await renderProfs(); 
        await renderMyBks(); 
    }
    else if(currentUser.role === 'prof') { 
        document.getElementById('view-prof').classList.remove('hidden'); 
        await renderProfAgenda(); 
    }
    else { 
        document.getElementById('view-admin').classList.remove('hidden'); 
        await renderAdmin(); 
    }
    switchTab('home');
}

async function switchTab(t) {
    document.querySelectorAll('.nav-btn, .sidebar-item').forEach(x => x.classList.remove('active'));
    const mbtn = document.getElementById('mn-'+(t === 'home' ? 'home' : 'cal')); if(mbtn) mbtn.classList.add('active');
    const sbtn = document.getElementById('sb-'+(t === 'home' ? 'home' : 'cal')); if(sbtn) sbtn.classList.add('active');
    document.getElementById('tab-home').classList.toggle('hidden', t !== 'home');
    document.getElementById('tab-calendar').classList.toggle('hidden', t !== 'calendar');
    if(t === 'calendar') { 
        document.getElementById('general-date').value = getToday(); 
        await renderGeneralCalendar(); 
    }
}

/* --- VISÃO: MORADOR --- */
async function renderProfs() { 
    const users = await API.u.get();
    document.getElementById('list-profs').innerHTML = users.filter(u => u.role === 'prof').map(p => createProfCard(p)).join(''); 
}

async function startBk(pid) {
    tempBk = { pid: pid }; 
    const users = await API.u.get();
    const p = users.find(x => x.id === pid);
    
    document.getElementById('sel-prof-name').innerText = p.name; 
    document.getElementById('sel-prof-desc').innerText = p.desc || '';
    document.getElementById('sel-prof-avatar').innerText = getInitials(p.name);
    document.getElementById('date-picker').value = getToday();
    document.getElementById('step-prof').classList.add('hidden'); 
    document.getElementById('step-time').classList.remove('hidden');
    await renderTimeGrid();
}

function backToProfs() { 
    document.getElementById('step-prof').classList.remove('hidden'); 
    document.getElementById('step-time').classList.add('hidden'); 
    document.getElementById('btn-confirm').classList.add('hidden'); 
    document.getElementById('booking-desc').value = ''; 
}

async function renderTimeGrid() {
    const d = document.getElementById('date-picker').value;
    const users = await API.u.get();
    const p = users.find(x => x.id === tempBk.pid);
    const bks = await API.b.get();
    
    document.getElementById('grid-slots').innerHTML = TIMES.map(t => {
        const slot = bks.filter(b => b.date === d && b.time === t);
        
        // 1. O profissional escolhido já está ocupado?
        if(slot.find(b => b.profId === p.id)) return `<div class="time-slot blocked-prof">--</div>`;
        
        // 2. REGRA DA MACA: Se o profissional escolhido usa maca, checar se a sala com maca está ocupada
        if(p.maca === 1) {
            const macaOcupada = slot.some(b => {
                if (b.type !== 'appt') return false; // Ignora bloqueios sem cliente
                const profDoAgendamento = users.find(u => u.id === b.profId);
                return profDoAgendamento && profDoAgendamento.maca === 1;
            });
            if(macaOcupada) return `<div class="time-slot" style="background:#fca5a5; color:#7f1d1d; cursor:not-allowed; border: 1px solid #f87171;">MACA EM USO</div>`;
        }

        // 3. REGRA DE GÊNERO
        const act = slot.find(b => b.type === 'appt');
        if(act && act.clientGender !== currentUser.gender) return `<div class="time-slot ${act.clientGender === 'M' ? 'blocked-male' : 'blocked-female'}">${act.clientGender === 'M' ? 'USO MASC' : 'USO FEM'}</div>`;
        
        // 4. Bloqueios manuais
        if(slot.find(b => b.type === 'block')) return `<div class="time-slot blocked-prof">BLOQ</div>`;
        
        // 5. Livre
        return `<div class="time-slot" onclick="selTime('${t}',this)">${t}</div>`;
    }).join('');
}

function selTime(t,el) { 
    document.querySelectorAll('.time-slot').forEach(x => x.classList.remove('selected')); 
    el.classList.add('selected'); 
    tempBk.time = t; 
    document.getElementById('btn-confirm').classList.remove('hidden'); 
}

async function confirmBooking() {
    const d = document.getElementById('booking-desc').value || 'Atendimento';
    const users = await API.u.get();
    const p = users.find(x => x.id === tempBk.pid);
    
    const newBk = {
        date: document.getElementById('date-picker').value, time: tempBk.time,
        profId: p.id, profName: p.name, clientId: currentUser.id, clientName: currentUser.name,
        clientUnit: currentUser.unit, clientGender: currentUser.gender, desc: d, type: 'appt'
    };
    
    await API.b.save(newBk);
    showToast('Agendado com sucesso!'); 
    backToProfs(); 
    await renderMyBks();
}

async function renderMyBks() {
    const bks = await API.b.get();
    const myBks = bks.filter(b => b.clientId === currentUser.id && b.type === 'appt');
    const act = myBks.filter(b => !isPast(b.date));
    const his = myBks.filter(b => isPast(b.date));
    
    document.getElementById('my-bookings-active').innerHTML = act.map(b => createTicket(b, true)).join('') || '<div style="text-align:center;color:#ccc;padding:20px">Sem agendamentos futuros</div>';
    document.getElementById('my-bookings-history').innerHTML = his.map(b => createTicket(b, false)).join('');
}

/* --- VISÃO: PROFISSIONAL --- */
async function renderBlockTimes() {
    const d = document.getElementById('block-date').value;
    const bks = await API.b.get();
    
    document.getElementById('block-grid').innerHTML = TIMES.map(t => {
        const b = bks.find(x => x.date === d && x.time === t && x.profId === currentUser.id);
        return `<div class="time-slot ${b ? 'blocked-prof' : ''}" onclick="${!b ? `this.classList.toggle('selected')` : ''}">${t}</div>`;
    }).join('');
}

async function saveBlock() {
    const d = document.getElementById('block-date').value;
    const els = document.querySelectorAll('#block-grid .selected');
    if(!d || !els.length) return showToast('Selecione data/hora');
    
    for (let e of els) {
        await API.b.save({
            date: d, time: e.innerText, profId: currentUser.id, profName: currentUser.name, type: 'block', desc: 'Bloqueio Profissional'
        });
    }
    
    showToast('Bloqueado'); 
    await renderBlockTimes(); 
    await renderProfAgenda();
}

async function renderProfAgenda() {
    const bks = await API.b.get();
    const all = bks.filter(b => b.profId === currentUser.id);
    const act = all.filter(b => !isPast(b.date));
    
    document.getElementById('prof-list-active').innerHTML = act.filter(b => b.type === 'appt').sort((a,b) => a.time.localeCompare(b.time)).map(b => createTicket(b, true, true)).join('') || '<div style="text-align:center;color:#ccc;padding:20px">Agenda Livre</div>';
    
    const bl = act.filter(b => b.type === 'block');
    const gr = bl.reduce((a,b) => { (a[b.date] = a[b.date] || []).push(b); return a }, {});
    
    document.getElementById('prof-list-blocks').innerHTML = Object.keys(gr).map(d => `<div style="margin-bottom:10px; padding:15px; background:white; border-radius:12px; border:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center"><b style="color:var(--primary)">${fmtDate(d)}</b><div>${gr[d].map(k => `<span onclick="cancelBk('${k.id}')" style="text-decoration:line-through;margin-left:8px;cursor:pointer;color:var(--text-light);font-size:0.8rem">${k.time}</span>`).join('')}</div></div>`).join('');
    document.getElementById('prof-list-history').innerHTML = all.filter(b => isPast(b.date) && b.type === 'appt').map(b => createTicket(b, false)).join('');
}

/* --- VISÃO: ADMIN --- */
async function renderAdminUsers() {
    const s = document.getElementById('admin-search').value.toLowerCase();
    const users = await API.u.get();
    const u = users.filter(x => x.role !== 'admin' && (x.name.toLowerCase().includes(s) || x.unit.toLowerCase().includes(s)));
    
    document.getElementById('admin-user-list').innerHTML = u.map(x => `
        <div style="padding:15px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center">
            <div style="display:flex; gap:12px; align-items:center">
                <div class="avatar-box small">${getInitials(x.name)}</div>
                <div>
                    <b style="font-size:0.95rem">${x.name}</b> ${x.maca === 1 ? '<span style="font-size:10px; background:#fee2e2; color:#b91c1c; padding:2px 4px; border-radius:4px; margin-left:4px">MACA</span>' : ''}<br>
                    <small style="color:var(--accent)">${x.unit} • ${x.role.toUpperCase()}</small>
                </div>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn-ghost" style="padding:8px" onclick="adminEditUser('${x.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-ghost" style="padding:8px; color:#ef4444" onclick="delUser('${x.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`).join('');
}

async function renderAdmin() {
    await renderAdminUsers();
    const bks = await API.b.get();
    document.getElementById('admin-list-active').innerHTML = bks.filter(b => b.type === 'appt' && !isPast(b.date)).map(b => createTicket(b, true, true)).join('') || '<div style="text-align:center;color:#ccc;padding:20px">Nenhuma reserva ativa</div>';
    document.getElementById('admin-list-history').innerHTML = bks.filter(b => b.type === 'appt' && isPast(b.date)).map(b => createTicket(b, false, true)).join('');
}

async function adminEditUser(id) {
    document.getElementById('modal-admin-user').style.display = 'flex';
    let u = { id: '', name: '', unit: '', email: '', pass: '', role: 'morador', gender: 'M', desc: '', maca: 0 };
    
    if (id) {
        const users = await API.u.get();
        u = users.find(x => x.id === id) || u;
    }
    
    document.getElementById('adm-uid').value = u.id || ''; 
    document.getElementById('adm-name').value = u.name; 
    document.getElementById('adm-unit').value = u.unit;
    document.getElementById('adm-email').value = u.email; 
    document.getElementById('adm-pass').value = u.pass; 
    document.getElementById('adm-role').value = u.role; 
    document.getElementById('adm-gender').value = u.gender;
    
    const descInput = document.getElementById('adm-desc');
    const macaInput = document.getElementById('adm-maca');
    if(descInput) descInput.value = u.desc || '';
    if(macaInput) macaInput.checked = (u.maca === 1);
}

async function adminSaveUser() {
    const n = document.getElementById('adm-name').value, u = document.getElementById('adm-unit').value, 
          e = document.getElementById('adm-email').value, p = document.getElementById('adm-pass').value, 
          r = document.getElementById('adm-role').value, g = document.getElementById('adm-gender').value, 
          id = document.getElementById('adm-uid').value;
          
    const d = document.getElementById('adm-desc') ? document.getElementById('adm-desc').value : '';
    const m = document.getElementById('adm-maca') && document.getElementById('adm-maca').checked ? 1 : 0;
          
    if(!n || !e || !p) return showToast('Preencha Nome, Email e Senha');
    
    const userToSave = {
        id: id || 'u' + Date.now(),
        name: n, unit: u, email: e, pass: p, role: r, gender: g, desc: d, maca: m
    };
    
    await API.u.save(userToSave);
    showToast('Usuário Salvo'); 
    document.getElementById('modal-admin-user').style.display = 'none'; 
    await renderAdmin();
}

async function delUser(id) { 
    if(confirm('Excluir permanentemente?')) { 
        await API.u.del(id); 
        await renderAdmin(); 
    } 
}

/* --- CANCELAMENTOS --- */
async function cancelBk(id) {
    const bks = await API.b.get();
    let b = bks.find(x => String(x.id) === String(id)); 
    if(!b) return;
    
    if(currentUser.role === 'morador') { 
        if(confirm('Cancelar sua reserva?')) await doCancel(id, null); 
    }
    else if(b.type === 'appt') { 
        pendingCancelId = id; 
        document.getElementById('cancel-reason').value = ''; 
        document.getElementById('modal-cancel').style.display = 'flex'; 
    }
    else { 
        if(confirm('Remover este bloqueio?')) await doCancel(id, null); 
    }
}

async function finalizeCancel() { 
    await doCancel(pendingCancelId, document.getElementById('cancel-reason').value); 
    document.getElementById('modal-cancel').style.display = 'none'; 
}

function closeCancelModal() { document.getElementById('modal-cancel').style.display = 'none'; }

async function doCancel(id, r) {
    const bks = await API.b.get();
    let bk = bks.find(x => String(x.id) === String(id));
    
    if(bk && bk.type === 'appt' && currentUser.role !== 'morador') {
        DB.m.add(bk.clientId, `Reserva cancelada. ${r ? 'Motivo: ' + r : ''}`);
    }
    
    await API.b.del(id);
    showToast('Cancelado'); 
    await loadView();
}

/* --- AGENDA GERAL (CALENDÁRIO ABA) --- */
async function renderGeneralCalendar() {
    const d = document.getElementById('general-date').value;
    const bks = await API.b.get();
    const dayBks = bks.filter(b => b.date === d);
    
    document.getElementById('general-timeline').innerHTML = TIMES.map(t => {
        const s = dayBks.filter(x => x.time === t); 
        let h = '<span style="color:#cbd5e1; font-size:0.85rem; font-style:italic">Disponível</span>';
        if(s.length) h = s.map(x => x.type === 'block' ? `<span class="tag" style="background:#f1f5f9; color:#94a3b8">BLOQUEIO PROF.</span>` : `<span class="tag ${x.clientGender === 'M' ? 'tag-m' : 'tag-f'}">${x.profName} • ${x.clientName} (${x.clientUnit})</span>`).join(' ');
        return `<div style="padding:18px 0; border-bottom:1px solid #f8fafc; display:flex; align-items:center"><div style="width:75px; font-weight:700; color:var(--primary); font-family:'Cinzel'">${t}</div><div style="flex:1">${h}</div></div>`;
    }).join('');
}

function toggleHistory(role) { 
    const id = role === 'morador' ? 'my-bookings-history' : role === 'prof' ? 'prof-list-history' : 'admin-list-history';
    document.getElementById(id).classList.toggle('hidden'); 
}

function showToast(m) { 
    const t = document.getElementById('toast'); 
    document.getElementById('toast-msg').innerText = m;
    t.style.display = 'flex'; 
    setTimeout(() => t.style.display = 'none', 3000); 
}

/* --- INICIALIZAÇÃO --- */
document.getElementById('date-picker').min = getToday();
document.getElementById('block-date').min = getToday();
