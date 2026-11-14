/* Projeto Quanto Custa — Senadores */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const E = { meta: null, ano: null, pag: "inicio", res: {}, forn: {}, ord: ["custo", -1], ordV: ["vo", -1], lim: 30, limF: 50, limV: 30, limW: 50, tick: 0, graf: {} };
const brl = (v, d = 0) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: d, maximumFractionDigits: d });
const curto = (v) => { const a = Math.abs(v || 0);
  if (a >= 1e9) return "R$ " + (v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " bi";
  if (a >= 999_500) return "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
  if (a >= 1e3) return "R$ " + (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil";
  return brl(v); };
const nf = (v, d = 0) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const semAcento = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soma = (a) => a.reduce((s, x) => s + (x || 0), 0);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const dataBR = (s) => (s ? s.split("-").reverse().join("/") : "—");
const getJSON = async (u) => { const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };
// valor por extenso para ler números grandes: 2.193.266.731 -> "≈ 2,19 bilhões de reais"
const porExtenso = (v) => { const a = Math.abs(v || 0);
  for (const [b, um, varios] of [[1e12, "trilhão", "trilhões"], [1e9, "bilhão", "bilhões"], [1e6, "milhão", "milhões"], [1e3, "mil", "mil"]]) {
    if (a < b) continue;
    const x = v / b, t = x.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(x) < 10 ? 2 : Math.abs(x) < 100 ? 1 : 0 });
    return b === 1e3 ? `≈ ${t} mil reais` : `≈ ${t} ${Math.abs(x) < 2 ? um : varios} de reais`; }
  return ""; };
const tot = () => E.ano === "total";
const corrigir = () => $("#f-ipca").checked;
const VINCULOS = { PARLAMENTAR: "Parlamentar", COMISSIONADO: "Comissionado", EFETIVO: "Efetivo" };
const rotVinculo = (v) => VINCULOS[v] || (v ? v.charAt(0) + v.slice(1).toLowerCase() : "Não informado");
const fatorDe = (r) => (corrigir() ? r?.fator_ipca || 1 : 1);

// fotos oficiais vêm com http:// e o navegador bloqueia em site https
const https = (u) => String(u || "").replace(/^http:\/\//, "https://");
async function resumo(a) {
  if (E.res[a]) return E.res[a];
  const r = await getJSON(`dados/${a}/resumo.json`).catch(() => null);
  r?.senadores.forEach((s) => (s.foto = https(s.foto)));
  return (E.res[a] = r);
}

// resumo do ano escolhido; em "Todos os anos", soma os anos (já corrigidos pelo IPCA de cada ano)
async function dados() {
  if (!tot()) { const r = await resumo(E.ano); return r ? r.senadores.map((s) => ({ ...s, F: fatorDe(r), anos: [r.ano] })) : []; }
  const rs = (await Promise.all(E.meta.anos.map(resumo))).filter(Boolean);
  const m = new Map();
  rs.forEach((r) => { const F = fatorDe(r); r.senadores.forEach((s) => {
    let o = m.get(s.id);
    if (!o) m.set(s.id, (o = { ...s, custo: 0, custos: { salario: 0, ceaps: 0 }, categorias: {}, viagens: {}, notas: 0, meses: 0, F: 1, anos: [] }));
    Object.entries(s.viagens || {}).forEach(([k, [v, n]]) => { const q = (o.viagens[k] = o.viagens[k] || [0, 0]); q[0] += v * F; q[1] += n; });
    Object.assign(o, { nome: s.nome, partido: s.partido, uf: s.uf, foto: s.foto, url: s.url });
    o.custo += s.custo * F; o.custos.salario += s.custos.salario * F; o.custos.ceaps += s.custos.ceaps * F; o.notas += s.notas; o.meses += s.meses; o.anos.push(r.ano);
    Object.entries(s.categorias || {}).forEach(([k, v]) => (o.categorias[k] = (o.categorias[k] || 0) + v * F));
  }); });
  return [...m.values()];
}
const passa = (s) => { const uf = $("#f-uf").value, p = $("#f-partido").value, q = semAcento($("#f-busca").value.trim());
  return (!uf || s.uf === uf) && (!p || s.partido === p) && (!q || semAcento(s.nome).includes(q)); };
const temFiltro = () => !!($("#f-uf").value || $("#f-partido").value || $("#f-busca").value.trim());
const V = (s, k) => (k === "custo" ? s.custo : k === "salario" ? s.custos.salario : s.custos.ceaps) * s.F;
const rotAno = () => (tot() ? `${E.meta.anos[0]}–${E.meta.anos[E.meta.anos.length - 1]}` : E.ano);

function kpis(el, itens) { $(el).innerHTML = itens.map(([r, v, o]) => `<div class="kpi"><div class="rot">${r}</div><div class="val num">${v}</div><div class="obs">${o || ""}</div></div>`).join(""); }
function grafico(id, cfg) { E.graf[id]?.destroy(); E.graf[id] = new Chart($("#" + id), cfg); }
const tipBRL = { callbacks: { label: (c) => `${c.dataset.label ? c.dataset.label + ": " : ""}${brl(c.parsed.x ?? c.parsed.y ?? c.parsed)}` } };

// ---------------------------------------------------------------- início
const UF_ROT = { AC: [58, 228], AL: [626, 240, 583, 233], AP: [336, 62], AM: [150, 150], BA: [500, 290], CE: [538, 160], DF: [446, 318, 409, 330],
  ES: [556, 404, 520, 392], GO: [370, 352], MA: [446, 168], MT: [282, 282], MS: [302, 412], MG: [452, 374], PA: [330, 140], PB: [626, 192, 590, 193],
  PR: [352, 478], PE: [626, 216, 572, 213], PI: [482, 196], RJ: [520, 452, 492, 433], RN: [626, 168, 585, 174], RS: [314, 584], RO: [168, 254],
  RR: [188, 56], SC: [364, 530], SP: [400, 446], SE: [626, 264, 573, 247], TO: [402, 228] };
function mapa(el, D) {
  const M = window.MAPA_BR; if (!M) return;
  const ufs = Object.keys(M.ufs), por = {};
  D.forEach((s) => { if (!s.uf) return; const o = (por[s.uf] = por[s.uf] || { t: 0, m: 0 }); o.t += s.custo * s.F; o.m += s.meses; });
  const val = Object.fromEntries(Object.entries(por).map(([k, o]) => [k, o.m ? o.t / o.m : 0])), vs = Object.values(val).filter((v) => v > 0);
  const mn = Math.min(...vs), mx = Math.max(...vs), sel = $("#f-uf").value;
  el.innerHTML = `<svg viewBox="${M.viewBox}">${ufs.map((u) => { const t = val[u] && mx > mn ? (val[u] - mn) / (mx - mn) : 0.3, c = [222 - 150 * t, 235 - 110 * t, 247 - 60 * t].map(Math.round);
    return `<path d="${M.ufs[u][1]}" data-uf="${u}" class="${u === sel ? "sel" : ""}" style="${u === sel ? "" : `fill:rgb(${c})`}"><title>${M.ufs[u][0]}${val[u] ? " · " + brl(val[u]) + " por senador, por mês" : ""}</title></path>`; }).join("")}
    ${ufs.map((u) => { const p = UF_ROT[u]; return p.length > 2 ? `<line x1="${p[0] - 6}" y1="${p[1] - 4}" x2="${p[2]}" y2="${p[3]}" class="uf-linha"/>` : ""; }).join("")}
    ${ufs.map((u) => { const p = UF_ROT[u]; return `<text x="${p[0]}" y="${p[1]}" data-uf="${u}" class="uf-rot${p.length > 2 ? " fora" : ""}">${u}</text>`; }).join("")}</svg>
    <p class="mapa-br-leg">Cor: custo médio de um senador por mês em ${rotAno()} (mais escuro = mais caro).</p>`;
}
async function rInicio() {
  const D = (await dados()).filter(passa);
  const t = soma(D.map((s) => V(s, "custo"))), c = soma(D.map((s) => V(s, "ceaps")));
  $("#i-rot").textContent = `${temFiltro() ? "Os senadores do filtro custaram" : "Os senadores custaram"} em ${rotAno()}`;
  const r = tot() ? null : E.res[E.ano], prevAtiva = r && !r.fechado && r.previsao;
  const rest = prevAtiva ? soma(D.map((s) => (s.previsao?.restante || 0) * s.F)) : 0;
  cancelAnimationFrame(E.tick);
  if (prevAtiva && rest > 0) {
    // corre em tempo real: do 1º dia depois dos dados publicados até 31/12, no ritmo da previsão
    const ini = new Date(r.ano, r.meses_decorridos, 1).getTime(), fim = new Date(r.ano + 1, 0, 1).getTime();
    const porSeg = rest / ((fim - ini) / 1000);
    const passo = () => { const v = Math.min(t + rest, t + Math.max(0, (Date.now() - ini) / 1000) * porSeg); $("#i-total").textContent = brl(v); $("#i-ext").textContent = porExtenso(v);
      if (E.pag === "inicio") E.tick = requestAnimationFrame(passo); };
    passo();
    $("#i-nota").innerHTML = `${corrigir() ? "em valores de hoje, <b>corrigidos pela inflação (IPCA)</b>" : "em valores da época"} · salário + cota parlamentar (CEAPS) · é um piso: a equipe do gabinete ainda não entra<br>
      <span class="ritmo">O valor avança em tempo real, no ritmo previsto: <b>+${brl(porSeg, 2)} por segundo</b> · ${curto(porSeg * 86400)} por dia · previsão para ${r.ano}: <b>${curto(t + rest)}</b> (estimativa)</span>`;
  } else {
    $("#i-total").textContent = brl(t); $("#i-ext").textContent = porExtenso(t);
    $("#i-nota").innerHTML = `${corrigir() ? "em valores de hoje, <b>corrigidos pela inflação (IPCA)</b>" : "em valores da época"} · salário + cota parlamentar (CEAPS) · é um piso: a equipe do gabinete ainda não entra`;
  }
  const meses = soma(D.map((s) => s.meses));
  kpis("#i-kpis", [...(rest > 0 ? [["Previsão até dezembro", "+" + curto(rest), `${r.ano} deve fechar em ${curto(t + rest)}`]] : []), ["Cota parlamentar (CEAPS)", curto(c), `${nf(soma(D.map((s) => s.notas)))} notas`], ["Salários", curto(soma(D.map((s) => V(s, "salario")))), "subsídio + 13º"],
    ["Custo médio por mês", brl(meses ? t / meses : 0), "por senador em exercício"], ["Senadores", nf(D.length), "com mandato no período (inclui suplentes)"]]);
  mapa($("#i-mapa"), D);
  const top = [...D].sort((a, b) => V(b, "custo") - V(a, "custo")).slice(0, 5);
  $("#i-top").innerHTML = top.map((s) => `<li><img src="${esc(s.foto)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span><button class="link-dep" data-sen="${s.id}">${esc(s.nome)}</button><span class="s">${esc(s.partido)}${s.uf ? "-" + esc(s.uf) : ""}</span></span><span class="v">${curto(V(s, "custo"))}</span></li>`).join("");
  const cats = {}; D.forEach((s) => Object.entries(s.categorias || {}).forEach(([k, v]) => (cats[k] = (cats[k] || 0) + v * (tot() ? 1 : s.F))));
  const cs = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  grafico("g-cat", { type: "bar", data: { labels: cs.map((x) => x[0]), datasets: [{ data: cs.map((x) => x[1]), backgroundColor: css("--accent") }] },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tipBRL },
      scales: { x: { ticks: { callback: (v) => curto(v), maxRotation: 0, autoSkip: true, maxTicksLimit: innerWidth < 600 ? 4 : 10 } },
                y: { ticks: { callback(v) { const t = this.getLabelForValue(v); return innerWidth < 600 && t.length > 24 ? t.slice(0, 23) + "…" : t; } } } } } });
}

// ---------------------------------------------------------------- senadores
async function rSenadores() {
  const D = (await dados()).filter(passa).map((s) => ({ ...s, vc: V(s, "custo"), vs: V(s, "salario"), vce: V(s, "ceaps"), mm: s.meses ? V(s, "custo") / s.meses : 0,
    pr: (s.previsao?.restante || 0) * s.F }));
  const temPrev = !tot() && D.some((s) => s.pr > 0);
  const G = await gabinetes(), anoAtual = !tot() && E.ano === E.meta.anos[E.meta.anos.length - 1];
  D.forEach((s) => (s.eq = anoAtual ? G?.por_senador?.[String(s.id)]?.total ?? 0 : 0));
  const temEq = anoAtual && G;
  kpis("#s-kpis", [...(temPrev ? [["Previsão até dezembro", "+" + curto(soma(D.map((s) => s.pr))), `fecha o ano em ${curto(soma(D.map((s) => s.vc + s.pr)))}`]] : []), ["Custo somado", curto(soma(D.map((s) => s.vc))), rotAno()], ["Cota (CEAPS)", curto(soma(D.map((s) => s.vce)))], ["Senadores", nf(D.length)],
    ["Custo médio por mês", brl(soma(D.map((s) => s.vc)) / Math.max(1, soma(D.map((s) => s.meses)))), "por senador"]]);
  const [k, d] = E.ord;
  D.sort((a, b) => ((a[k] ?? 0) > (b[k] ?? 0) ? 1 : (a[k] ?? 0) < (b[k] ?? 0) ? -1 : 0) * d);
  const col = [["pos", "#"], ["nome", "Senador"], ["vc", "Custo total"], ["mm", "Por mês"], ["vs", "Salário"], ["vce", "Cota (CEAPS)"], ...(temPrev ? [["pr", "Previsão até dez"]] : []), ...(temEq ? [["eq", "Equipe do gabinete"]] : []), ["meses", "Meses"], ["notas", "Notas"]];
  $("#s-tab").innerHTML = `<thead><tr>${col.map(([c, t], i) => `<th class="${i > 1 ? "num" : ""}" data-k="${c}" ${c === k ? `aria-sort="${d < 0 ? "descending" : "ascending"}"` : ""} style="cursor:pointer">${t}</th>`).join("")}</tr></thead><tbody>` +
    D.slice(0, E.lim).map((s, i) => `<tr><td class="num">${i + 1}º</td><td><button class="link-dep" data-sen="${s.id}">${esc(s.nome)}</button> <span class="sub">${esc(s.partido)}${s.uf ? "-" + esc(s.uf) : ""}</span></td>
      <td class="num"><b>${brl(s.vc)}</b></td><td class="num">${brl(s.mm)}</td><td class="num">${brl(s.vs)}</td><td class="num">${brl(s.vce)}</td>${temPrev ? `<td class="num prev">${s.pr ? "+" + curto(s.pr) : "—"}</td>` : ""}${temEq ? `<td class="num">${s.eq ? nf(s.eq) + " pessoas" : "—"}</td>` : ""}<td class="num">${nf(s.meses)}</td><td class="num">${nf(s.notas)}</td></tr>`).join("") +
    `</tbody><tfoot><tr><td></td><td>Total (${nf(D.length)})</td><td class="num">${brl(soma(D.map((s) => s.vc)))}</td><td></td><td class="num">${brl(soma(D.map((s) => s.vs)))}</td><td class="num">${brl(soma(D.map((s) => s.vce)))}</td>${temPrev ? `<td class="num">+${curto(soma(D.map((s) => s.pr)))}</td>` : ""}${temEq ? `<td class="num">${nf(soma(D.map((s) => s.eq)))}</td>` : ""}<td class="num">${nf(soma(D.map((s) => s.meses)))}</td><td class="num">${nf(soma(D.map((s) => s.notas)))}</td></tr></tfoot>`;
  $$("#s-tab th").forEach((th) => (th.onclick = () => { if (th.dataset.k === "pos") return; E.ord = [th.dataset.k, th.dataset.k === k ? -d : -1]; rSenadores(); }));
  $("#s-mais").hidden = D.length <= E.lim;
}

// ---------------------------------------------------------------- fornecedores
async function fornDoAno(a) { return E.forn[a] || (E.forn[a] = await getJSON(`dados/${a}/fornecedores.json`).catch(() => null)); }
async function fornecedores() {
  const anos = tot() ? E.meta.anos : [E.ano];
  if (tot()) $("#f-info").textContent = `Somando ${anos.length} anos…`;
  const arqs = (await Promise.all(anos.map(fornDoAno))).map((x, i) => [x, anos[i]]).filter(([x]) => x);
  const m = new Map();
  for (const [x, a] of arqs) {
    const F = fatorDe(E.res[a] || (await resumo(a)));
    x.linhas.forEach(([ch, nome, doc, tp, v, n, sens, tipos, maiores]) => {
      let o = m.get(ch);
      if (!o) m.set(ch, (o = { ch, nome, doc, tp, v: 0, n: 0, sens: new Map(), tipos: {}, maiores: [] }));
      o.v += v * F; o.n += n;
      sens.forEach(([s, sv, sn]) => { const q = o.sens.get(s) || [0, 0]; q[0] += sv * F; q[1] += sn; o.sens.set(s, q); });
      Object.entries(tipos).forEach(([t, tv]) => (o.tipos[t] = (o.tipos[t] || 0) + tv * F));
      maiores.forEach((mm) => o.maiores.push([mm[0], mm[1] * F, mm[2], mm[3], mm[4], a]));
    });
  }
  return [...m.values()];
}
async function rFornecedores() {
  const L = await fornecedores(), D = await dados(), nomes = new Map(D.map((s) => [String(s.id), s]));
  const ids = temFiltro() ? new Set(D.filter(passa).map((s) => String(s.id))) : null;
  const tipo = $("#f-tipo").value, q = semAcento($("#f-q").value.trim()), qd = q.replace(/\D/g, "");
  const sel = $("#f-tipo");
  if (sel.options.length <= 1) { const ts = {}; L.forEach((f) => Object.entries(f.tipos).forEach(([t, v]) => (ts[t] = (ts[t] || 0) + v)));
    sel.innerHTML = `<option value="">Todos os tipos de gasto</option>` + Object.entries(ts).sort((a, b) => b[1] - a[1]).map(([t]) => `<option>${esc(t)}</option>`).join(""); }
  // valor de cada fornecedor considerando o filtro de senadores e o tipo de gasto
  const linhas = L.map((f) => {
    let v = f.v, n = f.n, ns = f.sens.size;
    if (ids) { const ss = [...f.sens.entries()].filter(([s]) => ids.has(String(s))); v = soma(ss.map((x) => x[1][0])); n = soma(ss.map((x) => x[1][1])); ns = ss.length; }
    if (tipo) v = ids ? v * ((f.tipos[tipo] || 0) / (f.v || 1)) : f.tipos[tipo] || 0;
    return { ...f, vv: v, nn: n, ns };
  }).filter((f) => f.vv > 0.004 && (!q || semAcento(f.nome).includes(q) || (qd.length >= 4 && (f.doc || "").replace(/\D/g, "").includes(qd))))
    .sort((a, b) => b.vv - a.vv);
  const total = soma(linhas.map((f) => f.vv));
  kpis("#f-kpis", [["Pago a fornecedores", curto(total), `${rotAno()}${tipo ? " · " + tipo : ""}`], ["Fornecedores diferentes", nf(linhas.length)],
    ["Notas", nf(soma(linhas.map((f) => f.nn)))], ["Os 10 maiores levaram", nf(total ? (soma(linhas.slice(0, 10).map((f) => f.vv)) / total) * 100 : 0, 1) + "%"]]);
  $("#f-info").textContent = (ids ? `Só as notas dos ${nf(ids.size)} senadores do filtro. ` : "") + (tipo && ids ? "Com filtro de senador e de tipo, o valor por tipo é proporcional. " : "");
  $("#f-tab").innerHTML = `<thead><tr><th>#</th><th>Fornecedor</th><th class="num">Recebido</th><th class="num">Notas</th><th class="num">Senadores</th><th>Principal gasto</th></tr></thead><tbody>` +
    linhas.slice(0, E.limF).map((f, i) => `<tr><td class="num">${i + 1}º</td><td class="quebra"><button class="link-dep" data-forn="${esc(f.ch)}">${esc(f.nome || "(fornecedor não informado pelo Senado)")}</button><div class="sub">${esc(f.doc || (f.tp === "PF" ? "pessoa física" : ""))}</div></td>
      <td class="num"><b>${brl(f.vv, 2)}</b></td><td class="num">${nf(f.nn)}</td><td class="num">${nf(f.ns)}</td><td class="quebra sub">${esc(Object.entries(f.tipos).sort((a, b) => b[1] - a[1])[0]?.[0] || "")}</td></tr>`).join("") +
    `</tbody><tfoot><tr><td></td><td>Total (${nf(linhas.length)} fornecedores)</td><td class="num">${brl(total, 2)}</td><td class="num">${nf(soma(linhas.map((f) => f.nn)))}</td><td></td><td></td></tr></tfoot>`;
  $("#f-mais").hidden = linhas.length <= E.limF;
  E.fornAtual = { L, nomes };
}
// Receita Federal (cadastro, sócios e alertas), quando o robô "Receita Federal" já rodou
const RF = {};
const rfGet = (u) => RF[u] || (RF[u] = getJSON(u).catch(() => null));
async function blocoReceita(ch) {
  if (!/^\d{14}$/.test(ch)) return "";
  const [meta, grupo, al] = await Promise.all([rfGet("dados/receita/meta.json"), rfGet(`dados/receita/cadastro/${ch.slice(0, 2)}.json`), rfGet("dados/receita/alertas.json")]);
  if (!meta) return `<p class="sub">O cadastro na Receita Federal aparece aqui depois que o robô “Receita Federal” rodar.</p>`;
  const c = grupo?.[ch];
  if (!c) return `<p class="sub">CNPJ não consultado na base da Receita de ${esc(meta.base)} (fornecedor novo: entra na próxima base).</p>`;
  if (c.nao_encontrado) return `<p class="aviso-comprovante">CNPJ não encontrado na base da Receita Federal de ${esc(meta.base)}${c.cnpj_valido === false ? " (o dígito verificador do CNPJ informado é inválido)" : ""}.</p>`;
  const alertas = (al?.linhas || []).filter((a) => a[0] === ch);
  const e = c.end || {}, sim = c.simples || {};
  const linha = (r, v) => (v ? `<tr><td>${r}</td><td class="quebra">${v}</td></tr>` : "");
  return `${alertas.length ? `<div class="aviso-comprovante"><b>Pontos de atenção</b> (fatos do cadastro, não são acusação):<ul>${alertas.map((a) => `<li>${esc(a[2])}</li>`).join("")}</ul></div>` : ""}
    <table class="ranking"><tbody>
    ${linha("Razão social", esc(c.razao))}${linha("Nome fantasia", esc(c.fantasia))}
    ${linha("Situação", `${esc(c.situacao)}${c.data_situacao ? " desde " + dataBR(c.data_situacao) : ""}${c.motivo ? " · " + esc(c.motivo) : ""}`)}
    ${linha("Abertura", dataBR(c.abertura))}${linha("Atividade principal", c.cnae ? esc(c.cnae[0] + " · " + c.cnae[1]) : "")}
    ${linha("Natureza jurídica", esc(c.natureza))}${linha("Porte", esc(c.porte))}${linha("Capital social", c.capital != null ? brl(c.capital, 2) : "")}
    ${linha("Simples / MEI", sim.mei ? `MEI desde ${dataBR(sim.mei_desde)}${sim.mei_ate ? " até " + dataBR(sim.mei_ate) : ""}` : sim.simples ? `Simples Nacional desde ${dataBR(sim.simples_desde)}` : "Não optante")}
    ${linha("Endereço", esc([e.logradouro, e.numero, e.complemento, e.bairro, e.municipio && e.municipio + "-" + e.uf, e.cep].filter(Boolean).join(", ")))}
    </tbody></table>
    ${(c.socios || []).length ? `<h3 class="d-sec">Sócios (${nf(c.socios.length)})</h3><div class="tabela-rolagem"><table class="ranking"><thead><tr><th>Nome</th><th>Documento</th><th>Qualificação</th><th>Desde</th></tr></thead><tbody>${c.socios.map((x) => `<tr><td class="quebra">${esc(x[1])}${x[5] ? `<div class="sub">${esc(x[5])}</div>` : ""}</td><td>${esc(x[2])}</td><td class="quebra sub">${esc(x[3])}</td><td>${dataBR(x[4])}</td></tr>`).join("")}</tbody></table></div>` : `<p class="sub">Sem sócios no cadastro (empresário individual ou MEI).</p>`}
    <p class="sub">Fonte: dados abertos do CNPJ da Receita Federal, base ${esc(meta.base)}. CPF dos sócios aparece mascarado pela própria Receita.</p>`;
}
async function fichaFornecedor(ch) {
  const f = E.fornAtual?.L.find((x) => x.ch === ch); if (!f) return;
  const nomes = E.fornAtual.nomes;
  const ss = [...f.sens.entries()].sort((a, b) => b[1][0] - a[1][0]);
  abrirFicha(`<div class="ficha-cab"><div><p class="selo">Fornecedor · ${rotAno()}</p><h2>${esc(f.nome || "(fornecedor não informado pelo Senado)")}</h2><p class="sub">${esc(f.doc || "")} ${f.tp === "PJ" ? `· <a href="https://casadosdados.com.br/solucao/cnpj/${esc(f.ch)}" target="_blank" rel="noopener">consultar CNPJ</a>` : ""}</p></div></div>
    <div class="kpis">${[["Recebido", brl(f.v, 2)], ["Notas", nf(f.n)], ["Senadores que pagaram", nf(ss.length)], ["Valor médio por nota", brl(f.v / Math.max(1, f.n), 2)]].map(([r, v]) => `<div class="kpi"><div class="rot">${r}</div><div class="val num">${v}</div></div>`).join("")}</div>
    <div class="d-grade2"><div><h3 class="d-sec">Quem pagou</h3><table class="ranking"><tbody>${ss.map(([s, [v, n]]) => { const x = nomes.get(String(s));
      return `<tr><td class="quebra">${x ? `<button class="link-dep" data-sen="${esc(s)}">${esc(x.nome)}</button> <span class="sub">${esc(x.partido)}${x.uf ? "-" + esc(x.uf) : ""}</span>` : esc(s)}</td><td class="num">${nf(n)} nota(s)</td><td class="num">${brl(v, 2)}</td></tr>`; }).join("")}</tbody></table></div>
    <div><h3 class="d-sec">Por tipo de gasto</h3><table class="ranking"><tbody>${Object.entries(f.tipos).sort((a, b) => b[1] - a[1]).map(([t, v]) => `<tr><td class="quebra">${esc(t)}</td><td class="num">${brl(v, 2)}</td></tr>`).join("")}</tbody></table></div></div>
    <h3 class="d-sec">Maiores notas</h3><table class="ranking"><thead><tr><th>Data</th><th>Senador</th><th>Documento</th><th>Detalhe</th><th class="num">Valor</th></tr></thead><tbody>${f.maiores.sort((a, b) => b[1] - a[1]).slice(0, 30).map((m) => { const x = nomes.get(String(m[2]));
      return `<tr><td>${dataBR(m[0])}</td><td>${esc(x?.nome || m[2])}</td><td>${esc(m[3] || "")}</td><td class="quebra sub">${esc(m[4] || "")}</td><td class="num">${brl(m[1], 2)}</td></tr>`; }).join("")}</tbody></table>
    <p class="sub">Para ver todas as notas deste fornecedor com um senador, abra a ficha do senador.</p>
    <h3 class="d-sec">Cadastro na Receita Federal</h3><div id="ff-receita"><p class="sub">Carregando…</p></div>`);
  const rf = await blocoReceita(ch);
  if ($("#ff-receita")) $("#ff-receita").innerHTML = rf;
}

// ---------------------------------------------------------------- equipe do gabinete (fotografia do mês)
const gabinetes = () => E.gab || (E.gab = getJSON("dados/gabinetes.json").catch(() => null));
async function blocoGabinete(id) {
  const G = await gabinetes(), g = G?.por_senador?.[String(id)];
  if (!G) return "";
  const mes = new Date(G.data + "T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  if (!g) return `<h3 class="d-sec">Equipe do gabinete</h3><p class="sub">Sem gabinete na lista de servidores do Senado de ${mes} (senador fora de exercício).</p>`;
  const mor = g.imovel_funcional ? "mora em <b>imóvel funcional</b> do Senado" : g.auxilio_moradia ? `recebe <b>auxílio-moradia</b> (${brl(G.auxilio_moradia_valor)} por mês)` : g.imovel_funcional === false ? "não usa imóvel funcional nem auxílio-moradia" : "";
  const fun = Object.entries(g.funcoes || {}).map(([f, n]) => `${esc(f.toLowerCase())}: ${n}`).join(" · ");
  return `<h3 class="d-sec">Equipe do gabinete (${mes})</h3>
    <div class="kpis">${[["Pessoas na equipe", nf(g.total || 0)], ["Comissionados (sem concurso)", nf(g.comissionados || 0)], ["Servidores efetivos", nf(g.efetivos || 0)]].map(([a, b]) => `<div class="kpi"><div class="rot">${a}</div><div class="val num">${b}</div></div>`).join("")}</div>
    ${mor ? `<p>Moradia em Brasília: ${mor}.</p>` : ""}
    <p class="aviso-comprovante"><b>O Senado não divulga em arquivo o salário de cada assessor</b> (só consulta nome por nome no site), por isso o custo da equipe ainda não entra no total deste senador.</p>
    ${fun ? `<p class="sub">Funções: ${fun}.</p>` : ""}
    ${(g.pessoas || []).length ? `<details class="equipe"><summary>Ver os ${nf(g.pessoas.length)} nomes da equipe</summary>
      <div class="tabela-rolagem"><table class="ranking"><thead><tr><th>Nome</th><th>Função</th><th>Vínculo</th><th>Desde</th></tr></thead><tbody>${g.pessoas.map(([n, f, v, d]) => `<tr><td class="quebra">${esc(n)}</td><td class="quebra sub">${esc(f)}</td><td class="sub">${esc((v || "").toLowerCase())}</td><td>${esc(d)}</td></tr>`).join("")}</tbody></table></div>
      <p class="sub">Fonte: lista de servidores do Senado Federal (dados abertos), ${mes}. Nomes de servidores públicos são informação pública.</p></details>` : ""}`;
}

// ---------------------------------------------------------------- ficha do senador
function abrirFicha(html) { $("#ficha-corpo").innerHTML = html; $("#ficha").hidden = false; $("#ficha").scrollTop = 0; }
async function fichaSenador(id) {
  const D = await dados(), s = D.find((x) => String(x.id) === String(id)); if (!s) return;
  const anoN = tot() ? E.meta.anos[E.meta.anos.length - 1] : E.ano;
  const r = await resumo(anoN), F = fatorDe(r), sa = r?.senadores.find((x) => String(x.id) === String(id));
  const nd = sa ? await getJSON(`dados/${anoN}/notas/${id}.json`).catch(() => null) : null;
  const hist = (await Promise.all(E.meta.anos.map(resumo))).filter(Boolean).map((x) => [x.ano, x.senadores.find((y) => String(y.id) === String(id)), fatorDe(x)]).filter(([, y]) => y);
  abrirFicha(`<div class="ficha-cab"><img src="${esc(s.foto)}" alt="" onerror="this.style.visibility='hidden'"><div><p class="selo">Senador(a) · ${rotAno()}</p><h2>${esc(s.nome)}</h2>
      <p class="sub">${esc(s.partido)}${s.uf ? "-" + esc(s.uf) : ""} · ${nf(s.meses)} meses em exercício ${s.url ? `· <a href="${esc(s.url)}" target="_blank" rel="noopener">página oficial</a>` : ""}</p></div></div>
    <div class="kpis">${[["Custo", brl(V(s, "custo"))], ["Salário", brl(V(s, "salario"))], ["Cota (CEAPS)", brl(V(s, "ceaps"))], ["Por mês", brl(s.meses ? V(s, "custo") / s.meses : 0)],
      ...(!tot() && s.previsao?.restante ? [["Previsão até dezembro", "+" + brl(s.previsao.restante * s.F)]] : [])].map(([a, b]) => `<div class="kpi"><div class="rot">${a}</div><div class="val num">${b}</div></div>`).join("")}</div>
    <p class="sub"><button class="btn" id="card-sen" type="button">Gerar imagem para compartilhar</button></p>
    <div class="d-grade2"><div><h3 class="d-sec">Cota por mês em ${anoN}</h3><div class="canvas-box"><canvas id="g-f-mes"></canvas></div></div>
      <div><h3 class="d-sec">Ano a ano</h3><div class="canvas-box"><canvas id="g-f-hist"></canvas></div></div></div>
    <div id="ficha-gab"></div>
    <h3 class="d-sec">Cota por tipo de gasto (${rotAno()})</h3><table class="ranking"><tbody>${Object.entries(s.categorias).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td class="quebra">${esc(k)}</td><td class="num">${brl(v * (tot() ? 1 : s.F), 2)}</td></tr>`).join("")}</tbody></table>
    ${s.casado === false ? `<p class="aviso-comprovante">Este nome aparece na planilha da cota, mas não foi encontrado na lista oficial de senadores. Por isso só a cota (CEAPS) entra no custo, sem salário.</p>` : ""}
    ${nd?.passageiros?.length ? `<h3 class="d-sec">Quem viajou com a cota em ${anoN}</h3>
      <p class="sub">Passageiros citados no detalhamento das passagens. Quando a nota tem mais de um passageiro, o valor é dividido igualmente entre eles. “Parlamentar” é o próprio senador ou outro parlamentar; “Comissionado” é servidor de livre nomeação; “Efetivo” é servidor concursado.</p>
      <div class="tabela-rolagem passageiros"><table class="ranking"><thead><tr><th>Passageiro</th><th>Vínculo</th><th class="num">Trechos</th><th class="num">Valor</th></tr></thead><tbody>${nd.passageiros.map(([n, v, q, x]) => `<tr><td class="quebra">${esc(n)}</td><td>${esc(rotVinculo(v))}</td><td class="num">${nf(q)}</td><td class="num">${brl(x * F, 2)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <h3 class="d-sec">Todas as notas de ${anoN}, nota a nota</h3>
    <p class="aviso-comprovante"><b>O Senado não publica a imagem dos comprovantes</b> (notas fiscais e recibos), diferente da Câmara dos Deputados. Aqui aparecem só os dados digitados pelo Senado. O comprovante de uma nota pode ser pedido pela Lei de Acesso à Informação, no Serviço de Informação ao Cidadão (SIC) do Senado.</p>
    ${nd ? `<div class="filtros-tabela"><input id="n-q" class="mini-busca" type="search" placeholder="Fornecedor, documento, passageiro ou detalhe"></div><div class="tabela-rolagem"><table class="ranking notas-tab" id="n-tab"></table></div>` : `<p class="sub">Sem notas neste ano.</p>`}`);
  blocoGabinete(id).then((h) => { const el = $("#ficha-gab"); if (el) el.innerHTML = h; });
  $("#card-sen").onclick = () => cartaoSenador(s, D, anoN, nd, F);
  if (sa) grafico("g-f-mes", { type: "bar", data: { labels: MESES, datasets: [{ label: "Cota", data: (sa.mensal_ceaps || []).map((v) => v * F), backgroundColor: css("--accent") }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tipBRL }, scales: { y: { ticks: { callback: (v) => curto(v) } } } } });
  grafico("g-f-hist", { type: "bar", data: { labels: hist.map((h) => h[0]), datasets: [{ label: "Salário", data: hist.map(([, y, f]) => y.custos.salario * f), backgroundColor: "#14283F" }, { label: "Cota", data: hist.map(([, y, f]) => y.custos.ceaps * f), backgroundColor: "#2475B8" }] },
    options: { maintainAspectRatio: false, plugins: { tooltip: tipBRL }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (v) => curto(v) } } } } });
  if (nd) {
    const desenhar = () => { const q = semAcento($("#n-q").value.trim());
      const ns = nd.notas.filter((n) => { const fo = nd.fornecedores[n[3]] || []; return !q || semAcento(`${fo[1]} ${fo[2]} ${n[5]} ${n[6]} ${n[2]}`).includes(q); });
      $("#n-tab").innerHTML = `<thead><tr><th>Data</th><th>Tipo</th><th>Fornecedor</th><th>Documento</th><th>Detalhe</th><th class="num">Valor</th></tr></thead><tbody>` +
        ns.map((n) => { const fo = nd.fornecedores[n[3]] || []; return `<tr><td class="data">${dataBR(n[0])}</td><td class="quebra sub">${esc(n[2])}</td><td class="quebra">${esc(fo[1] || "")}<div class="sub">${esc(fo[2] || "")}</div></td><td class="doc">${esc(n[5] || "")}</td><td class="quebra sub">${esc(n[6] || "")}</td><td class="num">${brl(n[4] * F, 2)}</td></tr>`; }).join("") +
        `</tbody><tfoot><tr><td colspan="5">Total (${nf(ns.length)} notas)</td><td class="num">${brl(soma(ns.map((n) => n[4] * F)), 2)}</td></tr></tfoot>`; };
    $("#n-q").oninput = desenhar; desenhar();
  }
}

// ---------------------------------------------------------------- cartão para compartilhar
async function cartaoSenador(s, D, anoN, nd, F) {
  const ord = D.slice().sort((a, b) => V(b, "custo") - V(a, "custo")), pos = ord.findIndex((x) => x.id === s.id) + 1, n = ord.length;
  const caro = pos <= Math.ceil(n / 2);
  const porForn = {};
  (nd?.notas || []).forEach((x) => { porForn[x[3]] = (porForn[x[3]] || 0) + x[4]; });
  const top = Object.entries(porForn).sort((a, b) => b[1] - a[1])[0], fo = top ? nd.fornecedores[top[0]] || [] : [];
  const G = await gabinetes().catch(() => null), g = G?.por_senador?.[String(s.id)];
  const cat = Object.entries(s.categorias || {}).sort((a, b) => b[1] - a[1])[0];
  const destaques = [];
  if (top) destaques.push([`Quem mais recebeu da cota: ${fo[1] || "—"}`, `${brl(top[1] * F)} em ${anoN}${fo[2] ? " · " + fo[2] : ""}`, "#118dff"]);
  if (g) destaques.push([`${nf(g.total)} pessoas na equipe do gabinete`, "lista de servidores do Senado (o salário de cada assessor não é publicado)", "#107c41"]);
  else if (cat) destaques.push([`Maior gasto da cota: ${cat[0]}`, brl(cat[1] * (tot() ? 1 : s.F)), "#107c41"]);
  CartaoQC.abrir({
    titulo: tot() ? `Custo de todos os anos (${rotAno()})` : `Custo do mandato em ${E.ano}`,
    nome: s.nome, foto: `dados/fotos/${s.id}.jpg`, linhas: [`${s.partido || ""}${s.uf ? "-" + s.uf : ""}`, `${nf(s.meses)} meses em exercício${tot() ? "" : " em " + E.ano}`],
    faixa: pos ? { titulo: pos === 1 ? "Senador mais caro" : caro ? `${pos}º mais caro` : `${n - pos + 1}º mais econômico`, sub: `entre ${n} senadores · ${tot() ? "todos os anos" : "em " + E.ano}`, cor: caro ? "#c4161c" : "#107c41" } : null,
    valorRot: "Custou aos cofres públicos", valor: V(s, "custo"), valorSub: s.meses ? `${brl(V(s, "custo") / s.meses)} por mês, em média` : "",
    destaques,
    composicao: [["Salário", V(s, "salario"), "#14283F"], ["Cota parlamentar (CEAPS)", V(s, "ceaps"), "#2475B8"]],
    fonte: `Fonte: Senado Federal (dados abertos)${corrigir() ? " · valores corrigidos pelo IPCA" : ""} · sem a equipe do gabinete`,
    arquivo: `${semAcento(s.nome).replace(/\W+/g, "-")}-${tot() ? "todos-os-anos" : E.ano}`,
  });
}

// ---------------------------------------------------------------- notas da semana
async function rSemana() {
  const anoS = E.meta.anos[E.meta.anos.length - 1];
  const W = E.semana || (E.semana = await getJSON(`dados/${anoS}/semana.json`).catch(() => null));
  if (!W || !W.notas?.length) { $("#w-info").textContent = "As notas da semana aparecem aqui depois da próxima atualização do robô."; $("#w-tab").innerHTML = ""; kpis("#w-kpis", []); return; }
  const q = semAcento($("#w-q").value.trim()), uf = $("#f-uf").value, pa = $("#f-partido").value, bs = semAcento($("#f-busca").value.trim());
  const ns = W.notas.filter((n) => (!uf || n[4] === uf) && (!pa || n[3] === pa) && (!bs || semAcento(n[2]).includes(bs))
    && (!q || semAcento(`${n[2]} ${n[5]} ${n[6]} ${n[7]} ${n[9]} ${n[10]}`).includes(q)));
  const ord = $("#w-ord").value === "valor" ? ns.slice().sort((a, b) => b[8] - a[8]) : ns;
  const maior = ns.slice().sort((a, b) => b[8] - a[8])[0], senadores = new Set(ns.map((n) => n[1]));
  kpis("#w-kpis", [["Gasto na semana", curto(soma(ns.map((n) => n[8]))), `${dataBR(W.de)} a ${dataBR(W.ate)}`], ["Notas", nf(ns.length)], ["Senadores", nf(senadores.size)],
    ["Maior nota", maior ? brl(maior[8], 2) : "—", maior ? `${esc(maior[2])} · ${esc(maior[5])}` : ""]]);
  $("#w-info").innerHTML = `Notas emitidas de <b>${dataBR(W.de)}</b> a <b>${dataBR(W.ate)}</b>: os 7 dias que terminam na nota mais recente que o Senado já publicou (o Senado publica com atraso). Valores como publicados, sem correção.${temFiltro() ? " Com os filtros do topo." : ""}`;
  $("#w-tab").innerHTML = `<thead><tr><th>Data</th><th>Senador</th><th class="num">Valor</th><th>Tipo</th><th>Fornecedor</th><th>Detalhe</th></tr></thead><tbody>` +
    ord.slice(0, E.limW).map((n) => `<tr><td class="data">${dataBR(n[0])}</td><td class="quebra">${typeof n[1] === "number" ? `<button class="link-dep" data-sen="${n[1]}">${esc(n[2])}</button>` : esc(n[2])} <span class="sub">${esc(n[3])}${n[4] ? "-" + esc(n[4]) : ""}</span></td>
      <td class="num"><b>${brl(n[8], 2)}</b></td><td class="quebra sub">${esc(n[5])}</td><td class="quebra">${esc(n[6] || "(não informado)")}<div class="sub">${esc(n[7] || "")}</div></td><td class="quebra sub">${esc(n[10] || "")}</td></tr>`).join("") +
    `</tbody><tfoot><tr><td></td><td>Total (${nf(ns.length)} notas)</td><td class="num">${brl(soma(ns.map((n) => n[8])), 2)}</td><td colspan="3"></td></tr></tfoot>`;
  $("#w-mais").hidden = ns.length <= E.limW;
}

// ---------------------------------------------------------------- quem viaja com a cota
async function rViagens() {
  const D = (await dados()).filter(passa).map((s) => { const vg = s.viagens || {}, k = (tot() ? 1 : s.F);
    const t = soma(Object.values(vg).map((x) => x[0])) * k, prop = (vg.PARLAMENTAR?.[0] || 0) * k;
    return { ...s, vt: t, vp: prop, vo: t - prop, tre: soma(Object.values(vg).map((x) => x[1])), pct: t ? ((t - prop) / t) * 100 : 0 }; }).filter((s) => s.vt > 0);
  const t = soma(D.map((s) => s.vt)), p = soma(D.map((s) => s.vp)), por = {};
  D.forEach((s) => Object.entries(s.viagens || {}).forEach(([k, [v]]) => (por[k] = (por[k] || 0) + v * (tot() ? 1 : s.F))));
  kpis("#v-kpis", [["Passagens com passageiro informado", curto(t), rotAno()], ["Para o próprio parlamentar", t ? nf((p / t) * 100, 1) + "%" : "—", curto(p)],
    ["Para outras pessoas", t ? nf(((t - p) / t) * 100, 1) + "%" : "—", curto(t - p)], ["Senadores com passagens", nf(D.length)]]);
  $("#v-vinc").innerHTML = `<tbody>${Object.entries(por).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(rotVinculo(k))}</td><td class="num">${brl(v)}</td><td class="num">${t ? nf((v / t) * 100, 1) : 0}%</td></tr>`).join("")}</tbody>`;
  const [k, d] = E.ordV;
  D.sort((a, b) => ((a[k] ?? 0) > (b[k] ?? 0) ? 1 : (a[k] ?? 0) < (b[k] ?? 0) ? -1 : 0) * d);
  const col = [["pos", "#"], ["nome", "Senador"], ["vo", "Para outras pessoas"], ["pct", "% outras pessoas"], ["vp", "Para o senador"], ["vt", "Passagens"], ["tre", "Trechos"]];
  $("#v-tab").innerHTML = `<thead><tr>${col.map(([c, tt], i) => `<th class="${i > 1 ? "num" : ""}" data-k="${c}" ${c === k ? `aria-sort="${d < 0 ? "descending" : "ascending"}"` : ""} style="cursor:pointer">${tt}</th>`).join("")}</tr></thead><tbody>` +
    D.slice(0, E.limV).map((s, i) => `<tr><td class="num">${i + 1}º</td><td><button class="link-dep" data-sen="${s.id}">${esc(s.nome)}</button> <span class="sub">${esc(s.partido)}${s.uf ? "-" + esc(s.uf) : ""}</span></td>
      <td class="num"><b>${brl(s.vo)}</b></td><td class="num">${nf(s.pct, 1)}%</td><td class="num">${brl(s.vp)}</td><td class="num">${brl(s.vt)}</td><td class="num">${nf(s.tre)}</td></tr>`).join("") + `</tbody>`;
  $$("#v-tab th").forEach((th) => (th.onclick = () => { if (th.dataset.k === "pos") return; E.ordV = [th.dataset.k, th.dataset.k === k ? -d : -1]; rViagens(); }));
  $("#v-mais").hidden = D.length <= E.limV;
}

// ---------------------------------------------------------------- o que dava pra fazer
async function rDava() {
  const R = window.REFERENCIAS; if (!R) return;
  const D = (await dados()).filter(passa), aviso = tot() && !corrigir();
  const regs = R.excesso.grupos.map(([n, re]) => [n, new RegExp(re, "i")]), gr = regs.map(([n]) => ({ n, v: 0 }));
  D.forEach((s) => Object.entries(s.categorias || {}).forEach(([c, v]) => { const i = regs.findIndex(([, re]) => re.test(c)); if (i >= 0) gr[i].v += v * (tot() ? 1 : s.F); }));
  const base = soma(gr.map((g) => g.v)), exc = base * R.excesso.percentual, pct = nf(R.excesso.percentual * 100) + "%";
  $("#dv-sub").textContent = `${pct} do que a cota ${temFiltro() ? "dos senadores do filtro" : "dos senadores"} gastou nesses grupos em ${rotAno()}, ${corrigir() ? "em valores de hoje" : "em valores da época"}:`;
  $("#dv-total").textContent = aviso ? "ligue “Valores de hoje”" : brl(exc);
  $("#dv-ext").textContent = aviso ? "" : porExtenso(exc);
  $("#dv-regra").textContent = `Base: ${brl(base)} × ${pct}.`;
  const n = (x) => (x >= 10 ? nf(Math.floor(x)) : nf(x, 1));
  $("#dv-cards").innerHTML = aviso ? "" : R.itens.map((it) => { const q = exc / (it.construcao + it.ano_funcionando), so = exc / it.construcao;
    return `<div class="dv-card"><b class="dv-num">${n(q)}</b><span class="dv-rot">${esc(it.nome)}</span><p>${it.feminino ? "construídas" : "construídos"} do zero e funcionando por 1 ano <span class="sub">(${esc(it.detalhe)})</span></p><p class="sub">Só construir e equipar: ${n(so)} ${esc(so >= 2 ? it.plural : it.unidade)}.</p></div>`; }).join("") +
    `<div class="dv-card"><b class="dv-num">${nf(Math.floor(exc / R.bolsa_familia.por_familia_ano))}</b><span class="dv-rot">famílias a mais no Bolsa Família</span><p>durante 1 ano <span class="sub">(${esc(R.bolsa_familia.detalhe)})</span></p></div>`;
  $("#dv-grupos").innerHTML = `<thead><tr><th>Grupo</th><th class="num">Gasto</th><th class="num">${pct}</th></tr></thead><tbody>${gr.map((g) => `<tr><td class="quebra">${esc(g.n)}</td><td class="num">${brl(g.v)}</td><td class="num">${brl(g.v * R.excesso.percentual)}</td></tr>`).join("")}</tbody><tfoot><tr><td>Total</td><td class="num">${brl(base)}</td><td class="num">${brl(exc)}</td></tr></tfoot>`;
  $("#dv-nota").textContent = R.excesso.nota || "";
  const lnk = ([t, u]) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t));
  $("#dv-fontes").innerHTML = `<ul>${R.itens.map((it) => `<li><b>${esc(it.nome)}</b>: ${brl(it.construcao + it.ano_funcionando)} cada<ul>${it.fontes.map((f) => `<li>${lnk(f)}</li>`).join("")}</ul></li>`).join("")}<li><b>Bolsa Família</b>: ${brl(R.bolsa_familia.por_familia_ano)} por família no ano — ${lnk(R.bolsa_familia.fonte)}</li></ul>`;
}

// ---------------------------------------------------------------- navegação
async function render() {
  try { await ({ inicio: rInicio, senadores: rSenadores, fornecedores: rFornecedores, semana: rSemana, viagens: rViagens, dava: rDava, metodo: async () => {} })[E.pag](); }
  catch (e) { console.error(e); }
}
function irPara(p) {
  E.pag = p; $$(".pagina").forEach((s) => s.classList.toggle("ativa", s.dataset.pag === p));
  $$(".menu nav button").forEach((b) => (b.dataset.pag === p ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  $("#menu").classList.remove("aberto"); $("#veu").hidden = true;
  const u = new URL(location); u.searchParams.set("ano", E.ano); u.hash = p; history.replaceState(null, "", u);
  render(); window.scrollTo(0, 0);
}
async function iniciar() {
  try { E.meta = await getJSON("dados/meta.json"); } catch { $("#aviso").hidden = false; $("#aviso").textContent = "Os dados ainda estão sendo coletados pelo robô. Volte em algumas horas."; irPara("metodo"); return; }
  const anos = E.meta.anos.slice().reverse();
  const pedido = new URL(location).searchParams.get("ano");
  E.ano = pedido && (pedido === "total" || anos.includes(+pedido)) ? (pedido === "total" ? "total" : +pedido) : anos[0];
  $("#f-ano").innerHTML = `<option value="total">Todos os anos</option>` + anos.map((a) => `<option value="${a}">${a}</option>`).join("");
  $("#f-ano").value = E.ano;
  if (E.meta.ipca_referencia) $("#ipca-ref").textContent = `IPCA até ${E.meta.ipca_referencia}`;
  $("#atualizado").textContent = `Atualizado em ${new Date(E.meta.gerado_em).toLocaleString("pt-BR")}`;
  const todos = (await Promise.all(anos.slice(0, 4).map(resumo))).filter(Boolean).flatMap((r) => r.senadores);
  $("#f-uf").innerHTML = `<option value="">Todos</option>` + [...new Set(todos.map((s) => s.uf).filter(Boolean))].sort().map((u) => `<option>${u}</option>`).join("");
  $("#f-partido").innerHTML = `<option value="">Todos</option>` + [...new Set(todos.map((s) => s.partido).filter(Boolean))].sort().map((u) => `<option>${u}</option>`).join("");
  // links vindos de fora (ex.: hub): ?uf=CE&partido=PT e #sen-123 (abre a ficha do senador)
  const q = new URL(location).searchParams;
  ["uf", "partido"].forEach((k) => { const v = q.get(k); if (v && [...$("#f-" + k).options].some((o) => o.value === v)) $("#f-" + k).value = v; });
  const h = location.hash.slice(1), ms = h.match(/^sen-(\d+)$/), mf = h.match(/^forn-(.+)$/);
  irPara(ms ? "senadores" : mf ? "fornecedores" : ["inicio", "senadores", "semana", "fornecedores", "viagens", "dava", "metodo"].includes(h) ? h : "inicio");
  if (ms) fichaSenador(ms[1]);
  if (mf) { await rFornecedores(); fichaFornecedor(decodeURIComponent(mf[1])); }
}
document.addEventListener("click", (e) => {
  const s = e.target.closest("[data-sen]"); if (s) { fichaSenador(s.dataset.sen); return; }
  const f = e.target.closest("[data-forn]"); if (f) { fichaFornecedor(f.dataset.forn); return; }
  const u = e.target.closest("[data-uf]"); if (u && u.closest("#i-mapa")) { $("#f-uf").value = $("#f-uf").value === u.dataset.uf ? "" : u.dataset.uf; render(); return; }
  const b = e.target.closest(".menu nav button"); if (b) irPara(b.dataset.pag);
});
$("#f-ano").onchange = (e) => { E.ano = e.target.value === "total" ? "total" : +e.target.value; $("#f-tipo").innerHTML = ""; irPara(E.pag); };
["#f-uf", "#f-partido", "#f-ipca"].forEach((k) => ($(k).onchange = () => { E.lim = 30; E.limF = 50; E.limV = 30; render(); }));
$("#f-busca").oninput = () => { E.lim = 30; render(); };
$("#f-q").oninput = () => { E.limF = 50; rFornecedores(); };
$("#f-tipo").onchange = () => { E.limF = 50; rFornecedores(); };
$("#s-mais").onclick = () => { E.lim += 50; rSenadores(); };
$("#v-mais").onclick = () => { E.limV += 50; rViagens(); };
$("#w-mais").onclick = () => { E.limW += 100; rSemana(); };
$("#w-q").oninput = () => { E.limW = 50; rSemana(); };
$("#w-ord").onchange = () => rSemana();
$("#f-mais").onclick = () => { E.limF += 100; rFornecedores(); };
$("#ficha-fechar").onclick = () => ($("#ficha").hidden = true);
$("#ficha").onclick = (e) => { if (e.target.id === "ficha") $("#ficha").hidden = true; };
$("#abrir-menu").onclick = () => { $("#menu").classList.add("aberto"); $("#veu").hidden = false; };
$("#veu").onclick = () => { $("#menu").classList.remove("aberto"); $("#veu").hidden = true; };
iniciar();
})();
