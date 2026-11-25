"""Gera data/carros.json, o catálogo de versões de carros usado em "A minha conta".

Fontes:
  - Elétricos: OpenEV Data (https://open-ev-data.github.io), licença CDLA-Permissive-2.0.
    Uso: python scripts/carros.py <pasta do repositório open-ev-data-dataset>
  - Combustível e híbridos plug-in: data/carros-manual.json (acrescentados à mão, com fontes).
"""
import json, os, sys, glob

ROOT = os.path.join(os.path.dirname(__file__), "..")
# Fichas na versão europeia: os modelos vendidos na Europa usam CCS2 (CCS + Tipo 2), mesmo quando a
# base de dados descreve a versão americana (NACS ou CCS1).
CONN = {"ccs2": ["CCS", "Mennekes"], "ccs1": ["CCS", "Mennekes"], "nacs": ["CCS", "Mennekes"],
        "type2": ["Mennekes"], "chademo": ["CHAdeMO"]}
US_CONN = {"nacs", "ccs1"}


def merge(a, b):
    """Junta b por cima de a (dicionários em profundidade; listas e valores de b substituem)."""
    out = dict(a)
    for k, v in b.items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def ev_versions(src):
    out = []
    for base_path in glob.glob(os.path.join(src, "src", "*", "*", "base.json")):
        base = json.load(open(base_path, encoding="utf-8"))
        if base.get("vehicle_type") in ("van", "commercial", "cargo_van", "truck", "bus", "lcv", "light_commercial"):
            continue
        model_dir = os.path.dirname(base_path)
        for f in sorted(glob.glob(os.path.join(model_dir, "*", "*.json"))):
            v = json.load(open(f, encoding="utf-8"))
            # As versões só trazem o que muda: herdam o resto do ficheiro do modelo nesse ano
            year_base = os.path.join(os.path.dirname(f), base["model"]["slug"] + ".json")
            if f != year_base and os.path.exists(year_base):
                v = merge(json.load(open(year_base, encoding="utf-8")), v)
            markets = v.get("markets") or []
            if markets and not any(m in markets for m in ("PT", "ES", "FR", "DE", "IT", "NL", "BE", "GB", "EU")):
                continue
            bat = v.get("battery") or {}
            net, gross = bat.get("pack_capacity_kwh_net"), bat.get("pack_capacity_kwh_gross")
            fichas = []
            us = any(str(p.get("connector", "")).lower() in US_CONN for p in v.get("charge_ports") or [])
            for p in v.get("charge_ports") or []:
                for c in CONN.get(str(p.get("connector", "")).lower(), []):
                    if c not in fichas:
                        fichas.append(c)
            ch = v.get("charging") or {}
            ac = (ch.get("ac") or {}).get("max_power_kw")
            dc = (ch.get("dc") or {}).get("max_power_kw")
            wltp = next((r.get("range_km") for r in (v.get("range") or {}).get("rated", []) if r.get("cycle") == "wltp"), None)
            cap = net or gross
            cons = round(cap / wltp * 100 * 1.15, 1) if cap and wltp else None  # WLTP + 15% para uso real
            trim = (v.get("trim") or {}).get("name") or "Base"
            out.append({
                "marca": base["make"]["name"], "modelo": base["model"]["name"], "ano": v.get("year"),
                "versao": trim if trim.lower() != "base" else base["model"]["name"],
                "tipo": "eletrico", "bateria": cap, "bateriaTipo": "útil" if net else "bruta",
                "fichas": fichas or ["Mennekes"], "acKw": ac, "dcKw": dc, "consumoEletrico": cons,
                "fontes": [s.get("url") for s in v.get("sources") or [] if s.get("url")][:2],
                "origem": "OpenEV Data",
                **({"nota": "Fichas da versão europeia (CCS2); a fonte descreve a versão americana."} if us else {})
            })
    return out


def main():
    versions = []
    if len(sys.argv) > 1:
        seen, names = set(), {}
        for v in ev_versions(sys.argv[1]):
            key = (v["marca"], v["modelo"], v["ano"], v["versao"], v["bateria"], v["acKw"], v["dcKw"], tuple(v["fichas"]))
            if key in seen:
                continue  # duplicado exato
            seen.add(key)
            names.setdefault((v["marca"], v["modelo"], v["ano"], v["versao"]), []).append(v)
            versions.append(v)
        for group in names.values():  # mesmo nome, valores diferentes: distinguir pela bateria
            if len(group) > 1:
                for v in group:
                    v["versao"] = f'{v["versao"]} ({str(v["bateria"]).replace(".", ",")} kWh)'

    manual = json.load(open(os.path.join(ROOT, "data", "carros-manual.json"), encoding="utf-8"))["versoes"]
    for m in manual:
        m.setdefault("origem", "Manual")
    versions += manual
    versions.sort(key=lambda x: (x["marca"].lower(), x["modelo"].lower(), x["ano"] or 0, x["versao"].lower()))
    for i, v in enumerate(versions):
        v["id"] = f"c{i}"
    doc = {
        "gerado": __import__("datetime").date.today().isoformat(),
        "licencas": {
            "OpenEV Data": "Dados dos elétricos: OpenEV Data (https://open-ev-data.github.io), licença Community Data License Agreement – Permissive 2.0 (https://cdla.dev/permissive-2-0/).",
            "Manual": "Restantes versões: recolhidas à mão a partir das fontes indicadas em cada uma."
        },
        "versoes": versions,
    }
    with open(os.path.join(ROOT, "data", "carros.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(len(versions), "versões;", sum(v["tipo"] == "eletrico" for v in versions), "elétricas")


if __name__ == "__main__":
    main()
