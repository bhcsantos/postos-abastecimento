/* Aviso no topo com a previsão de preços para a semana seguinte (data/previsao.json).
   A estimativa do setor sai às sextas-feiras; o aviso só aparece enquanto é útil:
   antes da semana começar ("Próxima semana") ou durante a semana ("Esta semana"). */
(function(){
  const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const MES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const dm=s=>{const d=new Date(s+"T12:00:00");return `${d.getDate()} ${MES[d.getMonth()]}`};
  const cent=v=>(Math.abs(v)*100).toLocaleString("pt-PT",{maximumFractionDigits:1})+" cênt./l";
  const hojeLisboa=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon"}).format(new Date());
  const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  const DIA=["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
  const quando=iso=>{const d=new Date(iso.length<=16?iso+":00Z":iso);if(isNaN(d))return"";const l=new Date(d.toLocaleString("en-US",{timeZone:"Europe/Lisbon"}));return `${DIA[l.getDay()]} às ${String(l.getHours()).padStart(2,"0")}:${String(l.getMinutes()).padStart(2,"0")}`};
  function seta(v){return v<-0.0005?`<span class="pv-dn">▼ desce ${cent(v)}</span>`:v>0.0005?`<span class="pv-up">▲ sobe ${cent(v)}</span>`:`<span class="pv-eq">= sem alteração</span>`}
  const P={
    data:null, fuelType:null,
    async load(){try{const r=await fetch("data/previsao.json",{cache:"no-cache"});if(r.ok)this.data=await r.json()}catch(e){}this.render()},
    /* "gasoleo", "gasolina" ou null (ex.: GPL, sem previsão) — para destacar o combustível do utilizador */
    setFuel(t){this.fuelType=t;this.render()},
    render(){
      const box=document.getElementById("prevBanner"), d=this.data; if(!box)return;
      if(!d||!d.semanaInicio){box.hidden=true;return}
      const hoje=hojeLisboa(), antes=hoje<d.semanaInicio, durante=hoje>=d.semanaInicio&&hoje<=d.semanaFim;
      if(!antes&&!durante){box.hidden=true;return}
      const ft=this.fuelType, v=ft?d[ft]:null, chave=d.semanaInicio+(antes?"a":"d");
      /* Fechado: fica uma linha pequena com os valores, que volta a abrir o aviso completo */
      if(store.get("prev-fechado")===chave){
        const curto=k=>{const x=d[k];return x<-0.0005?`<span class="pv-dn">▼ ${cent(x).replace("/l","")}</span>`:x>0.0005?`<span class="pv-up">▲ ${cent(x).replace("/l","")}</span>`:`<span class="pv-eq">=</span>`};
        box.className="prevban mini";
        box.innerHTML=`<button type="button" class="pv-open" aria-expanded="false"><span>Previsão ${antes?"da próxima semana":"desta semana"}: gasóleo ${curto("gasoleo")} · gasolina ${curto("gasolina")}</span><span class="pv-more">Mostrar ▾</span></button>${this.justClosed?`<span class="pv-hint" role="status">Aviso encolhido. Toque nesta linha para o voltar a abrir. Quando sair a previsão seguinte, volta a aparecer aberto.</span>`:""}`;
        box.hidden=false;
        box.querySelector(".pv-open").onclick=()=>{store.set("prev-fechado","");this.justClosed=false;this.render()};
        return;
      }
      let conselho="";
      if(antes&&v!=null){conselho=v<-0.005?"Se puder, espere por segunda-feira para abastecer.":v>0.005?"Se puder, abasteça até domingo.":"Pode abastecer quando quiser: o preço deve ficar praticamente igual."}
      const linha=(k,n)=>`<span class="pv-f${ft===k?" pv-me":""}">${n}: ${seta(d[k])}</span>`;
      box.className="prevban "+(v!=null?(v<-0.0005?"dn":v>0.0005?"up":"eq"):(d.gasoleo+d.gasolina<0?"dn":"up"));
      box.innerHTML=`<div class="pv-txt"><strong>${antes?"Próxima semana":"Esta semana"} (${dm(d.semanaInicio)} a ${dm(d.semanaFim)})</strong>
          <span class="pv-vals">${linha("gasoleo","Gasóleo")}${linha("gasolina","Gasolina")}</span>
          ${conselho?`<span class="pv-cons">${esc(conselho)}</span>`:""}
          <span class="pv-src">Estimativa do setor, não oficial${d.obtido?` · atualizada ${quando(d.obtido)}`:""} · <a href="${esc(d.url)}" target="_blank" rel="noopener">fonte ↗</a>${durante?" · a próxima previsão sai na sexta-feira":""}</span></div>
        <button type="button" class="pv-x" aria-label="Encolher o aviso" title="Encolher (pode voltar a abrir)">✕</button>`;
      box.hidden=false;
      box.querySelector(".pv-x").onclick=()=>{store.set("prev-fechado",chave);this.justClosed=true;this.render();box.querySelector(".pv-open")?.focus()};
    }
  };
  const css=document.createElement("style");
  css.textContent=`.prevban{display:flex;gap:12px;align-items:flex-start;border-radius:10px;padding:10px 14px;border:1px solid var(--line);background:var(--surface);box-shadow:inset 4px 0 0 var(--pvc,#1f4fa8)}
.prevban.dn{--pvc:#1d8a4a}.prevban.up{--pvc:#c0392b}.prevban.eq{--pvc:#8a94a3}
.pv-txt{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;flex:1;min-width:0}
.pv-vals{display:flex;flex-wrap:wrap;gap:4px 14px}
.pv-f{font-weight:500}.pv-me{font-weight:700;text-decoration:underline;text-underline-offset:3px}
.pv-dn{color:#1d8a4a;font-weight:700}.pv-up{color:#c0392b;font-weight:700}.pv-eq{color:var(--muted);font-weight:600}
@media (prefers-color-scheme:dark){.pv-dn{color:#5cc98a}.pv-up{color:#f2847b}}
.pv-cons{flex-basis:100%;font-weight:600}
.pv-src{flex-basis:100%;font-size:.78rem;color:var(--muted)}.pv-src a{color:var(--accent)}
.pv-x{border:0;background:none;color:var(--muted);cursor:pointer;font-size:1rem}
.prevban.mini{padding:0;display:grid;gap:0;--pvc:#8a94a3}
.pv-open{font:inherit;font-size:.86rem;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;justify-content:space-between;width:100%;text-align:left;background:none;border:0;color:var(--fg);padding:8px 14px;cursor:pointer}
.pv-more{color:var(--accent);font-weight:600;white-space:nowrap}
.pv-hint{font-size:.78rem;color:var(--muted);padding:0 14px 8px}`;
  document.head.appendChild(css);
  window.Previsao=P;
})();
