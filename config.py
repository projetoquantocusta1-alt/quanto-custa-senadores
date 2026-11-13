"""Projeto Quanto Custa — Senadores (configuração)."""
from datetime import date

ANO_INICIAL = 2009
USER_AGENT = "ProjetoQuantoCusta/1.0 (painel de transparencia com dados abertos)"
PAUSA_ENTRE_REQUISICOES = 0.3

# Subsídio mensal de senadores = o mesmo dos deputados federais (Decretos Legislativos)
SUBSIDIO = [
    (date(2007, 4, 1), 16_512.09),   # DL 112/2007
    (date(2011, 2, 1), 26_723.13),   # DL 805/2010
    (date(2015, 2, 1), 33_763.00),   # DL 276/2014
    (date(2023, 1, 1), 39_293.32),   # DL 172/2022, inciso I
    (date(2023, 4, 1), 41_650.92),   # DL 172/2022, inciso II
    (date(2024, 2, 1), 44_008.52),   # DL 172/2022, inciso III
    (date(2025, 2, 1), 46_366.19),   # DL 172/2022, inciso IV
]


def valor_vigente(tabela, dia: date) -> float:
    atual = 0.0
    for inicio, valor in sorted(tabela):
        if dia >= inicio:
            atual = valor
    return atual


# Nomes da planilha da CEAPS que não batem com o cadastro do Senado (apelidos).
# Chave: nome como aparece na CEAPS; valor: código do senador na API do Senado.
APELIDOS_CEAPS = {
    "GIM ARGELLO": 4776,       # Jorge Afonso Argello
    "WEVERTON ROCHA": 5411,    # Weverton Rocha Marques de Sousa
}

# Versão do formato dos arquivos do site: anos gerados por versão anterior são refeitos.
VERSAO = 2

# --- Fontes (Senado Federal — dados abertos) ---
CEAPS_CSV = "https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv"
API_SENADO = "https://legis.senado.leg.br/dadosabertos"
LISTA_LEGISLATURA = API_SENADO + "/senador/lista/legislatura/{ini}/{fim}.json"   # legislaturas que tocam o intervalo
LISTA_ATUAL = API_SENADO + "/senador/lista/atual.json"
MANDATOS = API_SENADO + "/senador/{id}/mandatos.json"
URL_SENADOR = "https://www25.senado.leg.br/web/senadores/senador/-/perfil/{id}"
FOTO_SENADOR = "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador{id}.jpg"

# Legislaturas (início, fim) — mandatos de senador cobrem duas.
LEGISLATURAS = {53: (2007, 2011), 54: (2011, 2015), 55: (2015, 2019), 56: (2019, 2023), 57: (2023, 2027), 58: (2027, 2031)}

# ------------------------------------------------ Receita Federal (CNPJ)
# Mesma configuração do repositório dos deputados (pastas AAAA-MM mensais).
RECEITA_FONTES = [
    {"tipo": "indice", "url": "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/"},
    {"tipo": "indice", "url": "https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/"},
    {"tipo": "webdav", "url": "https://arquivos.receitafederal.gov.br/public.php/webdav/", "token": "YggdBLfdninEJX9"},
]
# Limite anual de faturamento do MEI (alerta "MEI acima do limite")
MEI_LIMITE = 81000.0

IPCA_SGS = ("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados"
            "?formato=json&dataInicial=01/01/{ano}")
