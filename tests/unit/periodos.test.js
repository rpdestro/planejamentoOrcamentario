// JAVASCRIPT
/** Testes: js/domain/periodos.js — diluição por período. */
(function (T, PO) {
  'use strict';

  var p = PO.domain.periodos;
  var assert = T.assert;
  var MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  T.describe('periodos.agregar', function () {
    T.it('bimestral soma pares de meses', function () {
      assert.igual(p.agregar(MESES, 'bimestral'), [3, 7, 11, 15, 19, 23]);
    });
    T.it('trimestral, quadrimestral e anual', function () {
      assert.igual(p.agregar(MESES, 'trimestral'), [6, 15, 24, 33]);
      assert.igual(p.agregar(MESES, 'quadrimestral'), [10, 26, 42]);
      assert.igual(p.agregar(MESES, 'anual'), [78]);
    });
    T.it('rótulos acompanham a quantidade de colunas', function () {
      assert.igual(p.rotulos('quadrimestral'), ['1º Quad', '2º Quad', '3º Quad']);
      assert.igual(p.rotulos('mensal').length, 12);
    });
  });

  T.describe('periodos.mesesEfetivos', function () {
    T.it('usa o cronograma quando existe', function () {
      assert.igual(p.mesesEfetivos({ totalCentavos: 78, mesesCentavos: MESES }), MESES);
    });
    T.it('projeta 1/12 quando não diluída', function () {
      var m = p.mesesEfetivos({ totalCentavos: 1200, mesesCentavos: null });
      assert.igual(m, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    });
  });
})(window.POTest, window.PO);
