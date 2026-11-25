/* Percurso partilhado entre a página dos combustíveis, a dos carregadores e a ficha de cada posto.
   Cada paragem: {k:"fuel"|"ev", id, t:título, b:marca/operador, sub:morada, lat, lng, info:texto extra}
   Fica guardado no navegador (localStorage), por isso as páginas veem a mesma lista. */
(function(){
  const KEY="route-v1";
  const read=k=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return null}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const MAX_STOPS=10; // o Google Maps aceita um destino e até 9 paragens intermédias no endereço
  const ICON={
    fuel:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Combustível"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12"/><path d="M7 7h4v4H7z"/><path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3"/></svg>',
    ev:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Carregador"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>'
  };

  function migrate(){
    const r=[];
    (read("pp-sel")||[]).forEach(s=>r.push({k:"fuel",id:s.id,t:s.n,b:s.b,sub:[s.a,s.loc].filter(Boolean).join(", "),lat:s.lat,lng:s.lon,
      info:s.fuel&&s.price?`${s.fuel} ${Number(s.price).toFixed(3).replace(".",",")} €`:""}));
    (read("ev-sel")||[]).forEach(s=>r.push({k:"ev",id:s.id,t:s.address||s.name,b:s.operator,sub:s.conc||"",lat:s.lat,lng:s.lng,info:""}));
    return r;
  }
  function distKm(a,b){const R=6371,r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lng-a.lng)*r;
    const h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
  const km=d=>d<1?Math.round(d*100)*10+" m":(d<100?d.toFixed(1):Math.round(d).toString()).replace(".",",")+" km";

  const Route={
    list:read(KEY)||migrate(),
    me:null,            // {lat,lng} quando a página sabe onde o utilizador está
    places:{},          // {casa:{lat,lng}, trabalho:{lat,lng}} da conta do utilizador
    origin:(()=>{try{return localStorage.getItem("route-origin")||"me"}catch(e){return"me"}})(),
    originPoint(){const p=this.places&&this.places[this.origin];if(this.origin!=="me"&&p)return{...p,label:this.origin==="casa"?"casa":"o trabalho"};return this.me?{...this.me,label:"a sua localização"}:null},
    setOrigin(o){this.origin=o;try{localStorage.setItem("route-origin",o)}catch(e){}this.render()},
    liveInfo:null,      // função opcional (paragem) => texto em direto, ex.: tomadas livres
    onchange:null,      // a página redesenha o mapa e a lista
    save(){write(KEY,this.list);this.render();this.onchange&&this.onchange()},
    has(k,id){return this.list.some(x=>x.k===k&&x.id===id)},
    toggle(stop){this.has(stop.k,stop.id)?this.list=this.list.filter(x=>!(x.k===stop.k&&x.id===stop.id)):this.list=[...this.list,stop];this.save()},
    remove(i){this.list.splice(i,1);this.save()},
    move(i,d){const j=i+d;if(j<0||j>=this.list.length)return;[this.list[i],this.list[j]]=[this.list[j],this.list[i]];this.save()},
    clear(){this.list=[];this.save()},
    /* Vizinho mais próximo: parte da localização (ou da 1.ª paragem) e vai sempre para a paragem mais perto da anterior */
    sortByDistance(){
      const rest=[...this.list]; if(rest.length<2)return;
      const o=this.originPoint(); const out=[]; let cur=o||rest.shift(); if(!o)out.push(cur);
      while(rest.length){let bi=0,bd=Infinity;rest.forEach((s,i)=>{const d=distKm(cur,s);if(d<bd){bd=d;bi=i}});cur=rest.splice(bi,1)[0];out.push(cur)}
      this.list=out;this.save();
    },
    reverse(){this.list.reverse();this.save()},
    url(){
      const L=this.list.slice(0,MAX_STOPS); if(!L.length)return "#";
      const c=s=>`${s.lat},${s.lng}`, dest=L[L.length-1], wp=L.slice(0,-1).map(c).join("|");
      const o=this.originPoint(); return `https://www.google.com/maps/dir/?api=1${o?`&origin=${encodeURIComponent(o.lat+","+o.lng)}`:""}&destination=${encodeURIComponent(c(dest))}${wp?"&waypoints="+encodeURIComponent(wp):""}&travelmode=driving`;
    },
    totalKm(){
      const L=this.list; if(!L.length)return null;
      const o=this.originPoint(); let d=o?distKm(o,L[0]):0; for(let i=1;i<L.length;i++)d+=distKm(L[i-1],L[i]); return d;
    },
    render(){
      const $=id=>document.getElementById(id); if(!$("trayBody"))return;
      const L=this.list, n=L.length, nf=L.filter(x=>x.k==="fuel").length, ne=n-nf;
      $("trayTitle").textContent=n?`O meu percurso (${n} ${n===1?"paragem":"paragens"})`:"O meu percurso";
      if($("selbar")){$("selbar").hidden=!n;$("selcount").textContent=`${n} ${n===1?"paragem":"paragens"} no percurso`+(nf&&ne?` (${nf} ${nf===1?"posto":"postos"} de combustível, ${ne} ${ne===1?"carregador":"carregadores"})`:"")}
      const tot=this.totalKm(), O=this.originPoint(), hasPlaces=this.places&&(this.places.casa||this.places.trabalho);
      $("trayBody").innerHTML=n?`
        <p class="routeinfo">${hasPlaces?`Partida: <select class="originsel" data-origin><option value="me" ${this.origin==="me"?"selected":""}>${this.me?"A minha localização":"Onde estiver (localização)"}</option>${this.places.casa?`<option value="casa" ${this.origin==="casa"?"selected":""}>Casa</option>`:""}${this.places.trabalho?`<option value="trabalho" ${this.origin==="trabalho"?"selected":""}>Trabalho</option>`:""}</select>`:O?`Partida: <strong>${O.label}</strong>.`:"Partida: onde estiver quando abrir o Google Maps. Ligue <strong>a minha localização</strong> no mapa para ver a distância desde aí."}
          ${tot!=null&&(n>1||O)?` Distância em linha reta: <strong>${km(tot)}</strong> (de carro é mais).`:""}</p>
        ${n>1?`<div class="routetools"><button type="button" class="btn ghost" data-sortd>Ordenar por proximidade</button><button type="button" class="btn ghost" data-rev>Inverter ordem</button><span class="routehint">${O?`Começa no posto mais perto d${O.label==="casa"?"e casa":O.label==="o trabalho"?"o trabalho":"e si"} e segue sempre para o mais próximo.`:"Mantém a 1.ª paragem e segue sempre para a mais próxima. Ligue a sua localização para começar no posto mais perto de si."}</span></div>`:""}
        <ol class="stops">${L.map((s,i)=>{const live=this.liveInfo?this.liveInfo(s):null;
          return `<li><span class="stopicon k-${s.k}">${ICON[s.k]||""}</span><span class="stoptxt"><strong>${esc(s.t)}</strong>${s.b?` · ${esc(s.b)}`:""}<br><span class="stopsub">${esc(s.sub)}${s.info?` · <span class="mono">${esc(s.info)}</span>`:""}${live?` · <span class="mono">${esc(live)}</span>`:""}${i>0?` · ${km(distKm(L[i-1],s))} desde a anterior`:(O?` · ${km(distKm(O,s))} desde ${O.label==="a sua localização"?"si":O.label}`:"")}</span></span>
            <span class="stopbtns"><button type="button" data-mv="${i}" data-d="-1" ${i===0?"disabled":""} aria-label="Subir">↑</button><button type="button" data-mv="${i}" data-d="1" ${i===n-1?"disabled":""} aria-label="Descer">↓</button><button type="button" data-rmi="${i}" aria-label="Remover">✕</button></span></li>`}).join("")}</ol>
        ${n>MAX_STOPS?`<p class="routewarn">O Google Maps só aceita ${MAX_STOPS} paragens num percurso. As últimas ${n-MAX_STOPS} ficam de fora quando abrir o percurso.</p>`:""}`
        :`<p class="count" style="margin:0">Ainda não há paragens. Toque num posto ou carregador no mapa, ou na caixa ✓ da lista. Pode juntar postos de combustível e carregadores no mesmo percurso.</p>`;
      $("trayBody").querySelectorAll("[data-mv]").forEach(b=>b.onclick=()=>this.move(+b.dataset.mv,+b.dataset.d));
      $("trayBody").querySelectorAll("[data-rmi]").forEach(b=>b.onclick=()=>this.remove(+b.dataset.rmi));
      const sd=$("trayBody").querySelector("[data-sortd]"); if(sd)sd.onclick=()=>this.sortByDistance();
      const rv=$("trayBody").querySelector("[data-rev]"); if(rv)rv.onclick=()=>this.reverse();
      const os=$("trayBody").querySelector("[data-origin]"); if(os)os.onchange=()=>this.setOrigin(os.value);
      const r=$("route"); r.href=this.url(); n?r.removeAttribute("aria-disabled"):r.setAttribute("aria-disabled","true");
      $("copy").disabled=$("clear").disabled=!n;
    },
    bind(){
      const $=id=>document.getElementById(id);
      if($("clearTop"))$("clearTop").onclick=()=>this.clear();
      $("clear").onclick=()=>this.clear();
      $("copy").onclick=()=>{
        const txt=this.list.map((s,i)=>`${i+1}. ${s.k==="ev"?"[Carregador] ":""}${s.t}${s.b?` (${s.b})`:""}, ${s.sub}${s.info?` | ${s.info}`:""} | ${s.lat}, ${s.lng}`).join("\n")+`\n\nPercurso: ${this.url()}`;
        const fail=()=>{$("toast").textContent="Não foi possível copiar. Selecione a lista acima e copie manualmente."};
        try{navigator.clipboard.writeText(txt).then(()=>{$("toast").textContent="Lista copiada, com a ligação do percurso."},fail)}catch(e){fail()}
      };
      window.addEventListener("storage",e=>{if(e.key===KEY){this.list=read(KEY)||[];this.render();this.onchange&&this.onchange()}});
      this.render();
    }
  };
  window.Route=Route;
})();
