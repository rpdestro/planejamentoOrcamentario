// JAVASCRIPT
/** Testes: js/core/dinheiro.js — aritmética em centavos inteiros. */
(function (T, PO) {
  'use strict';

  var d = PO.core.dinheiro;
  var assert = T.assert;

  T.describe('dinheiro.paraCentavos', function () {
    T.it('converte número do Excel com casas decimais', function () {
      assert.igual(d.paraCentavos(41.7), 4170);
      assert.igual(d.paraCentavos(996263686.69), 99626368669);
    });
    T.it('arredonda a 3ª casa sem erro de ponto flutuante', function () {
      assert.igual(d.paraCentavos(0.105), 11); // 0.105 em double é 0.10499…; toFixed(3) estabiliza
      assert.igual(d.paraCentavos('1.005'), 101);
    });
    T.it('aceita formato brasileiro e símbolo de moeda', function () {
      assert.igual(d.paraCentavos('R$ 1.234,56'), 123456);
      assert.igual(d.paraCentavos('-73818500'), -7381850000);
    });
    T.it('trata vazio conforme opção', function () {
      assert.igual(d.paraCentavos(''), null);
      assert.igual(d.paraCentavos(null, { vazioComoZero: true }), 0);
    });
    T.it('rejeita texto inválido', function () {
      assert.igual(d.paraCentavos('abc'), null);
    });
  });

  T.describe('dinheiro.distribuir', function () {
    T.it('soma exatamente o total, resíduo na última parcela', function () {
      var p = d.distribuir(50000, 12);
      assert.igual(d.somar(p), 50000);
      assert.igual(p[0], 4166);
      assert.igual(p[11], 4174);
    });
  });

  T.describe('dinheiro.formatar / percentual', function () {
    T.it('formata em pt-BR', function () {
      assert.igual(d.formatar(123456789), 'R$ 1.234.567,89');
      assert.igual(d.formatar(-5), '-R$ 0,05');
      assert.igual(d.paraTextoCsv(123456789), '1234567,89');
    });
    T.it('calcula percentual com 1 casa', function () {
      assert.igual(d.percentual(1, 3), '33,3%');
      assert.igual(d.percentual(1, 0), '—');
    });
  });
})(window.POTest, window.PO);
