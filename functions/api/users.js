export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method === "GET") {
    const { results } = await db.prepare("SELECT * FROM usuarios").all();
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (request.method === "POST") {
    try {
      const u = await request.json();
      
      // Log para depuração (visível no painel da Cloudflare)
      console.log("Tentando inserir usuário:", u);

      await db.prepare(`
        INSERT INTO usuarios (id, name, email, pass, unit, gender, role, desc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        u.id, 
        u.name, 
        u.email, 
        u.pass, 
        u.unit || "", 
        u.gender || "", 
        u.role || "morador", 
        u.desc || ""
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { 
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
}
