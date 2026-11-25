/* Filtros em caixa de seleção (dropdown) com seleção múltipla ou única.
   Uso:
     const dd = Dropdown.create(caixa, {label:"Marca", multi:true, allLabel:"Todas", onChange(valores){…}});
     dd.setOptions([{value, label, html?, count?, selected}]);
   Com multi:false, onChange recebe um só valor e a lista fecha ao escolher. */
(function(){
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  const CSS=`
.filters{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.dd{position:relative;min-width:0}
.dd[hidden]{display:none}
.dd-btn{font:inherit;width:100%;display:flex;align-items:center;gap:8px;text-align:left;padding:7px 10px 7px 12px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--fg);cursor:pointer;min-height:48px}
.dd-btn:hover{border-color:var(--muted)}
.dd.on .dd-btn{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.dd-txt{display:grid;min-width:0;flex:1;line-height:1.2}
.dd-l{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600}
.dd-v{font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}
.dd-n{flex:none;font-size:.72rem;font-weight:700;background:var(--accent);color:var(--surface);border-radius:999px;padding:1px 7px}
.dd-car{flex:none;width:10px;height:10px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg) translate(-2px,-2px);transition:transform .15s}
.dd.open .dd-car{transform:rotate(225deg) translate(-2px,-2px)}
.dd-pan{position:absolute;z-index:1200;top:calc(100% + 4px);left:0;min-width:100%;width:max-content;max-width:min(360px,calc(100vw - 32px));background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.22);display:grid;grid-template-rows:auto minmax(0,1fr);max-height:min(380px,60vh)}
.dd-pan[hidden]{display:none}
.dd.right .dd-pan{left:auto;right:0}
.dd-head{display:flex;gap:6px;align-items:center;padding:8px;border-bottom:1px solid var(--line)}
.dd-head input{font:inherit;font-size:.88rem;flex:1;min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:5px;background:var(--bg,var(--surface));color:var(--fg)}
.dd-head .sp{flex:1}
.dd-head button{font:inherit;font-size:.8rem;background:none;border:0;color:var(--accent);font-weight:600;cursor:pointer;padding:4px 6px;white-space:nowrap}
.dd-head button:disabled{color:var(--muted);cursor:default;opacity:.6}
.dd-list{overflow:auto;padding:4px 0;overscroll-behavior:contain}
.dd-opt{display:flex;align-items:center;gap:10px;padding:7px 12px;cursor:pointer;font-size:.9rem}
.dd-opt:hover{background:var(--accent-soft)}
.dd-opt input{width:17px;height:17px;flex:none;margin:0;accent-color:var(--accent)}
.dd-opt .dd-ol{flex:1;display:flex;align-items:center;gap:8px;min-width:0}
.dd-opt .dd-c{color:var(--muted);font-size:.78rem;font-variant-numeric:tabular-nums}
.dd-empty{padding:10px 12px;color:var(--muted);font-size:.85rem}
@media (max-width:520px){.filters{grid-template-columns:1fr 1fr}.dd-pan{position:fixed;left:16px!important;right:16px!important;top:auto;bottom:16px;width:auto;min-width:0;max-width:none;max-height:70vh}}
`;
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);

  let openDd=null;
  document.addEventListener("click",e=>{if(openDd&&!openDd.el.contains(e.target))openDd.close()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&openDd){const d=openDd;d.close();d.btn.focus()}});

  function create(host,cfg){
    const multi=cfg.multi!==false, allLabel=cfg.allLabel||"Todos";
    const el=document.createElement("div");el.className="dd";
    const id="dd"+Math.random().toString(36).slice(2,8);
    el.innerHTML=`<button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}"><span class="dd-txt"><span class="dd-l">${esc(cfg.label)}</span><span class="dd-v"></span></span><span class="dd-n" hidden></span><span class="dd-car" aria-hidden="true"></span></button>
<div class="dd-pan" id="${id}" hidden><div class="dd-head"></div><div class="dd-list" role="listbox" aria-label="${esc(cfg.label)}"${multi?' aria-multiselectable="true"':""}></div></div>`;
    host.appendChild(el);
    const btn=el.querySelector(".dd-btn"), pan=el.querySelector(".dd-pan"), head=el.querySelector(".dd-head"), list=el.querySelector(".dd-list");
    let opts=[], q="";
    const useSearch=()=>cfg.search!=null?cfg.search:opts.length>8;
    const sel=()=>opts.filter(o=>o.selected);
    const optHtml=o=>o.html||esc(o.label);

    function renderHead(){
      const s=useSearch();
      if(!s&&!multi){head.hidden=true;return}
      head.hidden=false;
      if(!head.dataset.s||head.dataset.s!==String(s)){
        head.dataset.s=s;
        head.innerHTML=(s?`<input type="search" placeholder="Procurar…" aria-label="Procurar em ${esc(cfg.label)}" autocomplete="off">`:`<span class="sp"></span>`)+(multi?`<button type="button" class="dd-clr">Limpar</button>`:"");
        const inp=head.querySelector("input");
        if(inp){inp.value=q;inp.oninput=()=>{q=inp.value;renderList()}}
        const c=head.querySelector(".dd-clr");
        if(c)c.onclick=()=>{opts.forEach(o=>o.selected=false);emit()};
      }
      const c=head.querySelector(".dd-clr");if(c)c.disabled=!sel().length;
    }
    function renderList(){
      const top=list.scrollTop, nq=norm(q.trim());
      const vis=nq?opts.filter(o=>norm(o.label).includes(nq)):opts;
      list.innerHTML=vis.length?vis.map(o=>`<label class="dd-opt" role="option" aria-selected="${!!o.selected}"><input type="${multi?"checkbox":"radio"}" name="${id}" value="${esc(o.value)}"${o.selected?" checked":""}><span class="dd-ol">${optHtml(o)}</span>${o.count!=null?`<span class="dd-c">${Number(o.count).toLocaleString("pt-PT")}</span>`:""}</label>`).join(""):`<div class="dd-empty">Nada encontrado.</div>`;
      list.querySelectorAll("input").forEach(inp=>inp.onchange=()=>{
        const o=opts.find(x=>String(x.value)===inp.value);if(!o)return;
        if(multi)o.selected=inp.checked;else{opts.forEach(x=>x.selected=x===o);close()}
        emit();
      });
      list.scrollTop=top;
    }
    function renderBtn(){
      const s=sel(), v=el.querySelector(".dd-v"), n=el.querySelector(".dd-n");
      if(!multi){const o=s[0];v.innerHTML=o?optHtml(o):esc(allLabel);el.classList.toggle("on",!!cfg.highlight&&!!o&&!o.isDefault);n.hidden=true;return}
      v.innerHTML=!s.length?esc(allLabel):s.length===1?optHtml(s[0]):esc(s.slice(0,2).map(o=>o.label).join(", "));
      v.title=s.map(o=>o.label).join(", ");
      n.hidden=s.length<2;n.textContent=s.length;
      el.classList.toggle("on",s.length>0);
    }
    function render(){renderBtn();if(!pan.hidden){renderHead();renderList()}}
    function emit(){render();const s=sel().map(o=>o.value);cfg.onChange&&cfg.onChange(multi?s:s[0])}
    function open(){
      if(openDd&&openDd!==api)openDd.close();
      pan.hidden=false;btn.setAttribute("aria-expanded","true");el.classList.add("open");openDd=api;
      const r=el.getBoundingClientRect();el.classList.toggle("right",r.left>window.innerWidth/2);
      renderHead();renderList();
      const inp=head.querySelector("input");
      if(inp&&window.matchMedia("(pointer:fine)").matches)inp.focus();
    }
    function close(){pan.hidden=true;btn.setAttribute("aria-expanded","false");el.classList.remove("open");q="";const inp=head.querySelector("input");if(inp)inp.value="";if(openDd===api)openDd=null}
    btn.onclick=()=>pan.hidden?open():close();
    const api={el,btn,open,close,
      setOptions(o){opts=o.map(x=>({...x,label:String(x.label??x.value)}));render()},
      setHidden(h){el.hidden=!!h;if(h&&!pan.hidden)close()}};
    return api;
  }
  window.Dropdown={create};
})();
