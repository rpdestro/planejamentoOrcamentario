// JAVASCRIPT
/** Testes: js/ui/tema.js — decisão do tema claro/escuro. */
(function (T, PO) {
  'use strict';

  var tema = PO.ui.tema;
  var assert = T.assert;

  T.describe('tema.resolver', function () {
    T.it('escolha salva do usuário prevalece sobre o sistema', function () {
      assert.igual(tema.resolver('claro', true), 'claro');
      assert.igual(tema.resolver('escuro', false), 'escuro');
    });
    T.it('sem escolha salva, segue a preferência do sistema', function () {
      assert.igual(tema.resolver(null, true), 'escuro');
      assert.igual(tema.resolver(null, false), 'claro');
    });
    T.it('valor salvo inválido é ignorado', function () {
      assert.igual(tema.resolver('azul', true), 'escuro');
      assert.igual(tema.resolver('', false), 'claro');
    });
  });
})(window.POTest, window.PO);
