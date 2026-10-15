// JAVASCRIPT
/**
 * @file base-excel.js (view)
 * @description Módulo "Base Excel" (#/base-excel): gera a base de dados em
 * planilha (.xlsx) com as dotações efetivas do exercício — inclusive as
 * modificações feitas no sistema (inclusões, alterações, anulações) — no
 * mesmo layout do "Cronograma de Orçamento".
 *
 * Gravação:
 *   - Chrome/Edge (File System Access API): "Gerar base Excel" pede ONDE salvar
 *     e mantém o arquivo VINCULADO nesta sessão; "Salvar modificações na base"
 *     sobrescreve o mesmo arquivo, sem nova pergunta.
 *   - Demais navegadores: o arquivo é baixado (pasta Downloads).
 * O registro da última gravação (nome, data, nº de ajustes) fica no
 * localStorage apenas como lembrete — a fonte da verdade é o IndexedDB.
 */
(function (PO) {
  'use strict';

  var h = PO.core.dom.h;
  var c = PO.ui.componentes;
  var notificador = PO.ui.notificador;
  var CHAVE_REGISTRO = 'po.baseExcel.ultimaGravacao';
  var TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  /** Arquivos vinculados nesta sessão: exercício → FileSystemFileHandle. */
  var vinculos = new Map();

  /** true quando o navegador permite escolher e regravar um arquivo local. */
  function suportaVinculo() {
    return typeof window.showSaveFilePicker === 'function';
  }

  /** Lê o lembrete da última gravação (tolerante a storage bloqueado). */
  function lerRegistro(exercicio) {
    try {
      var tudo = JSON.parse(window.localStorage.getItem(CHAVE_REGISTRO) || '{}');
      return tudo[exercicio] || null;
    } catch (e) {
      return null;
    }
  }

  function gravarRegistro(exercicio, registro) {
    try {
      var tudo = JSON.parse(window.localStorage.getItem(CHAVE_REGISTRO) || '{}');
      tudo[exercicio] = registro;
      window.localStorage.setItem(CHAVE_REGISTRO, JSON.stringify(tudo));
    } catch (e) {
      // Sem storage: só perde o lembrete; a base foi gravada normalmente.
    }
  }

  /** Carrega dotações efetivas, ajustes e trilha do exercício. */
  function carregarDados(exercicio) {
    return PO.data.repositorio.listarDespesas(exercicio).then(function (res) {
      if (!res.lote) {
        return null;
      }
      return {
        exercicio: exercicio,
        lote: res.lote,
        registros: res.registros,
        ajustes: res.ajustes,
        historico: PO.domain.ajustesDespesa.historico(res.base, res.ajustes)
      };
    });
  }

  /** Serializa a base em .xlsx (ArrayBuffer). */
  function gerarBinario(dados) {
    return PO.core.vendor.carregarXlsx().then(function (XLSX) {
      var pasta = PO.data.baseExcel.gerarPasta(XLSX, dados);
      return XLSX.write(pasta, { bookType: 'xlsx', type: 'array' });
    });
  }

  /** Grava o binário num arquivo vinculado (File System Access API). */
  function gravarNoVinculo(handle, binario) {
    return handle.createWritable().then(function (escrita) {
      return escrita.write(binario).then(function () { return escrita.close(); });
    });
  }

  /** Fallback: download direto. */
  function baixar(binario, nome) {
    var url = URL.createObjectURL(new Blob([binario], { type: TIPO_XLSX }));
    var a = h('a', { attrs: { href: url, download: nome } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** Pede ao usuário onde salvar a base e devolve o arquivo vinculado. */
  function escolherArquivo(exercicio) {
    return window.showSaveFilePicker({
      suggestedName: PO.data.baseExcel.nomeArquivo(exercicio),
      types: [{ description: 'Planilha Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
    });
  }

  /** Cartões de situação da base atual. */
  function blocoSituacao(dados) {
    var vi = PO.domain.valorInsuficiente.resumir(dados.registros);
    var total = PO.core.dinheiro.somar(dados.registros.map(function (r) { return r.totalCentavos; }));
    return h('div', { className: 'kpi-grid', testid: 'kpis-base-excel' }, [
      c.cartaoKpi({ rotulo: 'Dotações', valor: String(dados.registros.length), detalhe: c.moeda(total), testid: 'kpi-base-dotacoes' }),
      c.cartaoKpi({ rotulo: 'Ajustes no sistema', valor: String(dados.ajustes.length), detalhe: 'inclusões, alterações e anulações', testid: 'kpi-base-ajustes' }),
      c.cartaoKpi({ rotulo: 'Valor insuficiente — Negativo', valor: String(vi.negativo), detalhe: 'falta ' + c.moeda(vi.faltaCentavos), variante: vi.negativo ? 'erro' : null, testid: 'kpi-base-negativo' }),
      c.cartaoKpi({ rotulo: 'Atende / Positivo', valor: vi.atende + ' / ' + vi.positivo, testid: 'kpi-base-atende-positivo' })
    ]);
  }

  /** Texto de estado da última gravação + alerta de ajustes ainda não salvos. */
  function textoUltimaGravacao(dados) {
    var reg = lerRegistro(dados.exercicio);
    if (!reg) {
      return h('p', { className: 'report__hint', testid: 'txt-base-excel-status', text: 'Nenhuma base gerada para ' + dados.exercicio + ' neste navegador.' });
    }
    var pendente = reg.loteId !== dados.lote.id || reg.totalAjustes !== dados.ajustes.length;
    return h('div', { testid: 'txt-base-excel-status' }, [
      h('p', { className: 'report__hint', text: 'Última gravação: ' + reg.arquivo + ' em ' + new Date(reg.dataHora).toLocaleString('pt-BR') +
        (reg.modo === 'vinculo' ? ' (arquivo vinculado).' : ' (download).') }),
      pendente
        ? h('div', { className: 'alert alert--warning', testid: 'aviso-base-desatualizada', attrs: { role: 'status' } },
            h('p', { text: 'Há modificações no sistema que ainda não estão na base Excel. Salve novamente para atualizá-la.' }))
        : null
    ]);
  }

  function render(container) {
    var exercicio = PO.core.estado.getExercicio();
    var cabecalho = c.cabecalhoPagina('Base Excel', 'Base de dados em planilha (.xlsx) com as dotações de ' + exercicio + ' e as modificações feitas no sistema.');

    return carregarDados(exercicio).then(function (dados) {
      if (!dados) {
        PO.core.dom.anexar(container, [cabecalho, c.estadoVazio('Não há cronograma de despesas importado para ' + exercicio + '.', 'base-excel-vazia')]);
        return;
      }

      var alvoStatus = h('div');
      var alvoVinculo = h('p', { className: 'report__hint', testid: 'txt-base-excel-vinculo', attrs: { 'aria-live': 'polite' } });
      var botaoGerar = c.botao('Gerar base Excel', 'btn-gerar-base-excel', function () { gerar(true); });
      var botaoSalvar = c.botao('Salvar modificações na base', 'btn-salvar-base-excel', function () { gerar(false); }, 'secondary');

      function atualizarEstado() {
        var handle = vinculos.get(exercicio);
        botaoSalvar.hidden = !handle;
        alvoVinculo.textContent = handle
          ? 'Arquivo vinculado nesta sessão: ' + handle.name + '. "Salvar modificações na base" regrava este arquivo.'
          : suportaVinculo()
            ? 'Ao gerar, escolha onde salvar a base; o arquivo fica vinculado e pode ser regravado após novas modificações.'
            : 'Este navegador não permite regravar arquivos locais: a base será baixada para a pasta Downloads.';
        PO.core.dom.limpar(alvoStatus);
        alvoStatus.appendChild(textoUltimaGravacao(dados));
      }

      /**
       * Gera e grava a base. `escolher`=true pede o local (nova base);
       * false regrava o arquivo já vinculado.
       */
      function gerar(escolher) {
        var nomePadrao = PO.data.baseExcel.nomeArquivo(exercicio);
        var destino = !escolher && vinculos.get(exercicio)
          ? Promise.resolve(vinculos.get(exercicio))
          : suportaVinculo() ? escolherArquivo(exercicio) : Promise.resolve(null);

        botaoGerar.disabled = true;
        botaoSalvar.disabled = true;
        destino
          .then(function (handle) {
            // Recarrega do banco: garante que ajustes feitos em outra tela entrem na base.
            return carregarDados(exercicio).then(function (atual) {
              dados = atual;
              dados.geradaEm = new Date().toISOString();
              return gerarBinario(dados).then(function (binario) {
                if (handle) {
                  return gravarNoVinculo(handle, binario).then(function () {
                    vinculos.set(exercicio, handle);
                    return { arquivo: handle.name, modo: 'vinculo' };
                  });
                }
                baixar(binario, nomePadrao);
                return { arquivo: nomePadrao, modo: 'download' };
              });
            });
          })
          .then(function (res) {
            gravarRegistro(exercicio, { arquivo: res.arquivo, modo: res.modo, dataHora: dados.geradaEm, loteId: dados.lote.id, totalAjustes: dados.ajustes.length });
            notificador.sucesso('Base Excel gravada: ' + res.arquivo + ' (' + dados.registros.length + ' dotações).');
            PO.core.dom.limpar(alvoKpis);
            alvoKpis.appendChild(blocoSituacao(dados));
          })
          .catch(function (erro) {
            if (erro && erro.name === 'AbortError') {
              return; // usuário cancelou a escolha do arquivo
            }
            if (erro && erro.name === 'NotAllowedError') {
              vinculos.delete(exercicio);
              notificador.erro('Sem permissão para gravar no arquivo vinculado. Use "Gerar base Excel" para escolhê-lo novamente.');
              return;
            }
            notificador.erro('Falha ao gerar a base Excel: ' + (erro && erro.message ? erro.message : erro));
          })
          .then(function () {
            botaoGerar.disabled = false;
            botaoSalvar.disabled = false;
            atualizarEstado();
          });
      }

      var alvoKpis = h('div', null, blocoSituacao(dados));

      PO.core.dom.anexar(container, [
        cabecalho,
        h('section', { className: 'panel', testid: 'painel-base-excel' }, [
          h('h3', { className: 'panel__title', text: 'Situação do exercício ' + exercicio }),
          h('p', { className: 'report__hint', text: 'Origem: ' + dados.lote.arquivo + ' (importado em ' + new Date(dados.lote.dataHora).toLocaleString('pt-BR') + ') + ajustes registrados no sistema.' }),
          alvoKpis
        ]),
        h('section', { className: 'panel' }, [
          h('h3', { className: 'panel__title', text: 'Gerar base' }),
          h('ul', { className: 'alert__list' }, [
            h('li', { text: 'Aba "Cronograma": mesmas colunas da planilha Despesas (Cronograma de Orçamento) — A a T, com a coluna H "valor insuficiente" calculada (=G − SOMA(I:T)).' }),
            h('li', { text: 'Aba "Ajustes": trilha de auditoria das modificações (nº, data/hora, operação, valores antes/depois, motivo).' }),
            h('li', { text: 'Aba "Informações": exercício, arquivo de origem, data da geração e totais.' }),
            h('li', { text: 'Para restaurar a base em outro navegador ou computador, importe o arquivo em Importar planilhas → Despesas.' })
          ]),
          alvoVinculo,
          h('div', { className: 'form-actions' }, [botaoGerar, botaoSalvar]),
          alvoStatus
        ])
      ]);
      atualizarEstado();
    });
  }

  PO.ui.views.baseExcel = Object.freeze({ render: render });
})(window.PO);
