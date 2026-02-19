export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Binding DB não encontrado" }), { status: 500 });
  }

  try {
    // LER USUÁRIOS
    if (request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM usuarios").all();
      return new Response(JSON.stringify(results || []), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // SALVAR OU EDITAR USUÁRIO
    if (request.method === "POST") {
      const u = await request.json();
      
      await env.DB.prepare(`
        INSERT OR REPLACE INTO usuarios (id, name, email, pass, unit, gender, role, desc)
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
    }

    // DELETAR USUÁRIO
    if (request.method === "DELETE") {
      const id = new URL(request.url).searchParams.get("id");
      await env.DB.prepare("DELETE FROM usuarios WHERE id = ?").bind(id).run();
      return new Response(null, { status: 204 });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}
