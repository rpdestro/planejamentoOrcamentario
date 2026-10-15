// JAVASCRIPT
/**
 * @file classificacao-despesa.js
 * @description Parser da classificação da despesa (MTO/MCASP):
 *
 *   Natureza:  C.G.MM.EE[.DD]  → Categoria (1d) · GND (1d) · Modalidade (2d) · Elemento (2d) · Desdobramento (2d, opcional)
 *   Funcional: FF.SSS.PPPP.AAAA → Função · Subfunção · Programa · Ação
 *
 * Tipo da ação pelo 1º dígito (MTO): ímpar = Projeto, par (≠0) = Atividade,
 * 0 = Operação Especial; 9999 é usado para Reserva de Contingência.
 */
(function (PO) {
  'use strict';

  var RE_NATUREZA = /^(\d)\.(\d)\.(\d{2})\.(\d{2})(?:\.(\d{2}))?$/;
  var RE_FUNCIONAL = /^(\d{2})\.(\d{3})\.(\d{4})\.(\d{4})$/;

  /**
   * @param {string} codigo ex.: "3.3.90.39" ou "3.3.90.47.00"
   * @returns {{valido:boolean, categoria?:string, gnd?:string, modalidade?:string, elemento?:string, desdobramento?:string}}
   */
  function parseNatureza(codigo) {
    var m = RE_NATUREZA.exec(String(codigo || '').trim());
    if (!m) {
      return { valido: false };
    }
    return {
      valido: true,
      categoria: m[1],
      gnd: m[2],
      modalidade: m[3],
      elemento: m[4],
      desdobramento: m[5] || ''
    };
  }

  /**
   * @param {string} codigo ex.: "01.031.0001.2001"
   */
  function parseFuncional(codigo) {
    var m = RE_FUNCIONAL.exec(String(codigo || '').trim());
    if (!m) {
      return { valido: false };
    }
    return {
      valido: true,
      funcao: m[1],
      subfuncao: m[2],
      programa: m[3],
      acao: m[4],
      tipoAcao: tipoAcao(m[4])
    };
  }

  /** @param {string} acao 4 dígitos */
  function tipoAcao(acao) {
    if (acao === '9999') {
      return 'Reserva de Contingência';
    }
    var primeiro = Number(acao.charAt(0));
    if (primeiro === 0) {
      return 'Operação Especial';
    }
    return primeiro % 2 === 1 ? 'Projeto' : 'Atividade';
  }

  /**
   * Verifica se a natureza começa com o prefixo informado pelo usuário
   * (ex.: "3.3.90" casa "3.3.90.39"). Prefixo vazio casa tudo.
   * @param {string} natureza
   * @param {string} prefixo
   */
  function casaPrefixo(natureza, prefixo) {
    var p = String(prefixo || '').trim();
    return p === '' || String(natureza).indexOf(p) === 0;
  }

  PO.domain.classificacaoDespesa = Object.freeze({
    parseNatureza: parseNatureza,
    parseFuncional: parseFuncional,
    tipoAcao: tipoAcao,
    casaPrefixo: casaPrefixo
  });
})(window.PO);
