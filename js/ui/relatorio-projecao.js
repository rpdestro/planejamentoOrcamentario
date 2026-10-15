// JAVASCRIPT
/**
 * @file relatorio-projecao.js
 * @description Componente "Relatório de Projeção": tabela agrupada × período,
 * pronta para impressão. Usado pelo relatório geral (por órgão) e pela aba
 * de relatório de cada Secretaria (por UE, GND, fonte, natureza…).
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var cfg = PO.core.config;
  var periodos = PO.domain.periodos;
  var dinheiro = PO.core.dinheiro;

  /**
   * Agrupamentos disponíveis: cada um devolve {chave, rotulo} para uma dotação.
   * Para incluir um novo agrupamento basta acrescentar uma entrada aqui.
   */
  var AGRUPAMENTOS = Object.freeze({
    orgao: { rotulo: 'Órgão', de: function (d) { return { chave: d.uo, rotulo: d.uo + ' — ' + c.nomeOrgao(d.uo) }; } },
    ue: { rotulo: 'Unidade Executora', de: function (d) { return { chave: d.ue || '—', rotulo: d.ue || '(sem UE)' }; } },
    categoria: { rotulo: 'Categoria econômica', de: function (d) { return { chave: d.categoria || '?', rotulo: (d.categoria || '?') + ' — ' + (cfg.categoriasDespesa[d.categoria] || 'Não classificada') }; } },
    gnd: { rotulo: 'Grupo de despesa (GND)', de: function (d) { return { chave: d.gnd || '?', rotulo: (d.gnd || '?') + ' — ' + (cfg.gnd[d.gnd] || 'Não classificado') }; } },
    elemento: { rotulo: 'Natureza (até elemento)', de: function (d) { var k = d.natureza.split('.').slice(0, 4).join('.'); return { chave: k, rotulo: k }; } },
    fonte: { rotulo: 'Fonte de recurso', de: function (d) { return { chave: d.fonte || '?', rotulo: (d.fonte || '?') + ' — ' + (cfg.fontes[d.fonte] || 'Não cadastrada') }; } },
    funcao: { rotulo: 'Função de governo', de: function (d) { return { chave: d.funcao || '??', rotulo: (d.funcao || '??') + ' — ' + (cfg.funcoes[d.funcao] || 'Não classificada') }; } }
  });

  /** Agrupa dotações por um agrupamento, ordenado pela chave. */
  function agrupar(despesas, chaveAgrupamento) {
    var de = AGRUPAMENTOS[chaveAgrupamento].de;
    var grupos = new Map();
    despesas.forEach(function (d) {
      var g = de(d);
      if (!grupos.has(g.chave)) {
        grupos.set(g.chave, { chave: g.chave, rotulo: g.rotulo, itens: [] });
      }
      grupos.get(g.chave).itens.push(d);
    });
    return Array.from(grupos.values()).sort(function (a, b) { return String(a.chave).localeCompare(String(b.chave)); });
  }

  /**
   * Monta o conteúdo do relatório (metadados + tabela + nota).
   * @param {{despesas:Array, chavePeriodo:string, agrupamento:string, titulo:string, exercicio:number, testid:string}} p
   * @returns {Node[]}
   */
  function montar(p) {
    var chave = p.chavePeriodo;
    var linhas = agrupar(p.despesas, p.agrupamento).map(function (g) {
      var valores = periodos.agregar(periodos.somarMeses(g.itens), chave);
      return [g.rotulo].concat(valores.map(c.moeda)).concat([c.moeda(dinheiro.somar(valores))]);
    });
    var totais = periodos.agregar(periodos.somarMeses(p.despesas), chave);
    var compacta = chave === 'mensal';

    return [
      h('h3', { className: 'report__title', text: p.titulo }),
      h('p', { className: 'report__meta', text: 'Prefeitura Municipal de Botucatu · Exercício ' + p.exercicio + ' · Agrupamento: ' + AGRUPAMENTOS[p.agrupamento].rotulo + ' · Período: ' + periodos.obter(chave).rotulo + ' · Emitido em ' + new Date().toLocaleString('pt-BR') }),
      c.tabela({
        colunas: [{ titulo: AGRUPAMENTOS[p.agrupamento].rotulo }].concat(periodos.rotulos(chave).map(function (r) { return { titulo: r, numerica: true }; })).concat([{ titulo: 'Total', numerica: true }]),
        linhas: linhas,
        rodape: ['Total geral (' + p.despesas.length + ' dotações)'].concat(totais.map(c.moeda)).concat([c.moeda(dinheiro.somar(totais))]),
        legenda: p.titulo,
        testid: p.testid,
        compacta: compacta,
        vazio: 'Nenhuma dotação para projetar.'
      }),
      h('p', { className: 'report__note', text: 'Dotações sem cronograma mensal foram projetadas linearmente (1/12 ao mês). Valores em R$.' })
    ];
  }

  /**
   * Bloco completo com controles (período, agrupamento, imprimir).
   * @param {{
   *   obterDespesas: function():Array,  // chamado a cada redesenho (permite refletir filtros)
   *   titulo:string, exercicio:number,
   *   agrupamentos:string[], agrupamentoPadrao:string, periodoPadrao:string,
   *   prefixoTestid:string
   * }} p
   * @returns {{elemento:HTMLElement, atualizar:Function}}
   */
  function criar(p) {
    var pref = p.prefixoTestid;
    var seletorPeriodo = c.selectPeriodo('select-' + pref + '-periodo', p.periodoPadrao || 'bimestral');
    var seletorGrupo = c.select(p.agrupamentos.map(function (k) { return { valor: k, rotulo: AGRUPAMENTOS[k].rotulo }; }), 'select-' + pref + '-agrupamento', p.agrupamentoPadrao);
    var alvo = h('div', { className: 'report', testid: 'area-' + pref });

    function atualizar() {
      PO.core.dom.limpar(alvo);
      PO.core.dom.anexar(alvo, montar({
        despesas: p.obterDespesas(),
        chavePeriodo: seletorPeriodo.value,
        agrupamento: seletorGrupo.value,
        titulo: p.titulo,
        exercicio: p.exercicio,
        testid: 'tabela-' + pref
      }));
    }
    seletorPeriodo.addEventListener('change', atualizar);
    seletorGrupo.addEventListener('change', atualizar);

    var controles = h('div', { className: 'toolbar no-print' }, [
      h('label', { className: 'inline-field' }, [h('span', { className: 'inline-field__label', text: 'Período' }), seletorPeriodo]),
      p.agrupamentos.length > 1 ? h('label', { className: 'inline-field' }, [h('span', { className: 'inline-field__label', text: 'Agrupar por' }), seletorGrupo]) : null,
      h('span', { className: 'toolbar__spacer' }),
      c.botao('Imprimir', 'btn-' + pref + '-imprimir', function () { window.print(); })
    ]);

    atualizar();
    return { elemento: h('div', { className: 'report-block' }, [controles, alvo]), atualizar: atualizar };
  }

  PO.ui.relatorioProjecao = Object.freeze({
    AGRUPAMENTOS: AGRUPAMENTOS,
    agrupar: agrupar,
    montar: montar,
    criar: criar
  });
})(window.PO);
