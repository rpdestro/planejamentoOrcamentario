// JAVASCRIPT
/**
 * @file tema.js
 * @description Modo claro/escuro. Aplica o tema marcando <html data-tema="…">;
 * as cores em si ficam nos tokens de css/base.css.
 *
 * Carregado no <head> (logo após namespace.js), e não no fim do <body> como
 * os demais módulos de UI: assim o tema é aplicado ANTES da primeira pintura
 * e a tela não "pisca" em branco ao abrir no modo escuro. Por isso depende
 * apenas de `PO` — nada de PO.core.dom/eventos, que ainda não existem aqui.
 *
 * Ordem de decisão: escolha salva pelo usuário → preferência do sistema
 * operacional (prefers-color-scheme) → claro.
 */
(function (PO) {
  'use strict';

  var TEMAS = Object.freeze({ CLARO: 'claro', ESCURO: 'escuro' });
  var CHAVE_ARMAZENAMENTO = 'po.tema';
  var consultaSistema = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /**
   * Regra pura (testável): decide o tema a partir da escolha salva e da
   * preferência do sistema. Valores salvos inválidos são ignorados.
   * @param {string|null} salvo
   * @param {boolean} sistemaPrefereEscuro
   * @returns {'claro'|'escuro'}
   */
  function resolver(salvo, sistemaPrefereEscuro) {
    if (salvo === TEMAS.CLARO || salvo === TEMAS.ESCURO) {
      return salvo;
    }
    return sistemaPrefereEscuro ? TEMAS.ESCURO : TEMAS.CLARO;
  }

  // localStorage pode lançar exceção (navegação privada, política do navegador):
  // nesse caso o tema funciona normalmente, apenas não é lembrado.
  function lerEscolha() {
    try {
      return window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
    } catch (e) {
      return null;
    }
  }

  function salvarEscolha(tema) {
    try {
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, tema);
    } catch (e) {
      /* sem persistência — ver comentário acima */
    }
  }

  /** @returns {'claro'|'escuro'} tema aplicado no momento */
  function atual() {
    return document.documentElement.getAttribute('data-tema') === TEMAS.ESCURO ? TEMAS.ESCURO : TEMAS.CLARO;
  }

  function aplicar(tema) {
    document.documentElement.setAttribute('data-tema', tema);
  }

  /** Inverte o tema atual e memoriza a escolha explícita do usuário. */
  function alternar() {
    var novo = atual() === TEMAS.ESCURO ? TEMAS.CLARO : TEMAS.ESCURO;
    aplicar(novo);
    salvarEscolha(novo);
    return novo;
  }

  /**
   * Liga o botão de alternância. O rótulo acessível é fixo ("Modo escuro")
   * e o estado é comunicado por aria-pressed — padrão WAI-ARIA para toggles.
   * @param {HTMLButtonElement} botao
   */
  function ligarBotao(botao) {
    function sincronizar() {
      botao.setAttribute('aria-pressed', String(atual() === TEMAS.ESCURO));
    }
    botao.addEventListener('click', function () {
      alternar();
      sincronizar();
    });
    // Sem escolha salva, acompanha mudanças do sistema com a página aberta.
    if (consultaSistema && consultaSistema.addEventListener) {
      consultaSistema.addEventListener('change', function (evento) {
        if (lerEscolha() === null) {
          aplicar(resolver(null, evento.matches));
          sincronizar();
        }
      });
    }
    sincronizar();
  }

  // Aplica imediatamente, durante o parse do <head>.
  aplicar(resolver(lerEscolha(), Boolean(consultaSistema && consultaSistema.matches)));

  PO.ui.tema = Object.freeze({
    TEMAS: TEMAS,
    resolver: resolver,
    atual: atual,
    alternar: alternar,
    ligarBotao: ligarBotao
  });
})(window.PO);
