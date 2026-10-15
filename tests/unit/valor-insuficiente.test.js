// JAVASCRIPT
/** Testes: coluna H "valor insuficiente" e Base Excel (layout e reimportação). */
(function (T, PO) {
  'use strict';

  var assert = T.assert;
  var vi = PO.domain.valorInsuficiente;
  var doze = function (v) { return [v, v, v, v, v, v, v, v, v, v, v, v]; };

  T.describe('valorInsuficiente.calcular', function () {
    T.it('Atende quando a soma dos meses fecha com o total', function () {
      var c = vi.calcular({ totalCentavos: 120000, mesesCentavos: doze(10000) });
      assert.igual(c.saldoCentavos, 0);
      assert.igual(c.situacao.chave, 'atende');
      assert.igual(c.situacao.variante, 'info');
    });
    T.it('Negativo quando o planejado mensal ultrapassa o total', function () {
      var c = vi.calcular({ totalCentavos: 100000, mesesCentavos: doze(10000) });
      assert.igual(c.diluidoCentavos, 120000);
      assert.igual(c.saldoCentavos, -20000);
      assert.igual(c.situacao.chave, 'negativo');
      assert.igual(c.situacao.variante, 'erro');
    });
    T.it('Positivo quando sobra dotação não diluída', function () {
      var c = vi.calcular({ totalCentavos: 130000, mesesCentavos: doze(10000) });
      assert.igual(c.saldoCentavos, 10000);
      assert.igual(c.situacao.chave, 'positivo');
      assert.igual(c.situacao.variante, 'ok');
    });
    T.it('dotação sem cronograma: diluído 0 e saldo = total', function () {
      var c = vi.calcular({ totalCentavos: 5000, mesesCentavos: null });
      assert.igual(c.diluidoCentavos, 0);
      assert.igual(c.saldoCentavos, 5000);
    });
  });

  T.describe('valorInsuficiente.resumir', function () {
    T.it('conta situações e soma o que falta (em módulo)', function () {
      var r = vi.resumir([
        { totalCentavos: 100, mesesCentavos: doze(10) },   // −20
        { totalCentavos: 120, mesesCentavos: doze(10) },   // 0
        { totalCentavos: 500, mesesCentavos: null }        // +500
      ]);
      assert.igual([r.negativo, r.atende, r.positivo], [1, 1, 1]);
      assert.igual(r.faltaCentavos, 20);
      assert.igual(r.saldoCentavos, 480);
    });
  });

  T.describe('mapeadorDespesas — coluna H calculada', function () {
    var cab = ['Unidade orçamentária', 'unidade executora', 'funcional', 'natureza de despesa', 'descrição', 'fonte',
      'valor total orçamento 2027', 'valor insuficiente', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    var r = PO.importers.mapeadorDespesas.mapear({
      cabecalho: cab,
      linhas: [
        ['02.10', '02.10.01', '08.245.0032.2041', '3.3.90.30', 'Material', '1', 3000, 999,
          500, 500, null, 500, null, 500, null, 500, null, 500, null, 400]
      ]
    }, { exercicio: 2027 });
    T.it('ignora o valor digitado na planilha e calcula total − meses', function () {
      assert.igual(r.registros[0].insuficienteCentavos, -40000);
      assert.igual(r.resumo.valorInsuficiente.negativo, 1);
    });
  });

  T.describe('baseExcel.matrizCronograma', function () {
    var registros = [
      { uo: '02.01', ue: '02.01.01', funcional: '04.122.0001.2001', natureza: '3.3.90.30', descricao: 'Material', fonte: '1',
        totalCentavos: 120000, mesesCentavos: doze(10000) },
      { uo: '02.04', ue: '02.04.01', funcional: '12.361.0004.2010', natureza: '3.1.90.11', descricao: 'Pessoal', fonte: '2',
        totalCentavos: 5000, mesesCentavos: null }
    ];
    var matriz = PO.data.baseExcel.matrizCronograma(registros, 2027);

    T.it('mantém o layout A–T do Cronograma de Orçamento', function () {
      assert.igual(matriz[0].length, 20);
      assert.igual(matriz[0][6], 'valor total orçamento 2027');
      assert.igual(matriz[0][7], 'valor insuficiente');
      assert.igual(matriz[0][8], 'janeiro');
      assert.igual(matriz[0][19], 'dezembro');
    });
    T.it('dotação não diluída sai com meses em branco e H = total', function () {
      assert.igual(matriz[2][7], 50);
      assert.igual(matriz[2][8], null);
    });
    T.it('é reimportável pelo mapeador de despesas sem perda', function () {
      var r = PO.importers.mapeadorDespesas.mapear({ cabecalho: matriz[0], linhas: matriz.slice(1) }, { exercicio: 2027 });
      assert.igual(r.erros, []);
      assert.igual(r.registros.length, 2);
      assert.igual(r.registros[0].mesesCentavos, doze(10000));
      assert.igual(r.registros[1].diluida, false);
      assert.igual(r.registros[1].totalCentavos, 5000);
    });
  });
})(window.POTest, window.PO);
