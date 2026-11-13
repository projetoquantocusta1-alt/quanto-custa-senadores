"""Sessão HTTP com tentativas, pausa educada e cabeçalho identificado.

Se um site falhar várias vezes seguidas, ele é marcado como fora do ar
nesta execução e as próximas chamadas a ele falham na hora, em vez de
gastar minutos tentando de novo cada uma.
"""
import io
import time
import zipfile
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import config

LIMITE_FALHAS_SEGUIDAS = 4
LIMITE_FALHAS_TOTAL = 10   # site instável: desiste depois de 10 falhas na execução

_sessao = None
_ultima = 0.0
_falhas: dict[str, int] = {}
_falhas_total: dict[str, int] = {}


class SiteForaDoAr(requests.RequestException):
    pass


def sessao() -> requests.Session:
    global _sessao
    if _sessao is None:
        s = requests.Session()
        retry = Retry(
            total=3, backoff_factor=2,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=False,   # 503 com "volte em X min" travava o robô
            backoff_max=10,
        )
        s.mount("https://", HTTPAdapter(max_retries=retry))
        s.headers["User-Agent"] = config.USER_AGENT
        _sessao = s
    return _sessao


def fora_do_ar(url: str) -> bool:
    host = urlparse(url).netloc
    return (_falhas.get(host, 0) >= LIMITE_FALHAS_SEGUIDAS
            or _falhas_total.get(host, 0) >= LIMITE_FALHAS_TOTAL)


def get(url, params=None, timeout=60, **kw) -> requests.Response:
    global _ultima
    host = urlparse(url).netloc
    if fora_do_ar(url):
        raise SiteForaDoAr(f"{host} fora do ar nesta execução")
    espera = config.PAUSA_ENTRE_REQUISICOES - (time.time() - _ultima)
    if espera > 0:
        time.sleep(espera)
    try:
        r = sessao().get(url, params=params, timeout=timeout, **kw)
        r.raise_for_status()
    except requests.RequestException:
        _falhas[host] = _falhas.get(host, 0) + 1
        _falhas_total[host] = _falhas_total.get(host, 0) + 1
        raise
    finally:
        _ultima = time.time()
    _falhas[host] = 0
    return r


def baixar_zip(url, timeout=600) -> zipfile.ZipFile:
    r = get(url, timeout=timeout)
    return zipfile.ZipFile(io.BytesIO(r.content))
