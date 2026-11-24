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
  // valor por extenso: 1.451.070 -> "≈ 1,45 milhão de reais"
  const porExtenso = (v) => { const a = Math.abs(v || 0);
    for (const [b, um, varios] of [[1e12, "trilhão", "trilhões"], [1e9, "bilhão", "bilhões"], [1e6, "milhão", "milhões"], [1e3, "mil", "mil"]]) {
      if (a < b) continue;
      const x = v / b, t = x.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(x) < 10 ? 2 : Math.abs(x) < 100 ? 1 : 0 });
      return b === 1e3 ? `≈ ${t} mil reais` : `≈ ${t} ${Math.abs(x) < 2 ? um : varios} de reais`; }
    return ""; };
  /* Logo Quanto Custa? (negativo) desenhado em canvas, para as imagens de compartilhar. Mesmos caminhos de marca/logo-horizontal-negativo.svg */
  function desenharLogoQC(ctx, x, y, h) {
    const k = h / 64;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineWidth = 10; ctx.lineCap = "butt";
    ctx.strokeStyle = "#FFFFFF"; ctx.stroke(new Path2D("M37.44 52.28A21 21 0 1 1 52.28 37.44"));
    ctx.strokeStyle = "#3FC491"; ctx.stroke(new Path2D("M40.49 40.49 55.33 55.33"));
    ctx.fillStyle = "#FFFFFF"; ctx.fill(new Path2D("M100.05 40.17L97.72 42.52L96.18 40.98Q96.00 41.09 95.83 41.20L95.83 41.20Q93.64 42.52 90.61 42.52Q87.59 42.52 85.40 41.20Q83.21 39.89 82.02 37.52Q80.84 35.16 80.84 32.02Q80.84 28.88 82.02 26.52Q83.21 24.15 85.40 22.84Q87.59 21.52 90.61 21.52Q93.64 21.52 95.83 22.84Q98.02 24.15 99.20 26.52Q100.38 28.88 100.38 32.02Q100.38 35.16 99.21 37.52L99.21 37.52Q98.90 38.12 98.54 38.66L98.54 38.66L100.05 40.17ZM90.61 38.94L90.61 38.94Q92.29 38.96 93.48 38.31L93.48 38.31L91.84 36.67L94.20 34.32L95.67 35.79Q95.69 35.74 95.72 35.69L95.72 35.69Q96.35 34.12 96.35 32.02Q96.35 29.92 95.72 28.38Q95.08 26.84 93.80 25.99Q92.53 25.13 90.61 25.10Q88.69 25.08 87.42 25.93Q86.15 26.78 85.51 28.35Q84.87 29.92 84.87 32.02Q84.87 34.12 85.51 35.66Q86.15 37.20 87.42 38.05Q88.69 38.91 90.61 38.94ZM113.99 42.52L113.99 42.52Q111.56 42.52 109.71 41.53Q107.86 40.55 106.83 38.75Q105.79 36.96 105.79 34.54L105.79 34.54L105.79 21.97L109.65 21.94L109.65 34.51Q109.65 35.51 109.99 36.32Q110.33 37.13 110.92 37.72Q111.52 38.31 112.31 38.62Q113.10 38.94 113.99 38.94L113.99 38.94Q114.92 38.94 115.71 38.61Q116.50 38.29 117.09 37.70Q117.68 37.12 118.01 36.30Q118.33 35.49 118.33 34.51L118.33 34.51L118.33 21.94L122.20 21.94L122.20 34.54Q122.20 36.96 121.16 38.75Q120.13 40.55 118.28 41.53Q116.43 42.52 113.99 42.52ZM130.40 42.10L126.48 42.10L132.64 21.94L138.33 21.94L144.49 42.10L140.57 42.10L139.27 37.90L131.68 37.90L130.40 42.10ZM132.76 34.34L138.17 34.34L135.44 25.51L132.76 34.34ZM153.48 42.10L149.62 42.10L149.62 21.94L153.48 21.94L162.24 35.38L162.24 21.94L166.11 21.94L166.11 42.10L162.24 42.10L153.48 28.66L153.48 42.10ZM181.12 42.10L177.31 42.10L177.31 25.50L170.95 25.50L170.95 21.94L187.47 21.94L187.47 25.50L181.12 25.50L181.12 42.10ZM200.97 42.52L200.97 42.52Q197.95 42.52 195.76 41.20Q193.57 39.89 192.38 37.52Q191.20 35.16 191.20 32.02L191.20 32.02Q191.20 28.88 192.38 26.52Q193.57 24.15 195.76 22.84Q197.95 21.52 200.97 21.52L200.97 21.52Q204.00 21.52 206.19 22.84Q208.38 24.15 209.56 26.52Q210.74 28.88 210.74 32.02L210.74 32.02Q210.74 35.16 209.56 37.52Q208.38 39.89 206.19 41.20Q204.00 42.52 200.97 42.52ZM200.97 38.94L200.97 38.94Q202.89 38.96 204.16 38.11Q205.44 37.26 206.07 35.69Q206.71 34.12 206.71 32.02L206.71 32.02Q206.71 29.92 206.07 28.38Q205.44 26.84 204.16 25.99Q202.89 25.13 200.97 25.10L200.97 25.10Q199.05 25.08 197.78 25.93Q196.51 26.78 195.87 28.35Q195.23 29.92 195.23 32.02L195.23 32.02Q195.23 34.12 195.87 35.66Q196.51 37.20 197.78 38.05Q199.05 38.91 200.97 38.94ZM233.01 42.52L233.01 42.52Q229.98 42.52 227.79 41.20Q225.60 39.89 224.42 37.52Q223.24 35.16 223.24 32.02L223.24 32.02Q223.24 28.88 224.42 26.52Q225.60 24.15 227.79 22.84Q229.98 21.52 233.01 21.52L233.01 21.52Q236.48 21.52 238.84 23.24Q241.20 24.96 242.16 27.90L242.16 27.90L238.33 28.97Q237.77 27.13 236.44 26.12Q235.11 25.10 233.01 25.10L233.01 25.10Q231.09 25.10 229.81 25.96Q228.53 26.81 227.88 28.37Q227.24 29.92 227.24 32.02L227.24 32.02Q227.24 34.12 227.88 35.67Q228.53 37.23 229.81 38.08Q231.09 38.94 233.01 38.94L233.01 38.94Q235.11 38.94 236.44 37.91Q237.77 36.89 238.33 35.07L238.33 35.07L242.16 36.14Q241.20 39.08 238.84 40.80Q236.48 42.52 233.01 42.52ZM256.05 42.52L256.05 42.52Q253.62 42.52 251.77 41.53Q249.92 40.55 248.89 38.75Q247.85 36.96 247.85 34.54L247.85 34.54L247.85 21.97L251.71 21.94L251.71 34.51Q251.71 35.51 252.05 36.32Q252.39 37.13 252.98 37.72Q253.58 38.31 254.37 38.62Q255.16 38.94 256.05 38.94L256.05 38.94Q256.98 38.94 257.77 38.61Q258.56 38.29 259.15 37.70Q259.74 37.12 260.07 36.30Q260.39 35.49 260.39 34.51L260.39 34.51L260.39 21.94L264.26 21.94L264.26 34.54Q264.26 36.96 263.22 38.75Q262.19 40.55 260.34 41.53Q258.49 42.52 256.05 42.52ZM277.56 42.52L277.56 42.52Q275.32 42.52 273.52 41.73Q271.72 40.94 270.57 39.46Q269.41 37.98 269.11 35.94L269.11 35.94L273.08 35.35Q273.50 37.09 274.82 38.03Q276.13 38.96 277.81 38.96L277.81 38.96Q278.75 38.96 279.63 38.67Q280.51 38.38 281.08 37.80Q281.65 37.23 281.65 36.39L281.65 36.39Q281.65 36.08 281.56 35.79Q281.47 35.51 281.26 35.25Q281.05 35.00 280.66 34.78Q280.28 34.55 279.69 34.37L279.69 34.37L274.45 32.83Q273.87 32.66 273.09 32.36Q272.31 32.05 271.58 31.47Q270.86 30.90 270.37 29.96Q269.89 29.01 269.89 27.57L269.89 27.57Q269.89 25.54 270.91 24.19Q271.93 22.85 273.64 22.19Q275.35 21.53 277.42 21.55L277.42 21.55Q279.51 21.58 281.15 22.26Q282.78 22.95 283.89 24.26Q285.00 25.57 285.49 27.46L285.49 27.46L281.37 28.16Q281.15 27.18 280.54 26.50Q279.94 25.83 279.11 25.48Q278.28 25.13 277.37 25.10L277.37 25.10Q276.47 25.08 275.68 25.35Q274.89 25.62 274.39 26.14Q273.89 26.66 273.89 27.37L273.89 27.37Q273.89 28.03 274.30 28.44Q274.71 28.86 275.32 29.11Q275.94 29.36 276.58 29.53L276.58 29.53L280.08 30.48Q280.87 30.69 281.82 31.03Q282.77 31.38 283.64 31.98Q284.52 32.59 285.09 33.59Q285.65 34.58 285.65 36.11L285.65 36.11Q285.65 37.73 284.97 38.94Q284.30 40.15 283.15 40.95Q282.00 41.74 280.55 42.13Q279.10 42.52 277.56 42.52ZM299.82 42.10L296.02 42.10L296.02 25.50L289.66 25.50L289.66 21.94L306.18 21.94L306.18 25.50L299.82 25.50L299.82 42.10ZM312.99 42.10L309.07 42.10L315.23 21.94L320.91 21.94L327.07 42.10L323.15 42.10L321.85 37.90L314.26 37.90L312.99 42.10ZM315.34 34.34L320.76 34.34L318.03 25.51L315.34 34.34Z"));
    ctx.fillStyle = "#3FC491"; ctx.fill(new Path2D("M339.78 36.64L335.75 36.64Q335.75 35.72 335.97 34.79Q336.19 33.87 336.62 33.11L336.62 33.11Q336.97 32.40 337.38 31.98Q337.80 31.57 338.33 31.14Q338.87 30.70 339.62 29.92L339.62 29.92Q340.19 29.29 340.38 28.68Q340.57 28.07 340.57 27.34L340.57 27.34Q340.57 26.97 340.49 26.62Q340.41 26.27 340.20 26L340.20 26Q339.87 25.54 339.31 25.34Q338.76 25.13 338.13 25.13L338.13 25.13Q337.66 25.13 337.20 25.24Q336.75 25.36 336.42 25.61L336.42 25.61Q336.03 25.90 335.84 26.35Q335.65 26.80 335.67 27.34L335.67 27.34L331.64 27.34Q331.80 25.85 332.49 24.60Q333.18 23.35 334.27 22.64L334.27 22.64Q335.07 22.11 336.03 21.83Q337.00 21.55 337.96 21.55L337.96 21.55Q339.56 21.55 340.97 22.05Q342.39 22.54 343.31 23.68L343.31 23.68Q343.93 24.39 344.26 25.34Q344.60 26.28 344.60 27.23L344.60 27.23Q344.60 28.76 343.91 30.00Q343.23 31.25 342.22 32.33L342.22 32.33Q341.79 32.79 341.44 33.13Q341.10 33.48 340.83 33.78Q340.55 34.08 340.34 34.40L340.34 34.40Q339.95 35.04 339.87 35.45Q339.78 35.86 339.78 36.64L339.78 36.64ZM339.78 42.10L335.78 42.10L335.78 38.07L339.78 38.07L339.78 42.10Z"));
    ctx.restore();
    return 350 * k;
  }
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
      #qc-cartao button[data-fmt],#qc-cartao .qc-acoes button{border:1px solid #c8d3e0;background:#fff;border-radius:8px;padding:8px 12px;font:600 14px 'IBM Plex Sans',sans-serif;cursor:pointer}
      #qc-cartao button[aria-pressed=true]{background:#10243A;color:#fff;border-color:#10243A}
      #qc-cartao .qc-compartilhar{background:#2463A6!important;color:#fff;border-color:#2463A6!important}`;
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
    let t = tam; ctx.font = `${peso} ${t}px ${+peso >= 700 ? "Manrope" : "'IBM Plex Sans'"}, sans-serif`;
    while (ctx.measureText(txt).width > max && t > 22) { t -= 2; ctx.font = `${peso} ${t}px ${+peso >= 700 ? "Manrope" : "'IBM Plex Sans'"}, sans-serif`; }
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
    ctx.fillStyle = "#10243A"; ctx.fillRect(0, 0, W, 150);
    desenharLogoQC(ctx, 60, 22, 64);
    ctx.textAlign = "left"; ctx.fillStyle = "#a9b4cc"; ctx.font = "500 24px 'IBM Plex Sans', sans-serif"; ctx.fillText(cortar(ctx, D.titulo || "", W - 132), 72, 122);
    ctx.fillStyle = "#10243A"; ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = "#fff"; ctx.font = "700 28px Manrope, sans-serif"; ctx.fillText("quantocustaum.com", 60, H - 66);
    ctx.fillStyle = "#a9b4cc"; ctx.font = "500 20px 'IBM Plex Sans', sans-serif"; ctx.fillText(cortar(ctx, D.fonte || "", W - 120), 60, H - 32);
    // nome, linhas e foto
    let y = story ? 230 : 190;
    const fw = D.semFoto ? 0 : story ? 230 : 190, fh = Math.round(fw * 1.3);
    if (fw) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(W - 60 - fw, y, fw, fh, 18); ctx.clip();
      if (C.img) { const r = Math.max(fw / C.img.width, fh / C.img.height), iw = C.img.width * r, ih = C.img.height * r;
        ctx.drawImage(C.img, W - 60 - fw + (fw - iw) / 2, y + (fh - ih) / 2.6, iw, ih); }
      else { ctx.fillStyle = "#c7d6ec"; ctx.fillRect(W - 60 - fw, y, fw, fh); ctx.fillStyle = "#1f2a44"; ctx.textAlign = "center";
        ctx.font = `800 ${Math.round(fw * 0.38)}px Manrope, sans-serif`; ctx.fillText(iniciais(D.nome), W - 60 - fw / 2, y + fh / 2 + fw * 0.13); ctx.textAlign = "left"; }
      ctx.restore();
    }
    const larg = W - 120 - (fw ? fw + 30 : 0);
    ctx.fillStyle = "#252423"; ajustar(ctx, D.nome, larg, 66); ctx.fillText(D.nome, 60, y + 70);
    (D.linhas || []).forEach((l, i) => { ctx.fillStyle = "#605e5c"; ctx.font = `${i ? 500 : 600} ${i ? 26 : 30}px 'IBM Plex Sans', sans-serif`; ctx.fillText(cortar(ctx, l, larg), 60, y + 120 + i * 40); });
    y += Math.max(fh, 120 + (D.linhas || []).length * 40) + (story ? 50 : 30);
    // faixa de destaque
    if (D.faixa) {
      const hb = story ? 200 : 170;
      ctx.fillStyle = D.faixa.cor || "#c4161c"; ctx.beginPath(); ctx.roundRect(60, y, W - 120, hb, 22); ctx.fill();
      ctx.fillStyle = "#fff"; const tt = String(D.faixa.titulo).toUpperCase(); ajustar(ctx, tt, W - 180, story ? 64 : 58, 900); ctx.fillText(tt, 90, y + (story ? 92 : 80));
      ctx.font = `600 ${story ? 34 : 30}px 'IBM Plex Sans', sans-serif`; ctx.fillStyle = "#ffe9e9"; ctx.fillText(cortar(ctx, D.faixa.sub || "", W - 180), 90, y + (story ? 150 : 130));
      y += hb + (story ? 80 : 62);
    }
    // valor
    ctx.fillStyle = "#605e5c"; ctx.font = "600 30px 'IBM Plex Sans', sans-serif"; ctx.fillText(D.valorRot || "Custou aos cofres públicos", 60, y);
    y += story ? 110 : 96; ctx.fillStyle = "#c4161c"; ajustar(ctx, brl(D.valor), W - 120, story ? 120 : 104); ctx.fillText(brl(D.valor), 60, y);
    const ext = porExtenso(D.valor);
    if (ext) { y += story ? 50 : 42; ctx.fillStyle = "#c4161c"; ctx.font = `700 ${story ? 34 : 30}px Manrope, sans-serif`; ctx.fillText(ext, 60, y); }
    if (D.valorSub) { y += story ? 52 : 44; ctx.fillStyle = "#252423"; ctx.font = "600 30px 'IBM Plex Sans', sans-serif"; ctx.fillText(cortar(ctx, D.valorSub, W - 120), 60, y); }
    y += story ? 70 : 44;
    // destaques (sem a barra de composição, sobra mais espaço)
    const comps = (D.composicao || []).filter(([, v]) => v > 0);
    (D.destaques || []).forEach(([t1, t2, cor]) => {
      const hb = story ? 110 : 86;
      if (y + hb > H - (comps.length ? 215 : 140)) return;
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.roundRect(60, y, W - 120, hb, 14); ctx.fill();
      ctx.fillStyle = cor || "#118dff"; ctx.beginPath(); ctx.roundRect(60, y, 10, hb, 5); ctx.fill();
      ctx.fillStyle = "#252423"; ctx.font = `800 ${story ? 32 : 29}px Manrope, sans-serif`; ctx.fillText(cortar(ctx, t1, W - 170), 90, y + (story ? 46 : 37));
      ctx.fillStyle = "#605e5c"; ctx.font = `500 ${story ? 25 : 23}px 'IBM Plex Sans', sans-serif`; ctx.fillText(cortar(ctx, t2 || "", W - 170), 90, y + (story ? 86 : 69));
      y += hb + (story ? 22 : 12);
    });
    // composição do custo
    if (comps.length) {
      y += story ? 40 : 10;
      const tot = comps.reduce((a, [, v]) => a + v, 0) || 1; let bx = 60;
      comps.forEach(([, v, cor]) => { const w = (W - 120) * v / tot; ctx.fillStyle = cor; ctx.fillRect(bx, y, Math.max(2, w), story ? 30 : 24); bx += w; });
      y += (story ? 30 : 24) + (story ? 44 : 36);
      let lx = 60; ctx.font = `600 ${story ? 25 : 22}px 'IBM Plex Sans', sans-serif`;
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
      try { await navigator.share({ files: [arq], title: "Quanto Custa", text: "Veja mais em " + location.origin + location.pathname }); } catch (e) { /* cancelado */ }
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
  window.CartaoQC = { abrir, compacto, porExtenso };
})();
