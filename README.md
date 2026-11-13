# Projeto Quanto Custa — Senadores

Quanto custa cada senador desde 2009: salário (subsídio × meses em exercício + 13º) e cota parlamentar (CEAPS), nota a nota, com fornecedores. Site estático em `docs/` (GitHub Pages), atualizado por um robô diário no GitHub Actions. Repositório-satélite do Projeto Quanto Custa.

## Fontes
- CEAPS: `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_AAAA.csv`
- Senadores por legislatura e mandatos: API de dados abertos do Senado (`legis.senado.leg.br/dadosabertos`)
- IPCA: Banco Central (SGS 433)
- Cadastro e sócios dos fornecedores: dados abertos do CNPJ da Receita Federal (robô semanal `receita.yml`, só processa quando a Receita publica base nova)

## Robôs
- `atualizar.yml` — todo dia: CEAPS, senadores, custo, passageiros das passagens. Anos gerados por versão antiga do robô (`VERSAO` em `config.py`) são refeitos sozinhos.
- `receita.yml` — domingo: cadastro na Receita Federal dos fornecedores com CNPJ e pontos de atenção.

## Casamento de nomes
O nome na planilha da CEAPS nem sempre é o nome parlamentar do cadastro. O robô casa por: tabela de apelidos (`APELIDOS_CEAPS` em `config.py`), nome idêntico, ou todas as palavras do nome contidas no nome completo de um único senador (procura primeiro nas legislaturas do ano e depois em todos os senadores já vistos). O log avisa quando um nome não casa: acrescente-o em `APELIDOS_CEAPS`.

## O que ainda não entra
Equipe do gabinete, auxílio-moradia, imóvel funcional e ajudas de custo — o custo é um piso.

## Rodar
```bash
pip install -r requirements.txt
python -m pytest -q
python atualizar.py --anos 2025
```
