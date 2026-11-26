/* Telemóvel: botão flutuante "Lista ↓" / "Mapa ↑" nas páginas com mapa e lista. */
(function(){
  const map=document.getElementById("map"), list=document.getElementById("items");
  if(!map||!list)return;
  const b=document.createElement("button");b.type="button";b.className="mjump";
  document.body.appendChild(b);
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mapVisible=()=>{const r=map.getBoundingClientRect();return r.bottom>innerHeight*0.35&&r.top<innerHeight*0.65};
  function upd(){
    const onMap=mapVisible(), pastList=list.getBoundingClientRect().top<innerHeight*0.5;
    b.textContent=onMap||!pastList?"Ver lista ↓":"Ver mapa ↑";
    b.setAttribute("aria-label",b.textContent.replace(/ [↓↑]/,""));
    b.hidden=!list.children.length;
  }
  b.onclick=()=>{
    const toList=b.textContent.startsWith("Ver lista");
    const el=toList?(document.getElementById("count")||list):map.closest(".mapbox")||map;
    el.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
  };
  addEventListener("scroll",upd,{passive:true});addEventListener("resize",upd);
  new MutationObserver(upd).observe(list,{childList:true});
  upd();
})();
