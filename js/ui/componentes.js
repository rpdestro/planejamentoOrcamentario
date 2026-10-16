// JAVASCRIPT
/**
 * @file componentes.js
 * @description Componentes de interface reutilizáveis (fábricas de DOM).
 * Cada função devolve um elemento pronto, com classes BEM e data-testid.
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var dinheiro = PO.core.dinheiro;

  /**
   * Cabeçalho de página de view.
   * @param {string} titulo
   * @param {string} [descricao]
   * @param {Node[]} [acoes] botões à direita
   */
  function cabecalhoPagina(titulo, descricao, acoes) {
    return h('header', { className: 'page-header' }, [
      h('div', { className: 'page-header__text' }, [
        h('h2', { className: 'page-header__title', text: titulo }),
        descricao ? h('p', { className: 'page-header__description', text: descricao }) : null
      ]),
      acoes && acoes.length ? h('div', { className: 'page-header__actions' }, acoes) : null
    ]);
  }

  /**
   * Cartão de indicador (KPI).
   * @param {{rotulo:string, valor:string, detalhe?:string, variante?:string, testid:string}} p
   */
  function cartaoKpi(p) {
    return h('article', { className: 'kpi' + (p.variante ? ' kpi--' + p.variante : ''), testid: p.testid }, [
      h('h3', { className: 'kpi__label', text: p.rotulo }),
      h('p', { className: 'kpi__value', text: p.valor }),
      p.detalhe ? h('p', { className: 'kpi__detail', text: p.detalhe }) : null
    ]);
  }

  /**
   * Selo de status.
   * @param {string} texto
   * @param {'ok'|'alerta'|'erro'|'info'|'neutro'} variante
   */
  function selo(texto, variante) {
    return h('span', { className: 'badge badge--' + (variante || 'neutro'), text: texto });
  }

  /**
   * Selo da coluna H "Valor insuficiente": Negativo (vermelho), Atende (azul)
   * ou Positivo (verde), conforme domain/valor-insuficiente.js.
   * @param {{situacao:{rotulo:string, variante:string}}} calculo resultado de valorInsuficiente.calcular()
   */
  function seloValorInsuficiente(calculo) {
    return selo(calculo.situacao.rotulo, calculo.situacao.variante);
  }

  /**
   * Tabela de dados. Colunas com `numerica: true` são alinhadas à direita.
   * @param {{
   *   colunas: Array<{titulo:string, numerica?:boolean, classe?:string}>,  // classe: extra em th/td da coluna
   *   linhas: Array<Array<string|Node>>,
   *   rodape?: Array<string|Node>,
   *   legenda: string,
   *   testid: string,
   *   vazio?: string,
   *   compacta?: boolean   // fonte/espaçamento reduzidos para caber sem rolagem
   * }} p
   */
  function tabela(p) {
    function classeTd(col) {
      return 'data-table__td' + (col.numerica ? ' data-table__td--num' : '') + (col.classe ? ' ' + col.classe : '');
    }
    var thead = h('thead', null, h('tr', null, p.colunas.map(function (c) {
      return h('th', {
        className: 'data-table__th' + (c.numerica ? ' data-table__th--num' : '') + (c.classe ? ' ' + c.classe : ''),
        text: c.titulo,
        attrs: { scope: 'col' }
      });
    })));

    var corpo = p.linhas.length
      ? p.linhas.map(function (linha) {
          return h('tr', { className: 'data-table__row' }, linha.map(function (celula, i) {
            return h('td', { className: classeTd(p.colunas[i]) }, celula);
          }));
        })
      : [h('tr', null, h('td', {
          className: 'data-table__empty',
          text: p.vazio || 'Nenhum registro encontrado.',
          attrs: { colspan: p.colunas.length }
        }))];

    var tfoot = p.rodape && p.linhas.length
      ? h('tfoot', null, h('tr', { className: 'data-table__foot' }, p.rodape.map(function (celula, i) {
          return h('td', { className: classeTd(p.colunas[i]) }, celula);
        })))
      : null;

    return h('div', { className: 'data-table' + (p.compacta ? ' data-table--compact' : ''), attrs: { role: 'region', 'aria-label': p.legenda, tabindex: '0' } },
      h('table', { className: 'data-table__table', testid: p.testid }, [
        h('caption', { className: 'u-visually-hidden', text: p.legenda }),
        thead,
        h('tbody', null, corpo),
        tfoot
      ])
    );
  }

  /**
   * Campo de formulário com rótulo, ajuda e mensagem de erro acessível
   * (aria-describedby + aria-invalid controlados por `definirErro`).
   * @param {{id:string, rotulo:string, controle:HTMLElement, ajuda?:string}} p
   */
  function campo(p) {
    var idErro = p.id + '-erro';
    var idAjuda = p.id + '-ajuda';
    p.controle.id = p.id;
    p.controle.classList.add('form-field__control');
    p.controle.setAttribute('aria-describedby', (p.ajuda ? idAjuda + ' ' : '') + idErro);

    return h('div', { className: 'form-field' }, [
      h('label', { className: 'form-field__label', text: p.rotulo, attrs: { for: p.id } }),
      p.controle,
      p.ajuda ? h('p', { className: 'form-field__help', text: p.ajuda, attrs: { id: idAjuda } }) : null,
      h('p', { className: 'form-field__error', attrs: { id: idErro, 'aria-live': 'polite' }, testid: 'erro-' + p.id })
    ]);
  }

  /**
   * Exibe/limpa o erro de um campo criado por `campo()`.
   * @param {HTMLElement} controle
   * @param {string|null} mensagem
   */
  function definirErro(controle, mensagem) {
    var erro = document.getElementById(controle.id + '-erro');
    controle.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
    controle.closest('.form-field').classList.toggle('form-field--invalid', Boolean(mensagem));
    if (erro) {
      erro.textContent = mensagem || '';
    }
  }

  /**
   * <select> a partir de pares {valor, rotulo}.
   * @param {Array<{valor:string, rotulo:string}>} opcoes
   * @param {string} testid
   * @param {string} [selecionado]
   */
  function select(opcoes, testid, selecionado) {
    return h('select', { className: 'select', testid: testid }, opcoes.map(function (o) {
      return h('option', {
        text: o.rotulo,
        attrs: { value: o.valor, selected: String(o.valor) === String(selecionado) }
      });
    }));
  }

  /** Select de períodos (mensal…anual). */
  function selectPeriodo(testid, selecionado) {
    return select(PO.domain.periodos.listar().map(function (p) {
      return { valor: p.chave, rotulo: p.rotulo };
    }), testid, selecionado || 'mensal');
  }

  /** Botão padrão. */
  function botao(texto, testid, aoClicar, variante) {
    return h('button', {
      className: 'btn btn--' + (variante || 'primary'),
      text: texto,
      testid: testid,
      attrs: { type: 'button' },
      on: aoClicar ? { click: aoClicar } : null
    });
  }

  /** Aviso de "sem dados" com chamada para importação. */
  function estadoVazio(mensagem, testid) {
    return h('section', { className: 'empty-state', testid: testid || 'estado-vazio' }, [
      h('p', { className: 'empty-state__text', text: mensagem }),
      h('a', { className: 'btn btn--primary', text: 'Ir para Importação', testid: 'link-ir-importar', attrs: { href: '#/importar' } })
    ]);
  }

  /** Atalho: moeda formatada. */
  function moeda(centavos) {
    return dinheiro.formatar(centavos);
  }

  /**
   * Janela modal acessível baseada em <dialog> (foco preso, Esc fecha).
   * O elemento é removido do DOM ao fechar.
   * @param {{titulo:string, conteudo:Node|Node[], acoes:Node[], testid:string, largura?:'md'|'lg'}} p
   * @returns {{elemento:HTMLDialogElement, abrir:Function, fechar:Function}}
   */
  function dialogo(p) {
    var idTitulo = p.testid + '-titulo';
    var el = h('dialog', {
      className: 'dialog' + (p.largura === 'lg' ? ' dialog--lg' : ''),
      testid: p.testid,
      attrs: { 'aria-labelledby': idTitulo }
    }, [
      h('header', { className: 'dialog__header' }, [
        h('h2', { className: 'dialog__title', text: p.titulo, attrs: { id: idTitulo } }),
        h('button', { className: 'dialog__close', text: '×', testid: p.testid + '-fechar', attrs: { type: 'button', 'aria-label': 'Fechar' }, on: { click: function () { fechar(); } } })
      ]),
      h('div', { className: 'dialog__body' }, p.conteudo),
      h('footer', { className: 'dialog__footer' }, p.acoes)
    ]);
    // Esc dispara "close" (assíncrono); o botão Fechar/Cancelar remove na hora.
    el.addEventListener('close', function () {
      el.remove();
    });

    function abrir() {
      document.body.appendChild(el);
      el.showModal();
    }
    function fechar() {
      if (el.open) {
        el.close();
      }
      el.remove();
    }
    return { elemento: el, abrir: abrir, fechar: fechar };
  }

  /**
   * Abas acessíveis (padrão WAI-ARIA tablist; setas ← → alternam).
   * @param {{abas:Array<{id:string, rotulo:string, painel:HTMLElement}>, testid:string, aoTrocar?:Function}} p
   * @returns {HTMLElement} contêiner com a barra de abas e os painéis
   */
  function abas(p) {
    var botoes = p.abas.map(function (aba, i) {
      aba.painel.setAttribute('role', 'tabpanel');
      aba.painel.id = p.testid + '-painel-' + aba.id;
      aba.painel.setAttribute('aria-labelledby', p.testid + '-aba-' + aba.id);
      aba.painel.hidden = i !== 0;
      return h('button', {
        className: 'tabs__tab' + (i === 0 ? ' tabs__tab--active' : ''),
        text: aba.rotulo,
        testid: 'aba-' + aba.id,
        attrs: { type: 'button', role: 'tab', id: p.testid + '-aba-' + aba.id, 'aria-controls': aba.painel.id, 'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1' },
        on: { click: function () { ativar(i); } }
      });
    });

    function ativar(indice) {
      botoes.forEach(function (b, i) {
        var ativo = i === indice;
        b.classList.toggle('tabs__tab--active', ativo);
        b.setAttribute('aria-selected', String(ativo));
        b.setAttribute('tabindex', ativo ? '0' : '-1');
        p.abas[i].painel.hidden = !ativo;
      });
      if (p.aoTrocar) {
        p.aoTrocar(p.abas[indice].id);
      }
    }

    var barra = h('div', { className: 'tabs__list no-print', testid: p.testid, attrs: { role: 'tablist' } }, botoes);
    barra.addEventListener('keydown', function (e) {
      var atual = botoes.indexOf(document.activeElement);
      if (atual === -1 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) {
        return;
      }
      var proximo = (atual + (e.key === 'ArrowRight' ? 1 : botoes.length - 1)) % botoes.length;
      ativar(proximo);
      botoes[proximo].focus();
    });

    return h('div', { className: 'tabs' }, [barra].concat(p.abas.map(function (a) { return a.painel; })));
  }

  /** Nome do órgão pelo código (ou o próprio código, se não cadastrado). */
  function nomeOrgao(codigo) {
    var orgao = PO.core.config.orgaos.find(function (o) {
      return o.codigo === codigo;
    });
    return orgao ? orgao.nome : 'Órgão ' + codigo + ' (não cadastrado)';
  }

  PO.ui.componentes = Object.freeze({
    cabecalhoPagina: cabecalhoPagina,
    cartaoKpi: cartaoKpi,
    selo: selo,
    seloValorInsuficiente: seloValorInsuficiente,
    tabela: tabela,
    campo: campo,
    definirErro: definirErro,
    select: select,
    selectPeriodo: selectPeriodo,
    botao: botao,
    estadoVazio: estadoVazio,
    moeda: moeda,
    nomeOrgao: nomeOrgao,
    dialogo: dialogo,
    abas: abas
  });
})(window.PO);
