// JAVASCRIPT
/**
 * @file app.js
 * @description Bootstrap da aplicação: abre o banco local, monta navegação,
 * seletor de exercício e roteador, e conecta os eventos globais.
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;

  /** Preenche o seletor de exercício com os anos conhecidos. */
  function preencherExercicios(select) {
    return PO.data.repositorio.listarExercicios().then(function (anos) {
      var atual = PO.core.estado.getExercicio();
      if (anos.indexOf(atual) === -1) {
        anos.push(atual);
        anos.sort();
      }
      PO.core.dom.limpar(select);
      anos.forEach(function (ano) {
        select.appendChild(h('option', { text: String(ano), attrs: { value: ano, selected: ano === atual } }));
      });
    });
  }

  /**
   * Diálogo "Novo exercício": cadastra qualquer ano na faixa configurada
   * (sem o antigo teto implícito de 2029) e já o seleciona.
   * @param {HTMLSelectElement} seletor
   */
  function abrirNovoExercicio(seletor) {
    var c = PO.ui.componentes;
    var cfg = PO.core.config;
    var anos = Array.prototype.map.call(seletor.options, function (o) { return Number(o.value); });
    var sugestao = (anos.length ? Math.max.apply(null, anos) : cfg.exercicioPadrao) + 1;
    var campoAno = h('input', { className: 'input', testid: 'input-novo-exercicio', attrs: { type: 'number', min: cfg.exercicioMinimo, max: cfg.exercicioMaximo, step: 1, value: sugestao, required: true } });
    var botao = h('button', { className: 'btn btn--primary', text: 'Cadastrar', testid: 'btn-novo-exercicio-salvar', attrs: { type: 'submit', form: 'form-novo-exercicio' } });

    var form = h('form', { className: 'form form--dialog', testid: 'form-novo-exercicio', attrs: { id: 'form-novo-exercicio', novalidate: true }, on: { submit: salvar } },
      c.campo({ id: 'novo-exercicio-ano', rotulo: 'Ano do exercício', controle: campoAno, ajuda: 'Entre ' + cfg.exercicioMinimo + ' e ' + cfg.exercicioMaximo + '. Depois importe as planilhas do novo exercício.' }));

    var janela = c.dialogo({
      titulo: 'Novo exercício', testid: 'dialogo-novo-exercicio', conteudo: form,
      acoes: [botao, c.botao('Cancelar', 'btn-novo-exercicio-cancelar', function () { janela.fechar(); }, 'secondary')]
    });

    function salvar(evento) {
      evento.preventDefault();
      var ano = Number(campoAno.value);
      var erro = !Number.isInteger(ano) || ano < cfg.exercicioMinimo || ano > cfg.exercicioMaximo
        ? 'Informe um ano inteiro entre ' + cfg.exercicioMinimo + ' e ' + cfg.exercicioMaximo + '.'
        : anos.indexOf(ano) !== -1 ? 'O exercício ' + ano + ' já está cadastrado.' : null;
      c.definirErro(campoAno, erro);
      if (erro) {
        campoAno.focus();
        return;
      }
      botao.disabled = true;
      PO.data.repositorio.cadastrarExercicio(ano)
        .then(function () { return preencherExercicios(seletor); })
        .then(function () {
          janela.fechar();
          PO.core.estado.setExercicio(ano);
          seletor.value = String(ano);
          PO.ui.notificador.sucesso('Exercício ' + ano + ' cadastrado.');
        })
        .catch(function (e) {
          botao.disabled = false;
          c.definirErro(campoAno, e.message);
        });
    }

    janela.abrir();
    campoAno.focus();
  }

  /** Exibe falha fatal de inicialização na área principal. */
  function falhaFatal(erro) {
    console.error('[app] Falha na inicialização:', erro);
    var main = document.getElementById('conteudo');
    PO.core.dom.limpar(main);
    main.appendChild(h('section', { className: 'alert alert--error', attrs: { role: 'alert' }, testid: 'erro-inicializacao' }, [
      h('h2', { className: 'alert__title', text: 'Não foi possível iniciar a aplicação.' }),
      h('p', { text: erro && erro.message ? erro.message : String(erro) })
    ]));
  }

  function iniciar() {
    var nav = document.getElementById('navegacao');
    var main = document.getElementById('conteudo');
    var seletor = document.getElementById('seletor-exercicio');

    document.getElementById('versao-app').textContent = 'v' + PO.versao;
    PO.ui.tema.ligarBotao(document.getElementById('btn-modo-escuro'));

    PO.ui.navegacao.renderizar(nav);
    PO.ui.navegacao.ligarMenuMovel(document.querySelector('.app-header__menu-toggle'), nav);

    var rotas = {
      painel: PO.ui.views.painel,
      graficos: PO.ui.views.graficos,
      secretaria: PO.ui.views.secretaria,
      receitas: PO.ui.views.receitas,
      importar: PO.ui.views.importar,
      relatorios: PO.ui.views.relatorios,
      exportar: PO.ui.views.exportar,
      'base-excel': PO.ui.views.baseExcel
    };
    Object.keys(rotas).forEach(function (nome) {
      PO.ui.roteador.registrar(nome, rotas[nome]);
    });

    PO.core.eventos.on('rota:alterada', function () {
      PO.ui.navegacao.marcarAtivo(nav);
      main.focus({ preventScroll: true });
    });

    seletor.addEventListener('change', function () {
      PO.core.estado.setExercicio(Number(seletor.value));
    });
    document.getElementById('btn-novo-exercicio').addEventListener('click', function () {
      abrirNovoExercicio(seletor);
    });
    PO.core.eventos.on('exercicio:alterado', PO.ui.roteador.recarregar);
    PO.core.eventos.on('dados:atualizados', function () {
      preencherExercicios(seletor);
    });

    PO.data.db.abrir()
      .then(function () {
        return preencherExercicios(seletor);
      })
      .then(function () {
        PO.ui.roteador.iniciar(main);
      })
      .catch(falhaFatal);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window.PO);
