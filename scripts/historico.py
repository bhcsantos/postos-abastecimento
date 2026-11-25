"""Guarda os preços diários da DGEG para o histórico do site.

Corre uma vez por dia (GitHub Actions). Para cada combustível pede à DGEG os preços de
Portugal continental e acrescenta o preço do dia a cada posto. Os postos ficam repartidos
por 64 ficheiros (data/historico/NN.json, NN = id % 64) para a ficha de um posto só
precisar de ler um ficheiro. data/historico/medias.json guarda a média e a mediana
nacional e por distrito de cada combustível.
"""
import json, os, statistics, sys, urllib.request
from datetime import datetime, timezone, timedelta

API = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos"
FUELS = {2101: "Gasóleo simples", 2105: "Gasóleo especial", 3201: "Gasolina 95 simples",
         3205: "Gasolina 95 especial", 3405: "Gasolina 98 especial", 1120: "GPL Auto"}
SHARDS = 64
KEEP_DAYS = 400
DIR = os.path.join(os.path.dirname(__file__), "..", "data", "historico")


def lisbon_today():
    # Portugal continental: UTC+0 no inverno, UTC+1 no verão; a data basta com margem de 1 h
    return (datetime.now(timezone.utc) + timedelta(hours=1)).strftime("%Y-%m-%d")


def fetch(fid):
    req = urllib.request.Request(f"{API}?idsTiposComb={fid}&qtdPorPagina=5000&pagina=1",
                                 headers={"User-Agent": "postos-abastecimento (historico diario)"})
    with urllib.request.urlopen(req, timeout=120) as r:
        rows = json.load(r)["resultado"] or []
    out = {}
    for x in rows:
        try:
            p = float(str(x["Preco"]).replace("€", "").replace(",", ".").strip())
        except ValueError:
            continue
        if p > 0:
            out[str(x["Id"])] = (round(p, 3), x.get("Distrito") or "")
    return out


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def main():
    os.makedirs(DIR, exist_ok=True)
    day = lisbon_today()
    cutoff = (datetime.strptime(day, "%Y-%m-%d") - timedelta(days=KEEP_DAYS)).strftime("%Y-%m-%d")
    data = {fid: fetch(fid) for fid in FUELS}
    if sum(len(v) for v in data.values()) < 1000:
        sys.exit("A DGEG devolveu poucos dados; nada foi gravado.")

    shards = [load(os.path.join(DIR, f"{i:02d}.json"), {}) for i in range(SHARDS)]
    for fid, rows in data.items():
        for sid, (price, _) in rows.items():
            sh = shards[int(sid) % SHARDS]
            series = sh.setdefault(sid, {}).setdefault(str(fid), [])
            if series and series[-1][0] == day:
                series[-1][1] = price
            else:
                series.append([day, price])
    for i, sh in enumerate(shards):
        for sid in list(sh):
            for fid in list(sh[sid]):
                sh[sid][fid] = [e for e in sh[sid][fid] if e[0] >= cutoff]
                if not sh[sid][fid]:
                    del sh[sid][fid]
            if not sh[sid]:
                del sh[sid]
        with open(os.path.join(DIR, f"{i:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(sh, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    medias = load(os.path.join(DIR, "medias.json"), {})
    for fid, rows in data.items():
        groups = {"Portugal": [p for p, _ in rows.values()]}
        for p, d in rows.values():
            if d:
                groups.setdefault(d, []).append(p)
        for g, vals in groups.items():
            series = medias.setdefault(str(fid), {}).setdefault(g, [])
            entry = [day, round(statistics.mean(vals), 3), round(statistics.median(vals), 3), len(vals)]
            if series and series[-1][0] == day:
                series[-1] = entry
            else:
                series.append(entry)
            medias[str(fid)][g] = [e for e in series if e[0] >= cutoff]
    with open(os.path.join(DIR, "medias.json"), "w", encoding="utf-8") as f:
        json.dump(medias, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print(f"{day}: {sum(len(v) for v in data.values())} preços gravados")


if __name__ == "__main__":
    main()
