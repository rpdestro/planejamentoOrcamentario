// JAVASCRIPT
/**
 * @file roteador.js
 * @description Roteador por hash (#/rota/parametro), compatível com file://.
 *
 * Contrato de uma view (PO.ui.views.*):
 *   render(container: HTMLElement, params: string[]): Promise|void
 * O roteador limpa o container, chama render e trata erros de forma visível.
 *
 * Rotas:
 *   #/painel · #/secretaria/02.01 · #/receitas · #/importar
 *   #/relatorios · #/exportar
 */
(function (PO) {
  'use strict';

  var rotas = new Map();
  var container = null;
  var ROTA_PADRAO = 'painel';

  /**
   * @param {string} nome primeiro segmento do hash
   * @param {{render:Function, titulo?:string}} view
   */
  function registrar(nome, view) {
    rotas.set(nome, view);
  }

  /** Decompõe "#/secretaria/02.01" em { nome: "secretaria", params: ["02.01"] }. */
  function rotaAtual() {
    var partes = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    return { nome: partes[0] || ROTA_PADRAO, params: partes.slice(1) };
  }

  /** Renderiza a rota corrente. */
  function renderizar() {
    var rota = rotaAtual();
    var view = rotas.get(rota.nome) || PO.ui.views.naoEncontrado;

    PO.core.dom.limpar(container);
    container.setAttribute('aria-busy', 'true');
    PO.core.eventos.emit('rota:alterada', rota);

    Promise.resolve()
      .then(function () {
        return view.render(container, rota.params);
      })
      .catch(function (erro) {
        console.error('[roteador] Falha ao renderizar "' + rota.nome + '":', erro);
        PO.core.dom.limpar(container);
        container.appendChild(PO.core.dom.h('section', { className: 'alert alert--error', attrs: { role: 'alert' }, testid: 'erro-view' }, [
          PO.core.dom.h('h2', { className: 'alert__title', text: 'Não foi possível exibir esta página.' }),
          PO.core.dom.h('p', { text: erro && erro.message ? erro.message : String(erro) })
        ]));
      })
      .then(function () {
        container.removeAttribute('aria-busy');
      });
  }

  /**
   * Inicia o roteador.
   * @param {HTMLElement} alvo
   */
  function iniciar(alvo) {
    container = alvo;
    window.addEventListener('hashchange', renderizar);
    if (!window.location.hash) {
      window.location.hash = '#/' + ROTA_PADRAO;
      return; // hashchange chamará renderizar()
    }
    renderizar();
  }

  PO.ui.roteador = Object.freeze({
    registrar: registrar,
    iniciar: iniciar,
    rotaAtual: rotaAtual,
    recarregar: renderizar
  });
})(window.PO);
