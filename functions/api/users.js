export async function onRequest(context) {
  const { request, env } = context;

  // Verifica se o D1 está vinculado corretamente
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Binding 'DB' não configurado no painel da Cloudflare." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // MÉTODO GET: Listar usuários
    if (request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM usuarios").all();
      return new Response(JSON.stringify(results || []), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // MÉTODO POST: Cadastrar usuário
    if (request.method === "POST") {
      const u = await request.json();

      // Log preventivo para o painel de controle (ajuda a achar erros)
      console.log("Recebido para cadastro:", u);

      // Executa o comando no banco usando os nomes das colunas que criamos no SQL
      const resultado = await env.DB.prepare(`
        INSERT OR REPLACE INTO usuarios (id, name, email, pass, unit, gender, role, desc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        u.id || `u${Date.now()}`, 
        u.name || "Sem Nome", 
        u.email, 
        u.pass || "123", 
        u.unit || "N/A", 
        u.gender || "M", 
        u.role || "morador", 
        u.desc || ""
      )
      .run();

      return new Response(JSON.stringify({ success: true, meta: resultado.meta }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Método não permitido", { status: 405 });

  } catch (error) {
    // Este bloco impede o Erro 1101 e te mostra o erro real na tela
    return new Response(JSON.stringify({ 
      error: "Falha na operação", 
      message: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
