// JAVASCRIPT
/**
 * @file periodos.js
 * @description Diluição da despesa por período (mensal, bimestral, trimestral,
 * quadrimestral e anual). Todas as operações em centavos inteiros.
 *
 * Base: um vetor de 12 posições (jan..dez). Os demais períodos são somas de
 * blocos consecutivos de meses (ex.: trimestral = blocos de 3).
 */
(function (PO) {
  'use strict';

  var dinheiro = PO.core.dinheiro;

  var MESES = Object.freeze(['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']);

  /** Catálogo de períodos: quantos meses compõem cada bloco. */
  var PERIODOS = Object.freeze({
    mensal: Object.freeze({ chave: 'mensal', rotulo: 'Mensal', meses: 1, sufixo: '' }),
    bimestral: Object.freeze({ chave: 'bimestral', rotulo: 'Bimestral', meses: 2, sufixo: 'º Bim' }),
    trimestral: Object.freeze({ chave: 'trimestral', rotulo: 'Trimestral', meses: 3, sufixo: 'º Tri' }),
    quadrimestral: Object.freeze({ chave: 'quadrimestral', rotulo: 'Quadrimestral', meses: 4, sufixo: 'º Quad' }),
    anual: Object.freeze({ chave: 'anual', rotulo: 'Anual', meses: 12, sufixo: '' })
  });

  /**
   * @param {string} chave
   * @returns {{chave:string, rotulo:string, meses:number, sufixo:string}}
   */
  function obter(chave) {
    var periodo = PERIODOS[chave];
    if (!periodo) {
      throw new Error('Período desconhecido: ' + chave);
    }
    return periodo;
  }

  /**
   * Rótulos das colunas do período. Ex.: trimestral → ["1º Tri", ..., "4º Tri"].
   * @param {string} chave
   * @returns {string[]}
   */
  function rotulos(chave) {
    var periodo = obter(chave);
    if (periodo.chave === 'mensal') {
      return MESES.slice();
    }
    if (periodo.chave === 'anual') {
      return ['Anual'];
    }
    var quantidade = 12 / periodo.meses;
    var lista = [];
    for (var i = 1; i <= quantidade; i += 1) {
      lista.push(i + periodo.sufixo);
    }
    return lista;
  }

  /**
   * Agrega 12 valores mensais no período escolhido.
   * @param {number[]} meses12 centavos jan..dez
   * @param {string} chave
   * @returns {number[]}
   */
  function agregar(meses12, chave) {
    var periodo = obter(chave);
    var resultado = [];
    for (var inicio = 0; inicio < 12; inicio += periodo.meses) {
      resultado.push(dinheiro.somar(meses12.slice(inicio, inicio + periodo.meses)));
    }
    return resultado;
  }

  /**
   * Vetor mensal "efetivo" de uma despesa: o cronograma informado na planilha
   * ou, se a dotação ainda não foi diluída, uma projeção linear (1/12).
   * @param {{totalCentavos:number, mesesCentavos:(number[]|null)}} despesa
   * @returns {number[]}
   */
  function mesesEfetivos(despesa) {
    if (despesa.mesesCentavos && despesa.mesesCentavos.length === 12) {
      return despesa.mesesCentavos;
    }
    return dinheiro.distribuir(despesa.totalCentavos, 12);
  }

  /**
   * Soma vetores mensais de várias despesas.
   * @param {Array} despesas
   * @returns {number[]}
   */
  function somarMeses(despesas) {
    var total = new Array(12).fill(0);
    despesas.forEach(function (despesa) {
      var meses = mesesEfetivos(despesa);
      for (var i = 0; i < 12; i += 1) {
        total[i] += meses[i];
      }
    });
    return total;
  }

  /** @returns {Array} lista de períodos para selects */
  function listar() {
    return Object.keys(PERIODOS).map(function (k) {
      return PERIODOS[k];
    });
  }

  PO.domain.periodos = Object.freeze({
    MESES: MESES,
    obter: obter,
    listar: listar,
    rotulos: rotulos,
    agregar: agregar,
    mesesEfetivos: mesesEfetivos,
    somarMeses: somarMeses
  });
})(window.PO);
