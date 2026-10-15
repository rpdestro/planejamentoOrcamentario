// JAVASCRIPT
/**
 * @file receitas.js
 * @description View "Receitas": árvore da natureza de receita (Fiorilli)
 * com filtros por categoria (corrente, capital, intraorçamentária,
 * deduções), busca textual e opção de exibir só linhas analíticas.
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var texto = PO.core.texto;

  function render(container) {
    var exercicio = PO.core.estado.getExercicio();

    return PO.data.repositorio.listarReceitas(exercicio).then(function (res) {
      var registros = res.registros;
      container.appendChild(c.cabecalhoPagina('Receitas — Exercício ' + exercicio, 'Previsão da receita por natureza (arquivo Fiorilli).'));

      if (!registros.length) {
        container.appendChild(c.estadoVazio('Nenhuma receita importada que cubra ' + exercicio + '.', 'receitas-vazio'));
        return;
      }

      var categorias = PO.core.config.categoriasReceita;
      var ctrl = {
        categoria: c.select([{ valor: '', rotulo: 'Todas' }].concat(Object.keys(categorias).map(function (d) {
          return { valor: categorias[d].chave, rotulo: categorias[d].rotulo };
        })), 'filtro-receita-categoria'),
        busca: h('input', { className: 'input', testid: 'filtro-receita-busca', attrs: { type: 'search', placeholder: 'Sigla, código ou descrição (ex.: IPTU, 1112.50)', autocomplete: 'off' } }),
        analiticas: h('input', { testid: 'chk-receita-analiticas', attrs: { type: 'checkbox' } })
      };

      var alvo = h('div', { className: 'panel__body' });

      function atualizar() {
        var termo = texto.normalizar(ctrl.busca.value);
        // Sigla conhecida (IPTU, ISS…) vira busca por prefixo de código.
        var prefixoSigla = PO.core.config.siglasReceita[termo] || null;
        var filtrados = registros.filter(function (r) {
          return (!ctrl.categoria.value || r.categoria === ctrl.categoria.value) &&
            (!ctrl.analiticas.checked || r.analitica) &&
            (!termo ||
              (prefixoSigla && r.codigo.indexOf(prefixoSigla) === 0) ||
              r.codigo.indexOf(termo) === 0 ||
              texto.normalizar(r.nome).indexOf(termo) !== -1);
        });

        PO.core.dom.limpar(alvo);
        alvo.appendChild(c.tabela({
          colunas: [{ titulo: 'Código' }, { titulo: 'Descrição' }, { titulo: 'Tipo' }, { titulo: 'Previsto ' + exercicio, numerica: true }],
          linhas: filtrados.map(function (r) {
            var nome = h('span', {
              className: 'tree-label tree-label--level-' + Math.min(r.nivel, 10) + (r.analitica ? '' : ' tree-label--synthetic'),
              text: r.nome
            });
            return [r.codigo, nome, r.analitica ? 'Analítica' : 'Sintética', c.moeda(r.valoresCentavos[exercicio] || 0)];
          }),
          legenda: 'Previsão da receita',
          testid: 'tabela-receitas'
        }));
      }

      ctrl.categoria.addEventListener('change', atualizar);
      ctrl.busca.addEventListener('input', atualizar);
      ctrl.analiticas.addEventListener('change', atualizar);

      PO.core.dom.anexar(container, [
        h('section', { className: 'panel' }, h('form', { className: 'filters', testid: 'form-filtros-receitas', attrs: { novalidate: true }, on: { submit: function (e) { e.preventDefault(); } } }, [
          c.campo({ id: 'f-rec-categoria', rotulo: 'Categoria', controle: ctrl.categoria }),
          c.campo({ id: 'f-rec-busca', rotulo: 'Buscar', controle: ctrl.busca }),
          h('label', { className: 'checkbox' }, [
            ctrl.analiticas,
            h('span', { text: 'Somente analíticas' })
          ])
        ])),
        h('section', { className: 'panel' }, alvo)
      ]);
      atualizar();
    });
  }

  PO.ui.views.receitas = Object.freeze({ render: render });
})(window.PO);
