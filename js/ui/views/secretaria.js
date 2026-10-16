// JAVASCRIPT
/**
 * @file secretaria.js
 * @description View de uma Secretaria/Órgão (#/secretaria/{UO}).
 *
 * Abas:
 *   - Dotações: busca rápida, filtros (UE, Categoria, GND, Fonte, prefixo de
 *     Natureza), "Limpar filtros", diluição por período e ações por linha
 *     (Alterar/Excluir) + "Adicionar dotação".
 *   - Relatório de Projeção: projeção imprimível das dotações FILTRADAS.
 *   - Histórico de ajustes: trilha de auditoria (somente leitura) das
 *     inclusões/alterações/anulações da UO, com valor antes/depois e motivo.
 *
 * Em todos os períodos há duas visões (alternador acima da tabela), ambas com
 * UE, Funcional, Natureza, Descrição, Fonte e Total orçamento:
 *   - Resumo (padrão): clicar na linha abre o painel com a distribuição no
 *     período (indicadores, barras e subtotais: trimestres no Mensal,
 *     semestres no Bimestral/Trimestral; no Anual, os 12 meses como referência);
 *   - Grade completa: uma coluna por período em mapa de calor, zeros como "—"
 *     (abreviados no Mensal). Não existe no Anual (seria uma única coluna).
 * Nas duas, a coluna "Situação" traz a diferença total − diluído (coluna H do
 * cronograma) com semáforo verde (Atende) / amarelo (Falta diluir) /
 * vermelho (Excede); ela substitui a coluna "Valor insuficiente".
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var cfg = PO.core.config;
  var dinheiro = PO.core.dinheiro;
  var texto = PO.core.texto;
  var periodos = PO.domain.periodos;
  var classif = PO.domain.classificacaoDespesa;
  var formulario = PO.ui.formularioDotacao;
  var ajustesDespesa = PO.domain.ajustesDespesa;

  var PERIODO_PADRAO = 'mensal';

  /** Rótulo e variante de selo por operação de ajuste. */
  var OPERACAO_ROTULO = Object.freeze({
    inclusao: { rotulo: 'Inclusão', variante: 'ok' },
    alteracao: { rotulo: 'Alteração', variante: 'alerta' },
    exclusao: { rotulo: 'Anulação', variante: 'erro' }
  });

  /** Opções distintas de um campo, com "Todos" no topo. */
  function opcoesDistintas(registros, campo, rotular) {
    var valores = Array.from(new Set(registros.map(function (r) { return r[campo]; }).filter(Boolean))).sort();
    return [{ valor: '', rotulo: 'Todos' }].concat(valores.map(function (v) {
      return { valor: v, rotulo: rotular ? rotular(v) : v };
    }));
  }

  /** Recria as opções de um <select> preservando a seleção, se ainda existir. */
  function definirOpcoes(select, opcoes) {
    var atual = select.value;
    PO.core.dom.limpar(select);
    opcoes.forEach(function (o) {
      select.appendChild(h('option', { text: o.rotulo, attrs: { value: o.valor } }));
    });
    select.value = opcoes.some(function (o) { return o.valor === atual; }) ? atual : '';
  }

  /** Texto pesquisável de uma dotação (busca rápida, sem acento/caixa). */
  function textoBusca(r) {
    return texto.normalizar([r.ue, r.funcional, r.natureza, r.descricao, r.fonte, cfg.fontes[r.fonte] || '',
      dinheiro.formatar(r.totalCentavos, { simbolo: false })].join(' | '));
  }

  /** Aplica busca rápida + filtros. */
  function filtrar(registros, f) {
    var termos = texto.normalizar(f.busca).split(' ').filter(Boolean);
    return registros.filter(function (r) {
      var alvo = termos.length ? textoBusca(r) : '';
      return (!f.ue || r.ue === f.ue) &&
        (!f.categoria || r.categoria === f.categoria) &&
        (!f.gnd || r.gnd === f.gnd) &&
        (!f.fonte || r.fonte === f.fonte) &&
        classif.casaPrefixo(r.natureza, f.natureza) &&
        termos.every(function (t) { return alvo.indexOf(t) !== -1; });
    });
  }

  /** Botões de ação da linha (ícone + rótulo acessível). */
  function acoes(r, aoAlterar, aoExcluir) {
    var id = texto.slug(r.chave);
    return h('span', { className: 'row-actions' }, [
      h('button', { className: 'btn-icon', text: '✎', testid: 'btn-alterar-dotacao-' + id, attrs: { type: 'button', title: 'Alterar dotação', 'aria-label': 'Alterar dotação ' + r.natureza + ' ' + r.descricao }, on: { click: function () { aoAlterar(r); } } }),
      h('button', { className: 'btn-icon btn-icon--danger', text: '✕', testid: 'btn-excluir-dotacao-' + id, attrs: { type: 'button', title: 'Excluir (anular) dotação', 'aria-label': 'Excluir dotação ' + r.natureza + ' ' + r.descricao }, on: { click: function () { aoExcluir(r); } } })
    ]);
  }

  /** Valor sem "R$" (a legenda da tabela informa a unidade). */
  function semSimbolo(v) {
    return dinheiro.formatar(v, { simbolo: false });
  }

  /** Valor abreviado (grade mensal e rótulos do painel): "287,5 mil", "3,41 mi", "600". */
  function abreviar(centavos) {
    var reais = centavos / 100;
    var abs = Math.abs(reais);
    if (abs >= 1e6) {
      return (reais / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
    }
    if (abs >= 1e3) {
      return (reais / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    }
    return reais.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }

  /**
   * Semáforo da Situação (diferença = total − diluído nos meses):
   * verde "Atende" (0), amarelo "Falta diluir" (> 0), vermelho "Excede" (< 0).
   */
  var SEMAFORO = Object.freeze({
    atende: { rotulo: 'Atende', cor: 'verde' },
    positivo: { rotulo: 'Falta diluir', cor: 'amarelo' },
    negativo: { rotulo: 'Excede', cor: 'vermelho' }
  });

  /** Indicador: bolinha + valor da diferença + rótulo. */
  function semaforo(saldoCentavos) {
    var s = SEMAFORO[saldoCentavos === 0 ? 'atende' : saldoCentavos > 0 ? 'positivo' : 'negativo'];
    return h('span', { className: 'semaforo semaforo--' + s.cor }, [
      h('span', { className: 'semaforo__luz', attrs: { 'aria-hidden': 'true' } }),
      h('span', { className: 'semaforo__valor', text: semSimbolo(saldoCentavos) }),
      h('span', { className: 'semaforo__rotulo', text: s.rotulo })
    ]);
  }

  /**
   * Situação: semáforo com a diferença entre o total do orçamento e o
   * valor diluído, mais os selos "Não diluída" e de origem (Manual/Alterada).
   */
  function situacaoUnificada(r) {
    var calc = PO.domain.valorInsuficiente.calcular(r);
    var itens = [semaforo(calc.saldoCentavos)];
    if (!r.diluida) {
      itens.push(c.selo('Não diluída', 'alerta'));
    }
    if (r.origem === 'manual') {
      itens.push(c.selo('Manual', 'neutro'));
    } else if (r.alterada) {
      itens.push(c.selo('Alterada', 'neutro'));
    }
    return h('span', { className: 'badge-stack', testid: 'celula-situacao' }, itens);
  }

  /** Cartão de indicador do painel de distribuição. */
  function indicador(rotulo, valor) {
    return h('div', { className: 'dist-kpi' }, [
      h('span', { className: 'dist-kpi__label', text: rotulo }),
      h('span', { className: 'dist-kpi__value' }, valor)
    ]);
  }

  /**
   * Gráfico de barras com o valor sobre cada barra (exato no tooltip).
   * @param {number[]} valores centavos
   * @param {string[]} rotulos
   * @param {{abreviar?:boolean, referencia?:boolean}} [opcoes] referencia: barras esmaecidas (Anual)
   */
  function graficoBarras(valores, rotulos, opcoes) {
    var o = opcoes || {};
    var maximo = Math.max.apply(null, valores.map(Math.abs)) || 1;
    var colunas = 'grid-template-columns:repeat(' + valores.length + ', minmax(0, 1fr))';
    var largura = valores.length > 6 ? 'dist--estreito' : 'dist--largo';
    return [
      h('div', { className: 'dist__chart ' + largura + (o.referencia ? ' dist__chart--ref' : ''), attrs: { style: colunas, role: 'img', 'aria-label': 'Distribuição: ' + valores.map(function (v, i) { return rotulos[i] + ' ' + semSimbolo(v); }).join('; ') } },
        valores.map(function (v, i) {
          var altura = v ? Math.max(4, Math.round(Math.abs(v) / maximo * 80)) : 2;
          return h('div', { className: 'dist__col', attrs: { title: rotulos[i] + ': R$ ' + semSimbolo(v) } }, [
            h('span', { className: 'dist__val', text: v ? (o.abreviar ? abreviar(v) : semSimbolo(v)) : '—' }),
            h('span', { className: 'dist__bar' + (v ? '' : ' dist__bar--zero') + (v < 0 ? ' dist__bar--neg' : ''), attrs: { style: 'height:' + altura + '%' } })
          ]);
        })),
      h('div', { className: 'dist__axis', attrs: { style: colunas, 'aria-hidden': 'true' } }, rotulos.map(function (m) { return h('span', { text: m }); }))
    ];
  }

  /** Faixa de subtotais (trimestres no Mensal, semestres no Bimestral/Trimestral). */
  function faixaSubtotais(itens, abreviado) {
    return h('div', { className: 'dist__quarters', attrs: { style: 'grid-template-columns:repeat(' + itens.length + ', minmax(0, 1fr))' } }, itens.map(function (it) {
      return h('span', { className: 'dist__quarter' }, [it.rotulo + ' · ', h('strong', { text: abreviado ? abreviar(it.valor) : semSimbolo(it.valor), attrs: { title: semSimbolo(it.valor) } })]);
    }));
  }

  /**
   * Painel expandido da linha no período escolhido: indicadores (total,
   * diluído, situação, períodos com valor), barras por período e subtotais.
   *   - Mensal: 12 meses + trimestres;
   *   - Bimestral/Trimestral: barras do período + semestres;
   *   - Quadrimestral: só as barras;
   *   - Anual: os 12 meses como referência (barras esmaecidas).
   */
  function painelDistribuicao(r, meses, chavePeriodo) {
    var mensal = chavePeriodo === 'mensal';
    var anual = chavePeriodo === 'anual';
    var valores = anual || mensal ? meses : periodos.agregar(meses, chavePeriodo);
    var rotulos = anual ? periodos.rotulos('mensal') : periodos.rotulos(chavePeriodo);
    var diluido = dinheiro.somar(meses);
    var saldo = PO.domain.valorInsuficiente.calcular(r).saldoCentavos;
    var comValor = valores.filter(function (v) { return v !== 0; }).length;
    var media = comValor ? Math.round(diluido / comValor) : 0;
    var rotuloContagem = mensal || anual ? 'Meses com valor' : 'Períodos com valor';

    var partes = [
      h('div', { className: 'dist__kpis' }, [
        indicador('Total orçamento', semSimbolo(r.totalCentavos)),
        indicador(mensal ? 'Diluído Jan–Dez' : 'Diluído no ano', semSimbolo(diluido)),
        indicador('Situação', semaforo(saldo)),
        indicador(rotuloContagem, comValor + ' de ' + valores.length + ' · média ' + abreviar(media))
      ])
    ];
    if (anual) {
      partes.push(h('p', { className: 'dist__note', text: 'Referência mensal (o período Anual tem uma única coluna).' }));
    }
    partes = partes.concat(graficoBarras(valores, rotulos, { abreviar: mensal || anual, referencia: anual }));
    if (mensal) {
      partes.push(faixaSubtotais([0, 1, 2, 3].map(function (t) {
        return { rotulo: 'T' + (t + 1), valor: dinheiro.somar(meses.slice(t * 3, t * 3 + 3)) };
      }), true));
    } else if (chavePeriodo === 'bimestral' || chavePeriodo === 'trimestral') {
      partes.push(faixaSubtotais([
        { rotulo: '1º semestre', valor: dinheiro.somar(meses.slice(0, 6)) },
        { rotulo: '2º semestre', valor: dinheiro.somar(meses.slice(6)) }
      ], false));
    }
    return h('div', { className: 'dist' }, partes);
  }

  /** Colunas de identificação comuns às visões. */
  var COLUNAS_ID = ['UE', 'Funcional', 'Natureza', 'Descrição', 'Fonte', 'Total orçamento'];

  /** Células de identificação: UE, funcional, natureza, descrição, fonte, total. */
  function celulasId(r) {
    return [r.ue, r.funcional, r.natureza, h('span', { className: 'cell-desc2', text: r.descricao, attrs: { title: r.descricao } }), r.fonte,
      h('span', { className: 'u-num', text: semSimbolo(r.totalCentavos) })];
  }

  /**
   * Visão "Resumo" (padrão, todos os períodos): uma linha por dotação; clicar
   * na linha abre o painel com a distribuição no período. `expandidas` (Set de
   * chaves) preserva o estado entre redesenhos.
   */
  function tabelaResumo(registros, chavePeriodo, manipuladores, expandidas) {
    var nColunas = COLUNAS_ID.length + 3;
    var linhas = [];
    registros.forEach(function (r) {
      var id = texto.slug(r.chave);
      var meses = periodos.mesesEfetivos(r);
      var aberta = expandidas.has(r.chave);
      var detalhe = h('tr', { className: 'resumo-detalhe', testid: 'detalhe-dotacao-' + id, attrs: { hidden: !aberta } },
        h('td', { className: 'data-table__td', attrs: { colspan: nColunas } }, aberta ? painelDistribuicao(r, meses, chavePeriodo) : null));
      var botao = h('button', {
        className: 'btn-expand', text: '▸', testid: 'btn-expandir-dotacao-' + id,
        attrs: { type: 'button', 'aria-expanded': aberta ? 'true' : 'false', 'aria-label': 'Ver distribuição de ' + r.natureza + ' ' + r.descricao }
      });
      var linha;
      function alternar() {
        var abrir = detalhe.hidden;
        if (abrir && !detalhe.firstChild.firstChild) {
          detalhe.firstChild.appendChild(painelDistribuicao(r, meses, chavePeriodo));
        }
        detalhe.hidden = !abrir;
        linha.classList.toggle('is-open', abrir);
        botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
        if (abrir) { expandidas.add(r.chave); } else { expandidas.delete(r.chave); }
      }
      linha = h('tr', {
        className: 'data-table__row resumo-linha' + (aberta ? ' is-open' : ''),
        on: { click: function (e) { if (!e.target.closest('.row-actions')) { alternar(); } } }
      }, [h('td', { className: 'data-table__td resumo-linha__toggle' }, botao)]
        .concat(celulasId(r).map(function (cel) { return h('td', { className: 'data-table__td' }, cel); }))
        .concat([
          h('td', { className: 'data-table__td' }, situacaoUnificada(r)),
          h('td', { className: 'data-table__td' }, acoes(r, manipuladores.aoAlterar, manipuladores.aoExcluir))
        ]));
      linhas.push(linha, detalhe);
    });

    var corpo = linhas.length ? linhas : [h('tr', null, h('td', { className: 'data-table__empty', text: 'Nenhuma dotação atende aos filtros.', attrs: { colspan: nColunas } }))];
    var titulos = [''].concat(COLUNAS_ID).concat(['Situação', 'Ações']);

    return h('div', { className: 'data-table data-table--mensal data-table--resumo', attrs: { role: 'region', 'aria-label': 'Dotações da unidade orçamentária (valores em R$)', tabindex: '0' } },
      h('table', { className: 'data-table__table', testid: 'tabela-dotacoes' }, [
        h('caption', { className: 'u-visually-hidden', text: 'Dotações da unidade orçamentária (valores em R$). Clique numa linha para ver a distribuição no período.' }),
        h('thead', null, h('tr', null, titulos.map(function (t, i) {
          return h('th', { className: 'data-table__th' + (i === 0 ? ' resumo-linha__toggle' : ''), text: t, attrs: { scope: 'col' } });
        }))),
        h('tbody', null, corpo)
      ]));
  }

  /** Célula da grade: "—" no zero, tom pelo peso do período na dotação. */
  function celulaCalor(v, maximo, rotulo, abreviado) {
    if (!v) {
      return h('span', { className: 'heat heat--zero', text: '—', attrs: { title: rotulo + ': 0,00' } });
    }
    var tom = Math.round(6 + 26 * Math.abs(v) / maximo);
    return h('span', {
      className: 'heat' + (v < 0 ? ' heat--neg' : ''), text: abreviado ? abreviar(v) : semSimbolo(v),
      attrs: { title: rotulo + ': ' + semSimbolo(v), style: '--tom:' + tom + '%' }
    });
  }

  /**
   * Visão "Grade completa": identificação + uma coluna por período em mapa de
   * calor + situação. No Mensal os valores são abreviados (12 colunas); nos
   * demais períodos aparecem por extenso.
   */
  function tabelaGrade(registros, chavePeriodo, manipuladores) {
    var abreviado = chavePeriodo === 'mensal';
    var rotulos = periodos.rotulos(chavePeriodo);
    var colunas = COLUNAS_ID.map(function (t) { return { titulo: t }; })
      .concat(rotulos.map(function (r) { return { titulo: r }; }))
      .concat([{ titulo: 'Situação' }, { titulo: 'Ações' }]);
    var linhas = registros.map(function (r) {
      var valores = periodos.agregar(periodos.mesesEfetivos(r), chavePeriodo);
      var maximo = Math.max.apply(null, valores.map(Math.abs)) || 1;
      return celulasId(r)
        .concat(valores.map(function (v, i) { return celulaCalor(v, maximo, rotulos[i], abreviado); }))
        .concat([situacaoUnificada(r), acoes(r, manipuladores.aoAlterar, manipuladores.aoExcluir)]);
    });
    var soma = periodos.agregar(periodos.somarMeses(registros), chavePeriodo);
    var total = dinheiro.somar(registros.map(function (r) { return r.totalCentavos; }));
    var rodape = ['', '', '', 'Total (' + registros.length + ')', '', semSimbolo(total)]
      .concat(soma.map(function (v, i) {
        return h('span', { text: v ? (abreviado ? abreviar(v) : semSimbolo(v)) : '—', attrs: { title: rotulos[i] + ': ' + semSimbolo(v) } });
      }))
      .concat(['', '']);
    var tabela = c.tabela({
      colunas: colunas,
      linhas: linhas,
      rodape: rodape,
      legenda: 'Dotações da unidade orçamentária — grade por período (valores em R$' + (abreviado ? '; meses abreviados, valor exato no tooltip' : '') + ')',
      testid: 'tabela-dotacoes',
      vazio: 'Nenhuma dotação atende aos filtros.'
    });
    tabela.classList.add('data-table--mensal', 'data-table--grade');
    return tabela;
  }

  /** "antes → depois" quando o valor mudou; senão o valor vigente (ou "—"). */
  function antesDepois(antes, depois) {
    if (antes !== null && depois !== null && antes !== depois) {
      return antes + ' → ' + depois;
    }
    return (depois !== null ? depois : antes) || '—';
  }

  /**
   * Tabela (somente leitura) da trilha de auditoria dos ajustes da UO,
   * do mais recente para o mais antigo.
   * @param {Array} linhas resultado de ajustesDespesa.historico()
   */
  function tabelaHistorico(linhas) {
    var valor = function (v) { return v === null ? '—' : c.moeda(v); };
    return c.tabela({
      colunas: [{ titulo: 'Nº' }, { titulo: 'Data/hora' }, { titulo: 'Operação' }, { titulo: 'Natureza' }, { titulo: 'Descrição' },
        { titulo: 'Valor antes', numerica: true }, { titulo: 'Valor depois', numerica: true }, { titulo: 'Motivo' }],
      linhas: linhas.slice().reverse().map(function (l) {
        var op = OPERACAO_ROTULO[l.operacao] || { rotulo: l.operacao, variante: 'neutro' };
        var selos = [c.selo(op.rotulo, op.variante)];
        if (!l.alvoEncontrado) {
          selos.push(c.selo('Sem efeito', 'neutro'));
        }
        return [
          String(l.id),
          l.dataHora ? new Date(l.dataHora).toLocaleString('pt-BR') : '—',
          h('span', { className: 'badge-stack' }, selos),
          antesDepois(l.naturezaAntes, l.naturezaDepois),
          h('span', { className: 'cell-desc', text: antesDepois(l.descricaoAntes, l.descricaoDepois) }),
          valor(l.antesCentavos),
          valor(l.depoisCentavos),
          h('span', { className: 'cell-desc', text: l.motivo || '—' })
        ];
      }),
      legenda: 'Histórico de ajustes das dotações (trilha de auditoria)',
      testid: 'tabela-historico-ajustes',
      vazio: 'Nenhum ajuste registrado para esta unidade na importação ativa.'
    });
  }

  /**
   * @param {HTMLElement} container
   * @param {string[]} params [codigoUO]
   */
  function render(container, params) {
    var uo = params[0];
    var exercicio = PO.core.estado.getExercicio();
    if (!uo) {
      throw new Error('Unidade Orçamentária não informada na rota.');
    }

    function carregar() {
      return PO.data.repositorio.listarDespesas(exercicio).then(function (res) {
        var trilha = res.lote ? ajustesDespesa.historico(res.base, res.ajustes) : [];
        return {
          lote: res.lote,
          registros: res.registros.filter(function (r) { return r.uo === uo; }),
          historico: trilha.filter(function (l) { return l.uo === uo; })
        };
      });
    }

    return carregar().then(function (res) {
      var titulo = uo + ' — ' + c.nomeOrgao(uo);
      if (!res.lote) {
        container.appendChild(c.cabecalhoPagina(titulo, 'Dotações do exercício ' + exercicio + '.'));
        container.appendChild(c.estadoVazio('Não há cronograma de despesas importado para ' + exercicio + '.', 'secretaria-vazia'));
        return;
      }

      var registros = res.registros;
      var filtrados = registros;
      var alvoHistorico = h('div', { className: 'panel__body' });

      function desenharHistorico(linhas) {
        PO.core.dom.limpar(alvoHistorico);
        alvoHistorico.appendChild(tabelaHistorico(linhas));
      }

      var ctrl = {
        busca: h('input', { className: 'input', testid: 'input-busca-rapida', attrs: { type: 'search', placeholder: 'Descrição, natureza, funcional, fonte, valor…', autocomplete: 'off' } }),
        ue: c.select([], 'filtro-ue'),
        categoria: c.select([], 'filtro-categoria'),
        gnd: c.select([], 'filtro-gnd'),
        fonte: c.select([], 'filtro-fonte'),
        natureza: h('input', { className: 'input', testid: 'filtro-natureza', attrs: { type: 'search', placeholder: 'ex.: 3.3.90', inputmode: 'decimal', autocomplete: 'off' } }),
        periodo: c.selectPeriodo('filtro-periodo', PERIODO_PADRAO)
      };

      function atualizarOpcoes() {
        definirOpcoes(ctrl.ue, opcoesDistintas(registros, 'ue'));
        definirOpcoes(ctrl.categoria, opcoesDistintas(registros, 'categoria', function (v) { return v + ' — ' + (cfg.categoriasDespesa[v] || '?'); }));
        definirOpcoes(ctrl.gnd, opcoesDistintas(registros, 'gnd', function (v) { return v + ' — ' + (cfg.gnd[v] || '?'); }));
        definirOpcoes(ctrl.fonte, opcoesDistintas(registros, 'fonte', function (v) { return v + ' — ' + (cfg.fontes[v] || 'Não cadastrada'); }));
      }

      var alvoTabela = h('div', { className: 'panel__body' });
      var resumo = h('p', { className: 'filters__summary', testid: 'txt-resumo-filtro', attrs: { 'aria-live': 'polite' } });

      /** Recarrega do banco após um ajuste, preservando filtros e período. */
      function recarregar(mensagem) {
        return carregar().then(function (novo) {
          registros = novo.registros;
          atualizarOpcoes();
          atualizar();
          desenharHistorico(novo.historico);
          PO.ui.notificador.sucesso(mensagem);
        });
      }

      function unidadesExecutoras() {
        return opcoesDistintas(registros, 'ue').slice(1).map(function (o) { return o.valor; });
      }

      var manipuladores = {
        aoAlterar: function (r) {
          formulario.abrirFormulario({
            operacao: 'alteracao', uo: uo, exercicio: exercicio, registro: r, unidadesExecutoras: unidadesExecutoras(),
            aoSalvar: function () { recarregar('Dotação alterada (ajuste registrado na trilha de auditoria).'); }
          });
        },
        aoExcluir: function (r) {
          formulario.confirmarExclusao({
            registro: r, uo: uo, exercicio: exercicio,
            aoConfirmar: function () { recarregar('Dotação excluída (anulação registrada na trilha de auditoria).'); }
          });
        }
      };

      function adicionar() {
        formulario.abrirFormulario({
          operacao: 'inclusao', uo: uo, exercicio: exercicio, unidadesExecutoras: unidadesExecutoras(),
          aoSalvar: function () { recarregar('Dotação adicionada.'); }
        });
      }

      var relatorio = PO.ui.relatorioProjecao.criar({
        obterDespesas: function () { return filtrados; },
        titulo: 'Projeção da despesa — ' + titulo,
        exercicio: exercicio,
        agrupamentos: ['ue', 'gnd', 'categoria', 'elemento', 'fonte', 'funcao'],
        agrupamentoPadrao: 'ue',
        periodoPadrao: 'bimestral',
        prefixoTestid: 'relatorio-secretaria'
      });

      function atualizar() {
        var filtros = {
          busca: ctrl.busca.value,
          ue: ctrl.ue.value,
          categoria: ctrl.categoria.value,
          gnd: ctrl.gnd.value,
          fonte: ctrl.fonte.value,
          natureza: ctrl.natureza.value
        };
        var invalido = filtros.natureza && !/^[\d.]+$/.test(filtros.natureza.trim());
        c.definirErro(ctrl.natureza, invalido ? 'Use apenas dígitos e pontos (ex.: 3.3.90).' : null);
        if (invalido) {
          return;
        }
        filtrados = filtrar(registros, filtros);
        var total = dinheiro.somar(filtrados.map(function (r) { return r.totalCentavos; }));
        resumo.textContent = filtrados.length + ' de ' + registros.length + ' dotações · ' + c.moeda(total);
        desenharTabela();
        relatorio.atualizar();
      }

      /**
       * Visão "Resumo" (padrão — painel de distribuição ao clicar na linha) ou
       * "Grade completa" (uma coluna por período em mapa de calor), em todos os
       * períodos. No Anual só há o Resumo (a grade teria uma única coluna).
       * A escolha fica lembrada neste navegador.
       */
      var CHAVE_VISAO = 'po.secretaria.visaoMensal';
      var visaoMensal = 'resumo';
      try { visaoMensal = localStorage.getItem(CHAVE_VISAO) === 'grade' ? 'grade' : 'resumo'; } catch (e) { /* sem storage: usa o padrão */ }
      var expandidas = new Set();
      var alvoVisao = h('div', { className: 'view-switch-bar' });

      function botaoVisao(chave, rotulo, testid) {
        return h('button', {
          className: 'view-switch__btn', text: rotulo, testid: testid,
          attrs: { type: 'button', 'aria-pressed': visaoMensal === chave ? 'true' : 'false' },
          on: { click: function () {
            visaoMensal = chave;
            try { localStorage.setItem(CHAVE_VISAO, chave); } catch (e) { /* ignora */ }
            desenharTabela();
          } }
        });
      }

      function desenharTabela() {
        var chave = ctrl.periodo.value;
        var anual = chave === 'anual';
        var visao = anual ? 'resumo' : visaoMensal;
        var dica = visao === 'resumo'
          ? (chave === 'mensal' ? 'Clique numa linha para ver a distribuição Jan–Dez.' : 'Clique numa linha para ver a distribuição no período.') + ' Valores em R$.'
          : (chave === 'mensal'
            ? 'Valores em R$; meses abreviados (valor exato ao passar o mouse), zeros como "—" e o tom indica o peso do mês na dotação.'
            : 'Valores em R$; zeros como "—" e o tom indica o peso do período na dotação.');
        PO.core.dom.limpar(alvoTabela);
        PO.core.dom.limpar(alvoVisao);
        PO.core.dom.anexar(alvoVisao, [
          anual ? null : h('span', { className: 'view-switch', attrs: { role: 'group', 'aria-label': 'Visão da tabela de dotações' } }, [
            botaoVisao('resumo', 'Resumo', 'btn-visao-resumo'),
            botaoVisao('grade', 'Grade completa', 'btn-visao-grade')
          ]),
          h('span', { className: 'table-note', testid: 'txt-visao-mensal', text: dica })
        ]);
        alvoTabela.appendChild(alvoVisao);
        alvoTabela.appendChild(visao === 'resumo'
          ? tabelaResumo(filtrados, chave, manipuladores, expandidas)
          : tabelaGrade(filtrados, chave, manipuladores));
      }

      function limparFiltros() {
        ctrl.busca.value = '';
        ctrl.natureza.value = '';
        ['ue', 'categoria', 'gnd', 'fonte'].forEach(function (k) { ctrl[k].value = ''; });
        ctrl.periodo.value = PERIODO_PADRAO;
        atualizar();
        ctrl.busca.focus();
      }

      Object.keys(ctrl).forEach(function (k) {
        ctrl[k].addEventListener(k === 'natureza' || k === 'busca' ? 'input' : 'change', atualizar);
      });

      var filtrosForm = h('form', { className: 'filters', testid: 'form-filtros-secretaria', attrs: { 'aria-label': 'Filtros', novalidate: true }, on: { submit: function (e) { e.preventDefault(); } } }, [
        h('div', { className: 'filters__search' }, c.campo({ id: 'f-busca', rotulo: 'Busca rápida', controle: ctrl.busca })),
        c.campo({ id: 'f-ue', rotulo: 'Unidade Executora', controle: ctrl.ue }),
        c.campo({ id: 'f-categoria', rotulo: 'Categoria econômica', controle: ctrl.categoria }),
        c.campo({ id: 'f-gnd', rotulo: 'Grupo (GND)', controle: ctrl.gnd }),
        c.campo({ id: 'f-fonte', rotulo: 'Fonte de recurso', controle: ctrl.fonte }),
        c.campo({ id: 'f-natureza', rotulo: 'Natureza de despesa (prefixo)', controle: ctrl.natureza }),
        c.campo({ id: 'f-periodo', rotulo: 'Período', controle: ctrl.periodo }),
        h('div', { className: 'filters__actions' }, c.botao('Limpar filtros', 'btn-limpar-filtros', limparFiltros, 'secondary'))
      ]);

      var painelDotacoes = h('div', { className: 'stack' }, [
        h('section', { className: 'panel' }, [filtrosForm, resumo]),
        h('section', { className: 'panel' }, alvoTabela)
      ]);
      var painelRelatorio = h('div', null, h('section', { className: 'panel' }, [
        h('p', { className: 'report__hint no-print', text: 'O relatório considera a busca e os filtros aplicados na aba "Dotações".' }),
        relatorio.elemento
      ]));
      var painelHistorico = h('div', null, h('section', { className: 'panel', testid: 'painel-historico-ajustes' }, [
        h('p', { className: 'report__hint', text: 'Somente leitura. Ajustes vinculados à importação ativa (' + res.lote.arquivo + ', ' +
          new Date(res.lote.dataHora).toLocaleString('pt-BR') + '). Nada é apagado: anulações e alterações ficam registradas com motivo.' }),
        alvoHistorico
      ]));

      PO.core.dom.anexar(container, [
        c.cabecalhoPagina(titulo, 'Dotações do exercício ' + exercicio + ' com diluição por período.', [
          c.botao('+ Adicionar dotação', 'btn-adicionar-dotacao', adicionar)
        ]),
        c.abas({
          testid: 'abas-secretaria',
          abas: [
            { id: 'dotacoes', rotulo: 'Dotações', painel: painelDotacoes },
            { id: 'relatorio', rotulo: 'Relatório de Projeção', painel: painelRelatorio },
            { id: 'historico-ajustes', rotulo: 'Histórico de ajustes', painel: painelHistorico }
          ]
        })
      ]);
      atualizarOpcoes();
      atualizar();
      desenharHistorico(res.historico);
    });
  }

  PO.ui.views.secretaria = Object.freeze({ render: render, filtrar: filtrar });
})(window.PO);
