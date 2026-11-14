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


def versao_do_ano(a: int) -> int:
    r = ler(SAIDA / str(a) / "resumo.json", {}) or {}
    return int(r.get("versao") or 1)


def fila(hoje: date) -> list[int]:
    """Ano atual, ano passado (até março), anos que faltam e anos gerados por versão antiga (do mais novo ao mais antigo)."""
    feitos = set(anos_feitos())
    faltam = sorted((a for a in range(config.ANO_INICIAL, hoje.year)
                     if a not in feitos or versao_do_ano(a) < config.VERSAO), reverse=True)
    return [hoje.year] + ([hoje.year - 1] if hoje.month <= 3 and hoje.year - 1 not in faltam else []) + [a for a in faltam if a != hoje.year]


_LISTAS_DO_DIA: set[int] = set()   # legislaturas já baixadas nesta execução


def senadores_do_ano(ano: int) -> tuple[list[dict], list[dict]]:
    """(senadores das legislaturas do ano, todos os senadores já vistos), com partido e UF da legislatura do ano."""
    cache_p = BRUTOS / "senadores.json"
    cache = {int(k): v for k, v in (ler(cache_p, {}) or {}).items()}
    legs = [n for n, (i, f) in config.LEGISLATURAS.items() if i <= ano <= f]
    for n in legs:
        if n in _LISTAS_DO_DIA:
            continue
        try:
            for s in S.ler_lista_senadores(http.get(config.LISTA_LEGISLATURA.format(ini=n, fim=n),
                                                    headers={"Accept": "application/json"}, timeout=90).json(), leg=n):
                c = cache.get(s["id"], {})
                s["legislaturas"] = sorted(set((c.get("legislaturas") or []) + [n]))
                # partido e UF guardados por legislatura (o partido muda ao longo da carreira)
                s["partido_leg"] = {**(c.get("partido_leg") or {}), **({str(n): s["partido"]} if s["partido"] else {})}
                s["uf_leg"] = {**(c.get("uf_leg") or {}), **({str(n): s["uf"]} if s["uf"] else {})}
                cache[s["id"]] = {**c, **{k: v for k, v in s.items() if v}}
            _LISTAS_DO_DIA.add(n)
        except Exception as e:  # noqa: BLE001
            log.warning("lista de senadores da legislatura %s indisponível (%s): usando o guardado", n, e)
    gravar(cache_p, {str(k): v for k, v in cache.items()})

    def do_ano(v: dict) -> dict:
        v = dict(v)
        for n in sorted(legs, reverse=True):
            if (v.get("partido_leg") or {}).get(str(n)):
                v["partido"] = v["partido_leg"][str(n)]
                break
        for n in sorted(legs, reverse=True):
            if (v.get("uf_leg") or {}).get(str(n)):
                v["uf"] = v["uf_leg"][str(n)]
                break
        return v
    todos = [do_ano(v) for v in cache.values()]
    return [v for v in todos if set(v.get("legislaturas") or []) & set(legs)], todos


def exercicios(sid: int, renovar: bool) -> tuple[list[tuple[str, str]], str]:
    """(períodos em exercício, UF do mandato). Guardado em dados_brutos/exercicios/{id}.json."""
    p = BRUTOS / "exercicios" / f"{sid}.json"
    guardado = ler(p)
    if isinstance(guardado, list):          # formato antigo (só os períodos, sem a UF): baixa de novo
        guardado = {"ex": guardado, "uf": None}
    if guardado is not None and guardado.get("uf") is not None and not renovar:
        return [tuple(x) for x in guardado["ex"]], guardado["uf"]
    try:
        js = http.get(config.MANDATOS.format(id=sid), headers={"Accept": "application/json"}, timeout=60).json()
        ex, uf = S.ler_exercicios(js), S.ler_uf_mandatos(js)
        gravar(p, {"ex": ex, "uf": uf})
        return ex, uf
    except Exception as e:  # noqa: BLE001
        log.warning("mandatos do senador %s indisponíveis (%s)", sid, e)
        g = guardado or {}
        return [tuple(x) for x in (g.get("ex") or [])], g.get("uf") or ""


def sid_sem_casar(nome_norm: str) -> str:
    return "n-" + nome_norm.lower().replace(" ", "-")[:40]


def processar_ano(ano: int, hoje: date, fatores: dict) -> dict:
    ult = 12 if ano < hoje.year else max(hoje.month - 1, 1)
    fechado = ano < hoje.year
    linhas_c = S.ler_ceaps(http.get(config.CEAPS_CSV.format(ano=ano), timeout=300).content)
    sens, todos = senadores_do_ano(ano)
    casam = S.casar_nomes({l["senador_norm"] for l in linhas_c}, sens, todos, config.APELIDOS_CEAPS)
    por_id = {s["id"]: s for s in sens}
    por_id_todos = {s["id"]: s for s in todos}
    for sid in set(casam.values()) - set(por_id):      # suplente fora da lista da legislatura, ou apelido
        por_id[sid] = por_id_todos.get(sid) or {"id": sid, "nome": "", "partido": "", "uf": "", "foto": ""}
    notas_dep = defaultdict(list)
    sem_casar = defaultdict(float)
    for l in linhas_c:
        sid = casam.get(l["senador_norm"])
        if sid is None:
            sid = sid_sem_casar(l["senador_norm"])
            sem_casar[l["senador"]] += l["valor"]
            por_id.setdefault(sid, {"id": sid, "nome": l["senador"].title(), "partido": "", "uf": "", "foto": ""})
        notas_dep[sid].append(l)
    if sem_casar:
        log.warning("%s: %d nome(s) da CEAPS sem senador correspondente: %s", ano, len(sem_casar), list(sem_casar)[:8])

    linhas = []
    for sid, s in por_id.items():
        ns = notas_dep.get(sid, [])
        ex, uf_mand = exercicios(sid, renovar=(ano >= hoje.year - 1)) if isinstance(sid, int) else ([], "")
        meses = S.meses_em_exercicio(ex, ano, ult) if ex else []
        if not meses and ns and isinstance(sid, int):
            # sem período de exercício neste ano (ex.: suplente que assumiu): meses com despesas, preenchendo buracos
            ms = sorted({n["mes"] for n in ns if 1 <= n["mes"] <= ult})
            meses = list(range(ms[0], ms[-1] + 1)) if ms else []
        # nome da CEAPS sem senador correspondente: só a cota entra (sem salário, para não contar o mesmo senador duas vezes)
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
        # quem viajou com a cota: valor da passagem dividido entre os passageiros citados
        viag = defaultdict(lambda: [0.0, 0])
        pax = {}
        for n in ns:
            ps = n.get("passageiros") or []
            for nome, vinc in ps:
                v = n["valor"] / len(ps)
                viag[vinc][0] += v
                viag[vinc][1] += 1
                q = pax.setdefault((nome, vinc), [nome, vinc, 0, 0.0])
                q[2] += 1
                q[3] += v
        linhas.append({
            "id": sid, "nome": s.get("nome", ""), "partido": s.get("partido", ""), "uf": s.get("uf", "") or uf_mand,
            "foto": (s.get("foto") or (config.FOTO_SENADOR.format(id=sid) if isinstance(sid, int) else "")).replace("http://", "https://", 1),
            "meses": len(meses), "custos": {"salario": c["salario"], "ceaps": c["ceaps"]}, "custo": c["total"],
            "categorias": {k: round(v, 2) for k, v in sorted(cats.items(), key=lambda x: -x[1])},
            "mensal_ceaps": [round(v, 2) for v in mes_cota], "notas": len(ns),
            "viagens": {k: [round(v[0], 2), v[1]] for k, v in sorted(viag.items(), key=lambda x: -x[1][0])},
            "casado": isinstance(sid, int),
            "previsao": S.prever(ano, ult, meses, mes_cota, isinstance(sid, int) and S.ativo_no_fim(ex, ano, hoje)) if not fechado else None,
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
            # passageiros das passagens pagas pela cota: [nome, vínculo, trechos, valor]
            "passageiros": sorted([[a, b, c_, round(d, 2)] for a, b, c_, d in pax.values()], key=lambda x: -x[3]),
        })
    # apaga notas de senadores que não estão mais no ano (ex.: nome que antes não casava)
    feitos_ids = {f"{l['id']}.json" for l in linhas}
    for p in (SAIDA / str(ano) / "notas").glob("*.json"):
        if p.name not in feitos_ids:
            p.unlink()
    linhas.sort(key=lambda x: -x["custo"])
    for i, l in enumerate(linhas, 1):
        l["posicao"] = i

    # fornecedores: todos, com quem pagou e as maiores notas
    fz = {}
    for l in linhas_c:
        sid = casam.get(l["senador_norm"]) or sid_sem_casar(l["senador_norm"])
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
    prev = None
    if not fechado:
        rest = sum((l.get("previsao") or {}).get("restante", 0) for l in linhas)
        ja = sum(l["custo"] for l in linhas)
        prev = {"ja_gasto": round(ja, 2), "restante": round(rest, 2), "total_ano": round(ja + rest, 2),
                "ceaps_restante": round(sum((l.get("previsao") or {}).get("ceaps", 0) for l in linhas), 2)}
        gravar_semana(linhas_c, casam, por_id, ano, hoje)
    resumo = {"ano": ano, "versao": config.VERSAO, "meses_decorridos": ult, "fechado": fechado, "senadores": linhas, "previsao": prev,
              "total": round(sum(l["custo"] for l in linhas), 2), "total_ceaps": round(sum(l["custos"]["ceaps"] for l in linhas), 2),
              "fator_ipca": fatores.get(str(ano), fatores.get(ano, 1.0)), "sem_casar": {k: round(v, 2) for k, v in sem_casar.items()}}
    gravar(SAIDA / str(ano) / "resumo.json", resumo)
    log.info("%s: %d senadores, CEAPS R$ %.2f, custo R$ %.2f", ano, len(linhas), resumo["total_ceaps"], resumo["total"])
    return resumo


def gravar_semana(linhas_c: list[dict], casam: dict, por_id: dict, ano: int, hoje: date, dias: int = 7):
    """Notas da semana: as emitidas nos 7 dias que terminam na nota mais recente já publicada (até hoje).
    docs/dados/AAAA/semana.json -> [data, id, nome, partido, UF, tipo, fornecedor, documento do fornecedor,
                                    valor, nº do documento, detalhamento]"""
    from datetime import timedelta
    datas = [l["data"] for l in linhas_c if l["data"] and l["data"] <= hoje.isoformat()]
    if not datas:
        return
    fim = max(datas)
    ini = (date.fromisoformat(fim) - timedelta(days=dias - 1)).isoformat()
    notas = []
    for l in linhas_c:
        if not l["data"] or not (ini <= l["data"] <= fim):
            continue
        sid = casam.get(l["senador_norm"]) or sid_sem_casar(l["senador_norm"])
        s = por_id.get(sid) or {}
        notas.append([l["data"], sid, s.get("nome") or l["senador"].title(), s.get("partido", ""), s.get("uf", ""),
                      S.tipo_curto(l["tipo"]), l["fornecedor"], l["doc"], l["valor"], l["documento"], l["detalhe"]])
    notas.sort(key=lambda x: (x[0], -x[8]), reverse=True)
    gravar(SAIDA / str(ano) / "semana.json", {"ano": ano, "de": ini, "ate": fim, "gerado_em": datetime.now(timezone.utc).isoformat(timespec="minutes"),
                                              "total": round(sum(n[8] for n in notas), 2), "notas": notas})
    log.info("%s: notas da semana de %s a %s: %d notas", ano, ini, fim, len(notas))


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
    # fotografia do mês: equipe dos gabinetes, auxílio-moradia e imóvel funcional (a API não tem histórico)
    try:
        from coletor import gabinetes as G
        foto = {"data": hoje.isoformat()}
        serv = http.get(G.API + "/servidores?formato=json", timeout=300).json().get("data") or []
        foto["servidores_total"] = len(serv)
        foto["gabinetes"] = G.resumir_servidores(serv)
        foto["auxilio_imovel"] = G.ler_auxilio(http.get(G.API + "/senadores/auxilio-moradia-imoveis-funcionais?formato=json", timeout=120).json())
        try:
            foto["escritorios_apoio"] = http.get(G.ERGON + "/escritorios-apoio?formato=json", timeout=120).json().get("data")
        except Exception as e:  # noqa: BLE001
            foto["escritorios_apoio_erro"] = str(e)
        gravar(BRUTOS / "gabinetes" / f"{hoje:%Y-%m}.json", foto)
        # publica a equipe de cada gabinete, ligada ao senador (mesmo casamento de nomes da CEAPS)
        sens, todos = senadores_do_ano(hoje.year)
        eq = G.equipes(serv)
        cas = S.casar_nomes(set(eq) | {S.norm(a["nome"]) for a in foto["auxilio_imovel"]}, sens, todos, config.APELIDOS_CEAPS)
        por = {}
        for g, pessoas in eq.items():
            sid = cas.get(g)
            if sid is None:
                continue
            r = foto["gabinetes"].get(g, {})
            por[str(sid)] = {"gabinete": g, "total": len(pessoas), "comissionados": r.get("comissionados", 0),
                             "efetivos": r.get("efetivos", 0), "funcoes": r.get("funcoes", {}), "pessoas": pessoas}
        for a in foto["auxilio_imovel"]:
            sid = cas.get(S.norm(a["nome"]))
            if sid is not None:
                por.setdefault(str(sid), {}).update({"auxilio_moradia": a["auxilio_moradia"], "imovel_funcional": a["imovel_funcional"]})
        gravar(SAIDA / "gabinetes.json", {"data": hoje.isoformat(), "fonte": "Senado Federal — dados abertos administrativos",
                                          "auxilio_moradia_valor": 5500.0, "por_senador": por,
                                          "sem_casar": sorted(g for g in eq if g not in cas)})
        log.info("gabinetes: %d servidores, %d gabinetes, %d senadores na lista de auxílio/imóvel",
                 len(serv), len(foto["gabinetes"]), len(foto["auxilio_imovel"]))
    except Exception as e:  # noqa: BLE001
        log.warning("fotografia dos gabinetes indisponível: %s", e)
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
