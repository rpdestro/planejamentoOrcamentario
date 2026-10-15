// JAVASCRIPT
/**
 * @file graficos.js (view)
 * @description View "Gráficos" (#/graficos): composição da receita
 * (correntes, capital, intraorçamentárias, deduções FUNDEB), Orçamento Geral
 * e Orçamento por grupo de receita e despesa (PLOA).
 *
 * Regras de agrupamento: PO.domain.composicaoReceita (configuração declarativa).
 * Desenho: PO.ui.graficos (HTML/CSS, com tabela equivalente em cada cartão).
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var g = PO.ui.graficos;
  var cfg = PO.core.config;
  var dinheiro = PO.core.dinheiro;
  var composicao = PO.domain.composicaoReceita;
  var slug = PO.core.texto.slug;
  var TOP_N = 10;

  /** Soma de totalCentavos por chave, ordenado do maior para o menor; excedente em "Demais". */
  function topPor(despesas, chaveDe, rotuloDe, limite) {
    var mapa = new Map();
    despesas.forEach(function (d) {
      var k = chaveDe(d);
      mapa.set(k, (mapa.get(k) || 0) + d.totalCentavos);
    });
    var itens = Array.from(mapa.entries()).filter(function (par) { return par[1] !== 0; })
      .map(function (par) { return { rotulo: rotuloDe(par[0]), valor: par[1] }; })
      .sort(function (a, b) { return b.valor - a.valor; });
    if (limite && itens.length > limite) {
      var resto = dinheiro.somar(itens.slice(limite).map(function (i) { return i.valor; }));
      itens = itens.slice(0, limite).concat([{ rotulo: 'Demais (' + (itens.length - limite) + ')', valor: resto, demais: true }]);
    }
    return itens;
  }

  /** Seção numerada com título e grade de cartões. */
  function secao(numero, titulo, descricao, cartoes, id) {
    return h('section', { className: 'panel chart-section', testid: 'secao-graficos-' + id, attrs: { id: 'graficos-' + id, 'aria-labelledby': 'titulo-graficos-' + id } }, [
      h('h3', { className: 'panel__title chart-section__title', text: numero + '. ' + titulo, attrs: { id: 'titulo-graficos-' + id } }),
      descricao ? h('p', { className: 'chart-section__description', text: descricao }) : null,
      h('div', { className: 'chart-grid' }, cartoes)
    ]);
  }

  /** Cartão padrão de barras + tabela. */
  function cartaoBarras(titulo, itens, total, testid, opcoes) {
    var o = opcoes || {};
    return g.cartao({
      titulo: titulo,
      total: total,
      subtitulo: o.subtitulo,
      largo: o.largo,
      testid: testid,
      grafico: g.barras({ itens: itens, total: total, maximo: o.maximo, testid: testid + '-barras', legenda: titulo }),
      tabela: g.tabelaItens(itens, total, testid + '-tabela', titulo)
    });
  }

  /** Seções 1–3: grupo com subgrupos (composição + um cartão por subgrupo). */
  function secaoGrupo(numero, grupo) {
    var cartoes = [];
    if (grupo.subgrupos.length > 1) {
      var segmentos = grupo.subgrupos.map(function (s) { return { rotulo: s.titulo, valor: s.total }; });
      cartoes.push(g.cartao({
        titulo: 'Composição — ' + grupo.titulo,
        total: grupo.total,
        largo: true,
        testid: 'grafico-' + grupo.id + '-composicao',
        grafico: g.empilhada({ segmentos: segmentos, testid: 'grafico-' + grupo.id + '-empilhado', legenda: 'Composição de ' + grupo.titulo }),
        tabela: g.tabelaItens(segmentos, grupo.total, 'tabela-' + grupo.id + '-composicao', 'Composição de ' + grupo.titulo)
      }));
    }
    grupo.subgrupos.forEach(function (s) {
      cartoes.push(cartaoBarras(s.titulo, s.itens, s.total, 'grafico-' + grupo.id + '-' + slug(s.titulo)));
    });
    return secao(numero, grupo.titulo, 'Total previsto: ' + c.moeda(grupo.total) + '. "Demais" reúne as naturezas não detalhadas, para que cada grupo feche com o total oficial.', cartoes, grupo.id);
  }

  /** Seção 4: deduções (itens dinâmicos, valores negativos). */
  function secaoDeducoes(numero, grupo) {
    return secao(numero, grupo.titulo, 'Retenções constitucionais destinadas à formação do FUNDEB (valores redutores da receita).', [
      cartaoBarras('Deduções por receita de origem', grupo.itens, grupo.total, 'grafico-deducoes', { largo: true })
    ], 'deducoes');
  }

  /** Seção 5: Orçamento Geral — indicadores-chave e composição da despesa. */
  function secaoOrcamentoGeral(numero, grupos, receitas, despesas, exercicio) {
    var porId = {};
    grupos.forEach(function (gr) { porId[gr.id] = gr; });
    var liquida = PO.importers.mapeadorReceitas.totaisPorAno(receitas, [exercicio])[exercicio].liquido;
    var bruta = porId.correntes.total + porId.capital.total + porId.intra.total;
    var despesa = dinheiro.somar(despesas.map(function (d) { return d.totalCentavos; }));
    var saldo = liquida - despesa;
    var transferencias = porId.correntes.subgrupos.filter(function (s) { return s.titulo === 'Transferências Correntes'; })[0];
    var valorTransf = transferencias ? transferencias.total : 0;

    var kpis = h('div', { className: 'kpi-grid chart-card--wide' }, [
      c.cartaoKpi({ rotulo: 'Receita bruta prevista', valor: c.moeda(bruta), detalhe: 'Correntes + capital + intraorçamentárias', testid: 'kpi-graficos-receita-bruta' }),
      c.cartaoKpi({ rotulo: 'Deduções FUNDEB', valor: c.moeda(porId.deducoes.total), detalhe: dinheiro.percentual(-porId.deducoes.total, bruta) + ' da receita bruta', variante: 'alerta', testid: 'kpi-graficos-deducoes' }),
      c.cartaoKpi({ rotulo: 'Orçamento (receita líquida)', valor: c.moeda(liquida), detalhe: 'LOA ' + exercicio, testid: 'kpi-graficos-orcamento' }),
      c.cartaoKpi({ rotulo: 'Despesa fixada', valor: c.moeda(despesa), detalhe: despesas.length + ' dotações', testid: 'kpi-graficos-despesa' }),
      c.cartaoKpi({ rotulo: 'Equilíbrio (receita − despesa)', valor: c.moeda(saldo), detalhe: saldo === 0 ? 'Orçamento equilibrado' : 'Verificar diferença', variante: saldo === 0 ? 'positivo' : 'negativo', testid: 'kpi-graficos-equilibrio' })
    ]);

    var fontesReceita = [
      { rotulo: 'Receitas próprias correntes', valor: porId.correntes.total - valorTransf },
      { rotulo: 'Transferências correntes', valor: valorTransf },
      { rotulo: 'Receitas de capital', valor: porId.capital.total },
      { rotulo: 'Intraorçamentárias', valor: porId.intra.total }
    ];
    var categorias = topPor(despesas, function (d) { return d.categoria || '?'; }, function (k) { return cfg.categoriasDespesa[k] || 'Não classificada'; });

    var cartoes = [kpis,
      g.cartao({
        titulo: 'De onde vem o dinheiro (receita bruta)', total: bruta, testid: 'grafico-geral-origem', largo: true,
        subtitulo: 'Grau de dependência de transferências: ' + dinheiro.percentual(valorTransf, bruta) + ' da receita bruta.',
        grafico: g.empilhada({ segmentos: fontesReceita, testid: 'grafico-geral-origem-empilhado', legenda: 'Origem da receita bruta' }),
        tabela: g.tabelaItens(fontesReceita, bruta, 'tabela-geral-origem', 'Origem da receita bruta')
      }),
      g.cartao({
        titulo: 'Despesa por categoria econômica', total: despesa, testid: 'grafico-geral-categoria', largo: true,
        grafico: g.empilhada({ segmentos: categorias, testid: 'grafico-geral-categoria-empilhado', legenda: 'Despesa por categoria econômica' }),
        tabela: g.tabelaItens(categorias, despesa, 'tabela-geral-categoria', 'Despesa por categoria econômica')
      }),
      cartaoBarras('Despesa por função de governo', topPor(despesas, function (d) { return d.funcao || '??'; }, function (k) { return k + ' — ' + (cfg.funcoes[k] || 'Não classificada'); }, TOP_N), despesa, 'grafico-geral-funcao'),
      cartaoBarras('Despesa por grupo (GND)', topPor(despesas, function (d) { return d.gnd || '?'; }, function (k) { return k + ' — ' + (cfg.gnd[k] || 'Não classificado'); }), despesa, 'grafico-geral-gnd'),
      cartaoBarras('Maiores órgãos (despesa fixada)', topPor(despesas, function (d) { return d.uo; }, function (k) { return k + ' — ' + c.nomeOrgao(k); }, TOP_N), despesa, 'grafico-geral-orgaos'),
      cartaoBarras('Despesa por fonte de recurso', topPor(despesas, function (d) { return d.fonte || '?'; }, function (k) { return k + ' — ' + (cfg.fontes[k] || 'Não cadastrada'); }), despesa, 'grafico-geral-fontes')
    ];
    return secao(numero, 'Orçamento Geral', 'Visão-síntese da LOA ' + exercicio + ': tamanho do orçamento, dependência de transferências e para onde vai a despesa.', cartoes, 'geral');
  }

  /** Seção 6: Orçamento por grupo de receita (origem) e despesa (aplicação). */
  function secaoPorGrupo(numero, receitas, despesas, exercicio) {
    var r = composicao.porGrupo(receitas, despesas, exercicio);
    // Escala comum aos dois lados para comparação visual honesta.
    var maximo = Math.max.apply(null, r.origem.concat(r.aplicacao).map(function (i) { return Math.abs(i.valor); }).concat([0]));
    var equilibrado = r.diferenca === 0;

    var linhas = [];
    for (var i = 0; i < Math.max(r.origem.length, r.aplicacao.length); i += 1) {
      var o = r.origem[i];
      var a = r.aplicacao[i];
      linhas.push([o ? o.rotulo : '', o ? c.moeda(o.valor) : '', a ? a.rotulo : '', a ? c.moeda(a.valor) : '']);
    }

    return secao(numero, 'Orçamento por Grupo de Receita e Despesa — PLOA ' + exercicio, null, [
      cartaoBarras('Origem (receita)', r.origem, r.totalOrigem, 'grafico-grupo-origem', { maximo: maximo }),
      cartaoBarras('Aplicação (despesa)', r.aplicacao, r.totalAplicacao, 'grafico-grupo-aplicacao', { maximo: maximo }),
      g.cartao({
        titulo: 'Quadro-resumo', testid: 'quadro-grupo', largo: true,
        grafico: h('div', null, [
          c.tabela({
            colunas: [{ titulo: 'Origem' }, { titulo: 'Valor', numerica: true }, { titulo: 'Aplicação' }, { titulo: 'Valor', numerica: true }],
            linhas: linhas,
            rodape: ['Total', c.moeda(r.totalOrigem), 'Total', c.moeda(r.totalAplicacao)],
            legenda: 'Orçamento por grupo de receita e despesa',
            testid: 'tabela-grupo-resumo'
          }),
          h('p', { className: 'chart-card__status', testid: 'txt-grupo-equilibrio' }, [
            c.selo(equilibrado ? '✓ Equilibrado' : '⚠ Diferença', equilibrado ? 'ok' : 'alerta'),
            ' Receita líquida − despesa fixada = ' + c.moeda(r.diferenca)
          ])
        ])
      })
    ], 'grupo');
  }

  /** Índice de navegação interna (rola até a seção; não altera o hash da rota). */
  function indice(itens) {
    return h('nav', { className: 'chart-index no-print', attrs: { 'aria-label': 'Seções de gráficos' } }, itens.map(function (it) {
      return h('button', {
        className: 'chart-index__link', text: it.rotulo, testid: 'btn-ir-graficos-' + it.id,
        attrs: { type: 'button' },
        on: { click: function () { document.getElementById('graficos-' + it.id).scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
      });
    }));
  }

  function render(container) {
    var exercicio = PO.core.estado.getExercicio();
    return Promise.all([
      PO.data.repositorio.listarReceitas(exercicio),
      PO.data.repositorio.listarDespesas(exercicio)
    ]).then(function (res) {
      var receitas = res[0].registros;
      var despesas = res[1].registros;

      container.appendChild(c.cabecalhoPagina('Gráficos — Exercício ' + exercicio, 'Composição da receita, orçamento geral e orçamento por grupo de receita e despesa.',
        [c.botao('Imprimir', 'btn-imprimir-graficos', function () { window.print(); })]));

      if (!receitas.length) {
        container.appendChild(c.estadoVazio('Nenhuma receita importada que cubra ' + exercicio + '. Importe o arquivo de receitas do Fiorilli.', 'graficos-vazio'));
        return;
      }

      var grupos = composicao.apurar(receitas, exercicio);
      var porId = {};
      grupos.forEach(function (gr) { porId[gr.id] = gr; });

      PO.core.dom.anexar(container, [
        indice([
          { id: 'correntes', rotulo: '1. Correntes' }, { id: 'capital', rotulo: '2. Capital' },
          { id: 'intra', rotulo: '3. Intraorçamentárias' }, { id: 'deducoes', rotulo: '4. Deduções FUNDEB' },
          { id: 'geral', rotulo: '5. Orçamento Geral' }, { id: 'grupo', rotulo: '6. Por Grupo (PLOA)' }
        ]),
        secaoGrupo(1, porId.correntes),
        secaoGrupo(2, porId.capital),
        secaoGrupo(3, porId.intra),
        secaoDeducoes(4, porId.deducoes),
        despesas.length
          ? secaoOrcamentoGeral(5, grupos, receitas, despesas, exercicio)
          : c.estadoVazio('Importe o cronograma de despesas para ver o Orçamento Geral e o quadro por grupo.', 'graficos-sem-despesas'),
        despesas.length ? secaoPorGrupo(6, receitas, despesas, exercicio) : null
      ]);
    });
  }

  PO.ui.views.graficos = Object.freeze({ render: render });
})(window.PO);
