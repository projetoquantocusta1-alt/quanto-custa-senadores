"""Equipe dos gabinetes, auxílio-moradia e imóvel funcional (API de dados abertos administrativos do Senado).

Fontes (adm.senado.gov.br):
  /adm-dadosabertos/api/v1/servidores?formato=json      -> servidores ativos: vínculo, função, lotação
                                                          (hierarquia "GABINETE DO SENADOR X")
  /adm-dadosabertos/api/v1/senadores/auxilio-moradia-imoveis-funcionais?formato=json
                                                       -> por senador: recebe auxílio-moradia (S/N), ocupa imóvel funcional (S/N)
  /ergon-ng-reports/api/v1/escritorios-apoio?formato=json -> escritórios de apoio nos estados
A API só traz a situação de hoje (não tem histórico): o robô guarda uma fotografia por mês.
Os nomes dos servidores dos gabinetes são públicos (o Senado publica a lista) e aparecem no site, com função,
vínculo e data de admissão. Nada além disso (CPF, endereço etc.) é guardado.
"""
import re
import unicodedata
from collections import Counter, defaultdict

API = "https://adm.senado.gov.br/adm-dadosabertos/api/v1"
ERGON = "https://adm.senado.gov.br/ergon-ng-reports/api/v1"


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z ]", " ", s)).strip()


def gabinete_de(hierarquia: list[dict]) -> str | None:
    """'GABINETE DO SENADOR ROGÉRIO CARVALHO' -> 'ROGERIO CARVALHO' (também 'DA SENADORA')."""
    for h in hierarquia or []:
        m = re.search(r"GABINETE D[OA] SENADOR[A]? (.+)$", h.get("nome") or "", re.I)
        if m:
            return _norm(m.group(1))
    return None


def resumir_servidores(servidores: list[dict]) -> dict:
    """{gabinete: {"total", "comissionados", "efetivos", "funcoes": {função: n}}} (sem nomes)."""
    gab: dict[str, dict] = defaultdict(lambda: {"total": 0, "comissionados": 0, "efetivos": 0, "outros": 0, "funcoes": Counter()})
    for s in servidores or []:
        g = gabinete_de(s.get("hierarquiaCompleta"))
        if not g:
            continue
        x = gab[g]
        x["total"] += 1
        v = (s.get("tipoVinculo") or "").upper()
        x["comissionados" if "COMISSION" in v else "efetivos" if "EFETIV" in v else "outros"] += 1
        x["funcoes"][s.get("funcao") or "(sem função)"] += 1
    return {g: {**x, "funcoes": dict(x["funcoes"].most_common())} for g, x in sorted(gab.items())}


def ler_auxilio(js: dict) -> list[dict]:
    return [{"nome": d.get("nomeParlamentar") or "", "uf": d.get("estadoEleito") or "", "partido": d.get("partidoEleito") or "",
             "auxilio_moradia": (d.get("auxilioMoradia") or "").upper() == "S", "imovel_funcional": (d.get("imovelFuncional") or "").upper() == "S"}
            for d in (js or {}).get("data") or []]


def equipes(servidores: list[dict]) -> dict:
    """{gabinete: [[nome, função, vínculo, admissão], ...]} dos servidores lotados em gabinetes de senadores."""
    out: dict[str, list] = defaultdict(list)
    for s in servidores or []:
        g = gabinete_de(s.get("hierarquiaCompleta"))
        if g:
            out[g].append([re.sub(r"\s+", " ", s.get("nome") or "").strip(), s.get("funcao") or "", s.get("tipoVinculo") or "",
                           s.get("dataAdmissao") or ""])
    return {g: sorted(v, key=lambda x: (x[1], x[0])) for g, v in out.items()}
