"""Correção monetária pelo IPCA (série 433 do SGS / Banco Central).

Gera, para cada ano, o fator que leva os valores daquele ano para preços do
último mês com IPCA divulgado. Usa o índice médio do ano como referência
(os gastos se espalham ao longo dos meses).
"""
import config
from coletor import http


def baixar_ipca(ano_inicial: int) -> list[tuple[int, int, float]]:
    r = http.get(config.IPCA_SGS.format(ano=ano_inicial), headers={"Accept": "application/json"})
    out = []
    for item in r.json():
        d, m, a = item["data"].split("/")
        out.append((int(a), int(m), float(item["valor"])))
    return sorted(out)


def fatores_por_ano(serie: list[tuple[int, int, float]]) -> dict:
    """{'fatores': {ano: fator}, 'referencia': 'MM/AAAA'}"""
    if not serie:
        return {"fatores": {}, "referencia": None}
    indice, nivel = {}, 100.0
    for a, m, v in serie:
        nivel *= 1 + v / 100
        indice[(a, m)] = nivel
    ult = max(indice)
    por_ano: dict[int, list[float]] = {}
    for (a, _), v in indice.items():
        por_ano.setdefault(a, []).append(v)
    fatores = {a: round(indice[ult] / (sum(v) / len(v)), 6) for a, v in por_ano.items()}
    return {"fatores": fatores, "referencia": f"{ult[1]:02d}/{ult[0]}"}
