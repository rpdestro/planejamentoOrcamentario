// JAVASCRIPT
/**
 * @file nao-encontrado.js
 * @description View de fallback para rotas inexistentes.
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;

  function render(container) {
    PO.core.dom.anexar(container, [
      PO.ui.componentes.cabecalhoPagina('Página não encontrada', 'O endereço acessado não corresponde a nenhum módulo.'),
      h('a', { className: 'btn btn--primary', text: 'Voltar ao Painel', testid: 'link-voltar-painel', attrs: { href: '#/painel' } })
    ]);
  }

  PO.ui.views.naoEncontrado = Object.freeze({ render: render });
})(window.PO);
