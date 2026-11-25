// Intermediário para os dados públicos de carregadores da MOBI.E (data.mobie.pt).
// O servidor da MOBI.E não envia cabeçalhos CORS, por isso o site no GitHub Pages
// não os consegue pedir diretamente. Este Worker só serve três caminhos, só responde
// ao site autorizado e guarda as respostas em cache para poupar o servidor da MOBI.E.
//
//   GET /stations      lista de postos e tomadas (cache 1 hora)
//   GET /status        estado de cada tomada: available, inUse, outOfService, unknown (cache 60 s)
//   GET /station/:id   estado e preços de um posto (cache 60 s)

const ORIGEM = "https://data.mobie.pt";
const PERMITIDOS = ["https://bhcsantos.github.io"];
const ROTAS = [
  { re: /^\/stations$/, alvo: () => "/data/stations.json", ttl: 3600 },
  { re: /^\/status$/, alvo: () => "/api/v1/stations/status", ttl: 60 },
  { re: /^\/station\/([A-Za-z0-9._-]{1,40})$/, alvo: (m) => `/api/v1/stations/${encodeURIComponent(m[1])}`, ttl: 60 },
];

function cors(origin) {
  const ok = PERMITIDOS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || "");
  return ok
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin" }
    : { "Vary": "Origin" };
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors(origin), "Access-Control-Max-Age": "86400" } });
    if (req.method !== "GET") return new Response("Método não permitido", { status: 405, headers: cors(origin) });

    let rota, m;
    for (const r of ROTAS) { m = url.pathname.match(r.re); if (m) { rota = r; break; } }
    if (!rota) return new Response("Não encontrado", { status: 404, headers: cors(origin) });

    const cache = caches.default;
    const chave = new Request(ORIGEM + rota.alvo(m), { method: "GET" });
    let resp = await cache.match(chave);
    if (!resp) {
      const r = await fetch(chave, { headers: { "Accept": "application/json", "User-Agent": "postos-abastecimento (site sem fins comerciais)" } });
      if (!r.ok) return new Response(JSON.stringify({ erro: `MOBI.E respondeu ${r.status}` }), { status: 502, headers: { ...cors(origin), "Content-Type": "application/json" } });
      resp = new Response(r.body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${rota.ttl}` } });
      ctx.waitUntil(cache.put(chave, resp.clone()));
    }
    const h = new Headers(resp.headers);
    for (const [k, v] of Object.entries(cors(origin))) h.set(k, v);
    h.set("Cache-Control", `public, max-age=${Math.min(rota.ttl, 300)}`);
    return new Response(resp.body, { status: 200, headers: h });
  },
};
