"""Guarda a previsão de preços dos combustíveis para a semana seguinte (data/previsao.json).

Não há fonte oficial: a estimativa do setor sai às sextas-feiras (ACP e imprensa), com base nas
cotações do fecho de quinta. Esta tarefa lê a página do Ativos.pt, que publica essa estimativa
em formato estável, e guarda só os números (variação em €/litro e a semana a que se aplica).
Corre à sexta à tarde e ao sábado de manhã (GitHub Actions).
"""
import html, json, os, re, sys, urllib.request
from datetime import date, datetime, timezone

URL = "https://www.ativos.pt/combustiveis/precos-proxima-semana"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "previsao.json")
MESES = {m: i + 1 for i, m in enumerate(["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
                                          "agosto", "setembro", "outubro", "novembro", "dezembro"])}


def texto(url):
    req = urllib.request.Request(url, headers={"User-Agent": "postos-abastecimento (previsao semanal)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        s = r.read().decode("utf-8", "ignore")
    s = re.sub(r"<script.*?</script>|<style.*?</style>|<svg.*?</svg>", " ", s, flags=re.S)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\s+", " ", s)


def cent(v):
    v = v.replace("−", "-").replace(",", ".").replace("+", "")
    return round(float(v) / 100, 4)


def semana(t, hoje):
    m = re.search(r"Semana de (\d{1,2})(?: de (\w+))? a (\d{1,2}) de (\w+)", t)
    if not m:
        return None
    d1, m1, d2, m2 = m.group(1), m.group(2) or m.group(4), m.group(3), m.group(4)
    mi, mf = MESES.get(m1.lower()), MESES.get(m2.lower())
    if not mi or not mf:
        return None
    ano_i = hoje.year + (1 if mi < hoje.month - 6 else 0) - (1 if mi > hoje.month + 6 else 0)
    ano_f = ano_i + (1 if mf < mi else 0)
    return date(ano_i, mi, int(d1)), date(ano_f, mf, int(d2))


def main():
    hoje = datetime.now(timezone.utc).date()
    t = texto(URL)
    w = semana(t, hoje)
    g = re.search(r"Gasóleo simples\s+([+\-−]?\d+(?:,\d+)?) cênt\./l", t, flags=re.I)
    b = re.search(r"Gasolina 95\s+([+\-−]?\d+(?:,\d+)?) cênt\./l", t, flags=re.I)
    if not (w and g and b):
        sys.exit("Não encontrei a previsão na página (o formato pode ter mudado). Nada foi alterado.")
    novo = {
        "semanaInicio": w[0].isoformat(), "semanaFim": w[1].isoformat(),
        "gasoleo": cent(g.group(1)), "gasolina": cent(b.group(1)),
        "fonte": "Estimativa do setor publicada às sextas-feiras (ACP e imprensa), recolhida do Ativos.pt",
        "url": URL, "obtido": datetime.now(timezone.utc).isoformat(timespec="minutes"),
    }
    antigo = {}
    try:
        antigo = json.load(open(OUT, encoding="utf-8"))
    except FileNotFoundError:
        pass
    hist = [h for h in antigo.get("historico", []) if h.get("semanaInicio") != novo["semanaInicio"]]
    hist.append({k: novo[k] for k in ("semanaInicio", "semanaFim", "gasoleo", "gasolina")})
    novo["historico"] = hist[-52:]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(novo, f, ensure_ascii=False, indent=1)
    print(f"Semana {novo['semanaInicio']} a {novo['semanaFim']}: gasóleo {novo['gasoleo']:+.3f} €/l, gasolina {novo['gasolina']:+.3f} €/l")


if __name__ == "__main__":
    main()
