"""Fotos oficiais, reduzidas, guardadas no próprio site (docs/dados/fotos/ID.jpg).

A imagem de compartilhar é desenhada num canvas, e o navegador só deixa usar fotos do
mesmo endereço do site; por isso o robô guarda uma cópia pequena de cada foto.
Só baixa quem ainda não tem; foto que falha é lembrada por 30 dias para não insistir todo dia.
"""
import io
import json
import logging
from datetime import date
from pathlib import Path

from coletor import http

log = logging.getLogger(__name__)


def baixar_fotos(itens, pasta: Path, memoria: Path, largura: int = 180, limite: int = 120) -> int:
    """itens: [(id, url)]. Devolve quantas fotos novas foram salvas."""
    try:
        from PIL import Image
    except ImportError:
        log.warning("Pillow não instalado: fotos ficam para depois.")
        return 0
    sem = json.loads(memoria.read_text("utf-8")) if memoria.exists() else {}
    hoje = date.today().toordinal()
    novos = erros = feitos = 0
    for i, url in itens:
        arq = pasta / f"{i}.jpg"
        if not url or arq.exists() or hoje - sem.get(str(i), -999) < 30:
            continue
        if feitos >= limite:
            break
        feitos += 1
        try:
            r = http.get(url.replace("http://", "https://"), timeout=30)
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
            if img.width > largura:
                img = img.resize((largura, round(img.height * largura / img.width)), Image.LANCZOS)
            pasta.mkdir(parents=True, exist_ok=True)
            img.save(arq, "JPEG", quality=80, optimize=True)
            novos += 1
            erros = 0
        except Exception as e:  # noqa: BLE001
            sem[str(i)] = hoje
            erros += 1
            log.warning("foto %s falhou: %s", i, e)
            if erros >= 5:
                log.warning("fotos: muitas falhas seguidas, o resto fica para a próxima execução")
                break
    memoria.parent.mkdir(parents=True, exist_ok=True)
    memoria.write_text(json.dumps(sem), "utf-8")
    if novos:
        log.info("fotos novas: %d", novos)
    return novos
