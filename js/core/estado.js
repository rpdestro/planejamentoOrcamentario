// JAVASCRIPT
/**
 * @file estado.js
 * @description Estado global mínimo da interface (exercício selecionado).
 * Alterações são publicadas no barramento de eventos.
 */
(function (PO) {
  'use strict';

  var CHAVE_STORAGE = 'po:exercicio';
  var exercicio = lerExercicioSalvo();

  /** Lê o último exercício escolhido (conveniência; falha silenciosa). */
  function lerExercicioSalvo() {
    try {
      var salvo = Number(window.localStorage.getItem(CHAVE_STORAGE));
      return Number.isInteger(salvo) && salvo > 2000 ? salvo : PO.core.config.exercicioPadrao;
    } catch (e) {
      return PO.core.config.exercicioPadrao;
    }
  }

  /** @returns {number} */
  function getExercicio() {
    return exercicio;
  }

  /** @param {number} novo */
  function setExercicio(novo) {
    var valor = Number(novo);
    if (!Number.isInteger(valor) || valor === exercicio) {
      return;
    }
    exercicio = valor;
    try {
      window.localStorage.setItem(CHAVE_STORAGE, String(valor));
    } catch (e) {
      // Armazenamento indisponível (modo privado): segue sem persistir.
    }
    PO.core.eventos.emit('exercicio:alterado', { exercicio: valor });
  }

  PO.core.estado = Object.freeze({ getExercicio: getExercicio, setExercicio: setExercicio });
})(window.PO);
