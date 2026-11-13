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
