"""Envio de avisos por email (Gmail) e notificações push. Corre no GitHub Actions a cada 30 minutos.

Avisos:
  1. Alertas de preço: quando o preço de um posto fica igual ou abaixo do limite que o utilizador definiu
     (avisa uma vez; volta a avisar se descer mais, ou depois de o preço voltar a subir acima do limite).
  2. Previsão da semana: às sextas, quando sai a estimativa nova (data/previsao.json), para quem a pediu.
  3. Pedidos de funcionalidades: aos administradores quando chega um pedido novo; a quem fez o pedido
     quando o estado ou a resposta mudam.

Segredos do GitHub (Settings → Secrets and variables → Actions):
  FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço do Firebase (acesso à base de dados e às contas)
  GMAIL_USER                endereço Gmail que envia (ex.: o do dono do site)
  GMAIL_APP_PASSWORD        palavra-passe de aplicação do Google (não é a palavra-passe normal)

As chaves VAPID das notificações push são derivadas da chave privada da conta de serviço (não é preciso
outro segredo); a chave pública fica em data/push.json para o site a usar ao pedir autorização.
"""
import base64, hashlib, json, os, smtplib, sys, time, urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

SITE = "https://bhcsantos.github.io/postos-abastecimento/"
ROOT = os.path.join(os.path.dirname(__file__), "..")
API = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/GetDadosPosto?id="
ESTADO = {"novo": "Recebido", "analise": "Em análise", "planeado": "Planeado", "feito": "Feito", "recusado": "Recusado"}
DRY = "--teste" in sys.argv  # mostra o que enviaria, sem enviar nem gravar


def agora():
    return datetime.now(timezone.utc)


# ---------- chaves VAPID derivadas da conta de serviço ----------
def vapid(sa):
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    seed = hashlib.sha256(("vapid-postos-abastecimento|" + sa["private_key"]).encode()).digest()
    n = int("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551", 16)
    d = int.from_bytes(seed, "big") % (n - 1) + 1
    key = ec.derive_private_key(d, ec.SECP256R1())
    pub = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    return pem, base64.urlsafe_b64encode(pub).decode().rstrip("=")


# ---------- envio ----------
class Correio:
    def __init__(self):
        self.user, self.pw, self.smtp, self.n = os.environ.get("GMAIL_USER"), os.environ.get("GMAIL_APP_PASSWORD"), None, 0

    def enviar(self, para, assunto, texto, url=SITE):
        if not para or not self.user or not self.pw:
            return False
        if DRY:
            print(f"[email] {para}: {assunto}\n{texto}\n"); return True
        if self.smtp is None:
            self.smtp = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30)
            self.smtp.login(self.user, self.pw)
        m = EmailMessage()
        m["From"] = f"Postos de Abastecimento <{self.user}>"
        m["To"], m["Subject"] = para, assunto
        rodape = f"\n\n{url}\n\n—\nRecebe este email porque o pediu em Postos de Abastecimento. Para deixar de receber, desligue a opção em A minha conta: {SITE}conta.html"
        m.set_content(texto + rodape)
        try:
            self.smtp.send_message(m); self.n += 1; return True
        except Exception as e:
            print("Falhou o email para", para, e); return False

    def fechar(self):
        if self.smtp:
            try: self.smtp.quit()
            except Exception: pass


class Push:
    def __init__(self, pem, db):
        self.pem, self.db, self.n = pem, db, 0

    def enviar(self, uid, data, titulo, corpo, url):
        subs = (data or {}).get("push") or []
        if not subs:
            return False
        from pywebpush import webpush, WebPushException
        from py_vapid import Vapid01
        chave = Vapid01.from_pem(self.pem.encode())
        ok, vivas = False, []
        for s in subs:
            if DRY:
                print(f"[push] {uid}: {titulo} — {corpo}"); vivas.append(s); ok = True; continue
            try:
                webpush({"endpoint": s["endpoint"], "keys": s["keys"]}, json.dumps({"title": titulo, "body": corpo, "url": url}),
                        vapid_private_key=chave, vapid_claims={"sub": "mailto:" + (os.environ.get("GMAIL_USER") or "postos@example.com")}, ttl=86400)
                vivas.append(s); ok = True; self.n += 1
            except WebPushException as e:
                code = getattr(e.response, "status_code", 0)
                if code not in (404, 410):
                    vivas.append(s)
                print("Push falhou", code)
            except Exception as e:
                vivas.append(s); print("Push falhou", e)
        if len(vivas) != len(subs) and not DRY:
            self.db.collection("users").document(uid).update({"push": vivas})
        return ok


def preco(v):
    try: return round(float(str(v).replace("€/litro", "").replace("€", "").replace(",", ".").strip()), 3)
    except ValueError: return None


def eur(v):
    return f"{v:.3f}".replace(".", ",") + " €"


def main():
    sa_txt = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not sa_txt:
        print("Falta o segredo FIREBASE_SERVICE_ACCOUNT; nada a fazer."); return
    sa = json.loads(sa_txt)
    import firebase_admin
    from firebase_admin import credentials, firestore, auth
    firebase_admin.initialize_app(credentials.Certificate(sa))
    db = firestore.client()
    pem, pub = vapid(sa)
    # chave pública para o site (só muda se a conta de serviço mudar)
    pj = os.path.join(ROOT, "data", "push.json")
    try: atual = json.load(open(pj))
    except Exception: atual = {}
    if atual.get("vapidPublicKey") != pub:
        json.dump({"vapidPublicKey": pub}, open(pj, "w"))
        print("Chave pública VAPID atualizada em data/push.json")

    mail, push = Correio(), Push(pem, db)
    emails = {}
    def email_de(uid):
        if uid not in emails:
            try: emails[uid] = auth.get_user(uid).email
            except Exception: emails[uid] = None
        return emails[uid]

    users = {d.id: d.to_dict() for d in db.collection("users").stream()}
    sistema = db.collection("sistema").document("notificacoes")
    sis = (sistema.get().to_dict() or {})

    # 1) alertas de preço
    fichas = {}
    for uid, u in users.items():
        alertas, mudou = u.get("alertas") or [], False
        for a in alertas:
            pid = a.get("posto")
            if not pid: continue
            if pid not in fichas:
                try:
                    with urllib.request.urlopen(urllib.request.Request(API + str(pid), headers={"User-Agent": "postos-abastecimento (alertas)"}), timeout=30) as r:
                        fichas[pid] = json.load(r).get("resultado")
                except Exception:
                    fichas[pid] = None
            p = fichas[pid]
            if not p: continue
            c = next((x for x in p.get("Combustiveis") or [] if x.get("TipoCombustivel") == a.get("combustivel")), None)
            v = preco(c.get("Preco")) if c else None
            if v is None: continue
            lim, av = float(a.get("limite") or 0), a.get("avisado")
            if v <= lim + 1e-9:
                if not av or v < float(av.get("preco", 9)) - 1e-9:
                    titulo = f"{a.get('nome') or p.get('Nome')}: {a.get('combustivel')} a {eur(v)}"
                    corpo = f"O preço baixou para {eur(v)} (o seu alerta era {eur(lim)})."
                    url = f"{SITE}posto.html?id={pid}"
                    env = False
                    if u.get("emailAlertas", True) is not False:
                        env |= mail.enviar(email_de(uid), "Alerta de preço: " + titulo, corpo + f"\n\nPosto: {p.get('Nome')} ({p.get('Marca')})\nAtualizado na DGEG: {c.get('DataAtualizacao')}", url)
                    env |= push.enviar(uid, u, "Alerta de preço", f"{titulo} (alerta: {eur(lim)})", url)
                    if env:
                        a["avisado"] = {"preco": v, "data": agora().strftime("%Y-%m-%d %H:%M")}; mudou = True
            elif av:
                a.pop("avisado", None); mudou = True  # voltou a subir: o próximo recuo avisa outra vez
        if mudou and not DRY:
            db.collection("users").document(uid).update({"alertas": alertas})

    # 2) previsão da semana (quando sai uma nova)
    try:
        prev = json.load(open(os.path.join(ROOT, "data", "previsao.json"), encoding="utf-8"))
    except Exception:
        prev = None
    if prev and prev.get("semanaInicio") and sis.get("previsaoEnviada") != prev["semanaInicio"]:
        hoje = (agora() + timedelta(hours=1)).strftime("%Y-%m-%d")
        if hoje < prev["semanaInicio"]:
            def txt(x): return "sem alteração" if abs(x) < 0.0005 else (f"desce {abs(x)*100:.1f}".replace(".", ",") if x < 0 else f"sobe {x*100:.1f}".replace(".", ",")) + " cênt./l"
            ini = datetime.strptime(prev["semanaInicio"], "%Y-%m-%d").strftime("%d/%m")
            fim = datetime.strptime(prev["semanaFim"], "%Y-%m-%d").strftime("%d/%m")
            corpo = f"Gasóleo: {txt(prev['gasoleo'])}\nGasolina: {txt(prev['gasolina'])}"
            for uid, u in users.items():
                if not u.get("previsao"): continue
                if u.get("emailAlertas", True) is not False:
                    mail.enviar(email_de(uid), f"Preços na próxima semana ({ini} a {fim})", corpo + "\n\nEstimativa do setor, não oficial.")
                push.enviar(uid, u, f"Próxima semana ({ini} a {fim})", corpo.replace("\n", " · "), SITE)
            if not DRY:
                sistema.set({"previsaoEnviada": prev["semanaInicio"]}, merge=True)

    # 3) pedidos de funcionalidades
    admins = [d.id for d in db.collection("admins").stream()]
    for d in db.collection("pedidos").stream():
        x, ref, upd = d.to_dict(), d.reference, {}
        if not x.get("notificadoAdmin"):
            for aid in admins:
                t = f"Pedido novo de {x.get('nome') or 'um utilizador'}"
                mail.enviar(email_de(aid), "Postos: " + t, (x.get("texto") or "") + f"\n\nPágina: {x.get('pagina') or '—'}", SITE + "admin.html")
                push.enviar(aid, users.get(aid), t, (x.get("texto") or "")[:120], SITE + "admin.html")
            upd["notificadoAdmin"] = True
        marca = f"{x.get('estado')}|{x.get('resposta') or ''}"
        if x.get("estado") != "novo" and x.get("avisadoEstado") != marca and x.get("uid"):
            u = users.get(x["uid"]) or {}
            t = f"O seu pedido está: {ESTADO.get(x.get('estado'), x.get('estado'))}"
            corpo = f"Pedido: {(x.get('texto') or '')[:300]}" + (f"\n\nResposta: {x['resposta']}" if x.get("resposta") else "")
            if u.get("emailAlertas", True) is not False:
                mail.enviar(email_de(x["uid"]), "Postos: " + t, corpo, SITE + "conta.html#ideas")
            push.enviar(x["uid"], u, t, x.get("resposta") or (x.get("texto") or "")[:120], SITE + "conta.html#ideas")
            upd["avisadoEstado"] = marca
        if upd and not DRY:
            ref.update(upd)

    mail.fechar()
    print(f"Emails enviados: {mail.n} · notificações push: {push.n}")


if __name__ == "__main__":
    main()
