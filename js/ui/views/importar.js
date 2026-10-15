// JAVASCRIPT
/**
 * @file importar.js
 * @description View "Importar planilhas": formulário → prévia → gravação,
 * mais o histórico de importações (trilha de auditoria dos lotes).
 * Ao reimportar despesas de um exercício cujo lote ativo tem ajustes
 * manuais, a prévia avisa e oferece reaplicar as inclusões manuais.
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var importador = PO.importers.importador;
  var notificador = PO.ui.notificador;
  var LIMITE_AVISOS_EXIBIDOS = 100;

  /** Texto de ajuda do campo de ano conforme o tipo escolhido. */
  function ajudaAno(tipo) {
    return tipo === 'receitas'
      ? 'Ano da 1ª coluna de valor (VLR6_CALC) — normalmente o ano anterior ao exercício (arquivo 2027: VLR6=2026 … VLR9=2029).'
      : 'Exercício a que o cronograma de despesas se refere.';
  }

  /** Ano sugerido: exercício atual (despesas) ou exercício + deslocamento (receitas). */
  function anoPadrao(tipo) {
    var exercicio = PO.core.estado.getExercicio();
    return tipo === 'receitas' ? exercicio + PO.core.config.receitasDeslocamentoAnoInicial : exercicio;
  }

  /**
   * Aviso de que a nova importação de despesas vai substituir um lote que
   * tem ajustes manuais (que deixam de valer no lote novo). Oferece reaplicar
   * as inclusões manuais vigentes como novos ajustes.
   * @param {{lote:Object, ajustes:Array}|null} substituicao
   * @returns {{elemento:(HTMLElement|null), reaplicar:function():boolean}}
   */
  function blocoAjustesSubstituidos(substituicao) {
    if (!substituicao || !substituicao.ajustes.length) {
      return { elemento: null, reaplicar: function () { return false; } };
    }
    var ajustes = PO.domain.ajustesDespesa;
    var resumo = ajustes.resumir(substituicao.ajustes);
    var inclusoes = ajustes.inclusoesParaReaplicar(substituicao.ajustes);
    var lote = substituicao.lote;

    var opcao = inclusoes.length
      ? h('input', { testid: 'chk-reaplicar-inclusoes', attrs: { type: 'checkbox', id: 'imp-reaplicar', checked: true } })
      : null;

    var elemento = h('div', { className: 'alert alert--warning', testid: 'aviso-ajustes-substituidos', attrs: { role: 'alert' } }, [
      h('h4', { className: 'alert__title', text: 'Esta importação substitui um lote com ajustes manuais' }),
      h('p', { text: 'O lote ativo de ' + lote.exercicio + ' (' + lote.arquivo + ', ' + new Date(lote.dataHora).toLocaleString('pt-BR') +
        ') tem ' + resumo.total + ' ajuste(s). Eles continuam gravados na trilha de auditoria, mas deixam de valer no lote novo:' }),
      h('ul', { className: 'alert__list' }, [
        h('li', { text: resumo.inclusao + ' inclusão(ões) manual(is) — ' + inclusoes.length + ' ainda vigente(s)' }),
        h('li', { text: resumo.alteracao + ' alteração(ões) de dotação' }),
        h('li', { text: resumo.exclusao + ' anulação(ões) de dotação' })
      ]),
      resumo.alteracao || resumo.exclusao
        ? h('p', { text: 'Alterações e anulações de dotações importadas não são reaplicadas: confira se a nova planilha já traz essas correções.' })
        : null,
      opcao
        ? h('label', { className: 'checkbox', attrs: { for: 'imp-reaplicar' } }, [
            opcao,
            h('span', { text: 'Reaplicar as ' + inclusoes.length + ' inclusão(ões) manual(is) vigente(s) no novo lote (como novos ajustes, com referência ao original)' })
          ])
        : null
    ]);
    return { elemento: elemento, reaplicar: function () { return Boolean(opcao && opcao.checked); } };
  }

  /** Bloco de prévia (resumo + avisos + ações). */
  function blocoPrevia(previa, aoConfirmar, aoCancelar, avisoSubstituicao) {
    var r = previa.resumo || {};
    var itensResumo = [
      ['Arquivo', previa.arquivo],
      ['Linhas lidas', String(r.linhasLidas || 0)],
      ['Registros válidos', String(r.importadas || 0)],
      ['Linhas ignoradas', String(r.ignoradas || 0)]
    ];
    if (previa.tipo === 'despesas' && r.totalCentavos !== undefined) {
      itensResumo.push(['Total fixado', c.moeda(r.totalCentavos)]);
      itensResumo.push(['Não diluídas', String(r.naoDiluidas)]);
      itensResumo.push(['Com divergência mensal', String(r.divergentes)]);
    }
    if (previa.tipo === 'receitas' && r.anos) {
      r.anos.forEach(function (ano) {
        itensResumo.push(['Receita líquida ' + ano, c.moeda(r.totaisPorAno[ano].liquido)]);
      });
    }

    var erros = previa.erros.length
      ? h('div', { className: 'alert alert--error', attrs: { role: 'alert' }, testid: 'previa-erros' }, [
          h('h4', { className: 'alert__title', text: 'Erros impeditivos' }),
          h('ul', { className: 'alert__list' }, previa.erros.map(function (e) { return h('li', { text: e }); }))
        ])
      : null;

    var avisos = previa.avisos.length
      ? h('details', { className: 'warnings', testid: 'previa-avisos' }, [
          h('summary', { className: 'warnings__summary', text: previa.avisos.length + ' aviso(s) para conferência' }),
          h('ul', { className: 'warnings__list' }, previa.avisos.slice(0, LIMITE_AVISOS_EXIBIDOS).map(function (a) {
            return h('li', { className: 'warnings__item', text: 'Linha ' + a.linha + ': ' + a.mensagem });
          })),
          previa.avisos.length > LIMITE_AVISOS_EXIBIDOS
            ? h('p', { className: 'warnings__more', text: '… e mais ' + (previa.avisos.length - LIMITE_AVISOS_EXIBIDOS) + ' aviso(s).' })
            : null
        ])
      : null;

    return h('section', { className: 'panel', testid: 'previa-importacao', attrs: { 'aria-labelledby': 'titulo-previa' } }, [
      h('h3', { className: 'panel__title', text: 'Prévia da importação', attrs: { id: 'titulo-previa' } }),
      h('dl', { className: 'summary-list' }, itensResumo.map(function (par) {
        return h('div', { className: 'summary-list__item' }, [
          h('dt', { className: 'summary-list__term', text: par[0] }),
          h('dd', { className: 'summary-list__value', text: par[1] })
        ]);
      })),
      erros,
      avisos,
      previa.valida ? avisoSubstituicao : null,
      h('div', { className: 'form-actions' }, [
        previa.valida ? c.botao('Confirmar e gravar', 'btn-confirmar-importacao', aoConfirmar) : null,
        c.botao('Cancelar', 'btn-cancelar-importacao', aoCancelar, 'secondary')
      ])
    ]);
  }

  /** Tabela de histórico de importações. */
  function blocoHistorico(lista) {
    return h('section', { className: 'panel' }, [
      h('h3', { className: 'panel__title', text: 'Histórico de importações' }),
      c.tabela({
        colunas: [{ titulo: 'Data/hora' }, { titulo: 'Tipo' }, { titulo: 'Exercício(s)' }, { titulo: 'Arquivo' }, { titulo: 'Registros', numerica: true }, { titulo: 'Avisos', numerica: true }, { titulo: 'Situação' }],
        linhas: lista.map(function (imp) {
          return [
            new Date(imp.dataHora).toLocaleString('pt-BR'),
            imp.tipo === 'despesas' ? 'Despesas' : 'Receitas',
            (imp.anos || [imp.exercicio]).join(', '),
            imp.arquivo,
            String(imp.totalRegistros),
            String(imp.totalAvisos),
            imp.status === 'ativa' ? c.selo('Ativa', 'ok') : c.selo('Substituída', 'neutro')
          ];
        }),
        legenda: 'Histórico de importações',
        testid: 'tabela-historico-importacoes',
        vazio: 'Nenhuma importação realizada.'
      })
    ]);
  }

  function render(container) {
    var ctrl = {
      tipo: c.select([
        { valor: 'despesas', rotulo: importador.TIPOS.despesas.rotulo },
        { valor: 'receitas', rotulo: importador.TIPOS.receitas.rotulo }
      ], 'select-tipo-importacao', 'despesas'),
      arquivo: h('input', { className: 'input', testid: 'input-arquivo-importacao', attrs: { type: 'file', accept: '.csv,.xls,.xlsx', required: true } }),
      exercicio: h('input', { className: 'input', testid: 'input-exercicio-importacao', attrs: { type: 'number', min: 2000, max: 2100, step: 1, required: true, value: anoPadrao('despesas') } })
    };
    var botaoAnalisar = h('button', { className: 'btn btn--primary', text: 'Analisar arquivo', testid: 'btn-analisar-importacao', attrs: { type: 'submit' } });
    var alvoPrevia = h('div', { testid: 'area-previa' });
    var alvoHistorico = h('div');

    var campoExercicio = c.campo({ id: 'imp-exercicio', rotulo: 'Ano', controle: ctrl.exercicio, ajuda: ajudaAno('despesas') });

    ctrl.tipo.addEventListener('change', function () {
      document.getElementById('imp-exercicio-ajuda').textContent = ajudaAno(ctrl.tipo.value);
      ctrl.exercicio.value = anoPadrao(ctrl.tipo.value);
      c.definirErro(ctrl.exercicio, null);
      PO.core.dom.limpar(alvoPrevia);
    });

    function carregarHistorico() {
      return PO.data.repositorio.listarImportacoes().then(function (lista) {
        PO.core.dom.limpar(alvoHistorico);
        alvoHistorico.appendChild(blocoHistorico(lista));
      });
    }

    function aoEnviar(evento) {
      evento.preventDefault();
      var entrada = {
        tipo: ctrl.tipo.value,
        arquivo: ctrl.arquivo.files[0] || null,
        exercicio: Number(ctrl.exercicio.value)
      };
      var erros = importador.validarEntrada(entrada);
      c.definirErro(ctrl.tipo, erros.tipo || null);
      c.definirErro(ctrl.arquivo, erros.arquivo || null);
      c.definirErro(ctrl.exercicio, erros.exercicio || null);
      if (Object.keys(erros).length) {
        var primeiro = erros.tipo ? ctrl.tipo : erros.arquivo ? ctrl.arquivo : ctrl.exercicio;
        primeiro.focus();
        return;
      }

      botaoAnalisar.disabled = true;
      botaoAnalisar.textContent = 'Analisando…';
      PO.core.dom.limpar(alvoPrevia);

      importador.analisar(entrada)
        .then(function (previa) {
          // Despesas: verifica se o lote que será substituído tem ajustes manuais.
          var consulta = previa.tipo === 'despesas'
            ? PO.data.repositorio.obterAjustesDoLoteAtivo(previa.exercicio)
            : Promise.resolve(null);
          return consulta.then(function (substituicao) {
            return { previa: previa, substituicao: substituicao };
          });
        })
        .then(function (res) {
          var aviso = blocoAjustesSubstituidos(res.substituicao);
          alvoPrevia.appendChild(blocoPrevia(res.previa, function () {
            confirmar(res.previa, aviso.reaplicar() ? res.substituicao.lote : null);
          }, function () {
            PO.core.dom.limpar(alvoPrevia);
          }, aviso.elemento));
          alvoPrevia.querySelector('.panel__title').setAttribute('tabindex', '-1');
          alvoPrevia.querySelector('.panel__title').focus();
        })
        .catch(function (erro) {
          c.definirErro(ctrl.arquivo, erro.message);
          notificador.erro('Falha ao ler o arquivo: ' + erro.message);
        })
        .then(function () {
          botaoAnalisar.disabled = false;
          botaoAnalisar.textContent = 'Analisar arquivo';
        });
    }

    /**
     * Grava a prévia; se `loteReaplicar` for informado, reaplica no lote novo
     * as inclusões manuais vigentes daquele lote anterior.
     */
    function confirmar(previa, loteReaplicar) {
      var botao = alvoPrevia.querySelector('[data-testid="btn-confirmar-importacao"]');
      if (botao) {
        botao.disabled = true;
      }
      importador.confirmar(previa)
        .then(function (imp) {
          notificador.sucesso('Importação gravada: ' + imp.totalRegistros + ' registros (' + imp.arquivo + ').');
          if (loteReaplicar) {
            // Falha aqui não desfaz a importação (já gravada): só avisa.
            return PO.data.repositorio.reaplicarInclusoes(loteReaplicar.id, imp.exercicio)
              .then(function (gravados) {
                notificador.sucesso(gravados.length + ' inclusão(ões) manual(is) reaplicada(s) no novo lote.');
              })
              .catch(function (erro) {
                notificador.erro('Importação gravada, mas falhou a reaplicação das inclusões manuais: ' + erro.message);
              })
              .then(function () { return imp; });
          }
          return imp;
        })
        .then(function () {
          PO.core.dom.limpar(alvoPrevia);
          form.reset();
          ctrl.exercicio.value = anoPadrao(ctrl.tipo.value);
          document.getElementById('imp-exercicio-ajuda').textContent = ajudaAno(ctrl.tipo.value);
          return carregarHistorico();
        })
        .catch(function (erro) {
          notificador.erro('Falha ao gravar: ' + erro.message);
          if (botao) {
            botao.disabled = false;
          }
        });
    }

    var form = h('form', { className: 'form', testid: 'form-importacao', attrs: { novalidate: true, 'aria-label': 'Importar planilha' }, on: { submit: aoEnviar } }, [
      c.campo({ id: 'imp-tipo', rotulo: 'Tipo de dado', controle: ctrl.tipo }),
      c.campo({ id: 'imp-arquivo', rotulo: 'Arquivo (.csv, .xls, .xlsx)', controle: ctrl.arquivo, ajuda: 'Os dados ficam somente neste navegador. Uma nova importação do mesmo tipo e ano substitui a anterior (que permanece no histórico).' }),
      campoExercicio,
      h('div', { className: 'form-actions' }, botaoAnalisar)
    ]);

    PO.core.dom.anexar(container, [
      c.cabecalhoPagina('Importar planilhas', 'Carregue o cronograma de despesas e o arquivo de receitas do Fiorilli.'),
      h('section', { className: 'panel' }, form),
      alvoPrevia,
      alvoHistorico
    ]);
    return carregarHistorico();
  }

  PO.ui.views.importar = Object.freeze({ render: render });
})(window.PO);
