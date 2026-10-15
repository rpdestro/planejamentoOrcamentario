// JAVASCRIPT
/**
 * @file painel.js
 * @description View "Painel": visão consolidada do exercício.
 *   - KPIs: receita prevista líquida, despesa fixada, saldo, dotações não diluídas;
 *   - Receita por categoria econômica;
 *   - Despesa por órgão (link para a Secretaria);
 *   - Cronograma consolidado da despesa no período escolhido.
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var dinheiro = PO.core.dinheiro;
  var periodos = PO.domain.periodos;

  /** Agrupa despesas por UO: { uo → totalCentavos }. */
  function totaisPorOrgao(despesas) {
    var mapa = new Map();
    despesas.forEach(function (d) {
      mapa.set(d.uo, (mapa.get(d.uo) || 0) + d.totalCentavos);
    });
    return Array.from(mapa.entries()).sort(function (a, b) {
      return a[0].localeCompare(b[0]);
    });
  }

  function secaoKpis(exercicio, despesas, receitas) {
    var totalDespesa = dinheiro.somar(despesas.map(function (d) { return d.totalCentavos; }));
    var totais = PO.importers.mapeadorReceitas.totaisPorAno(receitas, [exercicio])[exercicio];
    var totalReceita = totais.liquido;
    var saldo = totalReceita - totalDespesa;
    var naoDiluidas = despesas.filter(function (d) { return !d.diluida; }).length;

    return h('section', { className: 'kpi-grid', attrs: { 'aria-label': 'Indicadores do exercício' } }, [
      c.cartaoKpi({ rotulo: 'Receita prevista (líquida)', valor: c.moeda(totalReceita), detalhe: receitas.length ? 'Já descontadas as deduções' : 'Sem receitas importadas', testid: 'kpi-receita' }),
      c.cartaoKpi({ rotulo: 'Despesa fixada', valor: c.moeda(totalDespesa), detalhe: despesas.length + ' dotações', testid: 'kpi-despesa' }),
      c.cartaoKpi({ rotulo: 'Saldo (receita − despesa)', valor: c.moeda(saldo), variante: saldo < 0 ? 'negativo' : 'positivo', testid: 'kpi-saldo' }),
      c.cartaoKpi({ rotulo: 'Dotações não diluídas', valor: String(naoDiluidas), detalhe: 'Projetadas em 1/12 por mês', variante: naoDiluidas ? 'alerta' : null, testid: 'kpi-nao-diluidas' })
    ]);
  }

  function secaoReceitas(exercicio, receitas) {
    var totais = PO.importers.mapeadorReceitas.totaisPorAno(receitas, [exercicio])[exercicio];
    var categorias = PO.core.config.categoriasReceita;
    var linhas = Object.keys(categorias).map(function (digito) {
      var cat = categorias[digito];
      return [cat.rotulo, c.moeda(totais.porCategoria[cat.chave] || 0)];
    });
    return h('section', { className: 'panel' }, [
      h('h3', { className: 'panel__title', text: 'Receita prevista por categoria — ' + exercicio }),
      c.tabela({
        colunas: [{ titulo: 'Categoria' }, { titulo: 'Valor', numerica: true }],
        linhas: linhas,
        rodape: ['Total líquido', c.moeda(totais.liquido)],
        legenda: 'Receita prevista por categoria econômica',
        testid: 'tabela-painel-receitas'
      })
    ]);
  }

  function secaoOrgaos(despesas) {
    var total = dinheiro.somar(despesas.map(function (d) { return d.totalCentavos; }));
    var linhas = totaisPorOrgao(despesas).map(function (par) {
      return [
        h('a', { text: par[0], testid: 'link-painel-orgao-' + PO.core.texto.slug(par[0]), attrs: { href: '#/secretaria/' + encodeURIComponent(par[0]) } }),
        c.nomeOrgao(par[0]),
        c.moeda(par[1]),
        dinheiro.percentual(par[1], total)
      ];
    });
    return h('section', { className: 'panel' }, [
      h('h3', { className: 'panel__title', text: 'Despesa fixada por órgão' }),
      c.tabela({
        colunas: [{ titulo: 'UO' }, { titulo: 'Órgão' }, { titulo: 'Total', numerica: true }, { titulo: '%', numerica: true }],
        linhas: linhas,
        rodape: ['', 'Total', c.moeda(total), '100,0%'],
        legenda: 'Despesa fixada por órgão',
        testid: 'tabela-painel-orgaos'
      })
    ]);
  }

  function secaoCronograma(despesas) {
    var alvo = h('div', { className: 'panel__body' });
    var seletor = c.selectPeriodo('select-painel-periodo', 'trimestral');

    function desenhar() {
      var chave = seletor.value;
      var valores = periodos.agregar(periodos.somarMeses(despesas), chave);
      PO.core.dom.limpar(alvo);
      alvo.appendChild(c.tabela({
        colunas: periodos.rotulos(chave).map(function (r) { return { titulo: r, numerica: true }; }),
        linhas: [valores.map(c.moeda)],
        legenda: 'Cronograma consolidado da despesa',
        testid: 'tabela-painel-cronograma'
      }));
    }

    seletor.addEventListener('change', desenhar);
    desenhar();

    return h('section', { className: 'panel' }, [
      h('div', { className: 'panel__header' }, [
        h('h3', { className: 'panel__title', text: 'Cronograma consolidado da despesa' }),
        h('label', { className: 'inline-field' }, [h('span', { className: 'inline-field__label', text: 'Período' }), seletor])
      ]),
      alertaDivergencias(despesas),
      alvo
    ]);
  }

  /**
   * Alerta quando o cronograma mensal informado não fecha com o total da
   * dotação — o consolidado por período fica distorcido até a correção na origem.
   */
  function alertaDivergencias(despesas) {
    var divergentes = despesas.filter(function (d) { return d.divergenciaCentavos !== 0; });
    if (!divergentes.length) {
      return null;
    }
    var diferenca = dinheiro.somar(divergentes.map(function (d) { return d.divergenciaCentavos; }));
    return h('div', { className: 'alert alert--warning', attrs: { role: 'status' }, testid: 'alerta-divergencias' }, [
      h('p', { className: 'alert__title', text: divergentes.length + ' dotação(ões) com cronograma mensal diferente do valor total.' }),
      h('p', { text: 'Diferença líquida (meses − total): ' + c.moeda(diferenca) + '. Os valores por período abaixo refletem os meses como informados na planilha. Consulte a situação "Divergente" em cada Secretaria e corrija na origem.' })
    ]);
  }

  /**
   * @param {HTMLElement} container
   */
  function render(container) {
    var exercicio = PO.core.estado.getExercicio();
    return Promise.all([
      PO.data.repositorio.listarDespesas(exercicio),
      PO.data.repositorio.listarReceitas(exercicio)
    ]).then(function (res) {
      var despesas = res[0].registros;
      var receitas = res[1].registros;

      container.appendChild(c.cabecalhoPagina('Painel — Exercício ' + exercicio, 'Visão consolidada de receitas e despesas planejadas.'));

      if (!despesas.length && !receitas.length) {
        container.appendChild(c.estadoVazio('Nenhum dado importado para ' + exercicio + '. Importe o cronograma de despesas e o arquivo de receitas.', 'painel-vazio'));
        return;
      }

      PO.core.dom.anexar(container, [
        secaoKpis(exercicio, despesas, receitas),
        h('div', { className: 'grid-2' }, [secaoReceitas(exercicio, receitas), secaoOrgaos(despesas)]),
        secaoCronograma(despesas)
      ]);
    });
  }

  PO.ui.views.painel = Object.freeze({ render: render });
})(window.PO);
