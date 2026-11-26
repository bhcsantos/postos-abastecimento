// Intermediário para os dados públicos de carregadores da MOBI.E (data.mobie.pt).
// O servidor da MOBI.E não envia cabeçalhos CORS, por isso o site no GitHub Pages
// não os consegue pedir diretamente. Este Worker só serve quatro caminhos, só responde
// ao site autorizado e guarda as respostas em cache para poupar o servidor da MOBI.E.
//
//   GET /stations      lista de postos e tomadas (cache 1 hora)
//   GET /status        estado de cada tomada: available, inUse, outOfService, unknown (cache 60 s)
//   GET /tariffs       tarifários dos operadores por posto e tomada (cache 1 hora)
//   GET /station/:id   estado e preços de um posto (cache 60 s)
//
// Também serve de cache para a API pública da DGEG (preços dos combustíveis):
//   GET /dgeg/PesquisarPostos?idsTiposComb=&idDistrito=&qtdPorPagina=&pagina=   (cache 15 min)
//   GET /dgeg/GetDadosPosto?id=                                                 (cache 15 min)
// Guarda ainda uma "última cópia boa" durante 7 dias: se a DGEG estiver lenta (mais de 10 s)
// ou em baixo, responde com essa cópia e o cabeçalho X-Copia: antiga.

const ORIGEM = "https://data.mobie.pt";
const PERMITIDOS = ["https://bhcsantos.github.io"];
const ROTAS = [
  { re: /^\/stations$/, alvo: () => "/data/stations.json", ttl: 3600 },
  { re: /^\/status$/, alvo: () => "/api/v1/stations/status", ttl: 60 },
  { re: /^\/tariffs$/, alvo: () => "/data/tariffs.json", ttl: 3600 },
  { re: /^\/station\/([A-Za-z0-9._-]{1,40})$/, alvo: (m) => `/api/v1/stations/${encodeURIComponent(m[1])}`, ttl: 60 },
];

const DGEG = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/";
const DGEG_ROTAS = { PesquisarPostos: ["idsTiposComb", "idDistrito", "qtdPorPagina", "pagina"], GetDadosPosto: ["id"] };
const DGEG_TTL = 900, DGEG_COPIA = 7 * 86400;

async function dgeg(url, origin, ctx) {
  const nome = url.pathname.slice(6), params = DGEG_ROTAS[nome];
  if (!params) return new Response("Não encontrado", { status: 404, headers: cors(origin) });
  const q = new URLSearchParams();
  for (const k of params) { const v = url.searchParams.get(k); if (v != null) { if (!/^[0-9,]{1,40}$/.test(v)) return new Response("Parâmetro inválido", { status: 400, headers: cors(origin) }); q.set(k, v); } }
  const alvo = DGEG + nome + "?" + q.toString();
  const cache = caches.default, chave = new Request(alvo), chaveCopia = new Request(alvo + "&_copia=1");
  const responder = (body, extra) => { const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", ...cors(origin), ...extra }); return new Response(body, { status: 200, headers: h }); };
  const hit = await cache.match(chave);
  if (hit) return responder(hit.body, { "X-Copia": "cache" });
  try {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 10000);
    const r = await fetch(alvo, { signal: c.signal, headers: { "Accept": "application/json", "User-Agent": "postos-abastecimento (site sem fins comerciais)" } });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    const txt = await r.text(), j = JSON.parse(txt);
    if (!j.status) throw new Error("DGEG sem dados");
    const guardar = (k, ttl) => cache.put(k, new Response(txt, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${ttl}` } }));
    ctx.waitUntil(Promise.all([guardar(chave, DGEG_TTL), guardar(chaveCopia, DGEG_COPIA)]));
    return responder(txt, { "X-Copia": "nova" });
  } catch (e) {
    const antiga = await cache.match(chaveCopia);
    if (antiga) return responder(antiga.body, { "X-Copia": "antiga" });
    return new Response(JSON.stringify({ erro: "A DGEG não respondeu" }), { status: 502, headers: { ...cors(origin), "Content-Type": "application/json" } });
  }
}

function cors(origin) {
  const ok = PERMITIDOS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || "");
  return ok
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Expose-Headers": "X-Copia", "Vary": "Origin" }
    : { "Vary": "Origin" };
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors(origin), "Access-Control-Max-Age": "86400" } });
    if (req.method !== "GET") return new Response("Método não permitido", { status: 405, headers: cors(origin) });

    if (url.pathname.startsWith("/dgeg/")) return dgeg(url, origin, ctx);

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
