// JAVASCRIPT
/**
 * @file dom.js
 * @description Helpers de criação de DOM.
 *
 * Segurança: o conteúdo vem de planilhas externas, portanto NUNCA é inserido
 * via innerHTML. `h()` cria elementos e atribui texto com textContent,
 * eliminando risco de injeção de HTML/script.
 */
(function (PO) {
  'use strict';

  /**
   * Cria um elemento.
   * @param {string} tag
   * @param {Object} [props]
   *   - className {string}
   *   - text {string}           → textContent
   *   - attrs {Object}          → setAttribute (null/false omitem o atributo)
   *   - testid {string}         → data-testid
   *   - on {Object<string,Function>} → addEventListener
   * @param {Array<Node|string|null>|Node|string} [filhos]
   * @returns {HTMLElement}
   */
  function h(tag, props, filhos) {
    var el = document.createElement(tag);
    var p = props || {};

    if (p.className) {
      el.className = p.className;
    }
    if (p.text !== undefined && p.text !== null) {
      el.textContent = String(p.text);
    }
    if (p.testid) {
      el.setAttribute('data-testid', p.testid);
    }
    if (p.attrs) {
      Object.keys(p.attrs).forEach(function (nome) {
        var valor = p.attrs[nome];
        if (valor === null || valor === undefined || valor === false) {
          return;
        }
        el.setAttribute(nome, valor === true ? '' : String(valor));
      });
    }
    if (p.on) {
      Object.keys(p.on).forEach(function (evento) {
        el.addEventListener(evento, p.on[evento]);
      });
    }
    anexar(el, filhos);
    return el;
  }

  /**
   * Anexa filhos (nós, textos ou listas aninhadas), ignorando null/false.
   * @param {HTMLElement} el
   * @param {*} filhos
   */
  function anexar(el, filhos) {
    if (filhos === null || filhos === undefined || filhos === false) {
      return;
    }
    if (Array.isArray(filhos)) {
      filhos.forEach(function (filho) {
        anexar(el, filho);
      });
      return;
    }
    el.appendChild(typeof filhos === 'string' ? document.createTextNode(filhos) : filhos);
  }

  /** Remove todos os filhos de um elemento. */
  function limpar(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  PO.core.dom = Object.freeze({ h: h, anexar: anexar, limpar: limpar });
})(window.PO);
