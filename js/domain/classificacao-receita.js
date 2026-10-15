// JAVASCRIPT
/**
 * @file classificacao-receita.js
 * @description Hierarquia da natureza de receita no layout Fiorilli
 * "C O E D . TT . N . T . XX . XX" (ex.: "1112.50.0.1.00.00").
 *
 * O 1º bloco tem 4 níveis de 1 dígito (Categoria, Origem, Espécie,
 * Desdobramento); os demais blocos são níveis inteiros. Um código é
 * descendente de outro quando seus níveis significativos (sem zeros à
 * direita) começam pelos níveis significativos do ascendente.
 *
 * Comparar por NÍVEL (e não por dígito) evita o falso positivo
 * "1112.53 é filho de 1112.50" que ocorreria cortando zeros de uma string.
 */
(function (PO) {
  'use strict';

  /**
   * Quebra o código em níveis e remove os níveis zerados à direita.
   * "1112.50.0.1.00.00" → ["1","1","1","2","50","0","1"]
   * @param {string} codigo
   * @returns {string[]|null} null se o formato for inválido
   */
  function niveis(codigo) {
    var partes = String(codigo || '').trim().split('.');
    if (partes.length < 1 || !/^\d{4}$/.test(partes[0])) {
      return null;
    }
    for (var i = 1; i < partes.length; i += 1) {
      if (!/^\d+$/.test(partes[i])) {
        return null;
      }
    }
    var lista = partes[0].split('').concat(partes.slice(1));
    while (lista.length > 1 && Number(lista[lista.length - 1]) === 0) {
      lista.pop();
    }
    return lista;
  }

  /**
   * @param {string} ascendente
   * @param {string} candidato
   * @returns {boolean} true se `candidato` está abaixo de `ascendente` na árvore
   */
  function ehDescendente(ascendente, candidato) {
    var a = niveis(ascendente);
    var c = niveis(candidato);
    if (!a || !c || c.length <= a.length) {
      return false;
    }
    for (var i = 0; i < a.length; i += 1) {
      if (a[i] !== c[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Categoria da receita pelo 1º dígito (corrente, capital, intra, dedução).
   * @param {string} codigo
   * @returns {{chave:string, rotulo:string}|null}
   */
  function categoria(codigo) {
    var digito = String(codigo || '').trim().charAt(0);
    return PO.core.config.categoriasReceita[digito] || null;
  }

  PO.domain.classificacaoReceita = Object.freeze({
    niveis: niveis,
    ehDescendente: ehDescendente,
    categoria: categoria
  });
})(window.PO);
