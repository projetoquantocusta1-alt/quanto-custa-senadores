"""Robô diário: custo dos senadores (Senado Federal — dados abertos) -> site em docs/.

Uso:
    python atualizar.py                 # ano atual + anos que ainda faltam (do mais recente ao mais antigo)
    python atualizar.py --anos 2024 2025
    python atualizar.py --minutos 300   # limite de tempo da execução
"""
import argparse
import json
import logging
import sys
import time
import traceback
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import config
from coletor import http, ipca
from coletor import senado as S

RAIZ = Path(__file__).parent
SAIDA = RAIZ / "docs" / "dados"
BRUTOS = RAIZ / "dados_brutos"
log = logging.getLogger("qcs")


def ler(p: Path, padrao=None):
    try:
        return json.loads(p.read_text("utf-8")) if p.exists() else padrao
    except json.JSONDecodeError:
        return padrao


def gravar(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), "utf-8")
    tmp.replace(p)


def anos_feitos():
    return sorted(int(p.parent.name) for p in SAIDA.glob("*/resumo.json") if p.parent.name.isdigit())


def fila(hoje: date) -> list[int]:
    feitos = set(anos_feitos())
    faltam = sorted((a for a in range(config.ANO_INICIAL, hoje.year) if a not in feitos), reverse=True)
    return [hoje.year] + ([hoje.year - 1] if hoje.month <= 3 and hoje.year - 1 not in faltam else []) + faltam


def senadores_do_ano(ano: int) -> list[dict]:
    cache_p = BRUTOS / "senadores.json"
    cache = {int(k): v for k, v in (ler(cache_p, {}) or {}).items()}
    legs = [n for n, (i, f) in config.LEGISLATURAS.items() if i <= ano <= f]
    for n in legs:
        try:
            for s in S.ler_lista_senadores(http.get(config.LISTA_LEGISLATURA.format(ini=n, fim=n),
                                                    headers={"Accept": "application/json"}, timeout=90).json()):
                s["legislaturas"] = sorted(set((cache.get(s["id"], {}).get("legislaturas") or []) + [n]))
                cache[s["id"]] = {**cache.get(s["id"], {}), **{k: v for k, v in s.items() if v}}
        except Exception as e:  # noqa: BLE001
            log.warning("lista de senadores da legislatura %s indisponível (%s): usando o guardado", n, e)
    gravar(cache_p, {str(k): v for k, v in cache.items()})
    return [v for v in cache.values() if set(v.get("legislaturas") or []) & set(legs)]


def exercicios(sid: int, renovar: bool) -> list[tuple[str, str]]:
    p = BRUTOS / "exercicios" / f"{sid}.json"
    guardado = ler(p)
    if guardado is not None and not renovar:
        return [tuple(x) for x in guardado]
    try:
        ex = S.ler_exercicios(http.get(config.MANDATOS.format(id=sid), headers={"Accept": "application/json"}, timeout=60).json())
        gravar(p, ex)
        return ex
    except Exception as e:  # noqa: BLE001
        log.warning("mandatos do senador %s indisponíveis (%s)", sid, e)
        return [tuple(x) for x in (guardado or [])]


def processar_ano(ano: int, hoje: date, fatores: dict) -> dict:
    ult = 12 if ano < hoje.year else max(hoje.month - 1, 1)
    fechado = ano < hoje.year
    linhas_c = S.ler_ceaps(http.get(config.CEAPS_CSV.format(ano=ano), timeout=300).content)
    sens = senadores_do_ano(ano)
    casam = S.casar_nomes({l["senador_norm"] for l in linhas_c}, sens)
    por_id = {s["id"]: s for s in sens}
    notas_dep = defaultdict(list)
    sem_casar = defaultdict(float)
    for l in linhas_c:
        sid = casam.get(l["senador_norm"])
        if sid is None:
            sid = "n-" + l["senador_norm"].lower().replace(" ", "-")[:40]
            sem_casar[l["senador"]] += l["valor"]
            por_id.setdefault(sid, {"id": sid, "nome": l["senador"].title(), "partido": "", "uf": "", "foto": ""})
        notas_dep[sid].append(l)
    if sem_casar:
        log.warning("%s: %d nome(s) da CEAPS sem senador correspondente: %s", ano, len(sem_casar), list(sem_casar)[:8])

    linhas = []
    for sid, s in por_id.items():
        ns = notas_dep.get(sid, [])
        ex = exercicios(sid, renovar=(ano >= hoje.year - 1)) if isinstance(sid, int) else []
        meses = S.meses_em_exercicio(ex, ano, ult) if ex else []
        if not meses and ns:     # sem dados de mandato: meses com despesas, preenchendo buracos
            ms = sorted({n["mes"] for n in ns if 1 <= n["mes"] <= ult})
            meses = list(range(ms[0], ms[-1] + 1)) if ms else []
        if not meses and not ns:
            continue
        tot = round(sum(n["valor"] for n in ns), 2)
        cats = defaultdict(float)
        mes_cota = [0.0] * 12
        for n in ns:
            cats[S.tipo_curto(n["tipo"])] += n["valor"]
            if 1 <= n["mes"] <= 12:
                mes_cota[n["mes"] - 1] += n["valor"]
        c = S.custo(ano, meses, tot, fechado)
        linhas.append({
            "id": sid, "nome": s.get("nome", ""), "partido": s.get("partido", ""), "uf": s.get("uf", ""),
            "foto": s.get("foto") or (config.FOTO_SENADOR.format(id=sid) if isinstance(sid, int) else ""),
            "meses": len(meses), "custos": {"salario": c["salario"], "ceaps": c["ceaps"]}, "custo": c["total"],
            "categorias": {k: round(v, 2) for k, v in sorted(cats.items(), key=lambda x: -x[1])},
            "mensal_ceaps": [round(v, 2) for v in mes_cota], "notas": len(ns),
            "url": config.URL_SENADOR.format(id=sid) if isinstance(sid, int) else "",
        })
        # notas nota a nota: [data, mês, tipo, chave, valor, documento, detalhe]
        forn = {}
        for n in ns:
            forn.setdefault(n["chave"], [n["chave"], n["fornecedor"], n["doc"], n["tipo_doc"]])
        gravar(SAIDA / str(ano) / "notas" / f"{sid}.json", {
            "fornecedores": forn,
            "notas": sorted([[n["data"], n["mes"], S.tipo_curto(n["tipo"]), n["chave"], n["valor"], n["documento"], n["detalhe"]]
                             for n in ns], key=lambda x: (x[0] or "", -x[4])),
        })
    linhas.sort(key=lambda x: -x["custo"])
    for i, l in enumerate(linhas, 1):
        l["posicao"] = i

    # fornecedores: todos, com quem pagou e as maiores notas
    fz = {}
    for l in linhas_c:
        sid = casam.get(l["senador_norm"]) or "n-" + l["senador_norm"].lower().replace(" ", "-")[:40]
        f = fz.setdefault(l["chave"], {"chave": l["chave"], "nome": l["fornecedor"], "doc": l["doc"], "tipo": l["tipo_doc"],
                                       "valor": 0.0, "notas": 0, "senadores": defaultdict(lambda: [0.0, 0]), "tipos": defaultdict(float), "maiores": []})
        f["valor"] += l["valor"]
        f["notas"] += 1
        f["senadores"][sid][0] += l["valor"]
        f["senadores"][sid][1] += 1
        f["tipos"][S.tipo_curto(l["tipo"])] += l["valor"]
        f["maiores"].append([l["data"], l["valor"], sid, l["documento"], l["detalhe"]])
    lista = []
    for f in sorted(fz.values(), key=lambda x: -x["valor"]):
        lista.append([f["chave"], f["nome"], f["doc"], f["tipo"], round(f["valor"], 2), f["notas"],
                      sorted([[k, round(v[0], 2), v[1]] for k, v in f["senadores"].items()], key=lambda x: -x[1]),
                      {k: round(v, 2) for k, v in sorted(f["tipos"].items(), key=lambda x: -x[1])},
                      sorted(f["maiores"], key=lambda x: -x[1])[:10]])
    gravar(SAIDA / str(ano) / "fornecedores.json", {"ano": ano, "linhas": lista})
    resumo = {"ano": ano, "meses_decorridos": ult, "fechado": fechado, "senadores": linhas,
              "total": round(sum(l["custo"] for l in linhas), 2), "total_ceaps": round(sum(l["custos"]["ceaps"] for l in linhas), 2),
              "fator_ipca": fatores.get(str(ano), fatores.get(ano, 1.0)), "sem_casar": {k: round(v, 2) for k, v in sem_casar.items()}}
    gravar(SAIDA / str(ano) / "resumo.json", resumo)
    log.info("%s: %d senadores, CEAPS R$ %.2f, custo R$ %.2f", ano, len(linhas), resumo["total_ceaps"], resumo["total"])
    return resumo


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--anos", type=int, nargs="*")
    ap.add_argument("--minutos", type=float, default=300)
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    hoje, inicio = date.today(), time.time()
    try:
        ip = ipca.fatores_por_ano(ipca.baixar_ipca(config.ANO_INICIAL))
        gravar(BRUTOS / "ipca.json", ip)
    except Exception as e:  # noqa: BLE001
        log.warning("IPCA indisponível (%s)", e)
        ip = ler(BRUTOS / "ipca.json", {"fatores": {}, "referencia": None})
    fat = {str(k): v for k, v in (ip.get("fatores") or {}).items()}
    status = {}
    for ano in (args.anos or fila(hoje)):
        if time.time() - inicio > args.minutos * 60 - 15 * 60:
            log.info("limite de tempo: o resto fica para a próxima execução")
            break
        try:
            processar_ano(ano, hoje, fat)
            status[ano] = "ok"
        except Exception as e:  # noqa: BLE001
            status[ano] = f"erro: {e}"
            log.error("%s falhou: %s", ano, e)
            traceback.print_exc()
    # fator de cada ano já publicado (o IPCA muda todo mês)
    for a in anos_feitos():
        r = ler(SAIDA / str(a) / "resumo.json")
        if r and r.get("fator_ipca") != fat.get(str(a), r.get("fator_ipca")):
            r["fator_ipca"] = fat[str(a)]
            gravar(SAIDA / str(a) / "resumo.json", r)
    gravar(SAIDA / "meta.json", {"gerado_em": datetime.now(timezone.utc).isoformat(timespec="minutes"),
                                 "anos": anos_feitos(), "ipca_referencia": ip.get("referencia"), "status": {str(k): v for k, v in status.items()}})
    log.info("Fim: %s", status)
    return 0 if any(v == "ok" for v in status.values()) else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        sys.exit(1)
