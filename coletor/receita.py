"""Receita Federal (dados abertos do CNPJ): cadastro e sócios dos fornecedores. Mesmo módulo do repositório dos deputados.

A Receita publica todo mês o cadastro completo das empresas em arquivos
compactados (CSV separado por ";", aspas duplas, sem cabeçalho, em latin-1).
Este módulo:
  1. descobre a pasta mensal mais recente e completa;
  2. baixa um arquivo por vez (com retomada e conferência do tamanho);
  3. lê em blocos e guarda só as empresas que interessam.

Nada é estimado: cada campo é o que está no arquivo oficial, com os códigos
traduzidos pelas tabelas oficiais do mesmo mês.

Layout (dicionário de dados oficial da Receita):
  Empresas (7):  cnpj_basico; razao_social; natureza_juridica; qualificacao_responsavel;
                 capital_social ("1000,00"); porte_empresa; ente_federativo
  Estabelecimentos (30): cnpj_basico; cnpj_ordem; cnpj_dv; identificador_matriz_filial;
                 nome_fantasia; situacao_cadastral; data_situacao_cadastral;
                 motivo_situacao_cadastral; nome_cidade_exterior; pais; data_inicio_atividade;
                 cnae_fiscal_principal; cnae_fiscal_secundaria; tipo_logradouro; logradouro;
                 numero; complemento; bairro; cep; uf; municipio; ddd1; telefone1; ddd2;
                 telefone2; ddd_fax; fax; correio_eletronico; situacao_especial;
                 data_situacao_especial
  Socios (11):   cnpj_basico; identificador_socio; nome_socio; cnpj_cpf_socio;
                 qualificacao_socio; data_entrada_sociedade; pais; representante_legal;
                 nome_representante; qualificacao_representante; faixa_etaria
  Simples (7):   cnpj_basico; opcao_simples; data_opcao_simples; data_exclusao_simples;
                 opcao_mei; data_opcao_mei; data_exclusao_mei
  Tabelas de códigos (2): codigo; descricao  (Cnaes, Motivos, Municipios, Naturezas,
                 Paises, Qualificacoes)
Telefones e e-mails das empresas não são guardados.
"""
import logging
import re
import time
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree

import pandas as pd
import requests

import config
from coletor import http
from coletor.privacidade import mascarar_cpf_no_texto

log = logging.getLogger("qcd")

GRUPOS = [f"{p}{i}" for p in ("Empresas", "Estabelecimentos", "Socios") for i in range(10)]
TABELAS = ["Cnaes", "Motivos", "Municipios", "Naturezas", "Paises", "Qualificacoes"]
NECESSARIOS = GRUPOS + ["Simples"] + TABELAS

SITUACAO = {"01": "NULA", "1": "NULA", "02": "ATIVA", "2": "ATIVA", "03": "SUSPENSA", "3": "SUSPENSA",
            "04": "INAPTA", "4": "INAPTA", "08": "BAIXADA", "8": "BAIXADA"}
PORTE = {"00": "Não informado", "0": "Não informado", "01": "Microempresa", "1": "Microempresa",
         "03": "Empresa de pequeno porte", "3": "Empresa de pequeno porte", "05": "Demais", "5": "Demais"}
TIPO_SOCIO = {"1": "PJ", "2": "PF", "3": "EX"}
FAIXA = {"1": "até 12 anos", "2": "13 a 20 anos", "3": "21 a 30 anos", "4": "31 a 40 anos", "5": "41 a 50 anos",
         "6": "51 a 60 anos", "7": "61 a 70 anos", "8": "71 a 80 anos", "9": "mais de 80 anos"}

COL_EMP = ["cnpj_basico", "razao", "natureza", "qual_resp", "capital", "porte", "ente"]
COL_EST = ["cnpj_basico", "ordem", "dv", "matriz", "fantasia", "situacao", "data_situacao", "motivo",
           "cidade_exterior", "pais", "abertura", "cnae", "cnaes_sec", "tipo_logradouro", "logradouro",
           "numero", "complemento", "bairro", "cep", "uf", "municipio", "ddd1", "tel1", "ddd2", "tel2",
           "ddd_fax", "fax", "email", "sit_especial", "data_sit_especial"]
COL_SOC = ["cnpj_basico", "tipo", "nome", "doc", "qualificacao", "entrada", "pais", "rep_doc", "rep_nome",
           "rep_qual", "faixa"]
COL_SIM = ["cnpj_basico", "simples", "simples_desde", "simples_ate", "mei", "mei_desde", "mei_ate"]


class ReceitaIndisponivel(Exception):
    pass


# ------------------------------------------------------------- utilidades
def so_digitos(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


def cnpj_valido(c: str) -> bool:
    c = so_digitos(c)
    if len(c) != 14 or c == c[0] * 14:
        return False
    def dv(base, pesos):
        s = sum(int(a) * b for a, b in zip(base, pesos)) % 11
        return "0" if s < 2 else str(11 - s)
    p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    d1 = dv(c[:12], p1)
    d2 = dv(c[:12] + d1, [6] + p1)
    return c[12:] == d1 + d2


def data_iso(s) -> str | None:
    """'20150930' -> '2015-09-30'; vazio, '0' ou '00000000' -> None."""
    s = so_digitos(s)
    if len(s) != 8 or s == "00000000":
        return None
    a, m, d = int(s[:4]), int(s[4:6]), int(s[6:])
    if not (1800 <= a <= 2100 and 1 <= m <= 12 and 1 <= d <= 31):
        return None
    return f"{s[:4]}-{s[4:6]}-{s[6:]}"


def numero_br(s) -> float | None:
    s = str(s or "").strip()
    if not s:
        return None
    try:
        return float(s.replace(".", "").replace(",", ".")) if "," in s else float(s)
    except ValueError:
        return None


def normalizar(nome: str) -> str:
    s = unicodedata.normalize("NFKD", str(nome or "")).encode("ascii", "ignore").decode().upper()
    s = re.sub(r"[^A-Z ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def limpo(s) -> str:
    """Texto sem espaços sobrando e com CPF mascarado (razão social de MEI traz o CPF do dono)."""
    return mascarar_cpf_no_texto(re.sub(r"\s+", " ", str(s or "")).strip())


# ------------------------------------------------------------ descoberta
def _sessao() -> requests.Session:
    return http.sessao()


def _listar_indice(url: str) -> list[str]:
    r = _sessao().get(url, timeout=60)
    r.raise_for_status()
    return sorted(set(re.findall(r'href="(\d{4}-\d{2})/?"', r.text)))


def _arquivos_indice(url: str) -> dict[str, int | None]:
    r = _sessao().get(url, timeout=60)
    r.raise_for_status()
    nomes = set(re.findall(r'href="([A-Za-z]+\d?\.zip)"', r.text))
    return {n[:-4]: None for n in nomes}


def _propfind(url: str, token: str) -> list[tuple[str, int | None]]:
    r = _sessao().request("PROPFIND", url, auth=(token, ""), headers={"Depth": "1"}, timeout=60)
    r.raise_for_status()
    ns = {"d": "DAV:"}
    out = []
    for resp in ElementTree.fromstring(r.content).findall("d:response", ns):
        href = resp.findtext("d:href", default="", namespaces=ns)
        tam = resp.findtext(".//d:getcontentlength", default="", namespaces=ns)
        out.append((requests.utils.unquote(href), int(tam) if tam.isdigit() else None))
    return out


def descobrir(fontes=None) -> dict:
    """{'fonte', 'mes', 'arquivos': {nome: url}, 'auth'} da pasta mais recente completa."""
    erros = []
    for f in fontes or config.RECEITA_FONTES:
        try:
            if f["tipo"] == "indice":
                base = f["url"].rstrip("/") + "/"
                for mes in reversed(_listar_indice(base)):
                    arqs = _arquivos_indice(base + mes + "/")
                    if all(n in arqs for n in NECESSARIOS):
                        return {"fonte": base, "mes": mes, "auth": None,
                                "arquivos": {n: f"{base}{mes}/{n}.zip" for n in NECESSARIOS}}
                    log.info("Receita: pasta %s incompleta em %s", mes, base)
            elif f["tipo"] == "webdav":
                base = f["url"].rstrip("/") + "/"
                raiz = _propfind(base, f["token"])
                meses = sorted({m for h, _ in raiz for m in re.findall(r"/(\d{4}-\d{2})/?$", h)})
                for mes in reversed(meses):
                    itens = _propfind(f"{base}{mes}/", f["token"])
                    arqs = {re.sub(r"\.zip$", "", h.rstrip("/").split("/")[-1]): t for h, t in itens if h.endswith(".zip")}
                    if all(n in arqs for n in NECESSARIOS):
                        return {"fonte": base, "mes": mes, "auth": (f["token"], ""),
                                "arquivos": {n: f"{base}{mes}/{n}.zip" for n in NECESSARIOS},
                                "tamanhos": {n: arqs[n] for n in NECESSARIOS}}
                    log.info("Receita: pasta %s incompleta em %s", mes, base)
        except Exception as e:  # noqa: BLE001
            erros.append(f"{f['url']}: {e}")
            log.warning("Receita: fonte %s indisponível (%s)", f["url"], e)
    raise ReceitaIndisponivel("Nenhuma fonte da Receita respondeu com uma pasta completa. " + " | ".join(erros))


# -------------------------------------------------------------- download
def baixar(url: str, destino: Path, auth=None, tamanho_esperado: int | None = None, tentativas: int = 6) -> Path:
    """Baixa com retomada (Range). Confere o tamanho e a integridade do zip."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    total = tamanho_esperado
    for t in range(1, tentativas + 1):
        ja = destino.stat().st_size if destino.exists() else 0
        if total and ja == total:
            break
        cab = {"Range": f"bytes={ja}-"} if ja else {}
        try:
            with _sessao().get(url, headers=cab, auth=auth, stream=True, timeout=(30, 300)) as r:
                if r.status_code == 416:      # já estava completo
                    break
                r.raise_for_status()
                if r.status_code == 200 and ja:   # servidor ignorou o Range: recomeça
                    ja = 0
                if total is None:
                    cl = r.headers.get("Content-Length")
                    if cl and cl.isdigit():
                        total = int(cl) + (ja if r.status_code == 206 else 0)
                with destino.open("ab" if ja else "wb") as f:
                    for bloco in r.iter_content(4 * 1024 * 1024):
                        f.write(bloco)
            if total is None or destino.stat().st_size == total:
                break
            log.warning("  %s: recebido %d de %d bytes, retomando", destino.name, destino.stat().st_size, total)
        except requests.RequestException as e:
            log.warning("  %s: falha no download (%s), tentativa %d/%d", destino.name, e, t, tentativas)
            time.sleep(min(60, 5 * t))
    else:
        raise ReceitaIndisponivel(f"não foi possível baixar {url}")
    if total is not None and destino.stat().st_size != total:
        raise ReceitaIndisponivel(f"{destino.name}: tamanho {destino.stat().st_size} diferente do esperado {total}")
    with zipfile.ZipFile(destino) as z:
        if len([n for n in z.namelist() if not n.endswith("/")]) != 1:
            raise ReceitaIndisponivel(f"{destino.name}: esperado 1 arquivo dentro do zip, há {z.namelist()}")
    return destino


# --------------------------------------------------------------- leitura
def ler_blocos(caminho: Path, colunas: list[str], tamanho=400_000):
    """Lê o CSV de dentro do zip em blocos (DataFrame de textos)."""
    with zipfile.ZipFile(caminho) as z:
        nome = next(n for n in z.namelist() if not n.endswith("/"))
        if z.getinfo(nome).file_size == 0:
            log.warning("  %s: arquivo vazio", caminho.name)
            return
        with z.open(nome) as f:
            leitor = pd.read_csv(f, sep=";", header=None, dtype=str, encoding="latin-1", quotechar='"',
                                 keep_default_na=False, na_filter=False, chunksize=tamanho,
                                 on_bad_lines="warn", engine="c")
            for bloco in leitor:
                if bloco.shape[1] != len(colunas):
                    raise ReceitaIndisponivel(f"{caminho.name}: {bloco.shape[1]} colunas, esperado {len(colunas)} (layout mudou?)")
                bloco.columns = colunas
                yield bloco


def ler_tabela(caminho: Path) -> dict[str, str]:
    out = {}
    for b in ler_blocos(caminho, ["codigo", "descricao"], tamanho=100_000):
        for c, d in zip(b["codigo"], b["descricao"]):
            out[c.strip()] = limpo(d)
    return out


def _cod(tab: dict, c: str) -> str:
    c = (c or "").strip()
    if not c:
        return ""
    return tab.get(c) or tab.get(c.lstrip("0")) or tab.get(c.zfill(2)) or tab.get(c.zfill(4)) or tab.get(c.zfill(7)) or c


# --------------------------------------------------------------- índice de deputados
def indice_deputados(chaves: dict) -> dict[str, list]:
    """{'123456': [(id, nome_normalizado, nome_exibicao), ...]} pelos 6 dígitos do meio do CPF."""
    idx = {}
    for dep_id, x in chaves.items():
        c6 = so_digitos(x.get("cpf6"))
        if len(c6) != 6:
            continue
        nomes = {normalizar(n) for n in (x.get("nome_civil"), x.get("nome")) if n}
        for n in nomes:
            idx.setdefault(c6, []).append((int(dep_id), n, x.get("nome") or n))
    return idx


def confere_deputado(idx, nome_socio: str, doc: str):
    """(id, confiança) se o sócio PF é um deputado: mesmos 6 dígitos do CPF e
    mesmo nome ('confirmado') ou mesmo primeiro e último nome ('provável')."""
    c6 = so_digitos(doc)
    if len(c6) != 6 or c6 not in idx:
        return None
    n = normalizar(nome_socio)
    melhor = None
    for dep_id, nome_dep, _ in idx[c6]:
        if n == nome_dep:
            return dep_id, "confirmado"
        a, b = n.split(), nome_dep.split()
        if a and b and a[0] == b[0] and a[-1] == b[-1] and len(set(a) & set(b)) >= 2:
            melhor = (dep_id, "provavel")
    return melhor


# ----------------------------------------------------------------- coleta
def coletar(alvos14: set[str], chaves_dep: dict, pasta_tmp: Path, fontes=None, manter_arquivos=False, loc=None) -> dict:
    """Lê a base mais recente e devolve:
    {'base', 'fonte', 'cadastro': {cnpj14: {...}}, 'deputados_socios': [...], 'estatisticas': {...}}"""
    loc = loc or descobrir(fontes)
    mes = loc["mes"]
    log.info("Receita: base %s em %s", mes, loc["fonte"])
    tam = loc.get("tamanhos", {})

    def arquivo(nome):
        return baixar(loc["arquivos"][nome], pasta_tmp / mes / f"{nome}.zip", loc["auth"], tam.get(nome))

    def apagar(p):
        if not manter_arquivos:
            p.unlink(missing_ok=True)

    tab = {}
    for t in TABELAS:
        p = arquivo(t)
        tab[t] = ler_tabela(p)
        apagar(p)
    log.info("Receita: tabelas de códigos lidas (%s)", ", ".join(f"{k}={len(v)}" for k, v in tab.items()))

    alvos14 = {c for c in alvos14 if len(c) == 14}
    basicos = {c[:8] for c in alvos14}
    idx_dep = indice_deputados(chaves_dep)
    stats = {"linhas_socios": 0, "linhas_empresas": 0, "linhas_estabelecimentos": 0}

    # 1) sócios: dos fornecedores e de qualquer empresa em que um deputado apareça
    socios: dict[str, list] = {}
    dep_socios = []
    for i in range(10):
        p = arquivo(f"Socios{i}")
        for b in ler_blocos(p, COL_SOC):
            stats["linhas_socios"] += len(b)
            alvo = b[b["cnpj_basico"].isin(basicos)]
            for r in alvo.itertuples(index=False):
                socios.setdefault(r.cnpj_basico, []).append(_socio(r, tab))
            if idx_dep:
                pf = b[(b["tipo"] == "2") & b["doc"].str[3:9].isin(list(idx_dep))]
                for r in pf.itertuples(index=False):
                    m = confere_deputado(idx_dep, r.nome, r.doc[3:9])
                    if m:
                        dep_socios.append({"dep_id": m[0], "confianca": m[1], "cnpj_basico": r.cnpj_basico,
                                           "nome_socio": limpo(r.nome), "qualificacao": _cod(tab["Qualificacoes"], r.qualificacao),
                                           "desde": data_iso(r.entrada)})
        apagar(p)
        log.info("  Socios%d lido (%d sócios de fornecedores até aqui)", i, sum(len(v) for v in socios.values()))
    basicos_dep = {d["cnpj_basico"] for d in dep_socios}

    # 2) empresas (razão social, natureza, capital, porte)
    empresas = {}
    quer = basicos | basicos_dep
    for i in range(10):
        p = arquivo(f"Empresas{i}")
        for b in ler_blocos(p, COL_EMP):
            stats["linhas_empresas"] += len(b)
            for r in b[b["cnpj_basico"].isin(quer)].itertuples(index=False):
                empresas[r.cnpj_basico] = {
                    "razao": limpo(r.razao),
                    "natureza": f"{r.natureza.strip()} · {_cod(tab['Naturezas'], r.natureza)}" if r.natureza.strip() else "",
                    "capital": numero_br(r.capital),
                    "porte": PORTE.get(r.porte.strip(), r.porte.strip()),
                    "ente": limpo(r.ente),
                }
        apagar(p)
    log.info("Receita: %d empresas encontradas de %d procuradas", len(empresas), len(quer))

    # 3) estabelecimentos: o CNPJ exato de cada fornecedor (+ matriz das empresas de deputados)
    estab = {}
    matrizes = {}
    for i in range(10):
        p = arquivo(f"Estabelecimentos{i}")
        for b in ler_blocos(p, COL_EST):
            stats["linhas_estabelecimentos"] += len(b)
            sel = b[b["cnpj_basico"].isin(quer)]
            for r in sel.itertuples(index=False):
                c14 = r.cnpj_basico + r.ordem + r.dv
                if c14 in alvos14:
                    estab[c14] = _estab(r, tab)
                if r.cnpj_basico in basicos_dep and r.matriz.strip() == "1":
                    matrizes[r.cnpj_basico] = (c14, _estab(r, tab))
        apagar(p)
    log.info("Receita: %d estabelecimentos encontrados de %d fornecedores", len(estab), len(alvos14))

    # 4) Simples Nacional / MEI
    simples = {}
    p = arquivo("Simples")
    for b in ler_blocos(p, COL_SIM):
        for r in b[b["cnpj_basico"].isin(quer)].itertuples(index=False):
            simples[r.cnpj_basico] = {
                "simples": r.simples.strip().upper() == "S", "simples_desde": data_iso(r.simples_desde),
                "simples_ate": data_iso(r.simples_ate), "mei": r.mei.strip().upper() == "S",
                "mei_desde": data_iso(r.mei_desde), "mei_ate": data_iso(r.mei_ate)}
    apagar(p)

    # monta o cadastro de cada fornecedor
    cadastro = {}
    for c14 in sorted(alvos14):
        bas = c14[:8]
        if c14 not in estab:
            cadastro[c14] = {"cnpj": c14, "nao_encontrado": True, "cnpj_valido": cnpj_valido(c14)}
            continue
        cadastro[c14] = {"cnpj": c14, **empresas.get(bas, {}), **estab[c14],
                         "simples": simples.get(bas), "socios": socios.get(bas, [])}
    for d in dep_socios:
        bas = d["cnpj_basico"]
        c14, e = matrizes.get(bas, (None, {}))
        d.update({"cnpj": c14, "razao": empresas.get(bas, {}).get("razao", ""), "situacao": e.get("situacao"),
                  "municipio": e.get("end", {}).get("municipio"), "uf": e.get("end", {}).get("uf")})
    stats.update({"fornecedores_procurados": len(alvos14), "encontrados": len(estab),
                  "nao_encontrados": len(alvos14) - len(estab), "deputados_socios": len(dep_socios)})
    return {"base": mes, "fonte": loc["fonte"], "cadastro": cadastro, "deputados_socios": dep_socios, "estatisticas": stats}


def _socio(r, tab) -> list:
    """[tipo, nome, documento (CPF mascarado pela Receita ou CNPJ), qualificação, desde,
    faixa etária, país, nome do representante, qualificação do representante]"""
    tipo = TIPO_SOCIO.get(r.tipo.strip(), r.tipo.strip())
    doc = so_digitos(r.doc) if tipo == "PJ" else limpo(r.doc)
    pais = _cod(tab["Paises"], r.pais) if r.pais.strip() else ""
    return [tipo, limpo(r.nome), doc, _cod(tab["Qualificacoes"], r.qualificacao), data_iso(r.entrada),
            FAIXA.get(r.faixa.strip(), ""), pais, limpo(r.rep_nome), _cod(tab["Qualificacoes"], r.rep_qual) if r.rep_nome.strip() else ""]


def _estab(r, tab) -> dict:
    sec = [c.strip() for c in r.cnaes_sec.split(",") if c.strip()]
    log_ = " ".join(x for x in (limpo(r.tipo_logradouro), limpo(r.logradouro)) if x)
    return {
        "fantasia": limpo(r.fantasia),
        "matriz": r.matriz.strip() == "1",
        "situacao": SITUACAO.get(r.situacao.strip(), r.situacao.strip()),
        "data_situacao": data_iso(r.data_situacao),
        "motivo": _cod(tab["Motivos"], r.motivo) if r.motivo.strip() not in ("", "0", "00") else "",
        "situacao_especial": limpo(r.sit_especial), "data_situacao_especial": data_iso(r.data_sit_especial),
        "abertura": data_iso(r.abertura),
        "cnae": [r.cnae.strip(), _cod(tab["Cnaes"], r.cnae)] if r.cnae.strip() else None,
        "cnaes_sec": [[c, _cod(tab["Cnaes"], c)] for c in sec],
        "end": {"logradouro": log_, "numero": limpo(r.numero), "complemento": limpo(r.complemento),
                "bairro": limpo(r.bairro), "cep": so_digitos(r.cep), "uf": limpo(r.uf),
                "municipio": _cod(tab["Municipios"], r.municipio) if r.municipio.strip() else "",
                "exterior": limpo(r.cidade_exterior)},
    }
