// JAVASCRIPT
/** Testes: js/importers/csv-parser.js. */
(function (T, PO) {
  'use strict';

  var csv = PO.importers.csv;
  var assert = T.assert;

  T.describe('csv.parse', function () {
    T.it('detecta ";" e mantém campos vazios', function () {
      assert.igual(csv.parse('A;B;C\n1;;3\n'), [['A', 'B', 'C'], ['1', '', '3']]);
    });
    T.it('aspas no meio do campo são literais (padrão Fiorilli)', function () {
      var linhas = csv.parse('1112.53;IMPOSTOS SOBRE TRANSMISSÃO "INTER VIVOS" DE BENS;10\r\n');
      assert.igual(linhas[0][1], 'IMPOSTOS SOBRE TRANSMISSÃO "INTER VIVOS" DE BENS');
    });
    T.it('campo entre aspas com separador e aspas escapadas', function () {
      assert.igual(csv.parse('"a;b";"x ""y"""')[0], ['a;b', 'x "y"']);
    });
    T.it('decodifica Windows-1252 quando não é UTF-8', function () {
      // "CÃO" em Windows-1252: 0xC3 = "Ã" (byte inválido isolado em UTF-8)
      var texto = csv.decodificar(new Uint8Array([0x43, 0xc3, 0x4f]).buffer);
      assert.igual(texto, 'CÃO');
    });
  });
})(window.POTest, window.PO);
