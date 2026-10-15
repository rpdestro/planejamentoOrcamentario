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
 * No período "Mensal" a tabela usa o modo compacto (classificação empilhada
 * em uma coluna, valores sem "R$") para exibir as 12 colunas sem rolagem.
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

  /** Selos de situação (diluição + origem do registro). */
  function situacao(r) {
    var selos = [];
    if (!r.diluida) {
      selos.push(c.selo('Não diluída', 'alerta'));
    } else if (r.divergenciaCentavos !== 0) {
      selos.push(c.selo('Divergente', 'erro'));
    } else {
      selos.push(c.selo('OK', 'ok'));
    }
    if (r.origem === 'manual') {
      selos.push(c.selo('Manual', 'neutro'));
    } else if (r.alterada) {
      selos.push(c.selo('Alterada', 'neutro'));
    }
    return h('span', { className: 'badge-stack' }, selos);
  }

  /** Botões de ação da linha (ícone + rótulo acessível). */
  function acoes(r, aoAlterar, aoExcluir) {
    var id = texto.slug(r.chave);
    return h('span', { className: 'row-actions' }, [
      h('button', { className: 'btn-icon', text: '✎', testid: 'btn-alterar-dotacao-' + id, attrs: { type: 'button', title: 'Alterar dotação', 'aria-label': 'Alterar dotação ' + r.natureza + ' ' + r.descricao }, on: { click: function () { aoAlterar(r); } } }),
      h('button', { className: 'btn-icon btn-icon--danger', text: '✕', testid: 'btn-excluir-dotacao-' + id, attrs: { type: 'button', title: 'Excluir (anular) dotação', 'aria-label': 'Excluir dotação ' + r.natureza + ' ' + r.descricao }, on: { click: function () { aoExcluir(r); } } })
    ]);
  }

  /** Célula empilhada de classificação (modo compacto). */
  function celulaClassificacao(r) {
    return h('span', { className: 'cell-stack' }, [
      h('span', { className: 'cell-stack__main', text: r.natureza + ' · F' + (r.fonte || '?') }),
      h('span', { className: 'cell-stack__sub', text: r.ue }),
      h('span', { className: 'cell-stack__sub', text: r.funcional })
    ]);
  }

  /**
   * Modo "semestres empilhados": 12 valores em 6 colunas (Jan/Jul, Fev/Ago…),
   * cada célula com 2 linhas. Usado quando 12 colunas não cabem na largura.
   */
  function empilharSemestres(valores, fmt) {
    var colunas = [];
    for (var i = 0; i < 6; i += 1) {
      colunas.push(h('span', { className: 'cell-stack cell-stack--num' }, [
        h('span', { text: fmt(valores[i]) }),
        h('span', { className: 'cell-stack__sub', text: fmt(valores[i + 6]) })
      ]));
    }
    return colunas;
  }

  /**
   * Tabela de dotações no período escolhido.
   * @param {Array} registros
   * @param {string} chavePeriodo
   * @param {{aoAlterar:Function, aoExcluir:Function}} manipuladores
   * @param {boolean} [semestral] Mensal em 6 colunas de 2 linhas (telas estreitas)
   */
  function tabelaDotacoes(registros, chavePeriodo, manipuladores, semestral) {
    var compacta = chavePeriodo === 'mensal';
    var empilhar = compacta && semestral;
    var fmt = compacta ? function (v) { return dinheiro.formatar(v, { simbolo: false }); } : c.moeda;
    var rotulos = periodos.rotulos(chavePeriodo);
    var colunasPeriodo = empilhar
      ? rotulos.slice(0, 6).map(function (r, i) { return { titulo: r + ' / ' + rotulos[i + 6], numerica: true }; })
      : rotulos.map(function (r) { return { titulo: r, numerica: true }; });
    var celulasPeriodo = empilhar ? function (v) { return empilharSemestres(v, fmt); } : function (v) { return v.map(fmt); };
    var colunasFixas = compacta
      ? [{ titulo: 'Classificação' }, { titulo: 'Descrição' }, { titulo: 'Total', numerica: true }]
      : [{ titulo: 'U. Executora' }, { titulo: 'Funcional' }, { titulo: 'Natureza' }, { titulo: 'Descrição' }, { titulo: 'Fonte' }, { titulo: 'Total', numerica: true }];
    var colunas = colunasFixas.concat(colunasPeriodo).concat([{ titulo: 'Situação' }, { titulo: 'Ações' }]);

    var linhas = registros.map(function (r) {
      var valores = periodos.agregar(periodos.mesesEfetivos(r), chavePeriodo);
      var fixas = compacta
        ? [celulaClassificacao(r), h('span', { className: 'cell-desc', text: r.descricao }), fmt(r.totalCentavos)]
        : [r.ue, r.funcional, r.natureza, r.descricao, r.fonte, fmt(r.totalCentavos)];
      return fixas.concat(celulasPeriodo(valores)).concat([situacao(r), acoes(r, manipuladores.aoAlterar, manipuladores.aoExcluir)]);
    });

    var somaPeriodos = periodos.agregar(periodos.somarMeses(registros), chavePeriodo);
    var total = dinheiro.somar(registros.map(function (r) { return r.totalCentavos; }));
    var vazias = compacta ? ['', 'Total (' + registros.length + ')'] : ['', '', '', 'Total (' + registros.length + ')', ''];
    var rodape = vazias.concat([fmt(total)]).concat(celulasPeriodo(somaPeriodos)).concat(['', '']);

    return c.tabela({
      colunas: colunas,
      linhas: linhas,
      rodape: rodape,
      legenda: 'Dotações da unidade orçamentária' + (compacta ? ' (valores em R$)' : '') + (empilhar ? ' — meses em pares: 1º semestre na linha de cima, 2º semestre na de baixo' : ''),
      testid: 'tabela-dotacoes',
      vazio: 'Nenhuma dotação atende aos filtros.',
      compacta: compacta
    });
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
       * Desenha a tabela. No Mensal, tenta 12 colunas; se não couberem na
       * largura disponível, redesenha com os semestres empilhados (6 colunas
       * × 2 linhas) — todas as informações continuam visíveis, sem rolagem.
       */
      var larguraDesenhada = 0;
      function desenharTabela() {
        var mensal = ctrl.periodo.value === 'mensal';
        PO.core.dom.limpar(alvoTabela);
        alvoTabela.appendChild(tabelaDotacoes(filtrados, ctrl.periodo.value, manipuladores, false));
        larguraDesenhada = alvoTabela.clientWidth;
        var regiao = alvoTabela.firstChild;
        if (mensal && regiao.scrollWidth > regiao.clientWidth + 1) {
          PO.core.dom.limpar(alvoTabela);
          alvoTabela.appendChild(h('p', { className: 'table-note', testid: 'txt-mensal-semestres', text: 'Meses exibidos em pares para caber na tela: linha de cima = Jan–Jun, linha de baixo = Jul–Dez. Em telas mais largas (ou com o menu ☰ recolhido) os 12 meses ficam lado a lado.' }));
          alvoTabela.appendChild(tabelaDotacoes(filtrados, ctrl.periodo.value, manipuladores, true));
        }
      }

      // Reavalia o layout quando a largura muda (janela, menu recolhido, troca de aba).
      if (window.ResizeObserver) {
        new ResizeObserver(function () {
          var largura = alvoTabela.clientWidth;
          if (alvoTabela.isConnected && largura > 0 && Math.abs(largura - larguraDesenhada) > 8) {
            desenharTabela();
          }
        }).observe(alvoTabela);
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
