// JAVASCRIPT
/**
 * @file runner.js
 * @description Mini framework de testes (describe/it/assert) sem dependências.
 * Registra suítes em `window.POTest` e executa via run.js.
 */
(function (global) {
  'use strict';

  var casos = [];
  var suiteAtual = '';

  function describe(nome, fn) {
    suiteAtual = nome;
    fn();
    suiteAtual = '';
  }

  function it(nome, fn) {
    casos.push({ nome: suiteAtual + ' › ' + nome, fn: fn });
  }

  /** Comparação profunda via JSON (suficiente para dados simples). */
  function igual(obtido, esperado, mensagem) {
    var a = JSON.stringify(obtido);
    var b = JSON.stringify(esperado);
    if (a !== b) {
      throw new Error((mensagem ? mensagem + ': ' : '') + 'esperado ' + b + ', obtido ' + a);
    }
  }

  function verdadeiro(valor, mensagem) {
    if (!valor) {
      throw new Error(mensagem || 'esperado verdadeiro');
    }
  }

  /** Executa todos os casos e devolve o relatório. */
  function executar() {
    return casos.map(function (caso) {
      try {
        caso.fn();
        return { nome: caso.nome, ok: true };
      } catch (erro) {
        return { nome: caso.nome, ok: false, erro: erro.message };
      }
    });
  }

  global.POTest = Object.freeze({
    describe: describe,
    it: it,
    assert: Object.freeze({ igual: igual, verdadeiro: verdadeiro }),
    executar: executar
  });
})(window);
