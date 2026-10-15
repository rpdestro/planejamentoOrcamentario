// JAVASCRIPT
/**
 * @file importador.js
 * @description Orquestra a importação em duas etapas:
 *   1) analisar(): lê o arquivo, valida e mapeia → prévia (nada é gravado);
 *   2) confirmar(): grava a prévia como um novo lote no IndexedDB.
 *
 * Separar as etapas permite ao usuário revisar avisos antes de gravar e
 * facilita testes automatizados (a análise é pura, sem efeitos colaterais).
 */
(function (PO) {
  'use strict';

  var TIPOS = Object.freeze({
    despesas: Object.freeze({ chave: 'despesas', rotulo: 'Despesas (Cronograma de Orçamento)' }),
    receitas: Object.freeze({ chave: 'receitas', rotulo: 'Receitas (Fiorilli — Fontes de Financiamento)' })
  });

  /** Gera um id de lote legível e único: "desp-20261014T153012-ab12". */
  function gerarIdLote(tipo) {
    var carimbo = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    var aleatorio = Math.random().toString(36).slice(2, 6);
    return tipo.slice(0, 4) + '-' + carimbo + '-' + aleatorio;
  }

  /**
   * Validações de entrada do formulário (antes de ler o arquivo).
   * @returns {Object<string,string>} mapa campo → mensagem de erro
   */
  function validarEntrada(entrada) {
    var erros = {};
    var cfg = PO.core.config;
    if (!TIPOS[entrada.tipo]) {
      erros.tipo = 'Selecione o tipo de dado.';
    }
    if (!entrada.arquivo) {
      erros.arquivo = 'Selecione um arquivo.';
    } else {
      var ext = PO.importers.leitor.extensao(entrada.arquivo.name);
      if (PO.importers.leitor.EXTENSOES.indexOf(ext) === -1) {
        erros.arquivo = 'Formato inválido. Aceitos: .csv, .xls, .xlsx.';
      } else if (entrada.arquivo.size > cfg.importacaoTamanhoMaximo) {
        erros.arquivo = 'Arquivo acima do limite de ' + Math.round(cfg.importacaoTamanhoMaximo / 1048576) + ' MB.';
      } else if (entrada.arquivo.size === 0) {
        erros.arquivo = 'O arquivo está vazio.';
      }
    }
    if (!Number.isInteger(entrada.exercicio) || entrada.exercicio < 2000 || entrada.exercicio > 2100) {
      erros.exercicio = 'Informe um ano entre 2000 e 2100.';
    }
    return erros;
  }

  /**
   * Etapa 1: lê e mapeia o arquivo.
   * @param {{tipo:string, arquivo:File, exercicio:number}} entrada
   *   Para receitas, `exercicio` é o ano da 1ª coluna de valor (VLR6).
   * @returns {Promise<Object>} prévia
   */
  function analisar(entrada) {
    return PO.importers.leitor.ler(entrada.arquivo).then(function (tabela) {
      var mapeado = entrada.tipo === 'despesas'
        ? PO.importers.mapeadorDespesas.mapear(tabela, { exercicio: entrada.exercicio })
        : PO.importers.mapeadorReceitas.mapear(tabela, { anoInicial: entrada.exercicio });

      return {
        tipo: entrada.tipo,
        exercicio: entrada.exercicio,
        arquivo: entrada.arquivo.name,
        tamanho: entrada.arquivo.size,
        formato: tabela.formato,
        registros: mapeado.registros,
        avisos: mapeado.avisos,
        erros: mapeado.erros,
        resumo: mapeado.resumo,
        valida: mapeado.erros.length === 0
      };
    });
  }

  /**
   * Etapa 2: grava a prévia.
   * @param {Object} previa resultado de analisar()
   * @returns {Promise<Object>} importação gravada
   */
  function confirmar(previa) {
    if (!previa || !previa.valida) {
      return Promise.reject(new Error('A prévia possui erros e não pode ser gravada.'));
    }
    var importacao = {
      id: gerarIdLote(previa.tipo),
      tipo: previa.tipo,
      exercicio: previa.exercicio,
      anos: previa.tipo === 'receitas' ? previa.resumo.anos : null,
      arquivo: previa.arquivo,
      formato: previa.formato,
      tamanho: previa.tamanho,
      dataHora: new Date().toISOString(),
      status: 'ativa',
      totalRegistros: previa.registros.length,
      totalAvisos: previa.avisos.length,
      resumo: previa.resumo
    };
    return PO.data.repositorio.salvarImportacao(importacao, previa.registros);
  }

  PO.importers.importador = Object.freeze({
    TIPOS: TIPOS,
    validarEntrada: validarEntrada,
    analisar: analisar,
    confirmar: confirmar
  });
})(window.PO);
