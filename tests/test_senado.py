import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from coletor import senado as S  # noqa: E402

CSV = ('"ULTIMA ATUALIZACAO";"10/11/2026 02:00"\n'
       '"ANO";"MES";"SENADOR";"TIPO_DESPESA";"CNPJ_CPF";"FORNECEDOR";"DOCUMENTO";"DATA";"DETALHAMENTO";"VALOR_REEMBOLSADO";"COD_DOCUMENTO"\n'
       '"2025";"3";"FULANO DE TAL";"Locomoção, hospedagem, alimentação, combustíveis e lubrificantes";"12.345.678/0001-90";"POSTO X";"123";"05/03/2025";"Combustível";"1.234,56";"2001"\n'
       '"2025";"4";"FULANO DE TAL";"Divulgação da atividade parlamentar";"123.456.789-01";"JOAO";"9";"10/04/2025";"";"500,00";"2002"\n'
       '"2025";"4";"DESCONHECIDO";"Passagens aéreas, aquáticas e terrestres nacionais";"";"CIA";"";"11/04/2025";"";"100";"2003"\n').encode("latin-1")


def test_ceaps():
    l = S.ler_ceaps(CSV)
    assert len(l) == 3 and l[0]["valor"] == 1234.56 and l[0]["data"] == "2025-03-05" and l[0]["doc"] == "12.345.678/0001-90"
    assert l[1]["tipo_doc"] == "PF" and "456" in l[1]["doc"] and "123" not in l[1]["doc"][:4]
    assert S.tipo_curto(l[0]["tipo"]) == "Locomoção, hospedagem, alimentação e combustíveis"


def test_lista_e_casamento():
    js = {"ListaParlamentarLegislatura": {"Parlamentares": {"Parlamentar": [
        {"IdentificacaoParlamentar": {"CodigoParlamentar": "123", "NomeParlamentar": "Fulano de Tal", "NomeCompletoParlamentar": "Fulano de Tal Silva",
                                      "SiglaPartidoParlamentar": "XX", "UfParlamentar": "CE"}}]}}}
    s = S.ler_lista_senadores(js)
    assert s[0]["id"] == 123 and s[0]["uf"] == "CE"
    assert S.casar_nomes({"FULANO DE TAL", "DESCONHECIDO"}, s) == {"FULANO DE TAL": 123}


def test_exercicios_e_custo():
    js = {"MandatoParlamentar": {"Parlamentar": {"Mandatos": {"Mandato": [{"Exercicios": {"Exercicio": [
        {"DataInicio": "2023-02-01", "DataFim": "2025-04-10"}, {"DataInicio": "2025-08-01"}]}}]}}}}
    ex = S.ler_exercicios(js)
    assert S.meses_em_exercicio(ex, 2025, 12) == [1, 2, 3, 4, 8, 9, 10, 11, 12]
    c = S.custo(2025, [1, 2, 3], 1000.0, True)
    assert c["salario"] == round(44008.52 + 46366.19 * 2 + 46366.19 * 3 / 12, 2) and c["total"] == round(c["salario"] + 1000, 2)


def _sen(i, nome, completo, **kw):
    return {"id": i, "nome": nome, "nome_completo": completo, **kw}


def test_casamento_endurecido():
    pool = [_sen(1, "Weverton", "Weverton Rocha Marques de Sousa"), _sen(2, "Eduardo Braga", "Carlos Eduardo de Souza Braga"),
            _sen(3, "Dr. Samuel Araújo", "Samuel Pereira de Araujo"), _sen(4, "Eduardo Girão", "Luis Eduardo Grangeiro Girão")]
    todos = pool + [_sen(5, "Wilder Morais", "Wilder Pedro de Morais"), _sen(6, "Jorge Afonso Argello", "Jorge Afonso Argello")]
    m = S.casar_nomes({"WEVERTON ROCHA", "EDUARDO SILVA", "EDUARDO", "SAMUEL ARAUJO", "WILDER MORAIS", "GIM ARGELLO"},
                      pool, todos, {"GIM ARGELLO": 6})
    assert m == {"WEVERTON ROCHA": 1, "SAMUEL ARAUJO": 3, "WILDER MORAIS": 5, "GIM ARGELLO": 6}


def test_uf_nas_listas_antigas():
    js = {"ListaParlamentarLegislatura": {"Parlamentares": {"Parlamentar": [
        {"IdentificacaoParlamentar": {"CodigoParlamentar": "9", "NomeParlamentar": "Fulano"},
         "Mandatos": {"Mandato": [{"UfParlamentar": "PI", "PrimeiraLegislaturaDoMandato": {"NumeroLegislatura": "50"}},
                                  {"UfParlamentar": "PA", "PrimeiraLegislaturaDoMandato": {"NumeroLegislatura": "53"},
                                   "SegundaLegislaturaDoMandato": {"NumeroLegislatura": "54"}}]}}]}}}
    assert S.ler_lista_senadores(js, leg=54)[0]["uf"] == "PA"
    assert S.ler_uf_mandatos({"MandatoParlamentar": {"Parlamentar": js["ListaParlamentarLegislatura"]["Parlamentares"]["Parlamentar"][0]}}) == "PA"


def test_passageiros():
    d = ("Companhia Aérea: LATAM, Localizador: AGTHGD. Passageiros: KAROL PONTES MONTEIRO (Matrícula 356685, COMISSIONADO), "
         "JOSÉ D'ÁVILA (Matrícula 12, PARLAMENTAR), Voo: 3768 - BSB/MCP - 17/07/2025;")
    assert S.passageiros(d) == [("KAROL PONTES MONTEIRO", "COMISSIONADO"), ("JOSÉ D'ÁVILA", "PARLAMENTAR")]
    assert S.passageiros("Passagem terrestre de servidor a serviço") == []


def test_alertas_receita():
    import receita as R
    cad = {"11222333000181": {"abertura": "2025-01-10", "situacao": "BAIXADA", "data_situacao": "2026-02-01",
                              "simples": {"mei": True}},
           "99888777000166": {"abertura": "2010-01-01", "situacao": "ATIVA", "simples": {"mei": False}},
           "55444333000122": {"nao_encontrado": True}}
    pags = {"11222333000181": {"anos": {2025: 90000.0}, "primeira": "2025-03-01", "ultima": "2026-03-01"},
            "99888777000166": {"anos": {2025: 500000.0}, "primeira": "2019-03-01"}}
    al = R.alertas(cad, pags)
    tipos = sorted(a[1] for a in al)
    assert tipos == ["aberta_antes", "mei_limite", "situacao"]
    assert "R$ 90.000,00" in next(a[2] for a in al if a[1] == "mei_limite")


def test_privacidade():
    from coletor.privacidade import mascarar_cpf_no_texto as m
    assert m("WEVERSON SARMENTO DA PAIXAO 96106697272") == "WEVERSON SARMENTO DA PAIXAO ***.066.972-**"
    ch, doc, tp = S.chave_e_doc("123.456.789-01", "JOAO")
    assert tp == "PF" and doc == "***.456.789-**" and ch == S.chave_e_doc("12345678901", "João")[0]
    import hashlib
    assert ch != "pf" + hashlib.sha1(b"12345678901").hexdigest()[:12]


def test_previsao():
    from datetime import date
    assert S.ativo_no_fim([("2023-02-01", "")], 2026, date(2026, 11, 13))
    assert not S.ativo_no_fim([("2023-02-01", "2026-06-30")], 2026, date(2026, 11, 13))
    p = S.prever(2026, 10, list(range(1, 11)), [100.0] * 9 + [40.0, 0, 0], True)
    # 2 meses de salário + 13º (12/12); cota no ritmo de 100/mês o ano todo: 12×100 − 940 já gastos
    sub = 46366.19
    assert p["ativo"] and p["salario"] == round(sub * 2 + sub, 2) and p["ceaps"] == 260.0 and p["restante"] == round(sub * 3 + 260, 2)
    assert S.prever(2026, 10, [1, 2], [0] * 12, False)["restante"] == 0
