// JAVASCRIPT
/**
 * @file namespace.js
 * @description Cria o namespace raiz `PO` (Planejamento Orçamentário).
 *
 * A aplicação usa scripts clássicos (não ES Modules) para funcionar abrindo o
 * index.html direto do disco (file://), sem servidor local — requisito do
 * ambiente da Prefeitura. Para não poluir o escopo global, TODO módulo se
 * registra dentro de `window.PO`, em uma das camadas abaixo:
 *
 *   PO.core       → utilitários transversais (config, dinheiro, DOM, eventos)
 *   PO.domain     → regras de negócio puras (períodos, classificações)
 *   PO.data       → persistência (IndexedDB) e repositórios
 *   PO.importers  → leitura e mapeamento de planilhas (.csv/.xls/.xlsx)
 *   PO.ui         → componentes, roteador e views
 */
(function (global) {
  'use strict';

  if (global.PO) {
    return;
  }

  global.PO = {
    /** Versão semântica da aplicação (manter em sincronia com o arquivo VERSION). */
    versao: '0.6.1',
    core: {},
    domain: {},
    data: {},
    importers: {},
    ui: { views: {} }
  };
})(window);
