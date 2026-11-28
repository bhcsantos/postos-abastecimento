/* Guarda as páginas do site para abrirem depressa e funcionarem sem rede (os preços precisam de rede).
   Páginas e scripts: primeiro a rede, com a cópia guardada como reserva. Bibliotecas e ícones: primeiro a cópia. */
const VERSAO="v49";
const BASE=["./","index.html","carregadores.html","posto.html","conta.html","privacidade.html","route.js","descontos.js","account.js","previsao.js","dropdown.js","mobile.css","mobile.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSAO).then(c=>c.addAll(BASE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSAO).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  const proprio=u.origin===location.origin, biblioteca=u.hostname==="cdnjs.cloudflare.com"||u.hostname==="fonts.gstatic.com"||u.hostname==="fonts.googleapis.com";
  if(!proprio&&!biblioteca)return; // preços, mapas e contas vão sempre à rede
  if(biblioteca||u.pathname.includes("/icons/")){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const c=res.clone();caches.open(VERSAO).then(x=>x.put(e.request,c));return res})));
    return;
  }
  /* cache:"no-cache": pergunta sempre ao servidor se há versão nova (o GitHub Pages deixa os ficheiros 10 min na cache do navegador) */
  e.respondWith(fetch(e.request.url,{cache:"no-cache",credentials:"same-origin"}).then(res=>{if(res.ok){const c=res.clone();caches.open(VERSAO).then(x=>x.put(e.request,c))}return res}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./"))));
});
/* Notificações push (alertas de preço, previsão da semana, pedidos): enviadas pelo GitHub Actions (scripts/notificacoes.py) */
self.addEventListener("push",e=>{let d={};try{d=e.data.json()}catch(x){d={body:e.data?e.data.text():""}}
  e.waitUntil(self.registration.showNotification(d.title||"Postos de Abastecimento",{body:d.body||"",icon:"icons/icon-192.png",badge:"icons/icon-192.png",data:{url:d.url||"./"}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const u=(e.notification.data&&e.notification.data.url)||"./";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{for(const c of l){if(c.url===u&&"focus" in c)return c.focus()}return clients.openWindow(u)}))});
