"""Coleta e cálculo do custo dos senadores (Senado Federal — dados abertos).

CEAPS (cota para o exercício da atividade parlamentar dos senadores):
  despesa_ceaps_AAAA.csv — latin-1, ";" — a primeira linha costuma ser
  "ULTIMA ATUALIZACAO";"dd/mm/aaaa"; o cabeçalho vem depois. Valores com vírgula.
"""
import csv
import hashlib
import io
import re
import unicodedata
from datetime import date

import config


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z ]", " ", s)).strip()


def br_float(v) -> float:
    s = str(v or "").strip().replace("R$", "").replace(" ", "")
    if not s:
        return 0.0
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _dig(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


def chave_e_doc(doc_bruto: str, nome: str) -> tuple[str, str, str]:
    """(chave interna, documento para exibir, PJ/PF/—). CPF nunca é guardado inteiro."""
    d = _dig(doc_bruto)
    if len(d) == 14:
        return d, f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}", "PJ"
    if len(d) == 11:
        return "pf" + hashlib.sha1(d.encode()).hexdigest()[:12], f"***.{d[3:6]}.{d[6:9]}-**", "PF"
    base = re.sub(r"[^a-z0-9]+", "-", str(nome).lower()).strip("-")[:24] or "sem-nome"
    return "sd-" + base, "", "—"


def _data(s: str) -> str:
    s = (s or "").strip()
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    return m.group(0) if m else ""


def ler_ceaps(conteudo: bytes) -> list[dict]:
    """Linhas normalizadas: ano, mes, senador, tipo, doc, chave, tipo_doc, fornecedor, documento, data, detalhe, valor, cod."""
    for enc in ("utf-8-sig", "latin-1"):
        try:
            txt = conteudo.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    linhas = txt.splitlines()
    ini = next((i for i, l in enumerate(linhas[:10]) if "SENADOR" in l.upper() and "VALOR" in l.upper()), None)
    if ini is None:
        raise ValueError("cabeçalho da CEAPS não encontrado")
    leitor = csv.DictReader(io.StringIO("\n".join(linhas[ini:])), delimiter=";")
    out = []
    for r in leitor:
        r = {norm(k).replace(" ", "_"): (v or "").strip() for k, v in r.items() if k}
        sen = r.get("SENADOR", "")
        if not sen:
            continue
        valor = br_float(r.get("VALOR_REEMBOLSADO") or r.get("VALOR"))
        forn = re.sub(r"\s+", " ", r.get("FORNECEDOR", "")).strip()
        chave, doc, td = chave_e_doc(r.get("CNPJ_CPF", ""), forn)
        out.append({
            "ano": int(_dig(r.get("ANO")) or 0), "mes": int(_dig(r.get("MES")) or 0), "senador": sen, "senador_norm": norm(sen),
            "tipo": re.sub(r"\s+", " ", r.get("TIPO_DESPESA", "")).strip(), "chave": chave, "doc": doc, "tipo_doc": td,
            "fornecedor": forn, "documento": r.get("DOCUMENTO", "")[:40], "data": _data(r.get("DATA", "")),
            "detalhe": re.sub(r"\s+", " ", r.get("DETALHAMENTO", "")).strip()[:200], "valor": round(valor, 2),
            "cod": r.get("COD_DOCUMENTO", ""),
        })
    return out


# Nomes curtos para os tipos de despesa da CEAPS (o texto oficial é longo)
TIPOS_CURTOS = [
    ("aluguel de imove", "Aluguel de imóveis e despesas do escritório"),
    ("aquisicao de material de consumo", "Material de consumo do escritório"),
    ("contratacao de consultorias", "Consultorias, assessorias e pesquisas"),
    ("divulgacao", "Divulgação da atividade parlamentar"),
    ("locomocao", "Locomoção, hospedagem, alimentação e combustíveis"),
    ("passagens aereas", "Passagens aéreas, aquáticas e terrestres"),
    ("seguranca", "Serviços de segurança privada"),
]


def tipo_curto(t: str) -> str:
    n = norm(t).lower()
    for chave, nome in TIPOS_CURTOS:
        if chave in n:
            return nome
    return t or "Outros"


# ------------------------------------------------------------- senadores
def _lista(obj, *caminho):
    for c in caminho:
        if isinstance(obj, dict):
            obj = obj.get(c)
        else:
            return []
    if obj is None:
        return []
    return obj if isinstance(obj, list) else [obj]


def ler_lista_senadores(js: dict) -> list[dict]:
    """Aceita a lista atual e a lista por legislatura da API do Senado."""
    parl = (_lista(js, "ListaParlamentarLegislatura", "Parlamentares", "Parlamentar")
            or _lista(js, "ListaParlamentarEmExercicio", "Parlamentares", "Parlamentar"))
    out = []
    for p in parl:
        i = p.get("IdentificacaoParlamentar") or {}
        cod = str(i.get("CodigoParlamentar") or "").strip()
        if not cod.isdigit():
            continue
        out.append({"id": int(cod), "nome": i.get("NomeParlamentar") or "", "nome_completo": i.get("NomeCompletoParlamentar") or "",
                    "partido": i.get("SiglaPartidoParlamentar") or "", "uf": i.get("UfParlamentar") or "",
                    "sexo": i.get("SexoParlamentar") or "", "foto": i.get("UrlFotoParlamentar") or ""})
    return out


def ler_exercicios(js: dict) -> list[tuple[str, str]]:
    """Períodos em exercício [(início, fim ou "")] a partir de /senador/{id}/mandatos."""
    out = []
    for m in _lista(js, "MandatoParlamentar", "Parlamentar", "Mandatos", "Mandato"):
        for e in _lista(m, "Exercicios", "Exercicio"):
            ini = (e.get("DataInicio") or "")[:10]
            if ini:
                out.append((ini, (e.get("DataFim") or "")[:10]))
    return sorted(set(out))


def meses_em_exercicio(exercicios: list[tuple[str, str]], ano: int, ultimo_mes: int) -> list[int]:
    meses = set()
    for ini, fim in exercicios:
        a_ini = date.fromisoformat(ini)
        a_fim = date.fromisoformat(fim) if fim else date(9999, 12, 31)
        for m in range(1, ultimo_mes + 1):
            p, u = date(ano, m, 1), date(ano, m, 28)
            if a_ini <= u and a_fim >= p:
                meses.add(m)
    return sorted(meses)


def casar_nomes(ceaps_nomes: set[str], senadores: list[dict]) -> dict[str, int]:
    """Nome que aparece na CEAPS -> código do senador (nome parlamentar ou completo, sem acento)."""
    idx = {}
    for s in senadores:
        for n in (s["nome"], s["nome_completo"]):
            if n:
                idx.setdefault(norm(n), set()).add(s["id"])
    out = {}
    for n in ceaps_nomes:
        ids = idx.get(n)
        if ids and len(ids) == 1:
            out[n] = next(iter(ids))
    return out


# ------------------------------------------------------------- custo
def custo(ano: int, meses: list[int], ceaps_total: float, ano_fechado: bool) -> dict:
    """Salário (subsídio × meses em exercício + 13º proporcional em ano fechado) + CEAPS."""
    subs = [config.valor_vigente(config.SUBSIDIO, date(ano, m, 1)) for m in meses]
    salario = sum(subs)
    decimo = (subs[-1] * len(meses) / 12) if (subs and ano_fechado) else 0.0
    return {"salario": round(salario + decimo, 2), "ceaps": round(ceaps_total, 2),
            "total": round(salario + decimo + ceaps_total, 2)}
