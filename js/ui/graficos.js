// JAVASCRIPT
/**
 * @file graficos.js
 * @description Componentes de gráfico em HTML/CSS puro (sem biblioteca externa,
 * funciona offline via file://). Cada gráfico acompanha uma tabela
 * equivalente ("Ver tabela") — a cor nunca é a única forma de leitura.
 *
 * Larguras de barra são calculadas só para DESENHO (proporção visual);
 * todos os valores exibidos vêm de centavos inteiros (PO.core.dinheiro).
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var dinheiro = PO.core.dinheiro;
  var MAX_SERIES = 8;

  /** Proporção visual (0–100) de |valor| sobre |maximo|. */
  function proporcao(valor, maximo) {
    return maximo ? Math.round((Math.abs(valor) * 1000) / Math.abs(maximo)) / 10 : 0;
  }

  /**
   * Barras horizontais (uma série). Valores negativos (deduções) usam a
   * variante "negativa" e a barra representa o módulo.
   * @param {{itens:Array<{rotulo:string, valor:number, demais?:boolean}>, total?:number, maximo?:number, testid:string, legenda:string}} p
   */
  function barras(p) {
    var maximo = p.maximo || Math.max.apply(null, p.itens.map(function (i) { return Math.abs(i.valor); }).concat([0]));
    var total = p.total !== undefined ? p.total : dinheiro.somar(p.itens.map(function (i) { return i.valor; }));
    return h('ul', { className: 'bar-chart', testid: p.testid, attrs: { 'aria-label': p.legenda } }, p.itens.map(function (i, n) {
      var perc = dinheiro.percentual(i.valor, total);
      var barra = h('span', { className: 'bar-chart__bar' + (i.valor < 0 ? ' bar-chart__bar--negative' : '') + (i.demais ? ' bar-chart__bar--muted' : '') });
      barra.style.setProperty('--tamanho', proporcao(i.valor, maximo) + '%');
      return h('li', { className: 'bar-chart__row', testid: p.testid + '-item-' + n, attrs: { title: i.rotulo + ': ' + c.moeda(i.valor) + ' (' + perc + ')' } }, [
        h('span', { className: 'bar-chart__label', text: i.rotulo }),
        h('span', { className: 'bar-chart__track', attrs: { 'aria-hidden': 'true' } }, barra),
        h('span', { className: 'bar-chart__value', text: c.moeda(i.valor) }),
        h('span', { className: 'bar-chart__percent', text: perc })
      ]);
    }));
  }

  /**
   * Barra 100% empilhada (composição) com legenda e rótulos diretos.
   * Mais de 8 segmentos: o excedente é agrupado em "Outros" (cores fixas por posição).
   * @param {{segmentos:Array<{rotulo:string, valor:number}>, testid:string, legenda:string}} p
   */
  function empilhada(p) {
    var segs = p.segmentos.filter(function (s) { return s.valor > 0; });
    if (segs.length > MAX_SERIES) {
      var outros = dinheiro.somar(segs.slice(MAX_SERIES - 1).map(function (s) { return s.valor; }));
      segs = segs.slice(0, MAX_SERIES - 1).concat([{ rotulo: 'Outros', valor: outros }]);
    }
    var total = dinheiro.somar(segs.map(function (s) { return s.valor; }));

    var barra = h('div', { className: 'stack-chart__bar', attrs: { role: 'img', 'aria-label': p.legenda } }, segs.map(function (s, i) {
      var el = h('span', { className: 'stack-chart__segment stack-chart__segment--s' + (i + 1), attrs: { title: s.rotulo + ': ' + c.moeda(s.valor) + ' (' + dinheiro.percentual(s.valor, total) + ')' } });
      el.style.setProperty('--tamanho', proporcao(s.valor, total) + '%');
      return el;
    }));
    var legenda = h('ul', { className: 'chart-legend' }, segs.map(function (s, i) {
      return h('li', { className: 'chart-legend__item' }, [
        h('span', { className: 'chart-legend__swatch stack-chart__segment--s' + (i + 1), attrs: { 'aria-hidden': 'true' } }),
        h('span', { className: 'chart-legend__label', text: s.rotulo }),
        h('span', { className: 'chart-legend__value', text: c.moeda(s.valor) + ' · ' + dinheiro.percentual(s.valor, total) })
      ]);
    }));
    return h('div', { className: 'stack-chart', testid: p.testid }, [barra, legenda]);
  }

  /** Tabela equivalente a uma lista de itens {rotulo, valor}. */
  function tabelaItens(itens, total, testid, legenda) {
    return c.tabela({
      colunas: [{ titulo: 'Item' }, { titulo: 'Valor', numerica: true }, { titulo: '%', numerica: true }],
      linhas: itens.map(function (i) { return [i.rotulo, c.moeda(i.valor), dinheiro.percentual(i.valor, total)]; }),
      rodape: ['Total', c.moeda(total), total ? '100,0%' : '—'],
      legenda: legenda,
      testid: testid
    });
  }

  /**
   * Cartão de gráfico: título, total em destaque, gráfico e tabela recolhível.
   * @param {{titulo:string, total?:number, subtitulo?:string, grafico:Node, tabela?:Node, testid:string, largo?:boolean}} p
   */
  function cartao(p) {
    return h('article', { className: 'chart-card' + (p.largo ? ' chart-card--wide' : ''), testid: p.testid }, [
      h('header', { className: 'chart-card__header' }, [
        h('h4', { className: 'chart-card__title', text: p.titulo }),
        p.total !== undefined ? h('p', { className: 'chart-card__total', text: c.moeda(p.total) }) : null
      ]),
      p.subtitulo ? h('p', { className: 'chart-card__subtitle', text: p.subtitulo }) : null,
      p.grafico,
      p.tabela ? h('details', { className: 'chart-card__table no-print' }, [
        h('summary', { className: 'chart-card__table-toggle', text: 'Ver tabela', testid: p.testid + '-ver-tabela' }),
        p.tabela
      ]) : null
    ]);
  }

  PO.ui.graficos = Object.freeze({
    barras: barras,
    empilhada: empilhada,
    tabelaItens: tabelaItens,
    cartao: cartao
  });
})(window.PO);
