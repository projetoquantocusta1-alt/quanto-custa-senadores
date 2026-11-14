"""Sondagem: baixa páginas de transparência do Senado e guarda o que encontrar (para descobrir formatos).
Só lê páginas públicas; grava em dados_brutos/sondagem/. Uso: python sondar.py"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

from coletor import http

PAGINAS = [
    "https://www12.senado.leg.br/dados-abertos/administrativo",
    "https://www12.senado.leg.br/transparencia/rh/HP-recursos-humanos",
    "https://www12.senado.leg.br/transparencia/sen/auxilio-moradia-e-imoveis-funcionais",
    "https://www12.senado.leg.br/transparencia/sen/coapat/auxilio-moradia-e-imoveis-funcionais",
    "https://www12.senado.leg.br/transparencia/sen",
    "https://www12.senado.leg.br/transparencia",
    "https://www.senado.leg.br/robots.txt",
    "https://www12.senado.leg.br/robots.txt",
]
SAIDA = Path(__file__).parent / "dados_brutos" / "sondagem"


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    res = {}
    for u in PAGINAS + sys.argv[1:]:
        try:
            r = http.get(u, timeout=60)
            txt = r.text
            links = sorted({urljoin(u, m) for m in re.findall(r'href="([^"]+)"', txt)
                            if re.search(r"csv|json|xml|xls|ods|dados|servidor|lotac|moradia|imove|gabinete|remunera|senador|beneficio|despesa", m, re.I)})
            res[u] = {"status": r.status_code, "tipo": r.headers.get("Content-Type"), "tamanho": len(r.content), "links": links[:400],
                      "texto": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", txt))[:6000]}
        except Exception as e:  # noqa: BLE001
            res[u] = {"erro": str(e)}
    (SAIDA / "paginas.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), "utf-8")
    print({u: (v.get("status"), len(v.get("links") or []), v.get("erro")) for u, v in res.items()})


if __name__ == "__main__":
    main()
