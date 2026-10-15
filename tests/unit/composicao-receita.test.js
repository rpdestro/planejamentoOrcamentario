// JAVASCRIPT
/** Testes: js/domain/composicao-receita.js — agrupamentos dos Gráficos e quadro por grupo. */
(function (T, PO) {
  'use strict';

  var comp = PO.domain.composicaoReceita;
  var assert = T.assert;

  function rec(codigo, valor, analitica) {
    return { codigo: codigo, nome: codigo, analitica: analitica !== false, valoresCentavos: { 2027: valor } };
  }

  var receitas = [
    rec('1112.00.0.0.00.00', 999, false),       // sintética: não soma
    rec('1112.50.0.1.00.00', 1000),             // IPTU
    rec('1113.03.1.1.00.00', 300),              // IRRF → "Demais" das tributárias
    rec('1121.01.0.1.01.00', 200),              // Taxas
    rec('1711.51.1.1.00.00', 5000),             // FPM
    rec('2213.01.0.1.01.00', 50),               // alienação móveis
    rec('7215.02.1.1.01.00', 400),              // patronal RPPS
    rec('9510.00.0.0.00.02', -1000)             // dedução FUNDEB
  ];

  T.describe('composicaoReceita.apurar', function () {
    var grupos = comp.apurar(receitas, 2027);
    var porId = {};
    grupos.forEach(function (g) { porId[g.id] = g; });

    T.it('soma apenas analíticas por grupo', function () {
      assert.igual([porId.correntes.total, porId.capital.total, porId.intra.total, porId.deducoes.total], [6500, 50, 400, -1000]);
    });
    T.it('itens + "Demais" fecham com o total do subgrupo', function () {
      var trib = porId.correntes.subgrupos[0];
      var iptu = trib.itens.filter(function (i) { return i.rotulo === 'IPTU'; })[0];
      var demais = trib.itens.filter(function (i) { return i.demais; })[0];
      assert.igual([trib.total, iptu.valor, demais.valor], [1500, 1000, 300]);
    });
    T.it('deduções viram itens dinâmicos', function () {
      assert.igual(porId.deducoes.itens.length, 1);
    });
  });

  T.describe('composicaoReceita.porGrupo', function () {
    var despesas = [
      { categoria: '3', totalCentavos: 4000 },
      { categoria: '4', totalCentavos: 1500 },
      { categoria: '9', totalCentavos: 450 }
    ];
    T.it('origem e aplicação com diferença (equilíbrio)', function () {
      var r = comp.porGrupo(receitas, despesas, 2027);
      assert.igual(r.origem.map(function (o) { return o.valor; }), [6500, 50, 400, -1000]);
      assert.igual(r.aplicacao.map(function (a) { return a.valor; }), [4000, 1500, 450]);
      assert.igual([r.totalOrigem, r.totalAplicacao, r.diferenca], [5950, 5950, 0]);
    });
  });
})(window.POTest, window.PO);
