"""Robô da Receita Federal: cadastro e sócios dos fornecedores da cota dos senadores (CEAPS).

Uso:
    python receita.py            # só processa se houver base nova da Receita
    python receita.py --forcar   # refaz mesmo com a mesma base

Roda pelo GitHub Actions (receita.yml), uma vez por semana: confere se a Receita
publicou uma base nova (é mensal) e, se sim, baixa e processa. O módulo que lê os
arquivos da Receita (coletor/receita.py) é o mesmo do repositório dos deputados.

Saídas:
    docs/dados/receita/meta.json            -> base usada, fonte, data, contagens
    docs/dados/receita/cadastro/XX.json     -> cadastro + sócios de cada fornecedor (CNPJ),
                                               em grupos (XX = 2 primeiros dígitos do CNPJ)
    docs/dados/receita/alertas.json         -> pontos de atenção (empresa aberta pouco antes
                                               do 1º pagamento, inativa, MEI acima do limite)
"""
import argparse
import json
import logging
import os
import shutil
import sys
import tempfile
import traceback
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import config
from coletor import receita

RAIZ = Path(__file__).parent
SAIDA = RAIZ / "docs" / "dados"
log = logging.getLogger("qcs")


def ler(p: Path, padrao=None):
    try:
        return json.loads(p.read_text("utf-8")) if p.exists() else padrao
    except json.JSONDecodeError:
        return padrao


def gravar(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), "utf-8")


def grupo(c14: str) -> str:
    """Arquivo de cadastro do CNPJ (o site calcula igual em JavaScript)."""
    return c14[:2]


def pagamentos_por_cnpj() -> dict[str, dict]:
    """{cnpj14: {"anos": {ano: valor}, "primeira": data da 1ª nota}} a partir das notas publicadas."""
    out: dict[str, dict] = defaultdict(lambda: {"anos": defaultdict(float), "primeira": None, "ultima": None, "senadores": set()})
    for p in SAIDA.glob("*/notas/*.json"):
        if not p.parent.parent.name.isdigit():
            continue
        ano = int(p.parent.parent.name)
        d = ler(p, {}) or {}
        forn = d.get("fornecedores") or {}
        for n in d.get("notas") or []:
            ch = n[3]
            if not (len(ch) == 14 and ch.isdigit()) or (forn.get(ch) or [None, None, None, ""])[3] != "PJ":
                continue
            x = out[ch]
            x["anos"][ano] += n[4]
            x["senadores"].add(p.stem)
            if n[0] and (x["primeira"] is None or n[0] < x["primeira"]):
                x["primeira"] = n[0]
            if n[0] and (x["ultima"] is None or n[0] > x["ultima"]):
                x["ultima"] = n[0]
    return out


def br(d: str) -> str:
    return "/".join(reversed(d.split("-"))) if d else ""


def alertas(cadastro: dict, pags: dict) -> list[list]:
    """[cnpj, tipo, texto] — fatos verificáveis, nunca acusação."""
    out = []
    for c14, cad in cadastro.items():
        pg = pags.get(c14)
        if not pg or cad.get("nao_encontrado"):
            continue
        ab, pri = cad.get("abertura"), pg["primeira"]
        if ab and pri:
            try:
                dias = (date.fromisoformat(pri) - date.fromisoformat(ab)).days
            except ValueError:
                dias = None
            if dias is not None and 0 <= dias <= 180:
                out.append([c14, "aberta_antes", f"Empresa aberta em {br(ab)}, {dias} dia(s) antes da primeira nota paga pela cota ({br(pri)})."])
            elif dias is not None and dias < 0:
                out.append([c14, "pago_antes_abertura", f"Primeira nota ({br(pri)}) com data anterior à abertura da empresa ({br(ab)})."])
        # só é ponto de atenção se a empresa já não estava ativa quando recebeu (fechar anos depois é normal)
        sit, dsit, ult = (cad.get("situacao") or "").upper(), cad.get("data_situacao"), pg.get("ultima")
        if sit and sit != "ATIVA" and dsit and ult and dsit <= ult:
            out.append([c14, "situacao", f"Recebeu da cota em {br(ult)}, mas está {sit} na Receita desde {br(dsit)}."])
        sim = cad.get("simples") or {}
        if sim.get("mei"):
            for ano, v in sorted(pg["anos"].items()):
                if v > config.MEI_LIMITE:
                    out.append([c14, "mei_limite", f"MEI que recebeu R$ {v:,.2f} da cota em {ano}, acima do limite anual de faturamento do MEI (R$ {config.MEI_LIMITE:,.2f})."
                                .replace(",", "X").replace(".", ",").replace("X", ".")])
    return out


def refazer_alertas() -> int:
    """Refaz alertas.json com o cadastro já publicado (sem baixar a Receita de novo)."""
    pasta = SAIDA / "receita"
    cad = {}
    for p in (pasta / "cadastro").glob("*.json"):
        cad.update(ler(p, {}) or {})
    meta = ler(pasta / "meta.json", {}) or {}
    al = alertas(cad, pagamentos_por_cnpj())
    gravar(pasta / "alertas.json", {"base": meta.get("base"), "linhas": al})
    meta["alertas"] = len(al)
    gravar(pasta / "meta.json", meta)
    return len(al)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--forcar", action="store_true", help="refaz mesmo se a base for a mesma")
    ap.add_argument("--pasta-tmp", help="onde guardar os arquivos baixados (padrão: pasta temporária)")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    pasta = SAIDA / "receita"
    meta = ler(pasta / "meta.json", {}) or {}
    try:
        loc = receita.descobrir()
    except receita.ReceitaIndisponivel as e:
        log.error("%s", e)
        return 1
    pags = pagamentos_por_cnpj()
    alvos = set(pags)
    feitos = set(ler(RAIZ / "dados_brutos" / "receita_cnpjs.json", []) or [])
    if loc["mes"] == meta.get("base") and not args.forcar and feitos >= alvos:
        log.info("Receita: base %s já processada para todos os fornecedores. Nada a fazer.", loc["mes"])
        return 0
    if not alvos:
        log.error("Nenhum fornecedor com CNPJ nos dados do site: rode o robô principal antes.")
        return 1
    invalidos = sorted(c for c in alvos if not receita.cnpj_valido(c))
    log.info("Receita: %d CNPJs de fornecedores (%d com dígito verificador inválido)", len(alvos), len(invalidos))
    tmp = Path(args.pasta_tmp or os.environ.get("RUNNER_TEMP") or tempfile.gettempdir()) / "receita_cnpj"
    try:
        res = receita.coletar(alvos, {}, tmp, loc=loc)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    grupos: dict[str, dict] = {}
    for c14, x in res["cadastro"].items():
        grupos.setdefault(grupo(c14), {})[c14] = x
    shutil.rmtree(pasta / "cadastro", ignore_errors=True)
    for g, conteudo in grupos.items():
        gravar(pasta / "cadastro" / f"{g}.json", conteudo)
    al = alertas(res["cadastro"], pags)
    gravar(pasta / "alertas.json", {"base": res["base"], "linhas": al})
    gravar(pasta / "meta.json", {
        "base": res["base"], "fonte": res["fonte"],
        "processado_em": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "estatisticas": res["estatisticas"], "cnpjs_invalidos": len(invalidos), "alertas": len(al),
    })
    gravar(RAIZ / "dados_brutos" / "receita_cnpjs.json", sorted(alvos))
    log.info("Receita: %s · %d alertas", res["estatisticas"], len(al))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        sys.exit(1)
