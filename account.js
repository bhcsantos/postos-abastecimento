/* Contas de utilizador (Firebase): login com Google ou email/palavra-passe, perfis, favoritos,
   locais, alertas e pedidos de funcionalidades. As preferências também ficam no navegador,
   por isso o site funciona sem conta; com conta, sincronizam entre dispositivos. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut, deleteUser, updateProfile,
  setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, addDoc, collection, serverTimestamp, query, where,
  getDocs, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuração pública da aplicação web (não é um segredo: a proteção está nas regras do Firestore)
const firebaseConfig = {
  apiKey: "AIzaSyA-5-wMzon_8dbas0BMYebbf8q58a16fxk",
  authDomain: "bhcsantos-postos-abastecimento.firebaseapp.com",
  projectId: "bhcsantos-postos-abastecimento",
  storageBucket: "bhcsantos-postos-abastecimento.firebasestorage.app",
  messagingSenderId: "299249541585",
  appId: "1:299249541585:web:2972248ef175c69fb2c0f0"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); auth.languageCode = "pt";
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uidShort = () => Math.random().toString(36).slice(2, 9);
const ERR = {
  "auth/invalid-credential": "Email ou palavra-passe errados.",
  "auth/wrong-password": "Email ou palavra-passe errados.",
  "auth/user-not-found": "Não existe nenhuma conta com este email.",
  "auth/email-already-in-use": "Já existe uma conta com este email. Entre com ela ou recupere a palavra-passe.",
  "auth/weak-password": "A palavra-passe tem de ter pelo menos 6 caracteres.",
  "auth/invalid-email": "O email não parece válido.",
  "auth/popup-closed-by-user": "A janela da Google foi fechada antes de terminar.",
  "auth/popup-blocked": "O navegador bloqueou a janela da Google. Permita janelas para este site e tente de novo.",
  "auth/requires-recent-login": "Por segurança, saia e volte a entrar antes de apagar a conta.",
  "auth/too-many-requests": "Demasiadas tentativas. Espere uns minutos e tente de novo.",
  "auth/network-request-failed": "Sem ligação à internet. Verifique a rede e tente de novo.",
  "permission-denied": "O site ainda não tem permissão para guardar dados. O dono do site tem de publicar as regras do Firestore."
};
const msg = e => ERR[e?.code] || (e?.message ? `Não foi possível concluir: ${e.message}` : "Não foi possível concluir. Tente de novo.");

function localSnapshot() {
  const r = k => { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } };
  const fuel = r("pp-fuel") || 2101, desc = r("pp-descontos") || { programas: [], condicoes: [] }, ev = r("ev-f") || {};
  return {
    perfis: [
      { id: uidShort(), nome: "O meu carro", tipo: "combustivel", combustivel: fuel, deposito: null, consumo: null, descontos: desc },
      ...(ev.conn && ev.conn.length ? [{ id: uidShort(), nome: "O meu elétrico", tipo: "eletrico", fichas: ev.conn, potenciaMin: ev.pow || 0, bateria: null, consumo: null }] : [])
    ],
    percurso: r("route-v1") || []
  };
}

const A = {
  user: null, data: null, ready: null, _subs: [], _t: null,
  on(fn) { this._subs.push(fn); fn(this) },
  emit() { this._subs.forEach(f => { try { f(this) } catch (e) { console.error(e) } }); this.renderBadge(); this.applyProfile() },
  profile() { const d = this.data; if (!d || !d.perfis) return null; return d.perfis.find(p => p.id === d.perfilAtivo) || d.perfis[0] || null },
  isAdminPage: false,

  async loadUser(u) {
    this.user = u; this.loaded = true;
    if (!u) { this.data = null; this.emit(); return }
    try {
      const ref = doc(db, "users", u.uid), snap = await getDoc(ref);
      if (snap.exists()) this.data = snap.data();
      else {
        const s = localSnapshot();
        this.data = { nome: u.displayName || "", perfis: s.perfis, perfilAtivo: s.perfis[0].id, favoritos: [], locais: {}, alertas: [], percurso: s.percurso, emailAlertas: true, criado: serverTimestamp(), atualizado: serverTimestamp() };
        await setDoc(ref, this.data);
      }
      // percurso: se o da conta estiver vazio e o do navegador não, fica o do navegador
      if (window.Route) {
        if ((this.data.percurso || []).length) { Route.list = this.data.percurso; try { localStorage.setItem("route-v1", JSON.stringify(Route.list)) } catch (e) {} Route.render(); Route.onchange && Route.onchange() }
        else if (Route.list.length) this.save({ percurso: Route.list });
      }
      this.error = null;
    } catch (e) { this.error = msg(e); console.error(e) }
    this.emit();
  },
  /* Guarda alterações na conta (com um pequeno atraso para juntar várias) */
  save(patch, now = false) {
    if (!this.user || !this.data) return Promise.resolve();
    Object.assign(this.data, patch);
    const go = () => setDoc(doc(db, "users", this.user.uid), { ...patch, atualizado: serverTimestamp() }, { merge: true }).catch(e => { this.error = msg(e); console.error(e) });
    clearTimeout(this._t);
    if (now) return go();
    this._t = setTimeout(go, 600); return Promise.resolve();
  },
  setProfiles(perfis, ativo) { this.save({ perfis, perfilAtivo: ativo ?? this.data.perfilAtivo }, true); this.emit() },
  switchProfile(id) { this.save({ perfilAtivo: id }, true); this.emit() },
  applyProfile() {
    const p = this.profile();
    if (p && p.tipo === "combustivel" && window.Discounts && p.descontos) {
      const cur = JSON.stringify(Discounts.prefs), nw = JSON.stringify({ programas: p.descontos.programas || [], condicoes: p.descontos.condicoes || [] });
      if (cur !== nw) Discounts.setPrefs(p.descontos);
    }
    if (typeof window.onProfile === "function") window.onProfile(p);
  },

  /* Favoritos: {k:"fuel"|"ev", id, t, sub, lat, lng} */
  isFav(k, id) { return !!(this.data && (this.data.favoritos || []).some(f => f.k === k && f.id === id)) },
  toggleFav(item) {
    if (!this.user) { location.href = "conta.html?voltar=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); return }
    const f = this.data.favoritos || [];
    this.save({ favoritos: this.isFav(item.k, item.id) ? f.filter(x => !(x.k === item.k && x.id === item.id)) : [...f, item] }, true);
    this.emit();
  },
  /* Alertas de preço: {id, posto, nome, combustivel, fuelId, limite} */
  setAlert(a) { const l = (this.data.alertas || []).filter(x => !(x.posto === a.posto && x.fuelId === a.fuelId)); if (a.limite) l.push(a); this.save({ alertas: l }, true); this.emit() },

  async loginGoogle() { return signInWithPopup(auth, new GoogleAuthProvider()) },
  async loginEmail(email, pass) { return signInWithEmailAndPassword(auth, email, pass) },
  async signupEmail(nome, email, pass) {
    const c = await createUserWithEmailAndPassword(auth, email, pass);
    if (nome) await updateProfile(c.user, { displayName: nome });
    sendEmailVerification(c.user).catch(() => {});
    return c;
  },
  async reset(email) { return sendPasswordResetEmail(auth, email) },
  async logout() { await signOut(auth) },
  async deleteAccount() {
    const u = this.user; if (!u) return;
    const mine = await getDocs(query(collection(db, "pedidos"), where("uid", "==", u.uid))).catch(() => null);
    if (mine) for (const d of mine.docs) await deleteDoc(d.ref).catch(() => {});
    await deleteDoc(doc(db, "users", u.uid));
    await deleteUser(u);
    ["pp-descontos", "route-v1"].forEach(k => { try { localStorage.removeItem(k) } catch (e) {} });
  },
  async exportData() {
    const u = this.user; if (!u) return null;
    const pedidos = await getDocs(query(collection(db, "pedidos"), where("uid", "==", u.uid))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => []);
    return { conta: { uid: u.uid, email: u.email, nome: u.displayName, criada: u.metadata.creationTime }, preferencias: this.data, pedidos };
  },
  async sendRequest(texto, pagina) {
    if (!this.user) throw { code: "auth/required" };
    return addDoc(collection(db, "pedidos"), { uid: this.user.uid, nome: this.user.displayName || "", texto, pagina: pagina || "", criado: serverTimestamp(), estado: "novo" });
  },
  async myRequests() {
    if (!this.user) return [];
    const s = await getDocs(query(collection(db, "pedidos"), where("uid", "==", this.user.uid)));
    return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.criado?.seconds || 0) - (a.criado?.seconds || 0));
  },
  async allRequests() {
    const s = await getDocs(query(collection(db, "pedidos"), orderBy("criado", "desc")));
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async setRequestState(id, estado, resposta) { return updateDoc(doc(db, "pedidos", id), resposta != null ? { estado, resposta } : { estado }) },
  async isAdmin() { if (!this.user) return false; try { return (await getDoc(doc(db, "admins", this.user.uid))).exists() } catch (e) { return false } },
  msg,

  /* Botão da conta no topo de cada página */
  renderBadge() {
    let box = document.getElementById("acctBox");
    const nav = document.querySelector("nav.tabs");
    if (!box && nav) {
      const bar = document.createElement("div"); bar.className = "topbar";
      nav.parentNode.insertBefore(bar, nav); bar.appendChild(nav);
      box = document.createElement("div"); box.id = "acctBox"; box.className = "acct"; bar.appendChild(box);
    }
    if (!box) return;
    const u = this.user, p = this.profile();
    if (!u) { box.innerHTML = `<a class="acctbtn" href="conta.html?voltar=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}">Entrar</a>`; return }
    const ini = (u.displayName || u.email || "?").trim().charAt(0).toUpperCase();
    const perfis = this.data?.perfis || [];
    box.innerHTML = `${perfis.length > 1 ? `<label class="acctprof"><span class="sr">Perfil</span><select id="acctProf">${perfis.map(x => `<option value="${esc(x.id)}" ${p && x.id === p.id ? "selected" : ""}>${x.tipo === "eletrico" ? "⚡ " : "⛽ "}${esc(x.nome)}</option>`).join("")}</select></label>` : ""}
      <a class="acctbtn me" href="conta.html" title="A minha conta"><span class="av">${esc(ini)}</span><span class="nm">${esc((u.displayName || u.email || "").split(" ")[0])}</span></a>`;
    const sel = document.getElementById("acctProf"); if (sel) sel.onchange = () => this.switchProfile(sel.value);
  }
};

/* Estilos do botão da conta (comuns a todas as páginas) */
const css = document.createElement("style");
css.textContent = `.topbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.acct{display:flex;align-items:center;gap:8px;margin-left:auto}
.acctbtn{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--fg);font-weight:600;text-decoration:none}
.acctbtn:hover{border-color:var(--accent)}
.acctbtn.me{padding:5px 12px 5px 5px}
.acctbtn .av{width:30px;height:30px;border-radius:50%;background:var(--accent);color:var(--surface);display:grid;place-items:center;font-weight:700}
.acctprof select{font:inherit;font-weight:600;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--fg);max-width:46vw}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (max-width:520px){.acctbtn .nm{display:none}}`;
document.head.appendChild(css);

window.Account = A;
A.ready = new Promise(res => onAuthStateChanged(auth, async u => { await A.loadUser(u); res(A) }));

/* Sincronizar descontos e percurso com a conta quando mudam */
const hook = () => {
  if (window.Discounts && !Discounts._acct) {
    Discounts._acct = true; const orig = Discounts.save.bind(Discounts);
    Discounts.save = () => { orig(); const p = A.profile(); if (A.user && p && p.tipo === "combustivel") { p.descontos = { ...Discounts.prefs }; A.save({ perfis: A.data.perfis }) } };
  }
  if (window.Route && !Route._acct) {
    Route._acct = true; const orig = Route.save.bind(Route);
    Route.save = () => { orig(); if (A.user) A.save({ percurso: Route.list }) };
  }
};
hook(); window.addEventListener("load", hook);
A.renderBadge();
