// JAVASCRIPT
/**
 * @file formulario-dotacao.js
 * @description Diálogos de "Adicionar", "Alterar" e "Excluir" (anular) dotação.
 * Validação em PO.domain.ajustesDespesa; gravação em PO.data.repositorio
 * como AJUSTE auditável (o lote importado nunca é modificado).
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var dinheiro = PO.core.dinheiro;
  var ajustes = PO.domain.ajustesDespesa;
  var MESES = PO.domain.periodos.MESES;

  /** Centavos → texto editável "1234,56" (vazio para null). */
  function paraCampo(centavos) {
    return centavos === null || centavos === undefined ? '' : dinheiro.formatar(centavos, { simbolo: false });
  }

  function input(testid, valor, extras) {
    return h('input', { className: 'input', testid: testid, attrs: Object.assign({ type: 'text', autocomplete: 'off', value: valor || '' }, extras || {}) });
  }

  /** <datalist> de sugestões (o campo continua livre). */
  function sugestoes(id, valores) {
    return h('datalist', { attrs: { id: id } }, valores.map(function (v) {
      return h('option', { attrs: { value: v.valor, label: v.rotulo || null } });
    }));
  }

  /**
   * Abre o formulário de inclusão/alteração.
   * @param {{
   *   operacao: 'inclusao'|'alteracao',
   *   uo: string,
   *   exercicio: number,
   *   registro?: Object,               // obrigatório na alteração
   *   unidadesExecutoras: string[],    // sugestões de UE
   *   aoSalvar: function(Object):void  // recebe o ajuste gravado
   * }} p
   */
  function abrirFormulario(p) {
    var alteracao = p.operacao === ajustes.OPERACOES.alteracao;
    var r = p.registro || {};
    var meses = r.mesesCentavos || [];

    var ctrl = {
      ue: input('input-dotacao-ue', r.ue || (p.unidadesExecutoras.length === 1 ? p.unidadesExecutoras[0] : ''), { list: 'lista-dotacao-ue', placeholder: p.uo + '.01' }),
      funcional: input('input-dotacao-funcional', r.funcional, { placeholder: '12.361.0004.2010', inputmode: 'decimal' }),
      natureza: input('input-dotacao-natureza', r.natureza, { placeholder: '3.3.90.39', inputmode: 'decimal' }),
      descricao: input('input-dotacao-descricao', r.descricao, { maxlength: 200 }),
      fonte: input('input-dotacao-fonte', r.fonte, { list: 'lista-dotacao-fonte', placeholder: '1' }),
      total: input('input-dotacao-total', paraCampo(r.totalCentavos), { inputmode: 'decimal', placeholder: '0,00' }),
      motivo: h('textarea', { className: 'input input--textarea', testid: 'input-dotacao-motivo', attrs: { rows: 2, maxlength: 300 } })
    };
    var camposMes = MESES.map(function (mes, i) {
      return input('input-dotacao-mes-' + (i + 1), r.diluida ? paraCampo(meses[i]) : '', { inputmode: 'decimal', 'aria-label': mes, placeholder: '0,00' });
    });
    var erroMeses = h('p', { className: 'form-field__error', testid: 'erro-dotacao-meses', attrs: { id: 'dot-meses-erro', 'aria-live': 'polite' } });

    var fontes = PO.core.config.fontes;
    var listaFontes = Object.keys(fontes).map(function (k) { return { valor: k, rotulo: fontes[k] }; });

    /** Preenche os 12 meses com o total dividido igualmente (resíduo no último mês). */
    function distribuirIgualmente() {
      var total = dinheiro.paraCentavos(ctrl.total.value);
      if (total === null || total < 0) {
        c.definirErro(ctrl.total, 'Informe o valor total antes de distribuir.');
        ctrl.total.focus();
        return;
      }
      dinheiro.distribuir(total, 12).forEach(function (v, i) {
        camposMes[i].value = paraCampo(v);
      });
      erroMeses.textContent = '';
    }

    function limparMeses() {
      camposMes.forEach(function (campo) { campo.value = ''; });
      erroMeses.textContent = '';
    }

    var form = h('form', { className: 'form form--dialog', testid: 'form-dotacao', attrs: { novalidate: true }, on: { submit: salvar } }, [
      c.campo({ id: 'dot-ue', rotulo: 'Unidade Executora *', controle: ctrl.ue }),
      c.campo({ id: 'dot-funcional', rotulo: 'Funcional programática', controle: ctrl.funcional, ajuda: 'Função.Subfunção.Programa.Ação' }),
      c.campo({ id: 'dot-natureza', rotulo: 'Natureza de despesa *', controle: ctrl.natureza, ajuda: 'Categoria.GND.Modalidade.Elemento' }),
      c.campo({ id: 'dot-fonte', rotulo: 'Fonte de recurso *', controle: ctrl.fonte }),
      h('div', { className: 'form__wide' }, c.campo({ id: 'dot-descricao', rotulo: 'Descrição *', controle: ctrl.descricao })),
      c.campo({ id: 'dot-total', rotulo: 'Valor total do orçamento (R$) *', controle: ctrl.total }),
      h('fieldset', { className: 'month-grid form__wide', testid: 'grupo-dotacao-meses', attrs: { 'aria-describedby': 'dot-meses-erro' } }, [
        h('legend', { className: 'form-field__label', text: 'Cronograma mensal (opcional — em branco: projeção linear 1/12)' }),
        h('div', { className: 'month-grid__items' }, camposMes.map(function (campo, i) {
          return h('label', { className: 'month-grid__item' }, [h('span', { className: 'month-grid__label', text: MESES[i] }), campo]);
        })),
        h('div', { className: 'month-grid__actions' }, [
          c.botao('Distribuir igualmente', 'btn-dotacao-distribuir', distribuirIgualmente, 'secondary'),
          c.botao('Limpar meses', 'btn-dotacao-limpar-meses', limparMeses, 'secondary')
        ]),
        erroMeses
      ]),
      alteracao ? h('div', { className: 'form__wide' }, c.campo({ id: 'dot-motivo', rotulo: 'Motivo da alteração *', controle: ctrl.motivo, ajuda: 'Registrado na trilha de auditoria.' })) : null,
      sugestoes('lista-dotacao-ue', p.unidadesExecutoras.map(function (v) { return { valor: v }; })),
      sugestoes('lista-dotacao-fonte', listaFontes)
    ]);

    var botaoSalvar = h('button', { className: 'btn btn--primary', text: alteracao ? 'Salvar alteração' : 'Adicionar dotação', testid: 'btn-dotacao-salvar', attrs: { type: 'submit', form: 'form-dotacao' } });
    form.id = 'form-dotacao';

    var janela = c.dialogo({
      titulo: (alteracao ? 'Alterar dotação' : 'Adicionar dotação') + ' — UO ' + p.uo,
      testid: 'dialogo-dotacao',
      largura: 'lg',
      conteudo: [
        h('p', { className: 'dialog__note', text: alteracao
          ? 'A dotação importada é preservada; a alteração é registrada como ajuste auditável.'
          : 'A nova dotação fica vinculada à importação ativa de ' + p.exercicio + '.' }),
        form
      ],
      acoes: [botaoSalvar, c.botao('Cancelar', 'btn-dotacao-cancelar', function () { janela.fechar(); }, 'secondary')]
    });

    function salvar(evento) {
      evento.preventDefault();
      var resultado = ajustes.validar({
        ue: ctrl.ue.value, funcional: ctrl.funcional.value, natureza: ctrl.natureza.value,
        descricao: ctrl.descricao.value, fonte: ctrl.fonte.value, total: ctrl.total.value,
        meses: camposMes.map(function (campo) { return campo.value; }),
        motivo: ctrl.motivo.value
      }, p.operacao);

      ['ue', 'funcional', 'natureza', 'descricao', 'fonte', 'total'].concat(alteracao ? ['motivo'] : []).forEach(function (k) {
        c.definirErro(ctrl[k], resultado.erros[k] || null);
      });
      erroMeses.textContent = resultado.erros.meses || '';
      camposMes.forEach(function (campo) { campo.setAttribute('aria-invalid', resultado.erros.meses ? 'true' : 'false'); });

      if (!resultado.dados) {
        var primeiro = ['ue', 'funcional', 'natureza', 'fonte', 'descricao', 'total'].find(function (k) { return resultado.erros[k]; });
        (primeiro ? ctrl[primeiro] : resultado.erros.meses ? camposMes[0] : ctrl.motivo).focus();
        return;
      }

      botaoSalvar.disabled = true;
      PO.data.repositorio.registrarAjuste(p.exercicio, {
        operacao: p.operacao,
        uo: p.uo,
        alvo: alteracao ? r.chave : null,
        dados: resultado.dados,
        motivo: alteracao ? ctrl.motivo.value.trim() : 'Inclusão manual'
      }).then(function (ajuste) {
        janela.fechar();
        p.aoSalvar(ajuste);
      }).catch(function (erro) {
        botaoSalvar.disabled = false;
        PO.ui.notificador.erro('Falha ao salvar: ' + erro.message);
      });
    }

    janela.abrir();
    ctrl.ue.focus();
  }

  /**
   * Confirmação de exclusão = anulação formal (com motivo obrigatório).
   * @param {{registro:Object, uo:string, exercicio:number, aoConfirmar:function(Object):void}} p
   */
  function confirmarExclusao(p) {
    var r = p.registro;
    var motivo = h('textarea', { className: 'input input--textarea', testid: 'input-exclusao-motivo', attrs: { rows: 3, maxlength: 300 } });
    var botao = h('button', { className: 'btn btn--danger', text: 'Confirmar exclusão', testid: 'btn-exclusao-confirmar', attrs: { type: 'button' } });

    var janela = c.dialogo({
      titulo: 'Excluir dotação',
      testid: 'dialogo-exclusao',
      conteudo: [
        h('dl', { className: 'summary-list' }, [
          ['Natureza', r.natureza], ['Descrição', r.descricao], ['Fonte', r.fonte], ['Valor', c.moeda(r.totalCentavos)]
        ].map(function (par) {
          return h('div', { className: 'summary-list__item' }, [
            h('dt', { className: 'summary-list__term', text: par[0] }),
            h('dd', { className: 'summary-list__value', text: par[1] || '—' })
          ]);
        })),
        h('p', { className: 'dialog__note', text: 'Conforme a regra de imutabilidade, a dotação não é apagada: ela é ANULADA e deixa de compor os totais. O registro permanece na trilha de auditoria.' }),
        h('form', { className: 'form form--dialog', attrs: { novalidate: true }, on: { submit: function (e) { e.preventDefault(); confirmar(); } } },
          h('div', { className: 'form__wide' }, c.campo({ id: 'exc-motivo', rotulo: 'Motivo da exclusão *', controle: motivo })))
      ],
      acoes: [botao, c.botao('Cancelar', 'btn-exclusao-cancelar', function () { janela.fechar(); }, 'secondary')]
    });

    function confirmar() {
      var erro = ajustes.validarMotivo(motivo.value);
      c.definirErro(motivo, erro);
      if (erro) {
        motivo.focus();
        return;
      }
      botao.disabled = true;
      PO.data.repositorio.registrarAjuste(p.exercicio, {
        operacao: ajustes.OPERACOES.exclusao,
        uo: p.uo,
        alvo: r.chave,
        dados: null,
        motivo: motivo.value.trim()
      }).then(function (ajuste) {
        janela.fechar();
        p.aoConfirmar(ajuste);
      }).catch(function (e) {
        botao.disabled = false;
        PO.ui.notificador.erro('Falha ao excluir: ' + e.message);
      });
    }

    botao.addEventListener('click', confirmar);
    janela.abrir();
    motivo.focus();
  }

  PO.ui.formularioDotacao = Object.freeze({
    abrirFormulario: abrirFormulario,
    confirmarExclusao: confirmarExclusao
  });
})(window.PO);
