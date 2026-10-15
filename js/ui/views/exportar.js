// JAVASCRIPT
/**
 * @file exportar.js
 * @description View "Exportar": gera .xlsx, .xls ou .csv das despesas
 * (com diluição no período escolhido) ou das receitas do exercício.
 *
 * CSV é gerado sem dependências (";" + vírgula decimal + BOM UTF-8, abre
 * corretamente no Excel em português). XLS/XLSX usam SheetJS.
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var dinheiro = PO.core.dinheiro;
  var periodos = PO.domain.periodos;

  /**
   * Monta a matriz (array de arrays) de despesas. `valorCelula` define como
   * centavos viram célula (número p/ Excel, texto p/ CSV).
   */
  function matrizDespesas(despesas, chavePeriodo, uo, valorCelula) {
    var lista = uo ? despesas.filter(function (d) { return d.uo === uo; }) : despesas;
    var cabecalho = ['Unidade Orçamentária', 'Unidade Executora', 'Funcional', 'Natureza de Despesa', 'Descrição', 'Fonte', 'Valor Total', 'Diluída']
      .concat(periodos.rotulos(chavePeriodo));
    var linhas = lista.map(function (d) {
      return [d.uo, d.ue, d.funcional, d.natureza, d.descricao, d.fonte, valorCelula(d.totalCentavos), d.diluida ? 'Sim' : 'Não (projeção 1/12)']
        .concat(periodos.agregar(periodos.mesesEfetivos(d), chavePeriodo).map(valorCelula));
    });
    return [cabecalho].concat(linhas);
  }

  /** Matriz de receitas do exercício. */
  function matrizReceitas(receitas, exercicio, valorCelula) {
    var cabecalho = ['Código', 'Descrição', 'Categoria', 'Analítica', 'Previsto ' + exercicio];
    return [cabecalho].concat(receitas.map(function (r) {
      return [r.codigo, r.nome, r.categoria, r.analitica ? 'Sim' : 'Não', valorCelula(r.valoresCentavos[exercicio] || 0)];
    }));
  }

  /** Serializa matriz em CSV (;), escapando aspas e separadores. */
  function paraCsv(matriz) {
    return '﻿' + matriz.map(function (linha) {
      return linha.map(function (v) {
        var s = String(v === null || v === undefined ? '' : v);
        return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
  }

  /** Dispara o download de um Blob. */
  function baixar(blob, nome) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { attrs: { href: url, download: nome } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function render(container) {
    var exercicio = PO.core.estado.getExercicio();
    var orgaos = PO.core.config.orgaos;

    var ctrl = {
      conjunto: c.select([{ valor: 'despesas', rotulo: 'Despesas (dotações)' }, { valor: 'receitas', rotulo: 'Receitas (previsão)' }], 'select-export-conjunto', 'despesas'),
      orgao: c.select([{ valor: '', rotulo: 'Todos os órgãos' }].concat(orgaos.map(function (o) {
        return { valor: o.codigo, rotulo: o.codigo + ' — ' + o.nome };
      })), 'select-export-orgao'),
      periodo: c.selectPeriodo('select-export-periodo', 'mensal'),
      formato: c.select([{ valor: 'xlsx', rotulo: 'Excel (.xlsx)' }, { valor: 'xls', rotulo: 'Excel 97-2003 (.xls)' }, { valor: 'csv', rotulo: 'CSV (;)' }], 'select-export-formato', 'xlsx')
    };
    var botao = h('button', { className: 'btn btn--primary', text: 'Gerar arquivo', testid: 'btn-exportar', attrs: { type: 'submit' } });

    function sincronizarCampos() {
      var ehDespesa = ctrl.conjunto.value === 'despesas';
      ctrl.orgao.disabled = !ehDespesa;
      ctrl.periodo.disabled = !ehDespesa;
    }
    ctrl.conjunto.addEventListener('change', sincronizarCampos);

    function aoEnviar(evento) {
      evento.preventDefault();
      var conjunto = ctrl.conjunto.value;
      var formato = ctrl.formato.value;
      var csv = formato === 'csv';
      var valorCelula = csv ? dinheiro.paraTextoCsv : dinheiro.paraDecimal;
      var carregar = conjunto === 'despesas' ? PO.data.repositorio.listarDespesas(exercicio) : PO.data.repositorio.listarReceitas(exercicio);

      botao.disabled = true;
      carregar
        .then(function (res) {
          if (!res.registros.length) {
            throw new Error('Não há ' + conjunto + ' importadas para ' + exercicio + '.');
          }
          var matriz = conjunto === 'despesas'
            ? matrizDespesas(res.registros, ctrl.periodo.value, ctrl.orgao.value, valorCelula)
            : matrizReceitas(res.registros, exercicio, valorCelula);
          if (matriz.length === 1) {
            throw new Error('Nenhum registro para o órgão selecionado.');
          }
          var nome = conjunto + '_' + exercicio + (ctrl.orgao.value && conjunto === 'despesas' ? '_' + ctrl.orgao.value : '') + '.' + formato;

          if (csv) {
            baixar(new Blob([paraCsv(matriz)], { type: 'text/csv;charset=utf-8' }), nome);
            return nome;
          }
          return PO.core.vendor.carregarXlsx().then(function (XLSX) {
            var pasta = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(pasta, XLSX.utils.aoa_to_sheet(matriz), conjunto === 'despesas' ? 'Despesas' : 'Receitas');
            XLSX.writeFile(pasta, nome, { bookType: formato });
            return nome;
          });
        })
        .then(function (nome) {
          PO.ui.notificador.sucesso('Arquivo gerado: ' + nome);
        })
        .catch(function (erro) {
          PO.ui.notificador.erro(erro.message);
        })
        .then(function () {
          botao.disabled = false;
        });
    }

    PO.core.dom.anexar(container, [
      c.cabecalhoPagina('Exportar', 'Gere arquivos .xlsx, .xls ou .csv do exercício ' + exercicio + '.'),
      h('section', { className: 'panel' }, h('form', { className: 'form', testid: 'form-exportar', attrs: { novalidate: true }, on: { submit: aoEnviar } }, [
        c.campo({ id: 'exp-conjunto', rotulo: 'Conjunto de dados', controle: ctrl.conjunto }),
        c.campo({ id: 'exp-orgao', rotulo: 'Órgão', controle: ctrl.orgao }),
        c.campo({ id: 'exp-periodo', rotulo: 'Diluição por período', controle: ctrl.periodo }),
        c.campo({ id: 'exp-formato', rotulo: 'Formato', controle: ctrl.formato }),
        h('div', { className: 'form-actions' }, botao)
      ]))
    ]);
    sincronizarCampos();
  }

  PO.ui.views.exportar = Object.freeze({ render: render, paraCsv: paraCsv });
})(window.PO);
