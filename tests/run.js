// JAVASCRIPT
/**
 * @file run.js
 * @description Executa as suítes registradas e exibe o resultado na página.
 * O relatório também fica em window.__resultadosTestes para automação.
 */
(function () {
  'use strict';

  var resultados = window.POTest.executar();
  var falhas = resultados.filter(function (r) { return !r.ok; });
  var lista = document.getElementById('resultados');
  var resumo = document.getElementById('resumo');

  resultados.forEach(function (r) {
    var item = document.createElement('li');
    item.className = 'test-list__item test-list__item--' + (r.ok ? 'ok' : 'falha');
    item.textContent = (r.ok ? '✔ ' : '✘ ') + r.nome;
    if (!r.ok) {
      var detalhe = document.createElement('span');
      detalhe.className = 'test-list__erro';
      detalhe.textContent = r.erro;
      item.appendChild(detalhe);
    }
    lista.appendChild(item);
  });

  resumo.textContent = (resultados.length - falhas.length) + ' de ' + resultados.length + ' testes passaram.';
  resumo.classList.add(falhas.length ? 'test-page__summary--falha' : 'test-page__summary--ok');
  window.__resultadosTestes = { total: resultados.length, falhas: falhas.length, resultados: resultados };
})();
