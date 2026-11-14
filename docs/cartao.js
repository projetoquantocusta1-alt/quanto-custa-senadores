/* Cartão para compartilhar (imagem 1080×1350 para feed ou 1080×1920 para status/stories).
   Mesmo desenho do cartão dos deputados federais. Uso:
   CartaoQC.abrir({ titulo, nome, linhas: [..], foto, faixa: {titulo, sub, cor}, valorRot, valor, valorSub,
                    destaques: [[linha1, linha2, cor]], composicao: [[rotulo, valor, cor]], fonte, arquivo }) */
(function () {
  "use strict";
  const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const compacto = (v) => { const a = Math.abs(v || 0);
    if (a >= 1e9) return "R$ " + (v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " bi";
    if (a >= 999500) return "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
    if (a >= 1e3) return "R$ " + Math.round(v / 1e3).toLocaleString("pt-BR") + " mil";
    return brl(v); };
  let C = { fmt: "feed", dados: null, img: null };

  function dialogo() {
    let d = document.getElementById("qc-cartao");
    if (d) return d;
    d = document.createElement("dialog");
    d.id = "qc-cartao";
    d.setAttribute("aria-label", "Imagem para compartilhar");
    d.innerHTML = `<button class="qc-fechar" type="button" aria-label="Fechar">×</button>
      <h2>Imagem para compartilhar</h2>
      <div class="qc-formatos" role="group" aria-label="Formato">
        <button type="button" data-fmt="feed" aria-pressed="true">Feed (4:5)</button>
        <button type="button" data-fmt="story" aria-pressed="false">Status / Stories (9:16)</button></div>
      <canvas width="1080" height="1350"></canvas>
      <div class="qc-acoes"><button type="button" class="qc-baixar">Baixar imagem</button>
        <button type="button" class="qc-compartilhar">Compartilhar</button></div>`;
    document.body.appendChild(d);
    const st = document.createElement("style");
    st.textContent = `#qc-cartao{border:0;border-radius:16px;padding:20px;max-width:min(560px,94vw);width:100%;box-shadow:0 20px 60px rgba(0,0,0,.35)}
      #qc-cartao::backdrop{background:rgba(20,40,63,.6)} #qc-cartao h2{margin:0 0 10px;font-size:20px}
      #qc-cartao canvas{width:100%;height:auto;border-radius:10px;display:block;margin:10px 0;background:#f3f2f1}
      #qc-cartao .qc-fechar{position:absolute;top:10px;right:12px;border:0;background:none;font-size:28px;cursor:pointer;line-height:1}
      #qc-cartao .qc-formatos,#qc-cartao .qc-acoes{display:flex;gap:8px;flex-wrap:wrap}
      #qc-cartao button[data-fmt],#qc-cartao .qc-acoes button{border:1px solid #c8d3e0;background:#fff;border-radius:8px;padding:8px 12px;font:600 14px Inter,sans-serif;cursor:pointer}
      #qc-cartao button[aria-pressed=true]{background:#14283F;color:#fff;border-color:#14283F}
      #qc-cartao .qc-compartilhar{background:#2475B8!important;color:#fff;border-color:#2475B8!important}`;
    document.head.appendChild(st);
    d.querySelector(".qc-fechar").onclick = () => d.close();
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    d.querySelectorAll("[data-fmt]").forEach((b) => (b.onclick = () => { C.fmt = b.dataset.fmt;
      d.querySelectorAll("[data-fmt]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); desenhar(); }));
    d.querySelector(".qc-baixar").onclick = baixar;
    d.querySelector(".qc-compartilhar").onclick = compartilhar;
    return d;
  }

  function ajustar(ctx, txt, max, tam, peso = 800) {
    let t = tam; ctx.font = `${peso} ${t}px Inter, sans-serif`;
    while (ctx.measureText(txt).width > max && t > 22) { t -= 2; ctx.font = `${peso} ${t}px Inter, sans-serif`; }
    return t;
  }
  function cortar(ctx, txt, max) { let t = txt; while (ctx.measureText(t).width > max && t.length > 8) t = t.slice(0, -2); return t === txt ? t : t + "…"; }
  const iniciais = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  function desenhar() {
    const D = C.dados, cv = dialogo().querySelector("canvas"), W = 1080, H = C.fmt === "story" ? 1920 : 1350, story = H > 1500;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    // moldura
    ctx.fillStyle = "#f3f2f1"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1f2a44"; ctx.fillRect(0, 0, W, 150);
    ctx.fillStyle = "#f2c811"; ctx.beginPath(); ctx.roundRect(60, 45, 60, 60, 12); ctx.fill();
    ctx.fillStyle = "#1f2a44"; ctx.font = "800 24px 'Roboto Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("R$", 90, 84);
    ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = "800 36px Inter, sans-serif"; ctx.fillText("Projeto Quanto Custa", 140, 88);
    ctx.fillStyle = "#a9b4cc"; ctx.font = "500 24px Inter, sans-serif"; ctx.fillText(cortar(ctx, D.titulo || "", W - 200), 140, 122);
    ctx.fillStyle = "#1f2a44"; ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = "#fff"; ctx.font = "700 28px Inter, sans-serif"; ctx.fillText("quantocustaum.com", 60, H - 66);
    ctx.fillStyle = "#a9b4cc"; ctx.font = "500 20px Inter, sans-serif"; ctx.fillText(cortar(ctx, D.fonte || "", W - 120), 60, H - 32);
    // nome, linhas e foto
    let y = story ? 230 : 190;
    const fw = D.semFoto ? 0 : story ? 230 : 190, fh = Math.round(fw * 1.3);
    if (fw) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(W - 60 - fw, y, fw, fh, 18); ctx.clip();
      if (C.img) { const r = Math.max(fw / C.img.width, fh / C.img.height), iw = C.img.width * r, ih = C.img.height * r;
        ctx.drawImage(C.img, W - 60 - fw + (fw - iw) / 2, y + (fh - ih) / 2.6, iw, ih); }
      else { ctx.fillStyle = "#c7d6ec"; ctx.fillRect(W - 60 - fw, y, fw, fh); ctx.fillStyle = "#1f2a44"; ctx.textAlign = "center";
        ctx.font = `800 ${Math.round(fw * 0.38)}px Inter, sans-serif`; ctx.fillText(iniciais(D.nome), W - 60 - fw / 2, y + fh / 2 + fw * 0.13); ctx.textAlign = "left"; }
      ctx.restore();
    }
    const larg = W - 120 - (fw ? fw + 30 : 0);
    ctx.fillStyle = "#252423"; ajustar(ctx, D.nome, larg, 66); ctx.fillText(D.nome, 60, y + 70);
    (D.linhas || []).forEach((l, i) => { ctx.fillStyle = "#605e5c"; ctx.font = `${i ? 500 : 600} ${i ? 26 : 30}px Inter, sans-serif`; ctx.fillText(cortar(ctx, l, larg), 60, y + 120 + i * 40); });
    y += Math.max(fh, 120 + (D.linhas || []).length * 40) + (story ? 50 : 30);
    // faixa de destaque
    if (D.faixa) {
      const hb = story ? 200 : 170;
      ctx.fillStyle = D.faixa.cor || "#c4161c"; ctx.beginPath(); ctx.roundRect(60, y, W - 120, hb, 22); ctx.fill();
      ctx.fillStyle = "#fff"; const tt = String(D.faixa.titulo).toUpperCase(); ajustar(ctx, tt, W - 180, story ? 64 : 58, 900); ctx.fillText(tt, 90, y + (story ? 92 : 80));
      ctx.font = `600 ${story ? 34 : 30}px Inter, sans-serif`; ctx.fillStyle = "#ffe9e9"; ctx.fillText(cortar(ctx, D.faixa.sub || "", W - 180), 90, y + (story ? 150 : 130));
      y += hb + (story ? 80 : 62);
    }
    // valor
    ctx.fillStyle = "#605e5c"; ctx.font = "600 30px Inter, sans-serif"; ctx.fillText(D.valorRot || "Custou aos cofres públicos", 60, y);
    y += story ? 110 : 96; ctx.fillStyle = "#c4161c"; ajustar(ctx, brl(D.valor), W - 120, story ? 120 : 104); ctx.fillText(brl(D.valor), 60, y);
    if (D.valorSub) { y += 52; ctx.fillStyle = "#252423"; ctx.font = "600 30px Inter, sans-serif"; ctx.fillText(cortar(ctx, D.valorSub, W - 120), 60, y); }
    y += story ? 70 : 44;
    // destaques (sem a barra de composição, sobra mais espaço)
    const comps = (D.composicao || []).filter(([, v]) => v > 0);
    (D.destaques || []).forEach(([t1, t2, cor]) => {
      const hb = story ? 110 : 92;
      if (y + hb > H - (comps.length ? 260 : 140)) return;
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.roundRect(60, y, W - 120, hb, 14); ctx.fill();
      ctx.fillStyle = cor || "#118dff"; ctx.beginPath(); ctx.roundRect(60, y, 10, hb, 5); ctx.fill();
      ctx.fillStyle = "#252423"; ctx.font = `800 ${story ? 32 : 29}px Inter, sans-serif`; ctx.fillText(cortar(ctx, t1, W - 170), 90, y + (story ? 46 : 39));
      ctx.fillStyle = "#605e5c"; ctx.font = `500 ${story ? 25 : 23}px Inter, sans-serif`; ctx.fillText(cortar(ctx, t2 || "", W - 170), 90, y + (story ? 86 : 73));
      y += hb + (story ? 22 : 14);
    });
    // composição do custo
    if (comps.length) {
      y += story ? 40 : 26;
      const tot = comps.reduce((a, [, v]) => a + v, 0) || 1; let bx = 60;
      comps.forEach(([, v, cor]) => { const w = (W - 120) * v / tot; ctx.fillStyle = cor; ctx.fillRect(bx, y, Math.max(2, w), story ? 30 : 24); bx += w; });
      y += (story ? 30 : 24) + (story ? 44 : 36);
      let lx = 60; ctx.font = `600 ${story ? 25 : 22}px Inter, sans-serif`;
      comps.forEach(([rot, v, cor]) => {
        const t = `${rot} ${compacto(v)}`, w = ctx.measureText(t).width + 30;
        if (lx + w > W - 60) { lx = 60; y += story ? 40 : 34; }
        ctx.fillStyle = cor; ctx.beginPath(); ctx.roundRect(lx, y - (story ? 18 : 16), 16, 16, 4); ctx.fill();
        ctx.fillStyle = "#3b3a39"; ctx.fillText(t, lx + 22, y); lx += w + 18;
      });
    }
  }

  function blob() { return new Promise((ok) => dialogo().querySelector("canvas").toBlob(ok, "image/png")); }
  async function baixar() {
    const b = await blob(), a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = (C.dados.arquivo || "quanto-custa") + ".png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function compartilhar() {
    const b = await blob(), arq = new File([b], (C.dados.arquivo || "quanto-custa") + ".png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [arq] })) {
      try { await navigator.share({ files: [arq], title: "Projeto Quanto Custa", text: "Veja mais em " + location.origin + location.pathname }); } catch (e) { /* cancelado */ }
    } else baixar();
  }
  function carregarFoto(url) {
    return new Promise((ok) => { if (!url) return ok(null);
      const im = new Image(); im.crossOrigin = "anonymous"; im.referrerPolicy = "no-referrer";
      im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url; setTimeout(() => ok(null), 6000); });
  }
  async function abrir(dados) {
    C.dados = dados; C.img = await carregarFoto(dados.foto);
    const d = dialogo(); if (!d.open) d.showModal();
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
    try { desenhar(); } catch (e) { C.img = null; desenhar(); }   // foto de outro site pode "sujar" o canvas
    try { d.querySelector("canvas").toDataURL(); } catch (e) { C.img = null; desenhar(); }
  }
  window.CartaoQC = { abrir, compacto };
})();
