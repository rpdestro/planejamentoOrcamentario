// JAVASCRIPT
/** Testes: mapeadores de despesas e receitas (amostras dos layouts reais). */
(function (T, PO) {
  'use strict';

  var assert = T.assert;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro ', 'outubro', 'novembro ', 'dezembro'];
  var CAB_DESPESA = ['Unidade orçamentária', 'unidade executora', 'funcional', 'natureza de despesa', 'descrição', 'fonte', 'valor total orçamento 2027', 'valor insuficiente'].concat(MESES);

  T.describe('mapeadorDespesas', function () {
    var tabela = {
      cabecalho: CAB_DESPESA,
      linhas: [
        ['01.01', '01.01.01', '01.031.0001.2001', '3.3.90.34', 'Terceirização', 1, 500, null,
          41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.7, 41.3],
        ['03.01', '03.01.01', '99.997.9999.9999', '9.9.99.99', 'RESERVA', null, 19414600, null,
          null, null, null, null, null, null, null, null, null, null, null, null],
        ['02.10', '02.10.01', '08.245.0032.2041', '3.3.90.30', 'Material', '1', 3000, null,
          500, 500, null, 500, null, 500, null, 500, null, 500, null, 400],
        [null, '02.35.08', '15.452.0028.2082', '3.3.67.82', 'PPP', null, 15293000, null],
        ['02.02', '02.02.02', '16.482.0033.2000', '3.3.90.48', 'Aluguel social', null, null, null],
        [null, null, null, null, null, null, 996263686.69, null]
      ]
    };
    var r = PO.importers.mapeadorDespesas.mapear(tabela, { exercicio: 2027 });

    T.it('importa linhas válidas e ignora o rodapé de totais', function () {
      assert.igual(r.erros, []);
      assert.igual(r.resumo.importadas, 5);
      assert.igual(r.resumo.ignoradas, 1);
      assert.igual(r.resumo.anoCabecalho, 2027);
    });
    T.it('deriva a UO a partir da UE quando a UO está vazia', function () {
      assert.igual(r.registros[3].uo, '02.35');
      assert.igual(r.registros[3].totalCentavos, 1529300000);
    });
    T.it('importa total vazio como zero, com aviso', function () {
      assert.igual(r.registros[4].totalCentavos, 0);
      assert.verdadeiro(r.avisos.some(function (a) { return a.linha === 6 && /Valor total vazio/.test(a.mensagem); }));
    });
    T.it('converte para centavos e reconhece cronograma', function () {
      assert.igual(r.registros[0].totalCentavos, 50000);
      assert.igual(r.registros[0].mesesCentavos[11], 4130);
      assert.igual(r.registros[0].divergenciaCentavos, 0);
    });
    T.it('marca dotação sem meses como não diluída', function () {
      assert.igual(r.registros[1].diluida, false);
      assert.igual(r.registros[1].mesesCentavos, null);
    });
    T.it('aponta divergência entre meses e total', function () {
      assert.igual(r.registros[2].divergenciaCentavos, 40000); // meses = 3.400,00; total = 3.000,00
      assert.verdadeiro(r.avisos.some(function (a) { return a.linha === 4 && /Soma dos meses/.test(a.mensagem); }));
    });
    T.it('acusa coluna obrigatória ausente', function () {
      var semNatureza = PO.importers.mapeadorDespesas.mapear({ cabecalho: ['Unidade orçamentária', 'valor total orçamento 2027'], linhas: [] }, { exercicio: 2027 });
      assert.verdadeiro(semNatureza.erros.length > 0);
    });
  });

  T.describe('mapeadorReceitas', function () {
    var tabela = {
      cabecalho: ['CODRE', 'NOMRE', 'TIPOREC', 'FONTE_STN', 'VLR6_CALC', 'VLR7_CALC', ''],
      linhas: [
        ['1000.00.0.0.00.00', 'RECEITAS CORRENTES', '', '', '300', '330', ''],
        ['1112.50.0.0.00.00', 'IPTU', '', '', '200', '220', ''],
        ['1112.50.0.1.00.00', 'IPTU PRINCIPAL', 'S', '', '200', '220', ''],
        ['1112.53.0.0.00.00', 'ITBI', '', '', '100', '110', ''],
        ['9510.00.0.0.00.00', 'DEDUÇÕES FUNDEB', '', '', '-50', '-55', ''],
        ['TOTAL', '', '', '', '0', '0', '']
      ]
    };
    var r = PO.importers.mapeadorReceitas.mapear(tabela, { anoInicial: 2027 });

    T.it('mapeia anos a partir do ano inicial', function () {
      assert.igual(r.resumo.anos, [2027, 2028]);
      assert.igual(r.registros[1].valoresCentavos[2027], 20000);
    });
    T.it('identifica analíticas pela hierarquia', function () {
      var analiticas = r.registros.filter(function (x) { return x.analitica; }).map(function (x) { return x.codigo; });
      assert.igual(analiticas, ['1112.50.0.1.00.00', '1112.53.0.0.00.00', '9510.00.0.0.00.00']);
    });
    T.it('totaliza só analíticas, com deduções', function () {
      assert.igual(r.resumo.totaisPorAno[2027].liquido, 25000);
      assert.igual(r.resumo.totaisPorAno[2027].porCategoria.deducao, -5000);
    });
  });
})(window.POTest, window.PO);
