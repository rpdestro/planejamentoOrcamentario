// JAVASCRIPT
/**
 * @file relatorios.js
 * @description View "Relatórios Gerenciais de Projeção": projeção da despesa
 * × período, agrupada por órgão, função, GND, fonte etc., pronta para impressão.
 * A montagem fica em PO.ui.relatorioProjecao (reutilizada nas Secretarias).
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;

  function render(container) {
    var exercicio = PO.core.estado.getExercicio();

    return PO.data.repositorio.listarDespesas(exercicio).then(function (res) {
      var despesas = res.registros;

      container.appendChild(c.cabecalhoPagina(
        'Relatórios Gerenciais de Projeção',
        'Projeção da despesa fixada por período — exercício ' + exercicio + '.'
      ));

      if (!despesas.length) {
        container.appendChild(c.estadoVazio('Sem despesas importadas para ' + exercicio + '.', 'relatorio-vazio'));
        return;
      }

      var relatorio = PO.ui.relatorioProjecao.criar({
        obterDespesas: function () { return despesas; },
        titulo: 'Projeção da despesa — Prefeitura Municipal de Botucatu',
        exercicio: exercicio,
        agrupamentos: ['orgao', 'funcao', 'categoria', 'gnd', 'fonte'],
        agrupamentoPadrao: 'orgao',
        periodoPadrao: 'bimestral',
        prefixoTestid: 'relatorio-projecao'
      });
      container.appendChild(h('section', { className: 'panel' }, relatorio.elemento));
    });
  }

  PO.ui.views.relatorios = Object.freeze({ render: render });
})(window.PO);
