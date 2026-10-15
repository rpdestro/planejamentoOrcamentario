// JAVASCRIPT
/** Testes: classificação da despesa e hierarquia da receita. */
(function (T, PO) {
  'use strict';

  var cd = PO.domain.classificacaoDespesa;
  var cr = PO.domain.classificacaoReceita;
  var assert = T.assert;

  T.describe('classificacaoDespesa', function () {
    T.it('decompõe natureza com 4 e 5 níveis', function () {
      var n = cd.parseNatureza('3.3.90.39');
      assert.igual([n.valido, n.categoria, n.gnd, n.modalidade, n.elemento], [true, '3', '3', '90', '39']);
      assert.igual(cd.parseNatureza('3.3.90.47.00').desdobramento, '00');
      assert.igual(cd.parseNatureza('339039').valido, false);
    });
    T.it('decompõe funcional e tipo de ação', function () {
      var f = cd.parseFuncional('01.031.0001.2001');
      assert.igual([f.funcao, f.subfuncao, f.programa, f.acao, f.tipoAcao], ['01', '031', '0001', '2001', 'Atividade']);
      assert.igual(cd.tipoAcao('1005'), 'Projeto');
      assert.igual(cd.tipoAcao('0009'), 'Operação Especial');
    });
    T.it('filtra por prefixo de natureza', function () {
      assert.verdadeiro(cd.casaPrefixo('3.3.90.39', '3.3.90'));
      assert.verdadeiro(!cd.casaPrefixo('4.4.90.52', '3.3'));
      assert.verdadeiro(cd.casaPrefixo('4.4.90.52', ''));
    });
  });

  T.describe('classificacaoReceita', function () {
    T.it('extrai níveis significativos', function () {
      assert.igual(cr.niveis('1000.00.0.0.00.00'), ['1']);
      assert.igual(cr.niveis('1112.50.0.1.00.00'), ['1', '1', '1', '2', '50', '0', '1']);
    });
    T.it('identifica descendentes sem falso positivo', function () {
      assert.verdadeiro(cr.ehDescendente('1100.00.0.0.00.00', '1112.50.0.1.00.00'));
      assert.verdadeiro(!cr.ehDescendente('1112.50.0.0.00.00', '1112.53.0.1.00.00'));
      assert.verdadeiro(!cr.ehDescendente('1000.00.0.0.00.00', '1000.00.0.0.00.00'));
      assert.verdadeiro(cr.ehDescendente('9510.00.0.0.00.00', '9510.00.0.0.00.01'));
    });
    T.it('classifica categoria pelo 1º dígito', function () {
      assert.igual(cr.categoria('7215.00.0.0.00.00').chave, 'intra-corrente');
      assert.igual(cr.categoria('9510.00.0.0.00.00').chave, 'deducao');
    });
  });
})(window.POTest, window.PO);
