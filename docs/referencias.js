/* =====================================================================
   "O QUE DAVA PRA FAZER?" — regra do excesso e custos de referência.
   Edite à vontade. Valores em reais de hoje (nov/2026). Fontes ao lado.
   ===================================================================== */
window.REFERENCIAS = {
  // Regra provisória: 80% do que a cota gastou nestes grupos de despesa.
  excesso: {
    percentual: 0.80,
    grupos: [
      // [nome, expressão que reconhece o tipo de gasto da CEAPS]
      ["Locomoção, hospedagem, alimentação e combustíveis", "locomo"],
      ["Passagens aéreas, aquáticas e terrestres", "passage"],
      ["Divulgação da atividade parlamentar", "divulga"],
    ],
    nota: "No Senado, alimentação, hospedagem, combustível e locomoção vêm juntos num só tipo de despesa da cota (CEAPS).",
  },
  itens: [
    { id: "escola", nome: "escolas de tempo integral", unidade: "escola", plural: "escolas", feminino: true, construcao: 10_100_000, ano_funcionando: 4_070_000,
      detalhe: "13 salas, 455 alunos em tempo integral",
      fontes: [["Construção: contrato FNDE de R$ 9,56 mi (Campo Grande, dez/2025), corrigido pelo IPCA", "https://www.campograndenews.com.br/cidades/capital/empresa-tera-360-dias-para-construir-escola-de-tempo-integral-a-r-9-5-milhoes"],
               ["1 ano: 455 alunos × R$ 8.944 (Fundeb 2026, fundamental em tempo integral)", "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/Valoralunoanoereceitaanualprevista2026.pdf"]] },
    { id: "hospital", nome: "hospitais de 100 leitos", unidade: "hospital", plural: "hospitais", construcao: 171_700_000, ano_funcionando: 95_300_000,
      detalhe: "100 leitos, com UTI",
      fontes: [["Construção: R$ 133,7 mi (Hospital do Recanto das Emas, DF, 2026) + ~R$ 38 mi em equipamentos (estimativa)", "https://www.satelitenoticias.com.br/2026/11/hospital-do-recanto-das-emas-recebe.html"],
               ["1 ano: R$ 4,73 mi/mês para 72 leitos (Hospital Estadual de Luziânia, 2022), proporcional a 100 leitos e corrigido pelo IPCA", "https://goias.gov.br/saude/wp-content/uploads/sites/34/2022/01/edital_luziania-7fd.pdf"]] },
    { id: "ubs", nome: "UBS (postos de saúde)", unidade: "UBS", plural: "UBS", feminino: true, construcao: 3_600_000, ano_funcionando: 1_980_000,
      detalhe: "porte III, 3 equipes de Saúde da Família",
      fontes: [["Construção: R$ 3,4 mi (UBS porte III, Novo PAC, Canoas, 2025) + kit de equipamentos de R$ 199 mil", "https://www.abcmais.com/brasil/rio-grande-do-sul/vale-do-rio-dos-sinos/canoas/novo-pac-destinara-r-34-milhoes-para-construcao-de-ubs-no-bairro-niteroi/"],
               ["1 ano: 3 equipes × ~R$ 55 mil/mês (estimativa de salários e insumos — a confirmar)", ""]] },
  ],
  bolsa_familia: { por_familia_ano: 9_324, detalhe: "benefício médio de R$ 777/mês após o reajuste de out/2026",
    fonte: ["MDS, via O Tempo (nov/2026)", "https://www.otempo.com.br/economia/2026/11/2/bolsa-familia-quanto-cada-tipo-de-familia-recebe-depois-do-reajuste-veja-exemplos"] },
};
