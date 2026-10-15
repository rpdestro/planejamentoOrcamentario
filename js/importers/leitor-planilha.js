// JAVASCRIPT
/**
 * @file leitor-planilha.js
 * @description Lê um arquivo (.csv, .xls, .xlsx) e devolve uma tabela
 * uniforme { cabecalho: string[], linhas: any[][] }, independente do formato.
 * Ponto único de extensão para o futuro leitor .xml (padrão TCE/AUDESP).
 */
(function (PO) {
  'use strict';

  var EXTENSOES = Object.freeze(['csv', 'xls', 'xlsx']);

  /** @param {string} nome */
  function extensao(nome) {
    var m = /\.([a-z0-9]+)$/i.exec(nome || '');
    return m ? m[1].toLowerCase() : '';
  }

  /** @param {File} arquivo */
  function lerBuffer(arquivo) {
    if (typeof arquivo.arrayBuffer === 'function') {
      return arquivo.arrayBuffer();
    }
    return new Promise(function (resolve, reject) {
      var leitor = new FileReader();
      leitor.onload = function () {
        resolve(leitor.result);
      };
      leitor.onerror = function () {
        reject(leitor.error);
      };
      leitor.readAsArrayBuffer(arquivo);
    });
  }

  /** Separa a primeira linha (cabeçalho) das demais. */
  function montarTabela(matriz) {
    if (!matriz.length) {
      throw new Error('O arquivo está vazio.');
    }
    return {
      cabecalho: matriz[0].map(function (v) {
        return PO.core.texto.celula(v);
      }),
      linhas: matriz.slice(1)
    };
  }

  /** CSV: parser próprio (não depende do SheetJS). */
  function lerCsv(buffer) {
    var texto = PO.importers.csv.decodificar(buffer);
    return montarTabela(PO.importers.csv.parse(texto));
  }

  /** XLS/XLSX: SheetJS, primeira aba, valores brutos (números como number). */
  function lerExcel(buffer) {
    return PO.core.vendor.carregarXlsx().then(function (XLSX) {
      var pasta = XLSX.read(buffer, { type: 'array' });
      var nomeAba = pasta.SheetNames[0];
      if (!nomeAba) {
        throw new Error('A planilha não possui abas.');
      }
      var matriz = XLSX.utils.sheet_to_json(pasta.Sheets[nomeAba], {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false
      });
      return montarTabela(matriz);
    });
  }

  /**
   * @param {File} arquivo
   * @returns {Promise<{cabecalho:string[], linhas:Array[], formato:string}>}
   */
  function ler(arquivo) {
    var ext = extensao(arquivo.name);
    if (EXTENSOES.indexOf(ext) === -1) {
      return Promise.reject(new Error('Formato não suportado: ".' + ext + '". Use .csv, .xls ou .xlsx.'));
    }
    return lerBuffer(arquivo)
      .then(function (buffer) {
        return ext === 'csv' ? lerCsv(buffer) : lerExcel(buffer);
      })
      .then(function (tabela) {
        tabela.formato = ext;
        return tabela;
      });
  }

  PO.importers.leitor = Object.freeze({ EXTENSOES: EXTENSOES, extensao: extensao, ler: ler });
})(window.PO);
