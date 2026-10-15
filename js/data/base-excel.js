// JAVASCRIPT
/**
 * @file base-excel.js
 * @description Monta a "Base Excel": a planilha local que guarda as dotações
 * EFETIVAS do exercício (lote importado + ajustes feitos no sistema), no
 * MESMO layout de colunas do "Cronograma de Orçamento" (A–T):
 *
 *   A Unidade orçamentária | B unidade executora | C funcional |
 *   D natureza de despesa  | E descrição | F fonte |
 *   G valor total orçamento AAAA | H valor insuficiente | I–T janeiro … dezembro
 *
 * Por manter o layout, a base pode ser reimportada em "Importar planilhas →
 * Despesas (Cronograma de Orçamento)" (restauração / outro computador).
 *
 * Abas da pasta de trabalho:
 *   - "Cronograma"  : as dotações (coluna H com fórmula =G−SOMA(I:T), que o
 *                     Excel recalcula se o usuário editar a planilha);
 *   - "Ajustes"     : trilha de auditoria dos ajustes (somente leitura);
 *   - "Informações" : metadados da geração (exercício, lote de origem, data).
 *
 * A montagem das matrizes é pura (testável); só `gerarPasta` depende do SheetJS.
 */
(function (PO) {
  'use strict';

  var dinheiro = PO.core.dinheiro;

  var MESES = Object.freeze(['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']);

  /** Índices (base 0) das colunas que recebem formato monetário: G, H, I–T. */
  var COLUNA_TOTAL = 6;
  var COLUNA_INSUFICIENTE = 7;
  var PRIMEIRA_COLUNA_MES = 8;

  var ROTULO_OPERACAO = Object.freeze({ inclusao: 'Inclusão', alteracao: 'Alteração', exclusao: 'Anulação' });

  /** Cabeçalho idêntico ao da planilha "Cronograma de Orçamento". */
  function cabecalho(exercicio) {
    return ['Unidade orçamentária', 'unidade executora', 'funcional', 'natureza de despesa', 'descrição', 'fonte',
      'valor total orçamento ' + exercicio, 'valor insuficiente'].concat(MESES);
  }

  /**
   * Matriz da aba "Cronograma". Valores em reais (decimal) — única conversão
   * de saída permitida (dinheiro.paraDecimal). Dotação não diluída sai com os
   * meses em branco, preservando esse estado numa reimportação.
   * @param {Array} registros dotações efetivas
   * @param {number} exercicio
   * @returns {Array<Array>}
   */
  function matrizCronograma(registros, exercicio) {
    var vi = PO.domain.valorInsuficiente;
    var linhas = registros.map(function (r) {
      var meses = r.mesesCentavos
        ? r.mesesCentavos.map(dinheiro.paraDecimal)
        : MESES.map(function () { return null; });
      return [r.uo, r.ue, r.funcional, r.natureza, r.descricao, r.fonte,
        dinheiro.paraDecimal(r.totalCentavos), dinheiro.paraDecimal(vi.calcular(r).saldoCentavos)].concat(meses);
    });
    return [cabecalho(exercicio)].concat(linhas);
  }

  /** Matriz da aba "Ajustes" a partir de ajustesDespesa.historico(). */
  function matrizAjustes(historico) {
    var cab = ['Nº', 'Data/hora', 'Operação', 'Unidade orçamentária', 'Natureza (antes)', 'Natureza (depois)',
      'Descrição (antes)', 'Descrição (depois)', 'Valor antes', 'Valor depois', 'Motivo'];
    var valor = function (v) { return v === null ? null : dinheiro.paraDecimal(v); };
    return [cab].concat(historico.map(function (l) {
      return [l.id, l.dataHora ? new Date(l.dataHora).toLocaleString('pt-BR') : '', ROTULO_OPERACAO[l.operacao] || l.operacao,
        l.uo, l.naturezaAntes, l.naturezaDepois, l.descricaoAntes, l.descricaoDepois,
        valor(l.antesCentavos), valor(l.depoisCentavos), l.motivo];
    }));
  }

  /** Matriz da aba "Informações". */
  function matrizInformacoes(dados) {
    var resumo = PO.domain.valorInsuficiente.resumir(dados.registros);
    return [
      ['Base Excel — Planejamento Orçamentário', PO.core.config.app.municipio],
      ['Exercício', dados.exercicio],
      ['Gerada em', new Date(dados.geradaEm).toLocaleString('pt-BR')],
      ['Versão do sistema', PO.versao],
      ['Arquivo de origem (lote ativo)', dados.lote.arquivo],
      ['Importado em', new Date(dados.lote.dataHora).toLocaleString('pt-BR')],
      ['Dotações', dados.registros.length],
      ['Ajustes aplicados', dados.ajustes.length],
      ['Valor total', dinheiro.paraDecimal(dinheiro.somar(dados.registros.map(function (r) { return r.totalCentavos; })))],
      ['Valor insuficiente — Negativo', resumo.negativo],
      ['Valor insuficiente — Atende', resumo.atende],
      ['Valor insuficiente — Positivo', resumo.positivo],
      ['Observação', 'Mesmo layout do Cronograma de Orçamento: pode ser reimportada em Importar planilhas → Despesas.']
    ];
  }

  /**
   * Na aba Cronograma: formato numérico brasileiro nas colunas de valor e
   * fórmula viva na coluna H (o valor calculado fica como cache da célula).
   */
  function formatarCronograma(XLSX, planilha, totalLinhas) {
    var FORMATO = '#,##0.00';
    for (var lin = 1; lin < totalLinhas; lin += 1) {
      for (var col = COLUNA_TOTAL; col < PRIMEIRA_COLUNA_MES + 12; col += 1) {
        var celula = planilha[XLSX.utils.encode_cell({ r: lin, c: col })];
        if (celula && celula.t === 'n') {
          celula.z = FORMATO;
        }
      }
      var h = planilha[XLSX.utils.encode_cell({ r: lin, c: COLUNA_INSUFICIENTE })];
      var n = lin + 1; // linha do Excel (base 1)
      if (h) {
        h.f = 'G' + n + '-SUM(I' + n + ':T' + n + ')';
      }
    }
    planilha['!cols'] = [10, 12, 18, 14, 48, 6, 18, 18].concat(MESES.map(function () { return 14; }))
      .map(function (w) { return { wch: w }; });
  }

  /**
   * Gera a pasta de trabalho (workbook SheetJS).
   * @param {Object} XLSX biblioteca SheetJS
   * @param {{exercicio:number, lote:Object, registros:Array, ajustes:Array, historico:Array, geradaEm:string}} dados
   */
  function gerarPasta(XLSX, dados) {
    var pasta = XLSX.utils.book_new();
    var cronograma = matrizCronograma(dados.registros, dados.exercicio);
    var aba = XLSX.utils.aoa_to_sheet(cronograma);
    formatarCronograma(XLSX, aba, cronograma.length);
    XLSX.utils.book_append_sheet(pasta, aba, 'Cronograma');
    XLSX.utils.book_append_sheet(pasta, XLSX.utils.aoa_to_sheet(matrizAjustes(dados.historico)), 'Ajustes');
    XLSX.utils.book_append_sheet(pasta, XLSX.utils.aoa_to_sheet(matrizInformacoes(dados)), 'Informações');
    return pasta;
  }

  /** Nome sugerido do arquivo da base. */
  function nomeArquivo(exercicio) {
    return 'base-excel_' + exercicio + '_cronograma-de-orcamento.xlsx';
  }

  PO.data.baseExcel = Object.freeze({
    cabecalho: cabecalho,
    matrizCronograma: matrizCronograma,
    matrizAjustes: matrizAjustes,
    gerarPasta: gerarPasta,
    nomeArquivo: nomeArquivo
  });
})(window.PO);
