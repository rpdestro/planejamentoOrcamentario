// JAVASCRIPT
/**
 * @file valor-insuficiente.js
 * @description Regra pura da coluna H "Valor insuficiente" do Cronograma de
 * Orçamento: confere se o valor DILUÍDO planejado (soma de janeiro a dezembro)
 * é compatível com o Valor Total do Orçamento da dotação.
 *
 *   valor insuficiente (saldo) = valor total − soma dos meses
 *
 * Situação (indicador gráfico):
 *   - negativo (vermelho): saldo < 0 → o planejado mensal ULTRAPASSA a dotação
 *                          (falta orçamento para cobrir o cronograma);
 *   - atende   (azul)    : saldo = 0 → o planejado mensal fecha exatamente;
 *   - positivo (verde)   : saldo > 0 → sobra dotação ainda não diluída nos meses.
 *
 * Dotação sem cronograma (meses vazios) tem diluído = 0, logo saldo = total.
 * Tudo em centavos inteiros (CLAUDE.md — Precisão Numérica).
 */
(function (PO) {
  'use strict';

  var dinheiro = PO.core.dinheiro;

  var SITUACOES = Object.freeze({
    negativo: Object.freeze({ chave: 'negativo', rotulo: 'Negativo', variante: 'erro' }),
    atende: Object.freeze({ chave: 'atende', rotulo: 'Atende', variante: 'info' }),
    positivo: Object.freeze({ chave: 'positivo', rotulo: 'Positivo', variante: 'ok' })
  });

  /** Situação a partir do saldo em centavos. */
  function classificar(saldoCentavos) {
    if (saldoCentavos < 0) {
      return SITUACOES.negativo;
    }
    return saldoCentavos === 0 ? SITUACOES.atende : SITUACOES.positivo;
  }

  /**
   * @param {{totalCentavos:number, mesesCentavos:(number[]|null)}} registro
   * @returns {{diluidoCentavos:number, saldoCentavos:number, situacao:{chave:string, rotulo:string, variante:string}}}
   */
  function calcular(registro) {
    var diluido = registro.mesesCentavos ? dinheiro.somar(registro.mesesCentavos) : 0;
    var saldo = (registro.totalCentavos || 0) - diluido;
    return { diluidoCentavos: diluido, saldoCentavos: saldo, situacao: classificar(saldo) };
  }

  /**
   * Totais por situação de uma lista de dotações.
   * @param {Array} registros
   * @returns {{negativo:number, atende:number, positivo:number, saldoCentavos:number, faltaCentavos:number}}
   *   `faltaCentavos` = soma dos saldos negativos (em módulo): quanto falta de dotação.
   */
  function resumir(registros) {
    var r = { negativo: 0, atende: 0, positivo: 0, saldoCentavos: 0, faltaCentavos: 0 };
    registros.forEach(function (reg) {
      var c = calcular(reg);
      r[c.situacao.chave] += 1;
      r.saldoCentavos += c.saldoCentavos;
      if (c.saldoCentavos < 0) {
        r.faltaCentavos -= c.saldoCentavos;
      }
    });
    return r;
  }

  PO.domain.valorInsuficiente = Object.freeze({
    SITUACOES: SITUACOES,
    classificar: classificar,
    calcular: calcular,
    resumir: resumir
  });
})(window.PO);
