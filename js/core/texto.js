// JAVASCRIPT
/**
 * @file texto.js
 * @description Utilitários de texto puros (sem DOM), usados principalmente
 * para casar cabeçalhos de planilhas com variações de acento/caixa/espaço.
 */
(function (PO) {
  'use strict';

  /**
   * Normaliza um texto para comparação: minúsculas, sem acentos,
   * espaços colapsados e sem espaços nas pontas.
   * Ex.: "  Valor Total  Orçamento 2027 " → "valor total orcamento 2027"
   * @param {*} valor
   * @returns {string}
   */
  function normalizar(valor) {
    if (valor === null || valor === undefined) {
      return '';
    }
    return String(valor)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Converte uma célula em texto "limpo" (trim), tratando null/undefined.
   * @param {*} valor
   * @returns {string}
   */
  function celula(valor) {
    if (valor === null || valor === undefined) {
      return '';
    }
    return String(valor).trim();
  }

  /**
   * Gera um identificador seguro para data-testid / atributos (ex.: "02.01" → "02-01").
   * @param {string} valor
   * @returns {string}
   */
  function slug(valor) {
    return normalizar(valor).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  PO.core.texto = Object.freeze({ normalizar: normalizar, celula: celula, slug: slug });
})(window.PO);
