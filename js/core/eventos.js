// JAVASCRIPT
/**
 * @file eventos.js
 * @description Barramento de eventos (publish/subscribe) para desacoplar
 * módulos. Ex.: o importador emite "dados:atualizados" e as views reagem
 * sem conhecer o importador.
 *
 * Eventos em uso:
 *   - "exercicio:alterado"  { exercicio }
 *   - "dados:atualizados"   { tipo }
 */
(function (PO) {
  'use strict';

  var assinantes = new Map();

  /**
   * Assina um evento.
   * @param {string} nome
   * @param {Function} callback
   * @returns {Function} função para cancelar a assinatura
   */
  function on(nome, callback) {
    if (!assinantes.has(nome)) {
      assinantes.set(nome, new Set());
    }
    assinantes.get(nome).add(callback);
    return function off() {
      assinantes.get(nome).delete(callback);
    };
  }

  /**
   * Publica um evento. Erros de um assinante não impedem os demais.
   * @param {string} nome
   * @param {*} [dados]
   */
  function emit(nome, dados) {
    var lista = assinantes.get(nome);
    if (!lista) {
      return;
    }
    lista.forEach(function (callback) {
      try {
        callback(dados);
      } catch (erro) {
        console.error('[eventos] Falha no assinante de "' + nome + '":', erro);
      }
    });
  }

  PO.core.eventos = Object.freeze({ on: on, emit: emit });
})(window.PO);
