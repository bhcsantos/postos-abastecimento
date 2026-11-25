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
      if(store.get("prev-fechado")===d.semanaInicio+(antes?"a":"d")){box.hidden=true;return}
      const ft=this.fuelType, v=ft?d[ft]:null;
      let conselho="";
      if(antes&&v!=null){conselho=v<-0.005?"Se puder, espere por segunda-feira para abastecer.":v>0.005?"Se puder, abasteça até domingo.":"Pode abastecer quando quiser: o preço deve ficar praticamente igual."}
      const linha=(k,n)=>`<span class="pv-f${ft===k?" pv-me":""}">${n}: ${seta(d[k])}</span>`;
      box.className="prevban "+(v!=null?(v<-0.0005?"dn":v>0.0005?"up":"eq"):(d.gasoleo+d.gasolina<0?"dn":"up"));
      box.innerHTML=`<div class="pv-txt"><strong>${antes?"Próxima semana":"Esta semana"} (${dm(d.semanaInicio)} a ${dm(d.semanaFim)})</strong>
          <span class="pv-vals">${linha("gasoleo","Gasóleo")}${linha("gasolina","Gasolina")}</span>
          ${conselho?`<span class="pv-cons">${esc(conselho)}</span>`:""}
          <span class="pv-src">Estimativa do setor, não oficial · <a href="${esc(d.url)}" target="_blank" rel="noopener">fonte ↗</a>${durante?" · a próxima previsão sai na sexta-feira":""}</span></div>
        <button type="button" class="pv-x" aria-label="Esconder até à próxima previsão">✕</button>`;
      box.hidden=false;
      box.querySelector(".pv-x").onclick=()=>{store.set("prev-fechado",d.semanaInicio+(antes?"a":"d"));box.hidden=true};
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
.pv-x{border:0;background:none;color:var(--muted);cursor:pointer;font-size:1rem}`;
  document.head.appendChild(css);
  window.Previsao=P;
})();
