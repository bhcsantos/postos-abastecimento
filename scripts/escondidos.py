"""Postos que a DGEG deixou de mostrar na pesquisa por não atualizarem os preços há 10 dias ou mais.

A pesquisa da DGEG (PesquisarPostos) esconde esses postos, mas a ficha (GetDadosPosto) continua a
existir, com os últimos preços comunicados. Este script, corrido uma vez por dia depois de
scripts/historico.py, procura os postos que já apareceram no histórico (ou em escondidos.json) e
que hoje faltam na pesquisa, e guarda a ficha de cada um em data/escondidos.json. O site junta-os à
lista com o aviso de que o preço pode estar desatualizado.

Postos sem atualização há mais de 90 dias ficam de fora (provavelmente fecharam).
"""
import glob, json, os, sys, time, urllib.request
from datetime import datetime, timedelta

API = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/"
FUELS = [2101, 2105, 3201, 3205, 3405, 1120]
# Nomes da ficha da DGEG -> id do combustível usado no site
NAME_ID = {"Gasóleo simples": 2101, "Gasóleo especial": 2105, "Gasolina simples 95": 3201,
           "Gasolina especial 95": 3205, "Gasolina especial 98": 3405, "GPL Auto": 1120}
MAX_DIAS = 90
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "data", "escondidos.json")
UA = {"User-Agent": "postos-abastecimento (postos escondidos)"}


def get(path):
    req = urllib.request.Request(API + path, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.load(r)
    if not j.get("status"):
        raise RuntimeError(j.get("mensagem") or "sem dados")
    return j["resultado"]


def price(v):
    try:
        return round(float(str(v).replace("€/litro", "").replace("€", "").replace(",", ".").strip()), 3)
    except ValueError:
        return None


def main():
    live = set()
    for fid in FUELS:
        live |= {str(x["Id"]) for x in get(f"PesquisarPostos?idsTiposComb={fid}&qtdPorPagina=5000&pagina=1") or []}
    if len(live) < 1000:
        sys.exit("A DGEG devolveu poucos postos; nada foi gravado.")

    seen = set()
    for f in glob.glob(os.path.join(ROOT, "data", "historico", "[0-9][0-9].json")):
        with open(f, encoding="utf-8") as fh:
            seen |= set(json.load(fh).keys())
    try:
        with open(OUT, encoding="utf-8") as fh:
            seen |= {str(p["id"]) for p in json.load(fh).get("postos", [])}
    except FileNotFoundError:
        pass

    distritos = {d["Descritivo"]: d["Id"] for d in get("GetDistritos")}
    limite = (datetime.now() - timedelta(days=MAX_DIAS)).strftime("%Y-%m-%d")
    postos = []
    for sid in sorted(seen - live, key=int):
        try:
            p = get(f"GetDadosPosto?id={sid}")
        except Exception as e:  # posto removido ou erro pontual: fica de fora hoje
            print(f"{sid}: {e}")
            continue
        m = p.get("Morada") or {}
        precos, datas = {}, []
        for c in p.get("Combustiveis") or []:
            fid, v = NAME_ID.get(c.get("TipoCombustivel")), price(c.get("Preco"))
            if fid and v:
                precos[str(fid)] = v
                datas.append(c.get("DataAtualizacao") or "")
        if not precos or not m.get("Latitude"):
            continue
        d = max(datas)
        if d[:10] < limite:
            continue
        postos.append({
            "id": int(sid), "n": str(p.get("Nome") or "").strip(), "b": str(p.get("Marca") or "").strip(),
            "a": str(m.get("Morada") or "").strip(), "cp": m.get("CodPostal") or "",
            "mun": str(m.get("Municipio") or "").strip(), "locn": str(m.get("Localidade") or "").strip(),
            "dist": distritos.get(m.get("Distrito")), "lat": float(m["Latitude"]), "lon": float(m["Longitude"]),
            "p": precos, "d": d,
        })
        time.sleep(0.2)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"atualizado": datetime.now().strftime("%Y-%m-%d %H:%M"), "postos": postos}, fh,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"{len(postos)} postos escondidos pela DGEG guardados")


if __name__ == "__main__":
    main()
