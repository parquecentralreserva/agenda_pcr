export async function onRequest({ request, env }) {
  const db = env.DB;
  if (request.method === "GET") {
    const { results } = await db.prepare("SELECT * FROM agendamentos").all();
    return new Response(JSON.stringify(results));
  }
  if (request.method === "POST") {
    const b = await request.json();
    await db.prepare("INSERT INTO agendamentos (date, time, profId, profName, clientId, clientName, clientUnit, clientGender, desc, type) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(b.date, b.time, b.profId, b.profName, b.clientId, b.clientName, b.clientUnit, b.clientGender, b.desc, b.type).run();
    return new Response(JSON.stringify({success: true}));
  }
  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id");
    await db.prepare("DELETE FROM agendamentos WHERE id = ?").bind(id).run();
    return new Response(null, { status: 204 });
  }
}
