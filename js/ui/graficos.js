// JAVASCRIPT
/**
 * @file graficos.js
 * @description Componentes de gráfico em HTML/CSS puro (sem biblioteca externa,
 * funciona offline via file://). Cada gráfico acompanha uma tabela
 * equivalente ("Ver tabela") — a cor nunca é a única forma de leitura.
 * Barras e segmentos exibem a caixa de dica própria (mouse ou teclado).
 *
 * Larguras de barra são calculadas só para DESENHO (proporção visual);
 * todos os valores exibidos vêm de centavos inteiros (PO.core.dinheiro).
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var dinheiro = PO.core.dinheiro;
  var MAX_SERIES = 8;

  /** Proporção visual (0–100) de |valor| sobre |maximo|. */
  function proporcao(valor, maximo) {
    return maximo ? Math.round((Math.abs(valor) * 1000) / Math.abs(maximo)) / 10 : 0;
  }

  /**
   * Caixa de dica (tooltip) única, compartilhada por todos os gráficos.
   * Cartão com seta, cor da série, valor em destaque e mini barra do %.
   * Abre com mouse (segue o cursor) ou foco por teclado; fecha com Esc,
   * ao sair do item ou ao trocar de rota. O alvo sob a dica fica em
   * evidência e os demais do mesmo gráfico esmaecem.
   */
  var dica = (function () {
    var ID = 'po-chart-tooltip';
    var MARGEM = 8;
    var AFASTAMENTO = 14;
    var el = null;
    var atual = null;
    var dispensada = null;
    var timerFechar = 0;

    function elemento() {
      if (!el) {
        el = h('div', { className: 'chart-tooltip no-print', attrs: { id: ID, role: 'tooltip', 'aria-hidden': 'true' } });
        document.body.appendChild(el);
        document.addEventListener('keydown', function (e) {
          if ((e.key === 'Escape' || e.key === 'Esc') && atual) {
            dispensada = atual.alvo;
            fechar(true);
          }
        });
        window.addEventListener('hashchange', function () { fechar(true); });
        window.addEventListener('scroll', function () { if (atual && atual.viaMouse) { fechar(true); } }, true);
      }
      return el;
    }

    function conteudo(info) {
      var preenchimento = h('span', { className: 'chart-tooltip__meter-fill' });
      preenchimento.style.width = Math.min(100, proporcao(info.valor, info.total)) + '%';
      preenchimento.style.background = info.cor;
      var bolinha = h('span', { className: 'chart-tooltip__dot', attrs: { 'aria-hidden': 'true' } });
      bolinha.style.background = info.cor;
      return [
        h('span', { className: 'chart-tooltip__name' }, [bolinha, h('span', { text: info.rotulo })]),
        h('span', { className: 'chart-tooltip__value', text: c.moeda(info.valor) }),
        h('span', { className: 'chart-tooltip__meter' }, [
          h('span', { className: 'chart-tooltip__meter-track', attrs: { 'aria-hidden': 'true' } }, preenchimento),
          h('span', { className: 'chart-tooltip__percent', text: dinheiro.percentual(info.valor, info.total) })
        ]),
        info.contexto ? h('span', { className: 'chart-tooltip__context', text: info.contexto }) : null
      ];
    }

    /** Posiciona acima do ponto (x, yTopo); sem espaço, abaixo de yBase. Nunca sai da janela. */
    function posicionar(x, yTopo, yBase) {
      var largura = el.offsetWidth;
      var altura = el.offsetHeight;
      var esquerda = Math.min(Math.max(MARGEM, x - largura / 2), window.innerWidth - largura - MARGEM);
      var topo = yTopo - altura - AFASTAMENTO;
      var abaixo = topo < MARGEM;
      if (abaixo) {
        topo = Math.min(yBase + AFASTAMENTO, window.innerHeight - altura - MARGEM);
      }
      el.classList.toggle('chart-tooltip--abaixo', abaixo);
      el.style.left = Math.round(esquerda) + 'px';
      el.style.top = Math.round(topo) + 'px';
      el.style.setProperty('--seta-x', Math.round(Math.min(Math.max(12, x - esquerda), largura - 12)) + 'px');
    }

    function abrir(reg, viaMouse) {
      clearTimeout(timerFechar);
      if (dispensada === reg.alvo) {
        return;
      }
      elemento();
      if (!atual || atual.alvo !== reg.alvo) {
        if (atual) {
          desmarcar(atual);
        }
        PO.core.dom.limpar(el);
        PO.core.dom.anexar(el, conteudo(reg.info));
        reg.grupo.classList.add('is-destacando');
        reg.alvo.classList.add('is-ativo');
        reg.focavel.setAttribute('aria-describedby', ID);
      }
      atual = reg;
      atual.viaMouse = viaMouse;
      el.setAttribute('aria-hidden', 'false');
      el.classList.add('is-visivel');
    }

    function desmarcar(reg) {
      reg.grupo.classList.remove('is-destacando');
      reg.alvo.classList.remove('is-ativo');
      reg.focavel.removeAttribute('aria-describedby');
    }

    function fechar(imediato) {
      clearTimeout(timerFechar);
      function executar() {
        if (!atual) {
          return;
        }
        desmarcar(atual);
        atual = null;
        el.classList.remove('is-visivel');
        el.setAttribute('aria-hidden', 'true');
      }
      if (imediato) {
        executar();
      } else {
        // Pequena tolerância: ao cruzar o vão entre segmentos a dica não pisca.
        timerFechar = setTimeout(executar, 80);
      }
    }

    /**
     * Liga a dica a um item de gráfico.
     * @param {{alvo:HTMLElement, focavel:HTMLElement, ancora:HTMLElement, grupo:HTMLElement,
     *   info:{rotulo:string, valor:number, total:number, cor:string, contexto?:string}}} reg
     *   alvo: recebe o mouse e o destaque; focavel: parada de Tab;
     *   ancora: onde a seta aponta no foco por teclado; grupo: gráfico que esmaece.
     */
    function registrar(reg) {
      reg.alvo.addEventListener('mousemove', function (e) {
        abrir(reg, true);
        if (atual === reg) {
          posicionar(e.clientX, e.clientY, e.clientY);
        }
      });
      reg.alvo.addEventListener('mouseleave', function () {
        if (dispensada === reg.alvo) {
          dispensada = null;
        }
        if (atual === reg && atual.viaMouse) {
          fechar(false);
        }
      });
      reg.focavel.addEventListener('focus', function () {
        dispensada = null;
        abrir(reg, false);
        var r = reg.ancora.getBoundingClientRect();
        posicionar(r.left + r.width / 2, r.top, r.bottom);
      });
      reg.focavel.addEventListener('blur', function () {
        if (atual === reg) {
          fechar(true);
        }
        if (dispensada === reg.alvo) {
          dispensada = null;
        }
      });
    }

    return { registrar: registrar };
  })();

  /** Cor de série para uso inline (bolinha e mini barra da dica). */
  function corSerie(n) {
    return 'var(--serie-' + n + ')';
  }

  /**
   * Barras horizontais (uma série). Valores negativos (deduções) usam a
   * variante "negativa" e a barra representa o módulo.
   * @param {{itens:Array<{rotulo:string, valor:number, demais?:boolean}>, total?:number, maximo?:number, testid:string, legenda:string}} p
   */
  function barras(p) {
    var maximo = p.maximo || Math.max.apply(null, p.itens.map(function (i) { return Math.abs(i.valor); }).concat([0]));
    var total = p.total !== undefined ? p.total : dinheiro.somar(p.itens.map(function (i) { return i.valor; }));
    var lista = h('ul', { className: 'bar-chart', testid: p.testid, attrs: { 'aria-label': p.legenda } });
    p.itens.forEach(function (i, n) {
      var perc = dinheiro.percentual(i.valor, total);
      var barra = h('span', { className: 'bar-chart__bar' + (i.valor < 0 ? ' bar-chart__bar--negative' : '') + (i.demais ? ' bar-chart__bar--muted' : '') });
      barra.style.setProperty('--tamanho', proporcao(i.valor, maximo) + '%');
      var trilho = h('span', { className: 'bar-chart__track', attrs: { tabindex: 0, role: 'img', 'aria-label': i.rotulo + ': ' + c.moeda(i.valor) + ' (' + perc + ')' } }, barra);
      var linha = h('li', { className: 'bar-chart__row', testid: p.testid + '-item-' + n }, [
        h('span', { className: 'bar-chart__label', text: i.rotulo }),
        trilho,
        h('span', { className: 'bar-chart__value', text: c.moeda(i.valor) }),
        h('span', { className: 'bar-chart__percent', text: perc })
      ]);
      dica.registrar({
        alvo: linha, focavel: trilho, ancora: barra, grupo: lista,
        info: { rotulo: i.rotulo, valor: i.valor, total: total, contexto: p.legenda, cor: i.valor < 0 ? corSerie(8) : (i.demais ? 'var(--serie-neutra)' : corSerie(1)) }
      });
      lista.appendChild(linha);
    });
    return lista;
  }

  /**
   * Barra 100% empilhada (composição) com legenda e rótulos diretos.
   * Mais de 8 segmentos: o excedente é agrupado em "Outros" (cores fixas por posição).
   * @param {{segmentos:Array<{rotulo:string, valor:number}>, testid:string, legenda:string}} p
   */
  function empilhada(p) {
    var segs = p.segmentos.filter(function (s) { return s.valor > 0; });
    if (segs.length > MAX_SERIES) {
      var outros = dinheiro.somar(segs.slice(MAX_SERIES - 1).map(function (s) { return s.valor; }));
      segs = segs.slice(0, MAX_SERIES - 1).concat([{ rotulo: 'Outros', valor: outros }]);
    }
    var total = dinheiro.somar(segs.map(function (s) { return s.valor; }));

    var barra = h('div', { className: 'stack-chart__bar', attrs: { role: 'group', 'aria-label': p.legenda } });
    segs.forEach(function (s, i) {
      var el = h('span', { className: 'stack-chart__segment stack-chart__segment--s' + (i + 1), attrs: { tabindex: 0, role: 'img', 'aria-label': s.rotulo + ': ' + c.moeda(s.valor) + ' (' + dinheiro.percentual(s.valor, total) + ')' } });
      el.style.setProperty('--tamanho', proporcao(s.valor, total) + '%');
      dica.registrar({
        alvo: el, focavel: el, ancora: el, grupo: barra,
        info: { rotulo: s.rotulo, valor: s.valor, total: total, contexto: p.legenda, cor: corSerie(i + 1) }
      });
      barra.appendChild(el);
    });
    var legenda = h('ul', { className: 'chart-legend' }, segs.map(function (s, i) {
      return h('li', { className: 'chart-legend__item' }, [
        h('span', { className: 'chart-legend__swatch stack-chart__segment--s' + (i + 1), attrs: { 'aria-hidden': 'true' } }),
        h('span', { className: 'chart-legend__label', text: s.rotulo }),
        h('span', { className: 'chart-legend__value', text: c.moeda(s.valor) + ' · ' + dinheiro.percentual(s.valor, total) })
      ]);
    }));
    return h('div', { className: 'stack-chart', testid: p.testid }, [barra, legenda]);
  }

  /** Tabela equivalente a uma lista de itens {rotulo, valor}. */
  function tabelaItens(itens, total, testid, legenda) {
    return c.tabela({
      colunas: [{ titulo: 'Item' }, { titulo: 'Valor', numerica: true }, { titulo: '%', numerica: true }],
      linhas: itens.map(function (i) { return [i.rotulo, c.moeda(i.valor), dinheiro.percentual(i.valor, total)]; }),
      rodape: ['Total', c.moeda(total), total ? '100,0%' : '—'],
      legenda: legenda,
      testid: testid
    });
  }

  /**
   * Cartão de gráfico: título, total em destaque, gráfico e tabela recolhível.
   * @param {{titulo:string, total?:number, subtitulo?:string, grafico:Node, tabela?:Node, testid:string, largo?:boolean}} p
   */
  function cartao(p) {
    return h('article', { className: 'chart-card' + (p.largo ? ' chart-card--wide' : ''), testid: p.testid }, [
      h('header', { className: 'chart-card__header' }, [
        h('h4', { className: 'chart-card__title', text: p.titulo }),
        p.total !== undefined ? h('p', { className: 'chart-card__total', text: c.moeda(p.total) }) : null
      ]),
      p.subtitulo ? h('p', { className: 'chart-card__subtitle', text: p.subtitulo }) : null,
      p.grafico,
      p.tabela ? h('details', { className: 'chart-card__table no-print' }, [
        h('summary', { className: 'chart-card__table-toggle', text: 'Ver tabela', testid: p.testid + '-ver-tabela' }),
        p.tabela
      ]) : null
    ]);
  }

  PO.ui.graficos = Object.freeze({
    barras: barras,
    empilhada: empilhada,
    tabelaItens: tabelaItens,
    cartao: cartao,
    registrarDica: dica.registrar
  });
})(window.PO);
