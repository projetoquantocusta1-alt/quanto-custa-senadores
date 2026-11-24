/* Quanto Custa — Dívida Pública */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const E = { d: null, b: null, meta: null, pag: "inicio", graf: {}, tick: 0, ordB: ["tvm", -1], limB: 30, limP: 15 };
const MI = 1e6; // as séries vêm em R$ milhões
const brl = (v, d = 0) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: d, maximumFractionDigits: d });
const curto = (v) => { const a = Math.abs(v || 0), f = (x, n = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: n });
  if (a >= 1e12) return "R$ " + f(v / 1e12) + " tri";
  if (a >= 1e9) return "R$ " + f(v / 1e9, a >= 1e11 ? 0 : 1) + " bi";
  if (a >= 999_500) return "R$ " + f(v / 1e6, 1) + " mi";
  if (a >= 1e3) return "R$ " + f(v / 1e3, 0) + " mil";
  return brl(v); };
const nf = (v, d = 0) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => (v == null ? "—" : nf(v, d) + "%");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const semAcento = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soma = (a) => a.reduce((s, x) => s + (x || 0), 0);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const getJSON = async (u) => { const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };
const rotMes = (m) => (m ? `${MESES[+m.slice(5, 7) - 1]}/${m.slice(0, 4)}` : "—");
const rotMesCurto = (m) => `${MESES[+m.slice(5, 7) - 1]}/${m.slice(2, 4)}`;
const porExtenso = (v) => { const a = Math.abs(v || 0);
  for (const [b, um, varios] of [[1e12, "trilhão", "trilhões"], [1e9, "bilhão", "bilhões"], [1e6, "milhão", "milhões"], [1e3, "mil", "mil"]]) {
    if (a < b) continue;
    const x = v / b, t = x.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(x) < 10 ? 2 : Math.abs(x) < 100 ? 1 : 0 });
    return b === 1e3 ? `≈ ${t} mil reais` : `≈ ${t} ${Math.abs(x) < 2 ? um : varios} de reais`; }
  return ""; };
const celular = () => innerWidth < 600;
const corrigir = () => $("#f-ipca").checked;
const COR = { divida: "#10243A", liquida: "#2463A6", juros: "#C84C4C", primario: "#D69A32", nominal: "#6b4fa0", selic: "#C84C4C", ipca: "#16865D",
  proj: "#8FA3B8", focus: "#D69A32",
  idx: { Selic: "#C84C4C", Prefixado: "#2463A6", "Inflação (IPCA)": "#16865D", "Câmbio": "#D69A32", Outros: "#8FA3B8" },
  esf: ["#10243A", "#2463A6", "#16865D", "#D69A32", "#8FA3B8"], ctrl: { "Público": "#10243A", "Privado nacional": "#2463A6", "Estrangeiro": "#D69A32", "Não informado": "#C3CDD8" } };

// ---------------------------------------------------------------- dados mensais
const M = () => E.d.mensal;
const idxDe = (k) => M().meses.indexOf(k);
const val = (k, mes) => { const i = idxDe(mes); return i < 0 ? null : M()[k][i]; };
let IPCA = null;   // número-índice mensal
function montarIPCA() {
  const m = M(), idx = {}; let n = 100;
  m.meses.forEach((mes, i) => { if (m.ipca[i] != null) n *= 1 + m.ipca[i] / 100; idx[mes] = n; });
  const ult = [...m.meses].reverse().find((mes, k) => m.ipca[m.meses.length - 1 - k] != null);
  IPCA = { idx, ult, ref: idx[ult] };
}
// fator para trazer o valor de um mês para preços de hoje (1 se "Valores de hoje" estiver desligado)
const fator = (mes) => (corrigir() && IPCA.idx[mes] ? IPCA.ref / IPCA.idx[mes] : 1);
const notaValores = () => (corrigir() ? `em valores de hoje (IPCA até ${rotMes(IPCA.ult)})` : "em valores da época");
// meses dentro do período escolhido
function janela() {
  const anos = +$("#f-periodo").value, ms = M().meses, ref = E.d.resumo.referencia;
  const fim = ms.indexOf(ref) >= 0 ? ms.indexOf(ref) : ms.length - 1;
  const ini = anos ? Math.max(0, fim - anos * 12 + 1) : 0;
  return ms.slice(ini, fim + 1);
}
function anosNaJanela() { const j = janela(); const a0 = +j[0].slice(0, 4); return E.d.anos.filter((a) => a.ano >= a0); }
// soma de um fluxo mensal no ano, já corrigida mês a mês
function somaAno(k, ano) { let t = 0, n = 0; M().meses.forEach((mes, i) => { if (mes.startsWith(ano + "-") && M()[k][i] != null) { t += M()[k][i] * fator(mes); n++; } }); return [t * MI, n]; }
function soma12(k, ate) { const i = idxDe(ate); if (i < 11) return null; let t = 0; for (let j = i - 11; j <= i; j++) t += (M()[k][j] || 0) * fator(M().meses[j]); return t * MI; }

function kpis(el, itens) { $(el).innerHTML = itens.map(([r, v, o, cls]) => `<div class="kpi${cls ? " " + cls : ""}"><div class="rot">${r}</div><div class="val num">${v}</div><div class="obs">${o || ""}</div></div>`).join(""); }
function grafico(id, cfg) { E.graf[id]?.destroy(); E.graf[id] = new Chart($("#" + id), cfg); }
const eixoR = (extra = {}) => ({ ticks: { callback: (v) => curto(v), maxTicksLimit: celular() ? 5 : 8 }, ...extra });
const eixoP = (extra = {}) => ({ ticks: { callback: (v) => nf(v, 0) + "%", maxTicksLimit: celular() ? 5 : 8 }, ...extra });
const eixoX = () => ({ ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: celular() ? 5 : 12 } });
const tip = (fmt) => ({ callbacks: { label: (c) => `${c.dataset.label ? c.dataset.label + ": " : ""}${fmt(c.parsed.y ?? c.parsed.x ?? c.parsed)}` } });
const linha = (label, data, cor, extra = {}) => ({ label, data, borderColor: cor, backgroundColor: cor, borderWidth: 2, pointRadius: 0, pointHitRadius: 6, tension: 0.15, spanGaps: true, ...extra });
// HTML: barras horizontais simples (leves, sem canvas)
function barrasHTML(itens, fmt = curto, total = null) {
  const mx = Math.max(...itens.map((x) => Math.abs(x.v)), 1), tot = total ?? soma(itens.map((x) => Math.max(0, x.v)));
  return `<ul class="barras">${itens.map((x) => `<li><span class="b-rot">${esc(x.n)}${x.s ? `<small>${esc(x.s)}</small>` : ""}</span><span class="b-val num">${fmt(x.v)}${tot && x.v > 0 ? ` <small>${pct((100 * x.v) / tot, 1)}</small>` : ""}</span>
    <span class="b-trilho"><i style="width:${(100 * Math.abs(x.v)) / mx}%;background:${x.v < 0 ? COR.ipca : x.c || COR.divida}"></i></span></li>`).join("")}</ul>`;
}

// ---------------------------------------------------------------- início
function contador() {
  const R = E.d.resumo, P = E.d.projecao, ref = R.referencia;
  const ini = new Date(+ref.slice(0, 4), +ref.slice(5, 7), 1).getTime();   // 1º dia depois do último dado oficial
  const porSeg = (P.aumento_medio_mes * MI) / (30.4375 * 86400), base = R.dbgg * MI;
  const jurosSeg = (R.juros_12m * MI) / (365.25 * 86400);
  cancelAnimationFrame(E.tick);
  const passo = () => { const v = base + Math.max(0, (Date.now() - ini) / 1000) * porSeg;
    $("#i-total").textContent = brl(v); $("#i-ext").textContent = porExtenso(v);
    if (E.pag === "inicio") E.tick = requestAnimationFrame(passo); };
  passo();
  $("#i-rot").textContent = "Dívida bruta do governo, agora (estimativa em tempo real)";
  $("#i-nota").innerHTML = `Último número oficial do Banco Central: <b>${brl(base)}</b> em ${rotMes(ref)} — União, INSS, estados e municípios.<br>
    <span class="ritmo">Desde então, o valor avança no ritmo médio dos últimos 12 meses: <b>+${brl(porSeg, 2)} por segundo</b> · ${curto(porSeg * 86400)} por dia (estimativa)</span><br>
    <span class="ritmo">Só de juros, a dívida custa <b>${brl(jurosSeg, 0)} por segundo</b> · ${curto(jurosSeg * 86400)} por dia</span>`;
}
function rInicio() {
  const D = E.d, R = D.resumo, pop = D.populacao?.valor, F = D.focus?.itens || [];
  contador();
  const fAno = F.find((x) => x.indicador.startsWith("Dívida bruta") && x.ano === R.referencia.slice(0, 4));
  const prim = R.primario_12m, sel = D.selic_meta;
  kpis("#i-kpis", [
    ["Dívida bruta / PIB", pct(R.dbgg_pib, 2), `em ${rotMes(R.referencia)} · ${fAno ? `mercado espera ${pct(fAno.mediana, 1)} em dez` : "Banco Central"}`],
    ["Por brasileiro", brl((R.dbgg * MI) / pop), `${nf(pop)} habitantes (IBGE)`],
    ["Juros em 12 meses", curto(R.juros_12m * MI), `${pct(R.juros_pib12, 2)} do PIB · ${brl((R.juros_12m * MI) / pop)} por brasileiro`, "kpi-alerta"],
    ["Juros no ano", curto(R.juros_ano * MI), `jan a ${MESES[+R.referencia.slice(5, 7) - 1]}/${R.referencia.slice(0, 4)}`],
    ["Dívida líquida", curto(R.dlsp * MI), `${pct(R.dlsp_pib, 1)} do PIB · descontado o que o governo tem a receber`],
    [prim > 0 ? "Déficit primário (12 meses)" : "Superávit primário (12 meses)", curto(Math.abs(prim) * MI), `${pct(Math.abs(R.primario_pib12), 2)} do PIB · contas sem os juros`],
    ["Selic (meta)", sel ? pct(sel.valor, 2) : "—", "ao ano · corrige mais da metade da dívida em títulos"],
    ["Prazo médio dos títulos", nf(R.prazo_medio, 1) + " meses", `≈ ${nf(R.prazo_medio / 12, 1)} anos para vencer, em média`]]);
  // gráfico: % do PIB + projeção
  const J = janela(), P = D.projecao.meses.filter((x) => x.mes.slice(0, 4) <= String(+R.referencia.slice(0, 4) + 1));
  const lab = [...J, ...P.map((x) => x.mes)];
  grafico("g-i-pib", { type: "line", data: { labels: lab.map(rotMesCurto), datasets: [
    linha("Dívida bruta", [...J.map((m) => val("dbgg_pib", m)), ...P.map(() => null)], COR.divida),
    linha("Dívida líquida", [...J.map((m) => val("dlsp_pib", m)), ...P.map(() => null)], COR.liquida),
    linha("Projeção (dívida bruta)", [...J.map((m, i) => (i === J.length - 1 ? val("dbgg_pib", m) : null)), ...P.map((x) => x.pct_pib)], COR.proj, { borderDash: [6, 4] })] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: tip((v) => pct(v, 2)) }, scales: { x: eixoX(), y: eixoP() } } });
  // por que cresce
  const j12 = R.juros_12m, n12 = R.nominal_12m;
  $("#i-cresce-dica").textContent = `12 meses até ${rotMes(R.referencia)}`;
  $("#i-cresce").innerHTML = barrasHTML([
    { n: "Juros da dívida", v: j12 * MI, c: COR.juros },
    { n: prim > 0 ? "Déficit primário" : "Superávit primário", s: "gastos − arrecadação, sem juros", v: prim * MI, c: COR.primario },
    { n: "Total que precisou ser financiado", s: "resultado nominal", v: n12 * MI, c: COR.nominal }], curto, 0) +
    `<p class="dica">${prim > 0 ? "Além dos juros, as contas do governo fecharam no vermelho" : "As contas sem juros fecharam no azul, mas não cobrem os juros"}: ${pct((100 * j12) / n12, 0)} do que o setor público precisou financiar foi juros.</p>`;
  const esf = R.esferas_juros_12m, ROT = { juros_gf: "Governo Federal (Tesouro)", juros_bc: "Banco Central", juros_est: "Estados", juros_mun: "Municípios", juros_estatais: "Estatais" };
  $("#i-esferas").innerHTML = barrasHTML(Object.entries(esf).map(([k, v], i) => ({ n: ROT[k], v: v * MI, c: COR.esf[i] }))) + `<p class="dica">Total: ${curto(R.juros_12m * MI)} · juros nominais das Estatísticas Fiscais do Banco Central.</p>`;
  const A = anosNaJanela();
  $("#i-juros-dica").textContent = notaValores() + " · * ano em andamento";
  grafico("g-i-juros", { type: "bar", data: { labels: A.map((a) => (a.fechado ? a.ano : `${a.ano}*`)), datasets: [{ label: "Juros", data: A.map((a) => somaAno("juros", a.ano)[0]), backgroundColor: COR.juros }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip(curto) }, scales: { x: eixoX(), y: eixoR() } } });
}

// ---------------------------------------------------------------- evolução
function rEvolucao() {
  const D = E.d, R = D.resumo, J = janela(), ref = R.referencia;
  const ant = M().meses[idxDe(ref) - 12], dez = (a) => D.anos.find((x) => x.ano === a);
  const maxPib = Math.max(...M().dbgg_pib.filter((x) => x != null)), mMax = M().meses[M().dbgg_pib.indexOf(maxPib)];
  const d10 = M().meses[idxDe(ref) - 120];
  kpis("#e-kpis", [
    ["Cresceu em 12 meses", curto((R.dbgg - val("dbgg", ant)) * MI), `de ${curto(val("dbgg", ant) * MI)} (${rotMes(ant)}) para ${curto(R.dbgg * MI)}`],
    ["Em 10 anos", d10 && val("dbgg", d10) ? `${nf(R.dbgg / val("dbgg", d10), 1)}×` : "—", d10 ? `era ${curto(val("dbgg", d10) * MI)} em ${rotMes(d10)} (valores da época)` : ""],
    ["Maior nível (% PIB)", pct(maxPib, 2), `dívida bruta em ${rotMes(mMax)}`],
    ["Dívida líquida / PIB", pct(R.dlsp_pib, 2), `${pct(R.dlsp_pib - (val("dlsp_pib", ant) || 0), 2).replace(/^(?!-)/, "+")} em 12 meses`]]);
  $("#e-reais-dica").textContent = notaValores();
  grafico("g-e-reais", { type: "line", data: { labels: J.map(rotMesCurto), datasets: [
    linha("Dívida bruta", J.map((m) => (val("dbgg", m) == null ? null : val("dbgg", m) * MI * fator(m))), COR.divida),
    linha("Dívida líquida", J.map((m) => (val("dlsp", m) == null ? null : val("dlsp", m) * MI * fator(m))), COR.liquida)] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: tip(curto) }, scales: { x: eixoX(), y: eixoR() } } });
  grafico("g-e-pib", { type: "line", data: { labels: J.map(rotMesCurto), datasets: [
    linha("Dívida bruta", J.map((m) => val("dbgg_pib", m)), COR.divida), linha("Dívida líquida", J.map((m) => val("dlsp_pib", m)), COR.liquida)] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: tip((v) => pct(v, 2)) }, scales: { x: eixoX(), y: eixoP() } } });
  const A = anosNaJanela().filter((a) => dez(a.ano - 1)?.dbgg && a.dbgg);
  grafico("g-e-cresc", { type: "bar", data: { labels: A.map((a) => (a.fechado ? a.ano : `${a.ano}*`)),
    datasets: [{ label: "Aumento da dívida bruta", data: A.map((a) => (a.dbgg - dez(a.ano - 1).dbgg) * MI * fator(a.mes_ref)), backgroundColor: COR.divida }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip(curto) }, scales: { x: eixoX(), y: eixoR() } } });
  const linhas = [...D.anos].reverse().map((a) => { const f = fator(a.mes_ref), [j] = somaAno("juros", a.ano), [p] = somaAno("primario", a.ano), [n] = somaAno("nominal", a.ano);
    return `<tr><td>${a.ano}${a.fechado ? "" : ` <span class="sub">até ${MESES[+a.mes_ref.slice(5, 7) - 1]}</span>`}</td>
      <td class="num">${a.dbgg ? curto(a.dbgg * MI * f) : "—"}</td><td class="num">${pct(a.dbgg_pib, 1)}</td>
      <td class="num">${curto(a.dlsp * MI * f)}</td><td class="num">${pct(a.dlsp_pib, 1)}</td>
      <td class="num neg">${curto(j)}</td><td class="num ${p > 0 ? "neg" : "pos"}">${p > 0 ? "déficit " : "superávit "}${curto(Math.abs(p))}</td>
      <td class="num">${curto(n)}</td><td class="num">${pct(a.selic_media, 2)}</td><td class="num">${pct(a.ipca, 2)}</td></tr>`; }).join("");
  $("#e-tab").innerHTML = `<thead><tr><th>Ano</th><th class="num">Dívida bruta</th><th class="num">% PIB</th><th class="num">Dívida líquida</th><th class="num">% PIB</th><th class="num">Juros</th><th class="num">Resultado primário</th><th class="num">Resultado nominal</th><th class="num">Selic média</th><th class="num">IPCA</th></tr></thead><tbody>${linhas}</tbody>`;
}

// ---------------------------------------------------------------- juros
function rJuros() {
  const D = E.d, R = D.resumo, J = janela(), pop = D.populacao.valor, ref = R.referencia;
  const medDiv = soma(M().meses.slice(idxDe(ref) - 12, idxDe(ref)).map((m) => val("dbgg", m))) / 12, custo = (100 * R.juros_12m) / medDiv;
  kpis("#j-kpis", [
    ["Juros em 12 meses", curto(R.juros_12m * MI), `${pct(R.juros_pib12, 2)} do PIB`, "kpi-alerta"],
    ["Por dia", curto((R.juros_12m * MI) / 365.25), "média dos últimos 12 meses"],
    ["Por brasileiro, por ano", brl((R.juros_12m * MI) / pop), "juros ÷ população"],
    ["Custo médio da dívida", pct(custo, 1) + " ao ano", "juros de 12 meses ÷ dívida bruta média (estimativa)"],
    ["Selic (meta)", D.selic_meta ? pct(D.selic_meta.valor, 2) : "—", "ao ano · definida pelo Copom"],
    ["Juros no ano", curto(R.juros_ano * MI), `jan a ${rotMes(ref)}`]]);
  $("#j-mes-dica").textContent = notaValores();
  grafico("g-j-mes", { type: "bar", data: { labels: J.map(rotMesCurto), datasets: [{ label: "Juros no mês", data: J.map((m) => (val("juros", m) || 0) * MI * fator(m)), backgroundColor: J.map((m) => (val("juros", m) < 0 ? COR.ipca : COR.juros)) }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip(curto) }, scales: { x: eixoX(), y: eixoR() } } });
  const A = anosNaJanela(), ESF = [["juros_gf", "Governo Federal"], ["juros_bc", "Banco Central"], ["juros_est", "Estados"], ["juros_mun", "Municípios"], ["juros_estatais", "Estatais"]];
  grafico("g-j-esf", { type: "bar", data: { labels: A.map((a) => (a.fechado ? a.ano : `${a.ano}*`)), datasets: ESF.map(([k, n], i) => ({ label: n, data: A.map((a) => somaAno(k, a.ano)[0]), backgroundColor: COR.esf[i] })) },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: tip(curto) }, scales: { x: { ...eixoX(), stacked: true }, y: { ...eixoR(), stacked: true } } } });
  grafico("g-j-prim", { type: "bar", data: { labels: A.map((a) => (a.fechado ? a.ano : `${a.ano}*`)), datasets: [
    { label: "Juros", data: A.map((a) => somaAno("juros", a.ano)[0]), backgroundColor: COR.juros, stack: "s" },
    { label: "Resultado primário (déficit +, superávit −)", data: A.map((a) => somaAno("primario", a.ano)[0]), backgroundColor: COR.primario, stack: "s" },
    { type: "line", label: "Resultado nominal (total)", data: A.map((a) => somaAno("nominal", a.ano)[0]), borderColor: COR.nominal, backgroundColor: COR.nominal, pointRadius: 3, borderWidth: 2 }] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: tip(curto) }, scales: { x: { ...eixoX(), stacked: true }, y: { ...eixoR(), stacked: true } } } });
  // inflação em 12 meses calculada com o IPCA mensal
  const ipca12 = (m) => { const i = idxDe(m); if (i < 11) return null; let f = 1; for (let k = i - 11; k <= i; k++) { if (M().ipca[k] == null) return null; f *= 1 + M().ipca[k] / 100; } return 100 * (f - 1); };
  grafico("g-j-selic", { type: "line", data: { labels: J.map(rotMesCurto), datasets: [linha("Selic (% ao ano)", J.map((m) => val("selic", m)), COR.selic), linha("IPCA em 12 meses", J.map(ipca12), COR.ipca)] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: tip((v) => pct(v, 2)) }, scales: { x: eixoX(), y: eixoP() } } });
  const sel = R.indexadores.idx_selic, ipca12u = ipca12(ref);
  $("#j-texto-selic").innerHTML = `<b>Juro real</b>: com a Selic em ${pct(val("selic", ref), 2)} e a inflação em ${pct(ipca12u, 2)} em 12 meses (${rotMes(ref)}), o juro acima da inflação é de cerca de <b>${pct(((1 + val("selic", ref) / 100) / (1 + ipca12u / 100) - 1) * 100, 1)} ao ano</b>. Como ${pct(sel, 0)} da dívida em títulos é corrigida pela Selic, cada ponto a mais na Selic encarece a dívida na hora.`;
}

// ---------------------------------------------------------------- composição
const IDX = (r) => ({ Selic: r.idx_selic, Prefixado: r.idx_pre, "Inflação (IPCA)": r.idx_ipca, "Câmbio": r.idx_cambio, Outros: (r.idx_igpm || 0) + (r.idx_igpdi || 0) + (r.idx_tr || 0) + (r.idx_outros || 0) });
const GLOSSARIO = [
  ["LFT", "Tesouro Selic", "rende a Selic do dia. É o título mais usado pelo Tesouro — e o que faz a dívida subir na hora quando o Banco Central sobe os juros."],
  ["LTN", "Tesouro Prefixado", "taxa fixa combinada na compra; paga tudo no vencimento."],
  ["NTN-F", "Tesouro Prefixado com juros semestrais", "taxa fixa, com pagamento de juros a cada 6 meses."],
  ["NTN-B", "Tesouro IPCA+ com juros semestrais", "inflação (IPCA) mais uma taxa fixa, com juros a cada 6 meses."],
  ["NTN-B1", "Tesouro RendA+ e Educa+", "inflação mais taxa fixa, pago em parcelas mensais (aposentadoria e educação)."],
  ["NTN-C", "Corrigida pelo IGP-M", "título antigo, corrigido pelo IGP-M; não é mais emitido."],
  ["NTN-I / NTN-P", "Títulos antigos", "ligados ao câmbio ou à TR, de programas específicos; valores pequenos."]];
function rComposicao() {
  const D = E.d, R = D.resumo, J = janela(), ix = IDX(R.indexadores);
  kpis("#c-kpis", [
    ["Títulos do Tesouro com o mercado", curto(R.dpmf_mercado * MI), `bancos, fundos, previdência, estrangeiros, pessoas · ${rotMes(R.referencia)}`],
    ["Títulos na carteira do Banco Central", curto(R.dpmf_bc * MI), "usados pelo BC nas operações compromissadas com os bancos"],
    ["Corrigida pela Selic", pct(ix.Selic, 1), "da dívida em títulos"],
    ["Prazo médio", nf(R.prazo_medio, 1) + " meses", "dos títulos emitidos"]]);
  const ks = Object.keys(ix);
  $("#c-idx-dica").textContent = `${rotMes(R.indexadores_mes)} · dívida mobiliária federal`;
  grafico("g-c-idx", { type: "doughnut", data: { labels: ks, datasets: [{ data: ks.map((k) => ix[k]), backgroundColor: ks.map((k) => COR.idx[k]), borderWidth: 1 }] },
    options: { maintainAspectRatio: false, cutout: "58%", plugins: { legend: { position: celular() ? "bottom" : "right" }, tooltip: { callbacks: { label: (c) => `${c.label}: ${pct(c.parsed, 2)}` } } } } });
  grafico("g-c-idx-hist", { type: "line", data: { labels: J.map(rotMesCurto), datasets: ks.map((k) => linha(k, J.map((m) => { const i = idxDe(m); const r = Object.fromEntries(Object.keys(R.indexadores).map((c) => [c, M()[c][i]])); return IDX(r)[k]; }), COR.idx[k], { fill: true, backgroundColor: COR.idx[k] + "CC", borderWidth: 1 })) },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: tip((v) => pct(v, 1)) }, scales: { x: eixoX(), y: { ...eixoP(), stacked: true, min: 0, max: 100 } } } });
  const esf = R.esferas_dlsp, ROT = { dlsp_gf: "Governo Federal", dlsp_bc: "Banco Central", dlsp_est: "Estados", dlsp_mun: "Municípios", dlsp_estatais: "Estatais" };
  $("#c-esf-dica").textContent = `dívida líquida em ${rotMes(R.referencia)}`;
  $("#c-esf").innerHTML = barrasHTML(Object.entries(esf).map(([k, v], i) => ({ n: ROT[k], v: v * MI, c: COR.esf[i] })), curto, R.dlsp * MI) +
    `<p class="dica">Valor negativo (verde) = a esfera tem mais a receber do que a pagar. No Banco Central, as reservas internacionais compensam as operações compromissadas.</p>`;
  grafico("g-c-bc", { type: "line", data: { labels: J.map(rotMesCurto), datasets: [
    linha("Com o mercado", J.map((m) => val("dpmf_mercado", m) * MI * fator(m)), COR.divida, { fill: true, backgroundColor: COR.divida + "CC" }),
    linha("Carteira do Banco Central", J.map((m) => val("dpmf_bc", m) * MI * fator(m)), COR.proj, { fill: "-1", backgroundColor: COR.proj + "AA" })] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: tip(curto) }, scales: { x: eixoX(), y: { ...eixoR(), stacked: true } } } });
  const C = D.cronograma;
  if (C) {
    const ts = Object.entries(C.por_titulo).sort((a, b) => b[1] - a[1]);
    $("#c-tit-dica").textContent = `posição em ${C.referencia.split("-").reverse().join("/")} · total ${curto(C.total * MI)}`;
    grafico("g-c-tit", { type: "bar", data: { labels: ts.map((t) => t[0]), datasets: [{ data: ts.map((t) => t[1] * MI), backgroundColor: COR.liquida }] },
      options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip(curto) }, scales: { x: eixoR() } } });
  }
  grafico("g-c-prazo", { type: "line", data: { labels: J.map(rotMesCurto), datasets: [linha("Prazo médio (meses)", J.map((m) => val("prazo_medio", m)), COR.liquida)] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip((v) => nf(v, 1) + " meses") }, scales: { x: eixoX() } } });
  $("#c-glossario").innerHTML = `<ul>${GLOSSARIO.map(([s, n, t]) => `<li><b>${s} — ${n}</b>: ${t}</li>`).join("")}</ul><p class="sub">O Tesouro Direto vende esses mesmos títulos a pessoas físicas; a maior parte, porém, está com bancos, fundos de investimento, previdência e investidores estrangeiros.</p>`;
}

// ---------------------------------------------------------------- vencimentos
function rVencimentos() {
  const C = E.d.cronograma; if (!C) { $("#v-kpis").innerHTML = `<p class="aviso">O cronograma de vencimentos não respondeu na última coleta.</p>`; return; }
  const anos = Object.keys(C.por_ano), ref = C.referencia, hoje = new Date(ref);
  const em12 = soma(C.proximos.filter((v) => new Date(v.data) <= new Date(hoje.getTime() + 365 * 864e5)).map((v) => v.total));
  const [amx, vmx] = Object.entries(C.por_ano).reduce((a, [k, v]) => (v.total > a[1] ? [k, v.total] : a), ["", 0]);
  const ate3 = soma(anos.filter((a) => +a <= +ref.slice(0, 4) + 2).map((a) => C.por_ano[a].total));
  kpis("#v-kpis", [
    ["Títulos em mercado", curto(C.total * MI), `posição em ${ref.split("-").reverse().join("/")}`],
    ["Vence nos próximos 12 meses", curto(em12 * MI), `${pct((100 * em12) / C.total, 1)} do total`, "kpi-alerta"],
    [`Vence até ${+ref.slice(0, 4) + 2}`, curto(ate3 * MI), `${pct((100 * ate3) / C.total, 1)} do total`],
    ["Ano com mais vencimentos", amx, curto(vmx * MI)]]);
  $("#v-dica").textContent = "valores da época, em mercado (sem a carteira do Banco Central) · a maior parte é paga com novos títulos (rolagem)";
  const tits = C.titulos.filter((t) => C.por_titulo[t]), cores = ["#2463A6", "#C84C4C", "#16865D", "#6b4fa0", "#D69A32", "#10243A", "#8FA3B8", "#5B6878"];
  grafico("g-v-ano", { type: "bar", data: { labels: anos, datasets: tits.map((t, i) => ({ label: t, data: anos.map((a) => (C.por_ano[a][t] || 0) * MI), backgroundColor: cores[i % cores.length] })) },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: { ...tip(curto), filter: (c) => c.parsed.y > 0 } },
      scales: { x: { ...eixoX(), stacked: true }, y: { ...eixoR(), stacked: true } } } });
  const prox = C.proximos.filter((v) => v.total >= 1000);
  $("#v-tab").innerHTML = `<thead><tr><th>Data</th><th>Títulos</th><th class="num">Valor</th><th class="num">% do total</th></tr></thead><tbody>${prox.map((v) =>
    `<tr><td>${v.data.split("-").reverse().join("/")}</td><td>${tits.filter((t) => v[t]).map((t) => `${t} <span class="sub">${curto(v[t] * MI)}</span>`).join(" · ")}</td><td class="num">${curto(v.total * MI)}</td><td class="num">${pct((100 * v.total) / C.total, 2)}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="4" class="sub" style="font-weight:400">Vencimentos menores que R$ 1 bi (parcelas mensais de títulos antigos, como a NTN-I) não aparecem na lista, mas entram nos totais.</td></tr></tfoot>`;
}

// ---------------------------------------------------------------- previsão
function rPrevisao() {
  const D = E.d, R = D.resumo, P = D.projecao, F = (D.focus?.itens || []);
  const a0 = +R.referencia.slice(0, 4), dez = (a) => P.meses.find((x) => x.mes === `${a}-12`);
  const fb = (a) => F.find((x) => x.indicador.startsWith("Dívida bruta") && +x.ano === a);
  kpis("#p-kpis", [
    [`Dezembro de ${a0}`, dez(a0) ? pct(dez(a0).pct_pib, 1) : "—", `projeção · ${fb(a0) ? "mercado (Focus): " + pct(fb(a0).mediana, 1) : ""}`],
    [`Dezembro de ${a0 + 1}`, dez(a0 + 1) ? pct(dez(a0 + 1).pct_pib, 1) : "—", `${dez(a0 + 1) ? curto(dez(a0 + 1).divida * MI) : ""} · ${fb(a0 + 1) ? "Focus: " + pct(fb(a0 + 1).mediana, 1) : ""}`],
    ["Ritmo usado", "+" + curto(P.aumento_medio_mes * MI) + "/mês", `média dos últimos ${P.janela_meses} meses`],
    ["Crescimento do PIB usado", pct(P.crescimento_pib_12m, 1), "nominal, em 12 meses (com inflação)"]]);
  const hist = M().meses.filter((m) => m >= `${a0 - 4}-01` && m <= R.referencia), PM = P.meses;
  const lab = [...hist, ...PM.map((x) => x.mes)], nul = (n) => Array(n).fill(null), h = hist.length;
  const focusPts = lab.map((m) => { const f = m.endsWith("-12") && fb(+m.slice(0, 4)); return f ? f.mediana : null; });
  grafico("g-p-pib", { type: "line", data: { labels: lab.map(rotMesCurto), datasets: [
    linha("Histórico", [...hist.map((m) => val("dbgg_pib", m)), ...nul(PM.length)], COR.divida),
    linha("Projeção", [...nul(h - 1), val("dbgg_pib", R.referencia), ...PM.map((x) => x.pct_pib)], COR.proj, { borderDash: [6, 4] }),
    linha("Faixa (máx.)", [...nul(h), ...PM.map((x) => x.pct_max)], "transparent", { fill: "+1", backgroundColor: "rgba(143,163,184,.25)" }),
    linha("Faixa (mín.)", [...nul(h), ...PM.map((x) => x.pct_min)], "transparent"),
    { type: "line", label: "Mercado (Focus), dezembro", data: focusPts, showLine: false, pointRadius: 6, pointStyle: "rectRot", borderColor: COR.focus, backgroundColor: COR.focus }] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { filter: (l) => !l.text.startsWith("Faixa") } }, tooltip: { ...tip((v) => pct(v, 2)), filter: (c) => c.parsed.y != null } }, scales: { x: eixoX(), y: eixoP() } } });
  grafico("g-p-reais", { type: "line", data: { labels: lab.map(rotMesCurto), datasets: [
    linha("Histórico", [...hist.map((m) => val("dbgg", m) * MI), ...nul(PM.length)], COR.divida),
    linha("Projeção", [...nul(h - 1), R.dbgg * MI, ...PM.map((x) => x.divida * MI)], COR.proj, { borderDash: [6, 4] })] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: { ...tip(curto), filter: (c) => c.parsed.y != null } }, scales: { x: eixoX(), y: eixoR() } } });
  if (F.length) {
    const inds = [...new Set(F.map((x) => x.indicador))], anos = [...new Set(F.map((x) => x.ano))].sort().slice(0, 6);
    $("#p-focus-dica").textContent = `mediana das instituições consultadas · ${F[0].data.split("-").reverse().join("/")}`;
    $("#p-focus").innerHTML = `<div class="tabela-rolagem"><table class="ranking mini-tab"><thead><tr><th>% do PIB</th>${anos.map((a) => `<th class="num">${a}</th>`).join("")}</tr></thead><tbody>${inds.map((ind) =>
      `<tr><td class="quebra">${esc(ind)}</td>${anos.map((a) => { const x = F.find((y) => y.indicador === ind && y.ano === a); return `<td class="num">${x ? pct(x.mediana, 1) : "—"}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="dica">Focus: pesquisa semanal do Banco Central com bancos e consultorias. ${esc(String(F[0].respondentes || ""))} respostas para o ano corrente.</p>`;
  } else $("#p-focus").innerHTML = `<p class="dica">As expectativas do Focus não responderam na última coleta.</p>`;
  const lin = PM.slice(0, E.limP);
  $("#p-tab").innerHTML = `<thead><tr><th>Mês</th><th class="num">Dívida bruta (projeção)</th><th class="num">Faixa de 90%</th><th class="num">% do PIB</th><th class="num">Faixa (% PIB)</th></tr></thead><tbody>${lin.map((x) =>
    `<tr><td>${rotMes(x.mes)}</td><td class="num">${curto(x.divida * MI)}</td><td class="num sub">${curto(x.min * MI)} a ${curto(x.max * MI)}</td><td class="num">${pct(x.pct_pib, 2)}</td><td class="num sub">${pct(x.pct_min, 1)} a ${pct(x.pct_max, 1)}</td></tr>`).join("")}</tbody>`;
  $("#p-mais").hidden = PM.length <= E.limP;
  $("#p-como").innerHTML = `<p><b>Regra:</b> a dívida bruta continua aumentando, a cada mês, a média do que aumentou nos últimos ${P.janela_meses} meses (+${curto(P.aumento_medio_mes * MI)} por mês). O PIB continua crescendo no mesmo ritmo dos últimos 12 meses (${pct(P.crescimento_pib_12m, 1)} ao ano, já com a inflação).</p>
    <p><b>Faixa:</b> o aumento mensal variou, nesses 12 meses, com desvio de ${curto(P.desvio_mes * MI)}. A faixa mostra onde a dívida deve ficar em 90% dos casos, se essa variação se mantiver (ela se alarga com o tempo).</p>
    <p><b>O que a projeção não vê:</b> mudança na Selic, reformas, cortes de gastos, privatizações, crises ou mudança de ritmo da economia. Por isso, quanto mais longe, menos confiável. As expectativas do mercado (Focus) já incluem a visão dos analistas sobre essas mudanças.</p>`;
}

// ---------------------------------------------------------------- bancos e financeiras
async function carregarBancos() {
  if (E.b) return E.b;
  const r = await getJSON("dados/bancos.json");
  r.bancos = r.linhas.map((l) => Object.fromEntries(r.campos.map((c, i) => [c, l[i]])));
  return (E.b = r);
}
const rotPeriodo = (p) => `${MESES[+p.slice(4) - 1]}/${p.slice(0, 4)}`;
const rotSemestres = (s) => (s && s.length === 2 ? `${s[1].endsWith("12") ? "jul" : "jan"}/${s[1].slice(0, 4)} a ${s[0].endsWith("06") ? "jun" : "dez"}/${s[0].slice(0, 4)}` : "12 meses");
function custoMedio() { const R = E.d.resumo, i = idxDe(R.referencia); return R.juros_12m / (soma(M().meses.slice(i - 12, i).map((m) => val("dbgg", m))) / 12); }
const COLS_B = [["nome", "Instituição"], ["controle", "Controle"], ["tvm", "Títulos (TVM)"], ["pct", "% do ativo"], ["renda_tvm", "Renda com títulos (12 meses)"], ["est", "Juros estimados/ano"], ["liquidez", "Aplicações de liquidez"], ["lucro", "Lucro (12 meses)"]];
async function rBancos() {
  let B; try { B = await carregarBancos(); } catch { $("#b-kpis").innerHTML = `<p class="aviso">Os dados dos bancos ainda não foram coletados.</p>`; return; }
  const L = B.bancos.filter((b) => b.tvm > 0), tot = soma(L.map((b) => b.tvm)), R = E.d.resumo, cm = custoMedio();
  const top10 = soma(L.slice(0, 10).map((b) => b.tvm)), renda = soma(L.map((b) => b.renda_tvm)), per = rotPeriodo(B.periodo), sem = rotSemestres(B.semestres);
  L.forEach((b) => { b.pct = b.ativo ? (100 * b.tvm) / b.ativo : 0; b.est = b.tvm * cm; });
  kpis("#b-kpis", [
    ["Títulos na carteira de todos", curto(tot * MI), `${nf(L.length)} bancos e financeiras · ${per}`],
    ["Dívida do governo em títulos", curto(R.dpmf_mercado * MI), `com o mercado (${rotMes(R.referencia)}) · a carteira dos bancos equivale a até ${pct((100 * tot) / R.dpmf_mercado, 0)} disso`],
    ["Os 10 maiores", pct((100 * top10) / tot, 1), "do total em títulos das instituições"],
    ["Renda com títulos (12 meses)", curto(renda * MI), `${sem} · declarada ao Banco Central`, "kpi-alerta"],
    ["Juros que a dívida paga", pct(cm * 100, 1) + " ao ano", "custo médio da dívida bruta (estimativa)"]]);
  $("#b-top-dica").textContent = `carteira de títulos e valores mobiliários · ${per}`;
  const CURTOS = { "BANCO NACIONAL DE DESENVOLVIMENTO ECONOMICO E SOCIAL": "BNDES", "CAIXA ECONOMICA FEDERAL": "CAIXA" };
  const t15 = L.slice(0, 15), nomeC = (n) => { n = CURTOS[n] || n.replace(/ - .*$/, "").replace(/ S\.?A\.?$| S\/A$/i, "").replace(/^BANCO /i, ""); const lim = celular() ? 16 : 30; return n.length > lim ? n.slice(0, lim - 1) + "…" : n; };
  grafico("g-b-top", { type: "bar", data: { labels: t15.map((b) => nomeC(b.nome)), datasets: [{ label: "Títulos", data: t15.map((b) => b.tvm * MI), backgroundColor: t15.map((b) => COR.ctrl[b.controle]) }] },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => t15[c[0].dataIndex].nome, label: (c) => curto(c.parsed.x) } } },
      scales: { x: { ticks: { callback: (v) => curto(v), maxTicksLimit: celular() ? 3 : 6, maxRotation: 0 } } } } });
  const porC = {}; L.forEach((b) => (porC[b.controle] = (porC[b.controle] || 0) + b.tvm));
  const cs = Object.keys(porC);
  grafico("g-b-ctrl", { type: "doughnut", data: { labels: cs, datasets: [{ data: cs.map((c) => porC[c] * MI), backgroundColor: cs.map((c) => COR.ctrl[c]) }] },
    options: { maintainAspectRatio: false, cutout: "58%", plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.label}: ${curto(c.parsed)} (${pct((100 * c.parsed) / (tot * MI), 1)})` } } } } });
  const porS = {}; L.forEach((b) => (porS[b.segmento] = (porS[b.segmento] || 0) + b.tvm));
  $("#b-seg").innerHTML = barrasHTML(Object.entries(porS).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ n, v: v * MI, c: COR.liquida })), curto, tot * MI);
  const sf = $("#b-seg-f"), cf = $("#b-ctrl-f");
  if (sf.options.length === 1) {
    sf.innerHTML += Object.keys(porS).sort().map((s) => `<option>${esc(s)}</option>`).join("");
    cf.innerHTML += cs.sort().map((s) => `<option>${esc(s)}</option>`).join("");
  }
  tabelaBancos(L);
  $("#b-juros").innerHTML = `<p>Nos 12 meses até ${rotMes(R.referencia)}, o setor público teve <b>${curto(R.juros_12m * MI)}</b> de juros sobre a dívida (${pct(R.juros_pib12, 2)} do PIB) — em média <b>${pct(cm * 100, 1)} ao ano</b> sobre a dívida bruta.</p>
    <p><b>Para quem vai esse dinheiro?</b> Para quem tem os títulos do Tesouro e para os bancos que fazem operações compromissadas com o Banco Central: bancos, fundos de investimento (onde está o dinheiro de muitos brasileiros), fundos de pensão, seguradoras, investidores estrangeiros e pessoas no Tesouro Direto. O Tesouro só publica a divisão por grupo, e o site dele não responde aos nossos robôs — por isso o valor exato por banco não existe em dado público.</p>
    <p><b>O que dá para mostrar com dado oficial:</b> na tabela acima, a <b>renda com títulos</b> que cada banco declarou ao Banco Central (${sem}). Somadas, as instituições declararam <b>${curto(renda * MI)}</b>. Esse valor inclui títulos privados e o resultado de operações de proteção (por isso alguns bancos aparecem com renda negativa).</p>
    <p><b>Estimativa:</b> a coluna "Juros estimados/ano" multiplica a carteira de títulos de cada banco pelo custo médio da dívida (${pct(cm * 100, 1)}). Se toda a carteira fosse dívida do governo, as instituições receberiam cerca de <b>${curto(tot * cm * MI)} por ano</b> — um teto, não um valor exato.</p>`;
}
function tabelaBancos(L) {
  const q = semAcento($("#b-q").value.trim()), sf = $("#b-seg-f").value, cf = $("#b-ctrl-f").value, [k, dir] = E.ordB;
  const F = L.filter((b) => (!q || semAcento(b.nome).includes(q)) && (!sf || b.segmento === sf) && (!cf || b.controle === cf));
  const ord = [...F].sort((a, b) => (typeof a[k] === "string" ? a[k].localeCompare(b[k]) : (a[k] || 0) - (b[k] || 0)) * dir);
  const pos = new Map(L.map((b, i) => [b.cod, i + 1]));
  const vis = ord.slice(0, E.limB), fmt = (c, b) => (c === "pct" ? pct(b.pct, 1) : curto((b[c] || 0) * MI));
  $("#b-tab").innerHTML = `<thead><tr><th class="num">#</th>${COLS_B.map(([c, n]) => `<th class="${["nome", "controle"].includes(c) ? "" : "num"} ordena${c === k ? " ativo" : ""}" data-ord="${c}">${n}${c === k ? (dir < 0 ? " ▾" : " ▴") : ""}</th>`).join("")}</tr></thead>
    <tbody>${vis.map((b) => `<tr><td class="num sub">${pos.get(b.cod)}º</td><td class="quebra"><button class="link-dep" data-banco="${esc(b.cod)}">${esc(b.nome)}</button><span class="sub seg">${esc(b.segmento)}${b.porte ? " · " + esc(b.porte) : ""}</span></td><td><span class="ctrl" style="--c:${COR.ctrl[b.controle]}">${esc(b.controle)}</span></td>
      <td class="num"><b>${curto(b.tvm * MI)}</b></td><td class="num">${pct(b.pct, 1)}</td><td class="num ${b.renda_tvm < 0 ? "neg" : ""}">${fmt("renda_tvm", b)}</td><td class="num prev">${fmt("est", b)}</td>
      <td class="num">${fmt("liquidez", b)}</td><td class="num ${b.lucro < 0 ? "neg" : ""}">${fmt("lucro", b)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td></td><td>${nf(F.length)} instituições</td><td></td><td class="num">${curto(soma(F.map((b) => b.tvm)) * MI)}</td><td></td><td class="num">${curto(soma(F.map((b) => b.renda_tvm)) * MI)}</td><td class="num">${curto(soma(F.map((b) => b.est)) * MI)}</td><td class="num">${curto(soma(F.map((b) => b.liquidez)) * MI)}</td><td class="num">${curto(soma(F.map((b) => b.lucro)) * MI)}</td></tr></tfoot>`;
  $("#b-mais").hidden = F.length <= E.limB;
}
function fichaBanco(cod) {
  const b = E.b?.bancos.find((x) => x.cod === cod); if (!b) return;
  const cm = custoMedio(), sem = rotSemestres(E.b.semestres), per = rotPeriodo(E.b.periodo);
  const linhas = [["Ativo total", b.ativo, `tudo o que a instituição tem (${per})`], ["Títulos e valores mobiliários (TVM)", b.tvm, "títulos públicos e privados na carteira"],
    ["Aplicações interfinanceiras de liquidez", b.liquidez, "inclui operações compromissadas (muitas com o Banco Central)"], ["Operações de crédito", b.credito, "empréstimos e financiamentos"],
    ["Patrimônio líquido", b.pl, ""], ["Renda com títulos (TVM)", b.renda_tvm, sem], ["Renda com aplicações de liquidez", b.renda_liquidez, sem],
    ["Renda com crédito", b.renda_credito, sem], ["Lucro líquido", b.lucro, sem]];
  $("#ficha-corpo").innerHTML = `<div class="ficha-cab"><div><p class="selo">${esc(b.segmento)} · ${esc(b.controle)}${b.porte ? " · porte " + esc(b.porte) : ""}</p><h2>${esc(b.nome)}</h2><p class="sub">${b.uf ? esc(b.uf) + " · " : ""}código no Banco Central: ${esc(b.cod)}</p></div></div>
    <div class="kpis"><div class="kpi"><div class="rot">Títulos em carteira</div><div class="val num">${curto(b.tvm * MI)}</div><div class="obs">${pct(b.pct, 1)} do ativo · ${pct((100 * b.tvm) / E.d.resumo.dpmf_mercado, 2)} da dívida em títulos (teto)</div></div>
      <div class="kpi"><div class="rot">Renda com títulos</div><div class="val num">${curto(b.renda_tvm * MI)}</div><div class="obs">${sem}, declarada</div></div>
      <div class="kpi"><div class="rot">Juros estimados por ano</div><div class="val num">${curto(b.tvm * cm * MI)}</div><div class="obs">carteira × ${pct(cm * 100, 1)} (estimativa, teto)</div></div></div>
    <div class="tabela-rolagem"><table class="ranking"><tbody>${linhas.map(([n, v, o]) => `<tr><td class="quebra">${n}<span class="sub" style="display:block">${o}</span></td><td class="num">${v == null ? "—" : brl(v * MI)}</td></tr>`).join("")}</tbody></table></div>
    <p class="aviso-bancos">A carteira de títulos inclui títulos privados (debêntures, letras financeiras etc.): o IF.data não separa os títulos do governo. Fonte: Banco Central, IF.data, data-base ${per}.</p>`;
  $("#ficha").hidden = false;
}

// ---------------------------------------------------------------- o que dava pra fazer
function rDava() {
  const R = window.REFERENCIAS, D = E.d.resumo; if (!R) return;
  const v = D.juros_12m * MI, n = (x) => (x >= 10 ? nf(Math.floor(x)) : nf(x, 1));
  $("#dv-sub").textContent = `Juros da dívida pública nos 12 meses até ${rotMes(D.referencia)}:`;
  $("#dv-total").textContent = brl(v); $("#dv-ext").textContent = porExtenso(v);
  $("#dv-regra").textContent = `Setor público consolidado · ${pct(D.juros_pib12, 2)} do PIB · com esse dinheiro, daria para:`;
  $("#dv-cards").innerHTML = R.itens.map((it) => { const q = v / (it.construcao + it.ano_funcionando), so = v / it.construcao;
    return `<div class="dv-card"><b class="dv-num">${n(q)}</b><span class="dv-rot">${esc(it.nome)}</span><p>${it.feminino ? "construídas" : "construídos"} do zero e funcionando por 1 ano <span class="sub">(${esc(it.detalhe)})</span></p><p class="sub">Só construir e equipar: ${n(so)} ${esc(so >= 2 ? it.plural : it.unidade)}.</p></div>`; }).join("") +
    `<div class="dv-card"><b class="dv-num">${nf(Math.floor(v / R.bolsa_familia.por_familia_ano))}</b><span class="dv-rot">famílias no Bolsa Família</span><p>durante 1 ano <span class="sub">(${esc(R.bolsa_familia.detalhe)})</span></p></div>` +
    `<div class="dv-card"><b class="dv-num">${brl(v / E.d.populacao.valor)}</b><span class="dv-rot">para cada brasileiro</span><p>se os juros de 12 meses fossem divididos igualmente</p></div>`;
  const lnk = ([t, u]) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t));
  $("#dv-fontes").innerHTML = `<ul>${R.itens.map((it) => `<li><b>${esc(it.nome)}</b>: ${brl(it.construcao + it.ano_funcionando)} cada<ul>${it.fontes.map((f) => `<li>${lnk(f)}</li>`).join("")}</ul></li>`).join("")}<li><b>Bolsa Família</b>: ${brl(R.bolsa_familia.por_familia_ano)} por família no ano — ${lnk(R.bolsa_familia.fonte)}</li></ul>
    <p class="sub">Comparação ilustrativa: os juros são uma obrigação do governo com quem emprestou dinheiro; deixar de pagá-los teria outras consequências.</p>`;
}

// ---------------------------------------------------------------- metodologia
function rMetodo() {
  const f = E.d.fontes;
  $("#m-series").innerHTML = `<div class="tabela-rolagem"><table class="ranking mini-tab"><thead><tr><th>Código SGS</th><th>Série</th><th>Unidade</th></tr></thead><tbody>${Object.values(f).map((s) =>
    `<tr><td><a href="https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s.codigo}/dados?formato=json" target="_blank" rel="noopener">${s.codigo}</a></td><td class="quebra">${esc(s.descricao)}</td><td>${esc(s.unidade)}</td></tr>`).join("")}</tbody></table></div>`;
  const st = E.meta?.situacao || {}, ROT = { series: "Séries do Banco Central", cronograma: "Cronograma de vencimentos", focus: "Focus", bancos: "IF.data (bancos)", populacao: "População (IBGE)", selic_meta: "Meta Selic" };
  $("#m-situacao").innerHTML = "Última coleta: " + Object.entries(st).map(([k, v]) => `${ROT[k] || k}: ${v === "ok" ? "ok" : esc(v.split(":")[0])}`).join(" · ");
}

// ---------------------------------------------------------------- navegação
const PAGS = { inicio: rInicio, evolucao: rEvolucao, juros: rJuros, composicao: rComposicao, vencimentos: rVencimentos, previsao: rPrevisao, bancos: rBancos, dava: rDava, metodo: rMetodo };
async function render() { try { await PAGS[E.pag](); } catch (e) { console.error(e); } }
function irPara(p) {
  E.pag = p; $$(".pagina").forEach((s) => s.classList.toggle("ativa", s.dataset.pag === p));
  $$(".menu nav button").forEach((b) => (b.dataset.pag === p ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  $("#menu").classList.remove("aberto"); $("#veu").hidden = true;
  $(".segmentacoes").hidden = ["bancos", "dava", "metodo", "vencimentos"].includes(p);
  const u = new URL(location); u.hash = p; history.replaceState(null, "", u);
  render(); window.scrollTo(0, 0);
}
async function iniciar() {
  try { [E.d, E.meta] = await Promise.all([getJSON("dados/divida.json"), getJSON("dados/meta.json").catch(() => null)]); }
  catch { $("#aviso").hidden = false; $("#aviso").textContent = "Os dados ainda estão sendo coletados pelo robô. Volte em alguns minutos."; irPara("metodo"); return; }
  montarIPCA();
  $("#ipca-ref").textContent = `IPCA até ${rotMes(IPCA.ult)}`;
  $("#atualizado").textContent = `Atualizado em ${new Date(E.d.gerado_em).toLocaleString("pt-BR")} · dados até ${rotMes(E.d.resumo.referencia)}`;
  const falhas = Object.entries(E.meta?.situacao || {}).filter(([k, v]) => k !== "populacao" && v !== "ok");
  if (falhas.length) { $("#aviso").hidden = false; $("#aviso").textContent = `Na última coleta, não responderam: ${falhas.map(([k]) => ({ series: "séries do Banco Central", cronograma: "cronograma de vencimentos", focus: "Focus", bancos: "IF.data" }[k] || k)).join(", ")}. Mostramos os dados da coleta anterior.`; }
  const h = location.hash.slice(1), mb = h.match(/^banco-(.+)$/);
  irPara(mb ? "bancos" : PAGS[h] ? h : "inicio");
  if (mb) { await rBancos(); fichaBanco(decodeURIComponent(mb[1])); }
}
document.addEventListener("click", (e) => {
  const bk = e.target.closest("[data-banco]"); if (bk) { fichaBanco(bk.dataset.banco); return; }
  const o = e.target.closest("#b-tab th[data-ord]"); if (o) { const c = o.dataset.ord; E.ordB = [c, E.ordB[0] === c ? -E.ordB[1] : ["nome", "segmento", "controle"].includes(c) ? 1 : -1]; tabelaBancos(E.b.bancos.filter((b) => b.tvm > 0)); return; }
  const b = e.target.closest(".menu nav button"); if (b) irPara(b.dataset.pag);
});
const refazBancos = () => { E.limB = 30; if (E.b) tabelaBancos(E.b.bancos.filter((b) => b.tvm > 0)); };
$("#b-q").oninput = refazBancos; $("#b-seg-f").onchange = refazBancos; $("#b-ctrl-f").onchange = refazBancos;
$("#b-mais").onclick = () => { E.limB += 50; tabelaBancos(E.b.bancos.filter((b) => b.tvm > 0)); };
$("#p-mais").onclick = () => { E.limP = 999; rPrevisao(); };
["#f-periodo", "#f-ipca"].forEach((k) => ($(k).onchange = () => render()));
$("#ficha-fechar").onclick = () => ($("#ficha").hidden = true);
$("#ficha").onclick = (e) => { if (e.target.id === "ficha") $("#ficha").hidden = true; };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#ficha").hidden = true; });
$("#abrir-menu").onclick = () => { $("#menu").classList.add("aberto"); $("#veu").hidden = false; };
$("#veu").onclick = () => { $("#menu").classList.remove("aberto"); $("#veu").hidden = true; };
let rz, larg = innerWidth; addEventListener("resize", () => { if (innerWidth === larg) return; larg = innerWidth; clearTimeout(rz); rz = setTimeout(render, 250); });
iniciar();
})();
