// JAVASCRIPT
/**
 * @file composicao-receita.js
 * @description Agrupamentos gerenciais da receita (módulo "Gráficos") e da
 * visão "Orçamento por grupo de receita e despesa" (PLOA).
 *
 * Tudo é configuração declarativa: cada item é um RÓTULO + PREFIXO(S) da
 * natureza de receita (layout Fiorilli "1112.50.0.1.00.00"). Os valores
 * somam APENAS linhas analíticas — sem dupla contagem dos níveis sintéticos.
 * O que não for coberto pelos itens listados aparece em "Demais", de modo
 * que cada subgrupo sempre fecha com o seu total oficial.
 *
 * Para ajustar a composição basta editar GRUPOS (sem tocar na lógica).
 */
(function (PO) {
  'use strict';

  var dinheiro = PO.core.dinheiro;

  function item(rotulo, prefixos) {
    return Object.freeze({ rotulo: rotulo, prefixos: [].concat(prefixos) });
  }

  var GRUPOS = Object.freeze([
    Object.freeze({
      id: 'correntes', titulo: 'Receitas Correntes', prefixo: '1',
      subgrupos: [
        { titulo: 'Receitas Tributárias', prefixo: '11', itens: [item('ITR', '1112.01'), item('IPTU', '1112.50'), item('ISS', '1114.51'), item('ITBI', '1112.53'), item('Taxas', '112')] },
        { titulo: 'Receitas de Contribuições', prefixo: '12', itens: [item('CIP (Iluminação Pública)', '124'), item('Contribuição do Servidor ao RPPS', '1215')] },
        { titulo: 'Receitas Patrimoniais', prefixo: '13', itens: [item('Rendimento de Aplicação Financeira', '1321')] },
        { titulo: 'Receitas de Serviços', prefixo: '16', itens: [item('Terminal Rodoviário', '1621.02')] },
        { titulo: 'Transferências Correntes', prefixo: '17', itens: [item('FPM', '1711.51'), item('ICMS', '1721.50'), item('IPVA', '1721.51'), item('FUNDEB', '1751'), item('SUS', ['1713', '1723']), item('SUAS', ['1716', '1729.51'])] },
        { titulo: 'Outras Receitas Correntes', prefixo: '19', itens: [item('Comprev', '1999.03'), item('Repasse Sabesp', '1999.99.2.1.01')] }
      ]
    }),
    Object.freeze({
      id: 'capital', titulo: 'Receitas de Capital', prefixo: '2',
      subgrupos: [
        { titulo: 'Alienação de Bens', prefixo: '22', itens: [item('Bens Móveis', '221'), item('Bens Imóveis', '222')] }
      ]
    }),
    Object.freeze({
      id: 'intra', titulo: 'Receitas Correntes — Intraorçamentárias', prefixo: '7',
      subgrupos: [
        { titulo: 'Receitas Intraorçamentárias (RPPS)', prefixo: '7', itens: [item('Contribuição Patronal — RPPS', '7215'), item('Aportes p/ Cobertura do Déficit Atuarial — RPPS', '7999.01')] }
      ]
    }),
    Object.freeze({
      // Itens dinâmicos: cada linha analítica vira um item (ITR, FPM, ICMS, IPVA, IPI…).
      id: 'deducoes', titulo: 'Deduções para Formação do FUNDEB', prefixo: '95', dinamico: true, subgrupos: []
    })
  ]);

  /** Origem do orçamento por grupo (PLOA). */
  var ORIGEM = Object.freeze([
    item('Receita Corrente', '1'),
    item('Receita de Capital', '2'),
    item('Receita Intraorçamentária', ['7', '8']),
    item('Deduções FUNDEB', '95')
  ]);

  /** Aplicação do orçamento por grupo (1º dígito da natureza de despesa). */
  var APLICACAO = Object.freeze([
    Object.freeze({ rotulo: 'Despesa Corrente', categoria: '3' }),
    Object.freeze({ rotulo: 'Despesa de Capital', categoria: '4' }),
    Object.freeze({ rotulo: 'Reserva de Contingência', categoria: '9' })
  ]);

  function casa(codigo, prefixos) {
    return prefixos.some(function (p) { return codigo.indexOf(p) === 0; });
  }

  /** Somatório analítico do exercício para os prefixos dados. */
  function somar(analiticas, exercicio, prefixos) {
    return dinheiro.somar(analiticas.filter(function (r) { return casa(r.codigo, prefixos); }).map(function (r) {
      return r.valoresCentavos[exercicio] || 0;
    }));
  }

  /** Itens + "Demais" (diferença para o total do agrupamento). */
  function comDemais(itens, total) {
    var demais = total - dinheiro.somar(itens.map(function (i) { return i.valor; }));
    return demais !== 0 ? itens.concat([{ rotulo: 'Demais', valor: demais, demais: true }]) : itens;
  }

  /**
   * Apura a composição da receita do exercício.
   * @param {Array} receitas registros de receita (com `analitica`, `codigo`, `valoresCentavos`)
   * @param {number} exercicio
   * @returns {Array<{id, titulo, total, subgrupos:Array<{titulo,total,itens:Array<{rotulo,valor,demais?}>}>, itens?:Array}>}
   */
  function apurar(receitas, exercicio) {
    var analiticas = receitas.filter(function (r) { return r.analitica; });
    return GRUPOS.map(function (g) {
      var total = somar(analiticas, exercicio, [g.prefixo]);
      var resultado = { id: g.id, titulo: g.titulo, total: total, subgrupos: [] };
      if (g.dinamico) {
        resultado.itens = analiticas.filter(function (r) { return r.codigo.indexOf(g.prefixo) === 0; }).map(function (r) {
          return { rotulo: r.nome, valor: r.valoresCentavos[exercicio] || 0 };
        });
        return resultado;
      }
      resultado.subgrupos = g.subgrupos.map(function (s) {
        var totalSub = somar(analiticas, exercicio, [s.prefixo]);
        var itens = s.itens.map(function (i) { return { rotulo: i.rotulo, valor: somar(analiticas, exercicio, i.prefixos) }; });
        return { titulo: s.titulo, total: totalSub, itens: comDemais(itens, totalSub) };
      });
      return resultado;
    });
  }

  /**
   * Orçamento por grupo de receita (origem) e despesa (aplicação).
   * @returns {{origem:Array<{rotulo,valor}>, aplicacao:Array<{rotulo,valor}>, totalOrigem:number, totalAplicacao:number, diferenca:number}}
   */
  function porGrupo(receitas, despesas, exercicio) {
    var analiticas = receitas.filter(function (r) { return r.analitica; });
    var origem = ORIGEM.map(function (o) { return { rotulo: o.rotulo, valor: somar(analiticas, exercicio, o.prefixos) }; });
    var aplicacao = APLICACAO.map(function (a) {
      return { rotulo: a.rotulo, valor: dinheiro.somar(despesas.filter(function (d) { return d.categoria === a.categoria; }).map(function (d) { return d.totalCentavos; })) };
    });
    var totalOrigem = dinheiro.somar(origem.map(function (o) { return o.valor; }));
    var totalAplicacao = dinheiro.somar(despesas.map(function (d) { return d.totalCentavos; }));
    var naoClassificada = totalAplicacao - dinheiro.somar(aplicacao.map(function (a) { return a.valor; }));
    if (naoClassificada !== 0) {
      aplicacao.push({ rotulo: 'Natureza não classificada', valor: naoClassificada });
    }
    return { origem: origem, aplicacao: aplicacao, totalOrigem: totalOrigem, totalAplicacao: totalAplicacao, diferenca: totalOrigem - totalAplicacao };
  }

  PO.domain.composicaoReceita = Object.freeze({
    GRUPOS: GRUPOS,
    apurar: apurar,
    porGrupo: porGrupo
  });
})(window.PO);
