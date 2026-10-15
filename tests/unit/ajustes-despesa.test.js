// JAVASCRIPT
/** Testes: js/domain/ajustes-despesa.js — inclusão/alteração/anulação auditáveis. */
(function (T, PO) {
  'use strict';

  var aj = PO.domain.ajustesDespesa;
  var assert = T.assert;

  function base() {
    return [
      { id: 1, uo: '02.01', ue: '02.01.01', funcional: '04.122.0001.2001', natureza: '3.3.90.39', descricao: 'Serviços', fonte: '1', totalCentavos: 1200, mesesCentavos: null, diluida: false, divergenciaCentavos: 0 },
      { id: 2, uo: '02.01', ue: '02.01.01', funcional: '04.122.0001.2001', natureza: '3.3.90.30', descricao: 'Material', fonte: '1', totalCentavos: 600, mesesCentavos: null, diluida: false, divergenciaCentavos: 0 }
    ];
  }

  var dadosNovos = { ue: '02.01.02', funcional: '04.122.0001.2002', natureza: '4.4.90.52', descricao: 'Equipamentos', fonte: '5', totalCentavos: 2400, mesesCentavos: null };

  T.describe('ajustesDespesa.aplicar', function () {
    T.it('sem ajustes devolve cópias com chave e origem', function () {
      var r = aj.aplicar(base(), []);
      assert.igual(r.map(function (x) { return x.chave; }), ['i1', 'i2']);
      assert.igual(r[0].origem, 'importada');
    });
    T.it('inclusão entra ao final com chave "m<id>" e classificação derivada', function () {
      var r = aj.aplicar(base(), [{ id: 7, operacao: 'inclusao', uo: '02.01', exercicio: 2027, dados: dadosNovos }]);
      assert.igual(r.length, 3);
      assert.igual(r[2].chave, 'm7');
      assert.igual([r[2].categoria, r[2].gnd, r[2].origem], ['4', '4', 'manual']);
    });
    T.it('alteração substitui campos e marca como alterada, sem mudar a ordem', function () {
      var r = aj.aplicar(base(), [{ id: 3, operacao: 'alteracao', alvo: 'i1', dados: dadosNovos }]);
      assert.igual(r[0].chave, 'i1');
      assert.igual([r[0].totalCentavos, r[0].alterada], [2400, true]);
    });
    T.it('exclusão (anulação) retira a dotação dos totais', function () {
      var r = aj.aplicar(base(), [{ id: 4, operacao: 'exclusao', alvo: 'i2' }]);
      assert.igual(r.map(function (x) { return x.chave; }), ['i1']);
    });
    T.it('ajustes são aplicados em ordem de id (alterar e depois anular)', function () {
      var r = aj.aplicar(base(), [{ id: 9, operacao: 'exclusao', alvo: 'i1' }, { id: 8, operacao: 'alteracao', alvo: 'i1', dados: dadosNovos }]);
      assert.igual(r.length, 1);
    });
    T.it('não altera o lote original (imutabilidade)', function () {
      var b = base();
      aj.aplicar(b, [{ id: 3, operacao: 'alteracao', alvo: 'i1', dados: dadosNovos }]);
      assert.igual(b[0].totalCentavos, 1200);
    });
  });

  T.describe('ajustesDespesa.historico', function () {
    var trilha = [
      { id: 10, dataHora: '2026-10-15T10:00:00.000Z', operacao: 'alteracao', uo: '02.01', alvo: 'i1', dados: dadosNovos, motivo: 'Remanejamento' },
      { id: 11, dataHora: '2026-10-15T11:00:00.000Z', operacao: 'inclusao', uo: '02.01', dados: dadosNovos, motivo: 'Inclusão manual' },
      { id: 12, dataHora: '2026-10-15T12:00:00.000Z', operacao: 'exclusao', uo: '02.01', alvo: 'i1', motivo: 'Erro de lançamento' },
      { id: 13, dataHora: '2026-10-15T13:00:00.000Z', operacao: 'exclusao', uo: '02.01', alvo: 'i1', motivo: 'Anulação repetida' }
    ];
    T.it('alteração registra valor e natureza antes/depois', function () {
      var l = aj.historico(base(), trilha)[0];
      assert.igual([l.antesCentavos, l.depoisCentavos], [1200, 2400]);
      assert.igual([l.naturezaAntes, l.naturezaDepois], ['3.3.90.39', '4.4.90.52']);
      assert.igual(l.motivo, 'Remanejamento');
    });
    T.it('inclusão não tem valor antes', function () {
      var l = aj.historico(base(), trilha)[1];
      assert.igual([l.antesCentavos, l.depoisCentavos, l.alvo], [null, 2400, 'm11']);
    });
    T.it('anulação parte do valor vigente (já alterado) e termina em zero', function () {
      var l = aj.historico(base(), trilha)[2];
      assert.igual([l.antesCentavos, l.depoisCentavos, l.alvoEncontrado], [2400, 0, true]);
    });
    T.it('anulação de dotação já anulada fica sem efeito', function () {
      var l = aj.historico(base(), trilha)[3];
      assert.igual([l.antesCentavos, l.depoisCentavos, l.alvoEncontrado], [null, null, false]);
    });
    T.it('ordena por id mesmo com entrada fora de ordem', function () {
      var r = aj.historico(base(), trilha.slice().reverse());
      assert.igual(r.map(function (l) { return l.id; }), [10, 11, 12, 13]);
    });
    T.it('resumir conta por operação', function () {
      assert.igual(aj.resumir(trilha), { total: 4, inclusao: 1, alteracao: 1, exclusao: 2 });
    });
  });

  T.describe('ajustesDespesa.inclusoesParaReaplicar', function () {
    T.it('devolve inclusões vigentes com os dados finais (após alteração)', function () {
      var alterados = Object.assign({}, dadosNovos, { totalCentavos: 3600 });
      var r = aj.inclusoesParaReaplicar([
        { id: 5, operacao: 'inclusao', uo: '02.01', dados: dadosNovos, motivo: 'Inclusão manual' },
        { id: 6, operacao: 'alteracao', uo: '02.01', alvo: 'm5', dados: alterados, motivo: 'Ajuste de valor' }
      ]);
      assert.igual(r.length, 1);
      assert.igual([r[0].origemId, r[0].uo, r[0].dados.totalCentavos, r[0].motivoOriginal], [5, '02.01', 3600, 'Inclusão manual']);
    });
    T.it('ignora inclusões anuladas e ajustes sobre dotações importadas', function () {
      var r = aj.inclusoesParaReaplicar([
        { id: 5, operacao: 'inclusao', uo: '02.01', dados: dadosNovos },
        { id: 6, operacao: 'exclusao', uo: '02.01', alvo: 'm5' },
        { id: 7, operacao: 'alteracao', uo: '02.01', alvo: 'i1', dados: dadosNovos },
        { id: 8, operacao: 'exclusao', uo: '02.01', alvo: 'i2' }
      ]);
      assert.igual(r, []);
    });
  });

  T.describe('ajustesDespesa.validar', function () {
    var ok = { ue: '02.01.01', funcional: '', natureza: '3.3.90.39', descricao: 'X', fonte: '1', total: '1.200,00', meses: [], motivo: '' };
    T.it('aceita dados válidos e converte o total em centavos', function () {
      var r = aj.validar(ok, 'inclusao');
      assert.igual(r.dados.totalCentavos, 120000);
      assert.igual(r.dados.mesesCentavos, null);
    });
    T.it('rejeita natureza fora do padrão e total inválido', function () {
      var r = aj.validar(Object.assign({}, ok, { natureza: '3390', total: 'abc' }), 'inclusao');
      assert.verdadeiro(r.erros.natureza && r.erros.total);
    });
    T.it('meses precisam fechar com o total', function () {
      var meses = ['100,00', '', '', '', '', '', '', '', '', '', '', ''];
      var r = aj.validar(Object.assign({}, ok, { meses: meses }), 'inclusao');
      assert.verdadeiro(r.erros.meses);
    });
    T.it('alteração exige motivo', function () {
      assert.verdadeiro(aj.validar(ok, 'alteracao').erros.motivo);
      assert.igual(aj.validar(Object.assign({}, ok, { motivo: 'Remanejamento' }), 'alteracao').erros, {});
    });
  });
})(window.POTest, window.PO);
