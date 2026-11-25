/* Cartões e programas de desconto do utilizador, e o preço final em cada posto.
   As regras estão em data/descontos.json (atualizadas por proposta semanal, aprovada pelo dono do site).
   O utilizador escolhe o que TEM (cartões, apps, contratos de energia); para cada posto o site aplica a
   melhor combinação possível e explica o que é preciso fazer para a obter.
   As escolhas ficam no navegador (e na conta, quando houver sessão iniciada). */
(function(){
  const KEY="pp-descontos";
  const OLD={vodafone:"p-vodafone"}; // ids antigos
  const read=()=>{try{const p=JSON.parse(localStorage.getItem(KEY))||{};return{programas:(p.programas||[]).map(x=>OLD[x]||x),condicoes:[]}}catch(e){return{programas:[],condicoes:[]}}};
  const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const cent=v=>(Math.round(v*1000)/10).toLocaleString("pt-PT",{maximumFractionDigits:1})+" cênt.";
  const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const today=()=>new Date().toISOString().slice(0,10);
  /* Tipo de combustível a partir do nome da DGEG: "gasolina", "gasoleo" ou "gas" (GPL, GNC, GNL) */
  const fuelType=f=>/gpl|gnc|gnl|g[áa]s natural/i.test(f)?"gas":/gas[óo]leo|biodiesel/i.test(f)?"gasoleo":/gasolina/i.test(f)?"gasolina":"outro";
  const nice=b=>b.length<=4?b:b.charAt(0)+b.slice(1).toLowerCase();

  const D={
    data:null, prefs:read(), onchange:null,
    async load(){this.injectCss();try{const r=await fetch("data/descontos.json",{cache:"no-cache"});if(r.ok)this.data=await r.json()}catch(e){}return this.data},
    save(){try{localStorage.setItem(KEY,JSON.stringify(this.prefs))}catch(e){}this.onchange&&this.onchange();this.renderButton()},
    setPrefs(p){this.prefs={programas:(p.programas||[]).map(x=>OLD[x]||x),condicoes:[]};try{localStorage.setItem(KEY,JSON.stringify(this.prefs))}catch(e){}this.onchange&&this.onchange();this.renderButton()},
    active(){return !!this.prefs.programas.length},
    prog(id){return(this.data?.programas||[]).find(p=>p.id===id)},
    has(id){return this.prefs.programas.includes(id)},
    add(id){
      const p=this.prog(id); if(!p||this.has(id))return;
      let l=this.prefs.programas;
      if(p.exclusivo)l=l.filter(x=>this.prog(x)?.exclusivo!==p.exclusivo); // ex.: só um plano Repsol de cada vez
      this.prefs.programas=[...l,id]; this.save();
    },
    remove(id){this.prefs.programas=this.prefs.programas.filter(x=>x!==id);this.save()},
    rules(){
      if(!this.data)return[];
      const has=new Set(this.prefs.programas), t=today();
      return this.data.descontos.filter(r=>(r.requer||[]).every(x=>has.has(x))&&!(r.exclui||[]).some(x=>has.has(x))&&(!r.fim||r.fim>=t)&&(!r.inicio||r.inicio<=t));
    },
    /* Melhor cenário: final = na bomba − desconto imediato; efetivo = final − saldo */
    apply(brand,fuel,price){
      const b=norm(brand), ft=fuelType(fuel||"");
      const rs=this.rules().filter(r=>!r.carregamento&&(r.marcas||[]).map(norm).includes(b)&&(!r.tipos||r.tipos.includes(ft))&&(!r.combustiveis||r.combustiveis.includes(fuel)));
      if(!rs.length)return{price,final:price,efetivo:price,direto:0,saldo:0,regras:[]};
      const cum=rs.filter(r=>r.cumulativo);
      /* Melhor = maior total; depois mais desconto na hora; depois os confirmados antes dos "a confirmar" */
      const conf=r=>r.estado&&r.estado!=="confirmado"?1:0;
      const nc=rs.filter(r=>!r.cumulativo).sort((a,b)=>((b.direto+b.saldo)-(a.direto+a.saldo))||(b.direto-a.direto)||(conf(a)-conf(b)));
      const best=nc[0];
      /* Alternativas com exatamente o mesmo desconto (ex.: cartão Fnac ou cartão Vodafone, com o mesmo plano) */
      const same=r=>best&&Math.abs((r.direto+r.saldo)-(best.direto+best.saldo))<1e-9&&Math.abs(r.direto-best.direto)<1e-9;
      const alternativas=nc.slice(1).filter(same);
      const use=[...(best?[best]:[]),...cum];
      const direto=use.reduce((a,r)=>a+(r.direto||0),0), saldo=use.reduce((a,r)=>a+(r.saldo||0),0);
      return{price,final:price-direto,efetivo:price-direto-saldo,direto,saldo,regras:use,alternativas};
    },
    /* Carregamentos elétricos: percentagem devolvida em saldo no operador (ex.: Repsol) */
    applyEv(operator,cost){
      const b=norm(operator), rs=this.rules().filter(r=>r.carregamento&&(r.marcas||[]).map(norm).includes(b));
      if(!rs.length)return{cost,saldo:0,efetivo:cost,regras:[]};
      const best=rs.sort((x,y)=>(y.percSaldo||0)-(x.percSaldo||0))[0], saldo=cost*(best.percSaldo||0);
      return{cost,saldo,efetivo:cost-saldo,perc:best.percSaldo||0,regras:[best]};
    },
    /* Frase curta para a lista: "Lidl Plus + Plano Motor: −6 cênt. na hora + 4 cênt. em saldo My Repsol" */
    describe(a){
      if(!a.regras.length)return"";
      return a.regras.map(r=>esc(r.titulo)).join(" + ")+": "+
        [a.direto?`−${cent(a.direto)} na hora`:"",a.saldo?`${cent(a.saldo)} em ${esc(a.regras.find(r=>r.saldo)?.saldoOnde||"saldo")}`:""].filter(Boolean).join(" + ");
    },
    /* Explicação completa: o que é preciso, como usar, limites e fonte */
    explain(a){
      return a.regras.map(r=>`<div class="dexp"><div><strong>${esc(r.titulo)}</strong>${r.estado&&r.estado!=="confirmado"?` <span class="dst warn">a confirmar</span>`:""}</div>
        <div>${esc(r.condicoes||"")}</div>
        ${r.carregamento?"":""}<div><b>O que precisa:</b> ${(r.requer||[]).map(id=>esc(this.prog(id)?.nome||id)).join(" + ")}${(r.exclui||[]).length?` (sem ${(r.exclui||[]).filter(id=>this.prog(id)).map(id=>esc(this.prog(id).nome)).join(" nem ")})`.replace(/\(sem \)/,""):""}.</div>
        ${r.comoUsar?`<div><b>Como usar:</b> ${esc(r.comoUsar)}</div>`:""}
        ${r.limite?`<div class="dlim">${esc(r.limite)}</div>`:""}
        ${r.nota?`<div class="dlim">${esc(r.nota)}</div>`:""}
        ${r.fonte?`<div><a href="${esc(r.fonte)}" target="_blank" rel="noopener">Ver a campanha ↗</a>${r.verificado?` · verificado a ${esc(r.verificado)}`:""}</div>`:""}</div>`).join("")+this.altText(a);
    },
    /* "Também pode usar, com o mesmo desconto: Vodafone — cliente" */
    altText(a){
      if(!a.alternativas||!a.alternativas.length||!a.regras.length)return"";
      const main=new Set(a.regras[0].requer||[]);
      const names=[...new Set(a.alternativas.flatMap(r=>(r.requer||[]).filter(id=>!main.has(id))).map(id=>this.prog(id)?.nome).filter(Boolean))];
      if(!names.length)return"";
      return `<div class="dexp"><div><b>Também pode usar, com o mesmo desconto:</b> ${names.map(esc).join(", ")}.</div><div class="dlim">A Repsol só aplica um cartão de parceiro por abastecimento, por isso basta associar um deles.</div></div>`;
    },
    renderButton(){
      const b=document.getElementById("discBtn"); if(!b)return;
      const n=this.prefs.programas.length;
      b.innerHTML=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>${n?`Os meus cartões (${n})`:"Os meus cartões de desconto"}`;
      b.setAttribute("aria-pressed",n?"true":"false");
    },

    /* ---------- Painel "Os meus cartões" ---------- */
    openPanel(){
      let dlg=document.getElementById("discDlg");
      if(!dlg){dlg=document.createElement("dialog");dlg.id="discDlg";dlg.className="dlg";document.body.appendChild(dlg);this.injectCss()}
      dlg.innerHTML=`<div class="dlgbox">
        <div class="dlghead"><h2>Os meus cartões de desconto</h2><button type="button" class="dlgx" data-close aria-label="Fechar">✕</button></div>
        <p class="dlgsub">Acrescente o que tem: cartões de cliente, apps, contratos de luz e gás. Em cada posto mostramos o preço com a melhor combinação possível e explicamos o que precisa de fazer para a obter.</p>
        <section><h3>O que tenho</h3><div class="mine" data-mine></div></section>
        <section><h3>Adicionar</h3>
          <input type="search" class="dsearch" data-q placeholder="Escreva, por exemplo: vodafone, lidl, repsol, sporting, caixa…" autocomplete="off" aria-label="Procurar cartão ou programa">
          <div class="dres" data-res role="listbox"></div>
          <details class="dall"><summary>Ver a lista completa por categoria</summary><div data-all></div></details>
        </section>
        <section><h3>O seu melhor desconto em cada marca</h3><div data-best></div></section>
        <p class="dlgsub">Descontos verificados nas páginas oficiais das campanhas e atualizados uma vez por semana. Confirme sempre as condições no posto. Última atualização: ${esc(this.data?.atualizado||"—")}.</p>
        <div class="dlgact"><button type="button" class="btn" data-close>Fechar</button></div>
      </div>`;
      const q=dlg.querySelector("[data-q]");
      const render=()=>{this.renderMine(dlg);this.renderResults(dlg,q.value);this.renderAll(dlg);this.renderBest(dlg)};
      q.oninput=()=>this.renderResults(dlg,q.value);
      dlg.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>dlg.close());
      dlg.onclick=e=>{const t=e.target.closest("[data-add],[data-rm]");if(!t)return;t.dataset.add?this.add(t.dataset.add):this.remove(t.dataset.rm);render();if(t.dataset.add){q.value="";this.renderResults(dlg,"");q.focus()}};
      render(); dlg.showModal(); setTimeout(()=>q.focus(),50);
    },
    renderMine(dlg){
      const l=this.prefs.programas.map(id=>this.prog(id)).filter(Boolean);
      dlg.querySelector("[data-mine]").innerHTML=l.length?l.map(p=>`<span class="dchip">${esc(p.nome)}<button type="button" data-rm="${esc(p.id)}" aria-label="Retirar ${esc(p.nome)}">✕</button></span>`).join("")
        :`<p class="dempty">Ainda não acrescentou nada. Use a pesquisa abaixo.</p>`;
    },
    item(p){const on=this.has(p.id);return `<button type="button" class="ditem${on?" on":""}" ${on?`data-rm="${esc(p.id)}"`:`data-add="${esc(p.id)}"`}><span>${esc(p.nome)}</span><span class="dact">${on?"✓ Tenho · retirar":"+ Adicionar"}</span></button>`},
    renderResults(dlg,qv){
      const box=dlg.querySelector("[data-res]"), q=norm(qv);
      if(!q){box.innerHTML="";return}
      const words=q.split(/\s+/).filter(Boolean);
      const hits=(this.data?.programas||[]).filter(p=>{const hay=norm([p.nome,p.grupo,...(p.pesquisa||[])].join(" "));return words.every(w=>hay.includes(w))});
      if(!hits.length){box.innerHTML=`<p class="dempty">Nada encontrado para "${esc(qv)}". Se tem um cartão que dá desconto em combustível e não está aqui, peça-o em <a href="conta.html#ideas">Pedir uma funcionalidade</a>.</p>`;return}
      const groups={};hits.forEach(p=>(groups[p.grupo]=groups[p.grupo]||[]).push(p));
      box.innerHTML=Object.entries(groups).map(([g,ps])=>`<div class="dgrp">${esc(g)}</div>${ps.map(p=>this.item(p)).join("")}`).join("");
    },
    renderAll(dlg){
      const ps=this.data?.programas||[], order=this.data?.grupos||[...new Set(ps.map(p=>p.grupo))];
      dlg.querySelector("[data-all]").innerHTML=order.map(g=>{const l=ps.filter(p=>p.grupo===g);return l.length?`<div class="dgrp">${esc(g)}</div>${l.map(p=>this.item(p)).join("")}`:""}).join("");
    },
    renderBest(dlg){
      const ds=this.data?.descontos||[];
      const brands=[...new Set(ds.filter(r=>!r.carregamento).flatMap(r=>r.marcas||[]))], evBrands=[...new Set(ds.filter(r=>r.carregamento).flatMap(r=>r.marcas||[]))];
      const out=brands.map(b=>{const a=this.apply(b,"Gasolina 95 simples",2);return a.regras.length?`<div class="dbest"><div class="dbt">⛽ ${esc(nice(b))}: <strong>${cent(a.direto+a.saldo)}/litro</strong> (${[a.direto?`${cent(a.direto)} na hora`:"",a.saldo?`${cent(a.saldo)} em saldo`:""].filter(Boolean).join(" + ")})</div>${this.explain(a)}</div>`:""}).join("")
        +evBrands.map(b=>{const a=this.applyEv(b,100);return a.regras.length?`<div class="dbest"><div class="dbt">⚡ ${esc(nice(b))} (carregamentos): <strong>${Math.round(a.perc*100)}% em saldo</strong></div>${this.explain(a)}</div>`:""}).join("");
      dlg.querySelector("[data-best]").innerHTML=out||`<p class="dempty">Com o que escolheu ainda não há descontos registados. Acrescente cartões ou programas acima.</p>`;
    },
    injectCss(){
      if(document.getElementById("discCss"))return;
      const s=document.createElement("style");s.id="discCss";
      s.textContent=`dialog.dlg{border:1px solid var(--line);border-radius:12px;padding:0;max-width:min(640px,calc(100vw - 24px));width:100%;background:var(--surface);color:var(--fg);box-shadow:0 20px 60px rgba(0,0,0,.3)}
dialog.dlg::backdrop{background:rgba(10,16,26,.55)}
.dlgbox{padding:18px 20px;display:grid;gap:14px;max-height:86vh;overflow:auto}
.dlghead{display:flex;justify-content:space-between;align-items:center;gap:10px}
.dlgbox h2{font-family:var(--display);font-size:1.5rem;margin:0}
.dlgbox h3{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 6px}
.dlgx{border:0;background:none;color:var(--muted);font-size:1.2rem;cursor:pointer}
.dlgsub{margin:0;color:var(--muted);font-size:.88rem}
.mine{display:flex;flex-wrap:wrap;gap:6px}
.dchip{display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:var(--surface);border-radius:999px;padding:5px 6px 5px 12px;font-size:.86rem;font-weight:600}
.dchip button{border:0;background:rgba(255,255,255,.25);color:inherit;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:.75rem}
.dsearch{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
.dres,.dall>div{display:grid;gap:4px;margin-top:6px}
.dgrp{font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:8px}
.ditem{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;font:inherit;font-size:.92rem;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);cursor:pointer}
.ditem:hover{border-color:var(--accent)}
.ditem .dact{font-size:.8rem;font-weight:600;color:var(--accent);white-space:nowrap}
.ditem.on{border-color:var(--good)}.ditem.on .dact{color:var(--good)}
.dall summary{cursor:pointer;color:var(--accent);font-weight:600;margin-top:8px}
.dempty{margin:0;color:var(--muted);font-size:.88rem}
.dempty a{color:var(--accent)}
.dbest{border:1px solid var(--line);border-radius:8px;padding:10px 12px;display:grid;gap:6px;background:var(--bg)}
.dbt{font-size:.95rem}
.dexp{display:grid;gap:3px;font-size:.86rem}
.dexp a{color:var(--accent)}
.dlim{color:var(--muted);font-size:.8rem}
.dst{font-size:.7rem;border-radius:999px;padding:1px 8px}.dst.warn{background:#d97a00;color:#fff}
.dlgact{display:flex;gap:8px}
details.discd{margin:0 12px 8px 82px;font-size:.84rem}
details.discd summary{cursor:pointer;color:var(--good);font-weight:600}
details.discd .dexp{margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg)}
@media (max-width:480px){details.discd{margin-left:12px}}`;
      document.head.appendChild(s);
    }
  };
  window.Discounts=D;
})();
