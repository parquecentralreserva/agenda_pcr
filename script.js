/* --- CONFIGURAÇÃO --- */
let currentUser = null;
const TIMES = ['09:00', '10:00', '13:00', '14:00', '15:00']; // Simplificado para teste

const DB = {
    fetchUsers: async () => (await fetch('/api/users')).json(),
    fetchBookings: async () => (await fetch('/api/bookings')).json(),
    saveUser: async (user) => fetch('/api/users', { method: 'POST', body: JSON.stringify(user) }),
    saveBooking: async (bk) => fetch('/api/bookings', { method: 'POST', body: JSON.stringify(bk) }),
    deleteBooking: async (id) => fetch(`/api/bookings?id=${id}`, { method: 'DELETE' })
};

/* --- AÇÕES --- */
async function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    
    const users = await DB.fetchUsers();
    const user = users.find(u => u.email === email && u.pass === pass);

    if (user) {
        currentUser = user;
        alert(`Bem-vindo, ${user.name}!`);
        // Aqui você chamaria a função de carregar a tela do app
    } else {
        alert("Usuário não encontrado no banco!");
    }
}

async function register() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    // ... pegar outros campos ...

    const newUser = {
        id: "u" + Date.now(),
        name: name,
        email: email,
        pass: "123", // exemplo
        unit: "101",
        gender: "M",
        role: "morador",
        desc: ""
    };

    await DB.saveUser(newUser);
    alert("Usuário salvo no D1!");
}
