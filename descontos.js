/* Cartões e programas de desconto do utilizador, e o preço final em cada posto.
   As regras estão em data/descontos.json (atualizadas por proposta semanal, aprovada pelo dono do site).
   As escolhas do utilizador ficam no navegador (e na conta, quando houver sessão iniciada). */
(function(){
  const KEY="pp-descontos";
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{programas:[],condicoes:[]}}catch(e){return{programas:[],condicoes:[]}}};
  const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const cent=v=>(v*100).toLocaleString("pt-PT",{maximumFractionDigits:1})+" cênt.";
  const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().trim();
  /* Tipo de combustível a partir do nome da DGEG: "gasolina", "gasoleo" ou "gas" (GPL, GNC, GNL) */
  const fuelType=f=>/gpl|gnc|gnl|g[áa]s natural/i.test(f)?"gas":/gas[óo]leo|biodiesel/i.test(f)?"gasoleo":/gasolina/i.test(f)?"gasolina":"outro";
  const today=()=>new Date().toISOString().slice(0,10);

  const D={
    data:null, prefs:read(), onchange:null,
    async load(){try{const r=await fetch("data/descontos.json",{cache:"no-cache"});if(r.ok)this.data=await r.json()}catch(e){}return this.data},
    save(){try{localStorage.setItem(KEY,JSON.stringify(this.prefs))}catch(e){}this.onchange&&this.onchange();this.renderButton()},
    setPrefs(p){this.prefs={programas:p.programas||[],condicoes:p.condicoes||[]};try{localStorage.setItem(KEY,JSON.stringify(this.prefs))}catch(e){}this.onchange&&this.onchange();this.renderButton()},
    active(){return !!(this.prefs.programas.length)},
    rules(){
      if(!this.data)return[];
      const has=new Set([...this.prefs.programas,...this.prefs.condicoes]), t=today();
      return this.data.descontos.filter(r=>(r.requer||[]).every(x=>has.has(x))&&!(r.exclui||[]).some(x=>has.has(x))&&(!r.fim||r.fim>=t)&&(!r.inicio||r.inicio<=t));
    },
    /* Preço com os descontos do utilizador: final = na bomba − direto; efetivo = final − saldo */
    apply(brand,fuel,price){
      const b=norm(brand), rs=this.rules().filter(r=>(r.marcas||[]).map(norm).includes(b)&&(!r.tipos||r.tipos.includes(fuelType(fuel)))&&(!r.combustiveis||r.combustiveis.includes(fuel)));
      if(!rs.length)return{price,final:price,efetivo:price,direto:0,saldo:0,regras:[]};
      const cum=rs.filter(r=>r.cumulativo), best=rs.filter(r=>!r.cumulativo).sort((a,b)=>(b.direto+b.saldo)-(a.direto+a.saldo))[0];
      const use=[...(best?[best]:[]),...cum];
      const direto=use.reduce((a,r)=>a+(r.direto||0),0), saldo=use.reduce((a,r)=>a+(r.saldo||0),0);
      return{price,final:price-direto,efetivo:price-direto-saldo,direto,saldo,regras:use};
    },
    describe(a){
      if(!a.regras.length)return"";
      return a.regras.map(r=>`${esc(r.titulo)}${r.estado&&r.estado!=="confirmado"?" (a confirmar)":""}`).join(" + ")+": "+
        [a.direto?`−${cent(a.direto)} na hora`:"",a.saldo?`${cent(a.saldo)} em ${esc(a.regras.find(r=>r.saldo)?.saldoOnde||"saldo")}`:""].filter(Boolean).join(", ");
    },
    renderButton(){
      const b=document.getElementById("discBtn"); if(!b)return;
      const n=this.prefs.programas.length;
      b.innerHTML=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>${n?`Os meus descontos (${n})`:"Os meus cartões de desconto"}`;
      b.setAttribute("aria-pressed",n?"true":"false");
    },
    openPanel(){
      let dlg=document.getElementById("discDlg");
      if(!dlg){dlg=document.createElement("dialog");dlg.id="discDlg";dlg.className="dlg";document.body.appendChild(dlg)}
      const d=this.data||{programas:[],condicoes:[],descontos:[]}, p=this.prefs;
      const groups={};d.programas.forEach(x=>(groups[x.grupo||"Outros"]=groups[x.grupo||"Outros"]||[]).push(x));
      dlg.innerHTML=`<form method="dialog" class="dlgbox">
        <h2>Os meus cartões de desconto</h2>
        <p class="dlgsub">Marque os cartões e programas que tem. A lista passa a mostrar o preço com os seus descontos e a ordenar por ele.</p>
        ${Object.entries(groups).map(([g,xs])=>`<fieldset><legend>${esc(g)}</legend>${xs.map(x=>`<label class="opt"><input type="checkbox" name="prog" value="${esc(x.id)}" ${p.programas.includes(x.id)?"checked":""}>${esc(x.nome)}</label>`).join("")}</fieldset>`).join("")||"<p>Ainda não há programas registados.</p>"}
        ${d.condicoes.length?`<fieldset><legend>Condições que alteram descontos</legend>${d.condicoes.map(x=>`<label class="opt"><input type="checkbox" name="cond" value="${esc(x.id)}" ${p.condicoes.includes(x.id)?"checked":""}>${esc(x.nome)}</label>`).join("")}</fieldset>`:""}
        <details class="rules"><summary>Ver todos os descontos registados (${d.descontos.length})</summary>
          ${d.descontos.map(r=>`<div class="rule"><strong>${esc(r.titulo)}</strong> <span class="st ${r.estado==="confirmado"?"ok":"warn"}">${esc(r.estado||"")}</span><br>
            ${esc(r.condicoes||"")}${r.limite?`<br>Limite: ${esc(r.limite)}`:""}${r.fim?`<br>Válido até ${esc(r.fim)}`:""}
            <br><small>${r.fonte?`<a href="${esc(r.fonte)}" target="_blank" rel="noopener">Ver a campanha ↗</a>`:esc(r.origem||"Sem ligação para a campanha")}${r.verificado?` · verificado a ${esc(r.verificado)}`:""}</small></div>`).join("")}
        </details>
        <p class="dlgsub">Os descontos são atualizados uma vez por semana a partir das páginas das campanhas. Confirme sempre as condições no posto. Última atualização: ${esc(d.atualizado||"—")}.</p>
        <div class="dlgact"><button value="ok" class="btn">Guardar</button><button value="cancel" class="btn ghost" formnovalidate>Cancelar</button></div>
      </form>`;
      dlg.onclose=()=>{if(dlg.returnValue!=="ok")return;
        const f=dlg.querySelector("form");
        this.prefs={programas:[...f.querySelectorAll('[name=prog]:checked')].map(x=>x.value),condicoes:[...f.querySelectorAll('[name=cond]:checked')].map(x=>x.value)};
        this.save()};
      dlg.showModal();
    }
  };
  window.Discounts=D;
})();
