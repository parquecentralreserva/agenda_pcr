export async function onRequest({ request, env }) {
  const db = env.DB; // O binding deve se chamar DB
  if (request.method === "GET") {
    const { results } = await db.prepare("SELECT * FROM usuarios").all();
    return new Response(JSON.stringify(results));
  }
  if (request.method === "POST") {
    const u = await request.json();
    await db.prepare("INSERT OR REPLACE INTO usuarios (id, name, email, pass, unit, gender, role, desc) VALUES (?,?,?,?,?,?,?,?)")
      .bind(u.id, u.name, u.email, u.pass, u.unit, u.gender, u.role, u.desc).run();
    return new Response(JSON.stringify({success: true}));
  }
}
