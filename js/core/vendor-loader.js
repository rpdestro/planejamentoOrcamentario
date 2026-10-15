// JAVASCRIPT
/**
 * @file vendor-loader.js
 * @description Carregamento sob demanda da biblioteca SheetJS (XLSX).
 *
 * Estratégia: 1) já carregada? usa; 2) tenta a cópia local em vendor/;
 * 3) se não existir, tenta a CDN oficial. Assim a aplicação funciona
 * offline quando o arquivo local estiver presente (ver README).
 * Arquivos .csv NÃO dependem desta biblioteca.
 */
(function (PO) {
  'use strict';

  var promessaXlsx = null;

  /** Injeta um <script> e resolve quando carregar. */
  function carregarScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        script.remove();
        reject(new Error('Falha ao carregar ' + src));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * @returns {Promise<Object>} objeto global XLSX
   */
  function carregarXlsx() {
    if (window.XLSX) {
      return Promise.resolve(window.XLSX);
    }
    if (promessaXlsx) {
      return promessaXlsx;
    }
    var cfg = PO.core.config.vendor;
    promessaXlsx = carregarScript(cfg.xlsxLocal)
      .catch(function () {
        return carregarScript(cfg.xlsxCdn);
      })
      .then(function () {
        if (!window.XLSX) {
          throw new Error('Biblioteca XLSX não disponível.');
        }
        return window.XLSX;
      })
      .catch(function (erro) {
        promessaXlsx = null; // permite nova tentativa
        throw new Error(
          'Não foi possível carregar a biblioteca de planilhas (SheetJS). ' +
          'Coloque o arquivo em "vendor/xlsx.full.min.js" ou verifique a internet. Detalhe: ' + erro.message
        );
      });
    return promessaXlsx;
  }

  PO.core.vendor = Object.freeze({ carregarXlsx: carregarXlsx });
})(window.PO);
