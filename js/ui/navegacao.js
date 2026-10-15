// JAVASCRIPT
/**
 * @file navegacao.js
 * @description Monta o menu lateral a partir de `config.orgaos` e mantém
 * o item ativo sincronizado com a rota (aria-current="page").
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var slug = PO.core.texto.slug;

  /** Link de navegação. */
  function link(rotulo, href, testid) {
    return h('li', { className: 'app-nav__item' },
      h('a', { className: 'app-nav__link', text: rotulo, testid: testid, attrs: { href: href } })
    );
  }

  /** Grupo de links com título. */
  function grupo(titulo, itens, testid) {
    return h('section', { className: 'app-nav__group', testid: testid }, [
      h('h2', { className: 'app-nav__group-title', text: titulo }),
      h('ul', { className: 'app-nav__list' }, itens)
    ]);
  }

  /**
   * Renderiza o menu.
   * @param {HTMLElement} nav
   */
  function renderizar(nav) {
    var orgaos = PO.core.config.orgaos;
    var secretarias = orgaos.filter(function (o) { return o.tipo === 'secretaria'; });
    var outros = orgaos.filter(function (o) { return o.tipo !== 'secretaria'; });

    function linkOrgao(o) {
      return link(o.codigo + ' — ' + o.nome, '#/secretaria/' + encodeURIComponent(o.codigo), 'nav-orgao-' + slug(o.codigo));
    }

    // Ordem definida pela equipe (v0.2.0): Visão geral → Secretarias → Outros órgãos.
    PO.core.dom.limpar(nav);
    PO.core.dom.anexar(nav, [
      grupo('Visão geral', [
        link('Painel', '#/painel', 'nav-painel'),
        link('Gráficos', '#/graficos', 'nav-graficos'),
        link('Receitas', '#/receitas', 'nav-receitas'),
        link('Relatórios de Projeção', '#/relatorios', 'nav-relatorios'),
        link('Exportar', '#/exportar', 'nav-exportar'),
        link('Importar planilhas', '#/importar', 'nav-importar')
      ], 'nav-grupo-geral'),
      grupo('Secretarias (' + secretarias.length + ')', secretarias.map(linkOrgao), 'nav-grupo-secretarias'),
      outros.length ? grupo('Outros órgãos', outros.map(linkOrgao), 'nav-grupo-outros') : null
    ]);
  }

  /** Marca o link ativo conforme o hash atual. */
  function marcarAtivo(nav) {
    var hash = window.location.hash || '#/painel';
    nav.querySelectorAll('.app-nav__link').forEach(function (a) {
      var ativo = a.getAttribute('href') === hash;
      a.classList.toggle('app-nav__link--active', ativo);
      if (ativo) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
  }

  /** true quando o layout é de celular/tablet (menu deslizante). */
  function ehTelaPequena() {
    return window.matchMedia('(max-width: 860px)').matches;
  }

  /**
   * Liga o botão de menu.
   *  - Tela pequena: abre/fecha o menu deslizante.
   *  - Desktop: recolhe/expande o menu lateral, liberando largura para
   *    tabelas extensas (ex.: período Mensal).
   * @param {HTMLElement} botao
   * @param {HTMLElement} nav
   */
  function ligarMenuMovel(botao, nav) {
    function definirAberto(aberto) {
      nav.classList.toggle('app-nav--open', aberto);
      botao.setAttribute('aria-expanded', String(aberto));
    }
    function sincronizarDesktop() {
      if (!ehTelaPequena()) {
        botao.setAttribute('aria-expanded', String(!document.body.classList.contains('app--nav-collapsed')));
      }
    }
    botao.addEventListener('click', function () {
      if (ehTelaPequena()) {
        definirAberto(!nav.classList.contains('app-nav--open'));
      } else {
        document.body.classList.toggle('app--nav-collapsed');
        sincronizarDesktop();
      }
    });
    nav.addEventListener('click', function (evento) {
      if (evento.target.closest('.app-nav__link') && ehTelaPequena()) {
        definirAberto(false);
      }
    });
    sincronizarDesktop();
  }

  PO.ui.navegacao = Object.freeze({
    renderizar: renderizar,
    marcarAtivo: marcarAtivo,
    ligarMenuMovel: ligarMenuMovel
  });
})(window.PO);
