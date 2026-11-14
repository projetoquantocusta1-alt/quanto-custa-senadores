/* =====================================================================
   BOAS-VINDAS — abre na primeira visita de cada pessoa.
   Para desligar, use ativo: false. Quando trocar o texto, mude também
   "versao" para mostrar de novo a quem já viu. (Mesmo texto do site dos deputados.)
   ===================================================================== */
(function () {
  const B = {
    ativo: true,
    versao: 2,
    titulo: "Bem-vindo ao Projeto Quanto Custa",
    texto: [
      "Este projeto nasceu para acompanhar os gastos públicos e mostrar a cada brasileiro o que está sendo feito com o nosso dinheiro.",
      "Os dados são oficiais, abertos e atualizados todos os dias. Use-os para acompanhar quem você elegeu, comparar, perguntar e cobrar. Fiscalizar é um direito e também um dever de todo cidadão.",
      "Pesquisadores, estudantes e jornalistas: os dados são livres para uso. Pedimos apenas que citem o Projeto Quanto Custa como fonte.",
      "Este trabalho é independente e feito com muita dedicação, para que a informação pública seja, de fato, pública.",
      "<b>Por um Brasil mais forte e mais justo.</b>",
      "<i>— Sociedade do Progresso</i>",
    ],
  };
  const SITE = document.currentScript ? document.currentScript.dataset.site || "x" : "x";
  const chave = `qc${SITE}_bv_${B.versao}`;
  function abrir(forcar) {
    if (!B.ativo && !forcar) return;
    if (!forcar) { try { if (localStorage.getItem(chave)) return; } catch (e) { /* sem armazenamento */ } }
    let el = document.getElementById("bv");
    if (!el) {
      el = document.createElement("div");
      el.className = "bv-fundo"; el.id = "bv";
      el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "bv-tit");
      el.innerHTML = `<div class="bv-caixa"><button class="fechar" id="bv-fechar" type="button" aria-label="Fechar">×</button>
        <p class="selo">Projeto Quanto Custa</p><h2 id="bv-tit"></h2><div id="bv-texto"></div>
        <p><button class="btn" id="bv-ok" type="button">Começar</button></p></div>`;
      document.body.appendChild(el);
    }
    el.querySelector("#bv-tit").textContent = B.titulo;
    el.querySelector("#bv-texto").innerHTML = B.texto.map((t) => `<p>${t}</p>`).join("");
    el.hidden = false; el.querySelector("#bv-ok").focus();
    const fechar = () => { el.hidden = true; try { localStorage.setItem(chave, "1"); } catch (e) { /* ok */ } };
    el.querySelector("#bv-ok").onclick = fechar; el.querySelector("#bv-fechar").onclick = fechar;
    el.onclick = (e) => { if (e.target === el) fechar(); };
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { fechar(); document.removeEventListener("keydown", esc); } });
  }
  window.boasVindas = abrir;
  document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("[data-boas-vindas]"); if (a) { e.preventDefault(); abrir(true); } });
  const iniciar = () => setTimeout(() => abrir(false), 600);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
