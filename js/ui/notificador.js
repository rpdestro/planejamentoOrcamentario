// JAVASCRIPT
/**
 * @file notificador.js
 * @description Notificações "toast" acessíveis. Erros usam role="alert"
 * (anunciados imediatamente por leitores de tela); demais usam role="status".
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var DURACAO_MS = 6000;
  var contador = 0;

  /**
   * @param {string} mensagem
   * @param {'sucesso'|'erro'|'aviso'|'info'} [tipo]
   */
  function notificar(mensagem, tipo) {
    var regiao = document.getElementById('notificacoes');
    if (!regiao) {
      return;
    }
    var variante = tipo || 'info';
    contador += 1;

    var toast = h('div', {
      className: 'toast toast--' + variante,
      testid: 'toast-' + variante,
      attrs: { role: variante === 'erro' ? 'alert' : 'status', id: 'toast-' + contador }
    }, [
      h('p', { className: 'toast__message', text: mensagem }),
      h('button', {
        className: 'toast__close',
        text: '×',
        testid: 'btn-fechar-toast',
        attrs: { type: 'button', 'aria-label': 'Fechar notificação' },
        on: { click: function () { toast.remove(); } }
      })
    ]);

    regiao.appendChild(toast);
    // Erros permanecem até o usuário fechar; demais somem sozinhos.
    if (variante !== 'erro') {
      window.setTimeout(function () {
        toast.remove();
      }, DURACAO_MS);
    }
  }

  PO.ui.notificador = Object.freeze({
    sucesso: function (m) { notificar(m, 'sucesso'); },
    erro: function (m) { notificar(m, 'erro'); },
    aviso: function (m) { notificar(m, 'aviso'); },
    info: function (m) { notificar(m, 'info'); }
  });
})(window.PO);
