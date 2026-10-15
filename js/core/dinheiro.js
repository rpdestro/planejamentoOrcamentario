// JAVASCRIPT
/**
 * @file dinheiro.js
 * @description Aritmética monetária em CENTAVOS INTEIROS.
 *
 * Regra do projeto (CLAUDE.md — Precisão Numérica): valores monetários nunca
 * são somados/divididos como ponto flutuante. Toda entrada é convertida para
 * um inteiro de centavos na fronteira (importação) e todas as operações
 * internas usam inteiros. A única conversão de volta para número decimal
 * acontece na exportação para Excel (célula numérica), em `paraDecimal`.
 */
(function (PO) {
  'use strict';

  var FORMATADOR_INTEIRO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

  /**
   * Converte texto decimal normalizado ("-1234.5") em centavos, arredondando
   * a 3ª casa (meio para cima, em módulo) sem usar ponto flutuante.
   * @param {string} texto
   * @returns {number|null}
   */
  function decimalTextoParaCentavos(texto) {
    var m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(texto);
    if (!m) {
      return null;
    }
    var negativo = m[1] === '-';
    var inteiro = m[2];
    var fracao = (m[3] || '') + '000';
    var centavos = Number(inteiro) * 100 + Number(fracao.slice(0, 2));
    if (Number(fracao.charAt(2)) >= 5) {
      centavos += 1;
    }
    if (!Number.isSafeInteger(centavos)) {
      return null;
    }
    return negativo && centavos !== 0 ? -centavos : centavos;
  }

  /**
   * Converte um valor vindo de planilha em centavos inteiros.
   * Aceita: número (célula numérica do Excel), "1234.56", "1.234,56", "R$ 1.234,56".
   * Células vazias retornam 0 se `opcoes.vazioComoZero`, senão null.
   *
   * Números do Excel chegam como double; `toFixed(3)` produz a representação
   * decimal estável, e a partir daí o cálculo é feito sobre texto/inteiros.
   *
   * @param {*} valor
   * @param {{vazioComoZero?: boolean}} [opcoes]
   * @returns {number|null} centavos, ou null se inválido/vazio
   */
  function paraCentavos(valor, opcoes) {
    var vazioComoZero = Boolean(opcoes && opcoes.vazioComoZero);

    if (valor === null || valor === undefined || valor === '') {
      return vazioComoZero ? 0 : null;
    }
    if (typeof valor === 'number') {
      if (!Number.isFinite(valor)) {
        return null;
      }
      return decimalTextoParaCentavos(valor.toFixed(3));
    }

    var texto = String(valor).replace(/R\$\s?/i, '').replace(/\s/g, '');
    if (texto === '') {
      return vazioComoZero ? 0 : null;
    }
    // Formato brasileiro: vírgula decimal, ponto de milhar.
    if (texto.indexOf(',') !== -1) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    }
    return decimalTextoParaCentavos(texto);
  }

  /**
   * Formata centavos como moeda brasileira. Ex.: 123456 → "R$ 1.234,56".
   * @param {number} centavos
   * @param {{simbolo?: boolean}} [opcoes]
   * @returns {string}
   */
  function formatar(centavos, opcoes) {
    var comSimbolo = !opcoes || opcoes.simbolo !== false;
    var negativo = centavos < 0;
    var absoluto = Math.abs(centavos);
    var reais = Math.trunc(absoluto / 100);
    var resto = absoluto - reais * 100;
    var texto = FORMATADOR_INTEIRO.format(reais) + ',' + String(resto).padStart(2, '0');
    return (negativo ? '-' : '') + (comSimbolo ? 'R$ ' : '') + texto;
  }

  /**
   * Soma uma lista de centavos (inteiros).
   * @param {number[]} lista
   * @returns {number}
   */
  function somar(lista) {
    var total = 0;
    for (var i = 0; i < lista.length; i += 1) {
      total += lista[i] || 0;
    }
    return total;
  }

  /**
   * Distribui um total em N parcelas inteiras cuja soma é exatamente o total.
   * O resíduo da divisão é lançado na ÚLTIMA parcela — mesmo critério usado
   * pela equipe no cronograma (ex.: 500,00 → 11 × 41,66 + 41,74).
   * @param {number} totalCentavos
   * @param {number} partes
   * @returns {number[]}
   */
  function distribuir(totalCentavos, partes) {
    var base = Math.trunc(totalCentavos / partes);
    var parcelas = new Array(partes).fill(base);
    parcelas[partes - 1] = totalCentavos - base * (partes - 1);
    return parcelas;
  }

  /**
   * Percentual com 1 casa (texto), calculado em inteiros. Ex.: (1, 3) → "33,3%".
   * @param {number} parte
   * @param {number} todo
   * @returns {string}
   */
  function percentual(parte, todo) {
    if (!todo) {
      return '—';
    }
    var milesimos = Math.round((parte * 1000) / todo);
    var inteiro = Math.trunc(milesimos / 10);
    var decimal = Math.abs(milesimos - inteiro * 10);
    return inteiro + ',' + decimal + '%';
  }

  /**
   * Conversão de saída para célula numérica de Excel (único ponto onde
   * centavos voltam a ser decimal). NÃO usar em cálculos.
   * @param {number} centavos
   * @returns {number}
   */
  function paraDecimal(centavos) {
    return centavos / 100;
  }

  /**
   * Texto decimal com vírgula, para CSV brasileiro. Ex.: 123456 → "1234,56".
   * @param {number} centavos
   * @returns {string}
   */
  function paraTextoCsv(centavos) {
    return formatar(centavos, { simbolo: false }).replace(/\./g, '');
  }

  PO.core.dinheiro = Object.freeze({
    paraCentavos: paraCentavos,
    formatar: formatar,
    somar: somar,
    distribuir: distribuir,
    percentual: percentual,
    paraDecimal: paraDecimal,
    paraTextoCsv: paraTextoCsv
  });
})(window.PO);
