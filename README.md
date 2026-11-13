# Projeto Quanto Custa — Senadores

Quanto custa cada senador desde 2009: salário (subsídio × meses em exercício + 13º) e cota parlamentar (CEAPS), nota a nota, com fornecedores. Site estático em `docs/` (GitHub Pages), atualizado por um robô diário no GitHub Actions. Repositório-satélite do Projeto Quanto Custa.

## Fontes
- CEAPS: `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_AAAA.csv`
- Senadores por legislatura e mandatos: API de dados abertos do Senado (`legis.senado.leg.br/dadosabertos`)
- IPCA: Banco Central (SGS 433)

## O que ainda não entra
Equipe do gabinete, auxílio-moradia, imóvel funcional e ajudas de custo — o custo é um piso.

## Rodar
```bash
pip install -r requirements.txt
python -m pytest -q
python atualizar.py --anos 2025
```
