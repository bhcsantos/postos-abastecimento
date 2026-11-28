"""Verificação automática das campanhas de desconto (data/descontos.json).

Corre todos os dias no GitHub Actions:
  * todos os dias: campanhas que terminam hoje ou amanhã, e as que terminaram nos últimos 7 dias
    (para confirmar se foram prolongadas);
  * às segundas-feiras (ou quando se pede com --tudo): visita a página de cada campanha e compara
    o texto com o da semana anterior, para saber quais mudaram ou deixaram de abrir.

Escreve o resultado em data/verificacao-descontos.json (que a revisão semanal lê) e, se houver algo a
rever, abre um "issue" no GitHub com a etiqueta "descontos" (ou comenta no que já estiver aberto),
o que faz chegar um email ao dono do repositório.
"""
import hashlib, html, json, os, re, subprocess, sys, urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.join(os.path.dirname(__file__), "..")
DESC = os.path.join(ROOT, "data", "descontos.json")
OUT = os.path.join(ROOT, "data", "verificacao-descontos.json")
UA = {"User-Agent": "Mozilla/5.0 (postos-abastecimento; verificação semanal das campanhas)",
      "Accept-Language": "pt-PT,pt;q=0.9"}


def hoje():
    return (datetime.now(timezone.utc) + timedelta(hours=1)).date()  # Portugal continental, com margem


def texto(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read()
        tipo = r.headers.get("Content-Type", "")
    if "pdf" in tipo or url.lower().endswith(".pdf"):
        return hashlib.sha256(raw).hexdigest()
    t = raw.decode("utf-8", "replace")
    t = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", t)
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"\s+", " ", t).strip()
    return hashlib.sha256(t.encode()).hexdigest()


def gh(*args, input=None):
    return subprocess.run(["gh", *args], input=input, text=True, capture_output=True)


def main():
    tudo = "--tudo" in sys.argv or hoje().weekday() == 0
    d = json.load(open(DESC, encoding="utf-8"))
    prog = {p["id"]: p for p in d["programas"]}
    try:
        antes = json.load(open(OUT, encoding="utf-8"))
    except FileNotFoundError:
        antes = {}
    t = hoje()
    fmt = lambda s: datetime.strptime(s, "%Y-%m-%d").strftime("%d/%m/%Y")

    # 1) datas de fim
    termina, terminou = [], []
    for r in d["descontos"]:
        if not r.get("fim"):
            continue
        fim = datetime.strptime(r["fim"], "%Y-%m-%d").date()
        item = {"id": r["id"], "titulo": r["titulo"], "fim": r["fim"], "fonte": r.get("fonte", "")}
        if t <= fim <= t + timedelta(days=1):
            termina.append(item)
        elif t - timedelta(days=7) <= fim < t:
            terminou.append(item)

    # 2) páginas das campanhas (às segundas)
    hashes = antes.get("hashes", {})
    mudou, falhou = [], []
    if tudo:
        urls = {}
        for r in d["descontos"]:
            for u in [r.get("fonte")] + list(r.get("fontes") or []):
                if u and u.startswith("http"):
                    urls.setdefault(u, []).append(r["titulo"])
        for p in d["programas"]:
            if p.get("fonte", "").startswith("http"):
                urls.setdefault(p["fonte"], []).append(p["nome"])
        novos = {}
        for u, quem in sorted(urls.items()):
            try:
                h = texto(u)
                novos[u] = h
                if u in hashes and hashes[u] != h:
                    mudou.append({"url": u, "campanhas": sorted(set(quem))[:5]})
            except Exception as e:
                falhou.append({"url": u, "erro": str(e)[:120], "campanhas": sorted(set(quem))[:5]})
                if u in hashes:
                    novos[u] = hashes[u]
        hashes = novos

    res = {"verificado": t.isoformat(), "paginasVerificadas": tudo, "terminaEmBreve": termina,
           "terminouRecentemente": terminou, "paginasQueMudaram": mudou, "paginasSemAcesso": falhou,
           "hashes": hashes, "ultimaVerificacaoPaginas": t.isoformat() if tudo else antes.get("ultimaVerificacaoPaginas")}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1, sort_keys=False)

    # 3) aviso no GitHub (issue com a etiqueta "descontos")
    partes = []
    if termina:
        partes.append("**Terminam hoje ou amanhã** (confirmar se são prolongadas):\n" + "\n".join(
            f"- {x['titulo']}: até {fmt(x['fim'])} — {x['fonte']}" for x in termina))
    if terminou:
        partes.append("**Terminaram nos últimos 7 dias** (já não aparecem no site; confirmar se houve prolongamento ou campanha nova):\n" + "\n".join(
            f"- {x['titulo']}: terminou a {fmt(x['fim'])} — {x['fonte']}" for x in terminou))
    if mudou:
        partes.append("**Páginas que mudaram desde a semana passada:**\n" + "\n".join(
            f"- {x['url']} ({', '.join(x['campanhas'])})" for x in mudou))
    novas_falhas = [x for x in falhou if x["url"] not in {y["url"] for y in antes.get("paginasSemAcesso", [])}]
    if novas_falhas:
        partes.append("**Páginas que deixaram de abrir** (podem ter mudado de endereço ou bloquear acessos automáticos):\n" + "\n".join(
            f"- {x['url']} — {x['erro']}" for x in novas_falhas))
    print("\n\n".join(partes) or "Nada a rever.")
    if not partes or not os.environ.get("GH_TOKEN"):
        return
    corpo = "\n\n".join(partes) + "\n\nA revisão semanal (segunda-feira) vai propor as alterações num pull request. Lista completa em `data/verificacao-descontos.json`."
    gh("label", "create", "descontos", "--color", "1d7a46", "--description", "Campanhas de desconto a rever", "--force")
    aberto = gh("issue", "list", "--label", "descontos", "--state", "open", "--json", "number", "--jq", ".[0].number").stdout.strip()
    if aberto:
        gh("issue", "comment", aberto, "--body-file", "-", input=f"### Verificação de {t.strftime('%d/%m/%Y')}\n\n" + corpo)
    else:
        gh("issue", "create", "--title", f"Descontos a rever ({t.strftime('%d/%m/%Y')})", "--label", "descontos", "--body-file", "-", input=corpo)


if __name__ == "__main__":
    main()
