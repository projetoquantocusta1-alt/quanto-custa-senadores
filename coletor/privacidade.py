"""Privacidade: CPF de pessoa física nunca aparece inteiro.

Nomes de MEI vêm da Receita com o CPF do dono no fim ("FULANO DE TAL 12345678901"), e
históricos de notas às vezes citam CPF. Aqui o CPF é mascarado como em todo o projeto:
***.456.789-** (só os 6 dígitos do meio).
"""
import re

# não começa logo depois de um dígito (nem de "dígito + pontuação", que é parte de outro número), mas pode vir
# colado em letra, ponto ou traço: "CPF.123.456.789-01", "MARIA-123.456.789-01"
CPF_NO_TEXTO = re.compile(r"(?<!\d)(?<!\d[./-])(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})(?![\d./-]*\d)")
_LETRA = re.compile(r"[A-Za-zÀ-ÿ]")
_CPF_MASCARA_CNPJ = re.compile(r"^(\d{3})\.(\d{3})\.(\d{3})/(\d{2})\s*-?\s*$")
_CPF_FORMATADO = re.compile(r"^\d{3}\.\d{3}\.\d{3}-\d{2}$")


def mascarar_cpf_no_texto(s):
    """Mascara CPFs (11 dígitos, com ou sem pontuação) dentro de textos que têm letras."""
    if not isinstance(s, str):
        return s
    m = _CPF_MASCARA_CNPJ.match(s.strip())      # CPF no formato de CNPJ da Câmara: "123.456.789/01  -"
    if m:
        return f"***.{m.group(2)}.{m.group(3)}-**"
    if _CPF_FORMATADO.match(s.strip()):          # campo que é só um CPF com pontuação (ex.: digitado como nº do documento)
        return CPF_NO_TEXTO.sub(lambda m: f"***.{m.group(2)}.{m.group(3)}-**", s)
    if not _LETRA.search(s):                     # número puro sem pontuação: nº de documento, não mexe
        return s
    return CPF_NO_TEXTO.sub(_trocar, s)


def cpf_valido(d: str) -> bool:
    """Dígitos verificadores do CPF (11 dígitos)."""
    if len(d) != 11 or len(set(d)) == 1:
        return False
    for n in (9, 10):
        soma = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if (soma * 10 % 11) % 10 != int(d[n]):
            return False
    return True


def _trocar(m):
    """Com pontuação de CPF (123.456.789-01) mascara sempre; 11 dígitos colados só se forem um CPF válido —
    números de processo e documento ("20250101001SEME", colados em letra) ficam como estão."""
    txt, s, a, b = m.group(0), m.string, m.start(), m.end()
    if not ("." in txt or "-" in txt):
        colado_em_letra = (a > 0 and s[a - 1].isalpha()) or (b < len(s) and s[b].isalpha())   # "20240516001G"
        if colado_em_letra or not cpf_valido(re.sub(r"\D", "", txt)):
            return txt
    return f"***.{m.group(2)}.{m.group(3)}-**"


def limpar_json(obj):
    """Aplica a máscara em todos os textos de uma estrutura JSON (usado para limpar arquivos já publicados)."""
    if isinstance(obj, str):
        return mascarar_cpf_no_texto(obj)
    if isinstance(obj, list):
        return [limpar_json(x) for x in obj]
    if isinstance(obj, dict):
        return {mascarar_cpf_no_texto(k): limpar_json(v) for k, v in obj.items()}
    return obj


def limpar_pastas(*pastas) -> int:
    """Reescreve, já mascarados, os .json publicados que tenham CPF em textos. Uso:
    python -m coletor.privacidade docs/dados dados_brutos"""
    import json
    from pathlib import Path
    n = 0
    for pasta in pastas:
        for p in Path(pasta).rglob("*.json"):
            txt = p.read_text("utf-8")
            if not (CPF_NO_TEXTO.search(txt) or re.search(r'\d{3}\.\d{3}\.\d{3}/\d{2}\s*-?\s*"', txt)):
                continue
            novo = json.dumps(limpar_json(json.loads(txt)), ensure_ascii=False, separators=(",", ":"))
            if novo != txt:
                p.write_text(novo, "utf-8")
                n += 1
    return n


if __name__ == "__main__":
    import sys
    print(limpar_pastas(*(sys.argv[1:] or ["docs/dados", "dados_brutos"])), "arquivo(s) limpo(s)")
