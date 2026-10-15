// JAVASCRIPT
/**
 * @file csv-parser.js
 * @description Parser de CSV sem dependências, tolerante ao padrão Fiorilli:
 *   - delimitador detectado automaticamente (";" "," ou TAB);
 *   - aspas só abrem campo quando estão no INÍCIO do campo — assim textos
 *     como  IMPOSTOS SOBRE TRANSMISSÃO "INTER VIVOS"  não quebram a linha;
 *   - "" dentro de campo entre aspas vira uma aspa literal;
 *   - codificação: UTF-8, com fallback para Windows-1252 (ANSI).
 */
(function (PO) {
  'use strict';

  /**
   * Decodifica bytes em texto, tentando UTF-8 estrito e caindo para
   * Windows-1252 se houver bytes inválidos. Remove BOM.
   * @param {ArrayBuffer} buffer
   * @returns {string}
   */
  function decodificar(buffer) {
    var texto;
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
      texto = new TextDecoder('windows-1252').decode(buffer);
    }
    return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  }

  /** Escolhe o delimitador mais frequente na primeira linha. */
  function detectarDelimitador(texto) {
    var primeira = texto.split(/\r?\n/, 1)[0] || '';
    var candidatos = [';', ',', '\t'];
    var melhor = ';';
    var maior = -1;
    candidatos.forEach(function (d) {
      var qtd = primeira.split(d).length - 1;
      if (qtd > maior) {
        maior = qtd;
        melhor = d;
      }
    });
    return melhor;
  }

  /**
   * Converte texto CSV em matriz de células (strings).
   * Máquina de estados de um passo: percorre caractere a caractere,
   * alternando entre "fora de aspas" e "dentro de aspas".
   * @param {string} texto
   * @param {{delimitador?: string}} [opcoes]
   * @returns {string[][]}
   */
  function parse(texto, opcoes) {
    var delim = (opcoes && opcoes.delimitador) || detectarDelimitador(texto);
    var linhas = [];
    var linha = [];
    var campo = '';
    var dentroAspas = false;
    var inicioCampo = true;

    for (var i = 0; i < texto.length; i += 1) {
      var c = texto.charAt(i);

      if (dentroAspas) {
        if (c === '"') {
          if (texto.charAt(i + 1) === '"') {
            campo += '"';
            i += 1;
          } else {
            dentroAspas = false;
          }
        } else {
          campo += c;
        }
        continue;
      }

      if (c === '"' && inicioCampo) {
        dentroAspas = true;
        inicioCampo = false;
      } else if (c === delim) {
        linha.push(campo);
        campo = '';
        inicioCampo = true;
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto.charAt(i + 1) === '\n') {
          i += 1;
        }
        linha.push(campo);
        linhas.push(linha);
        linha = [];
        campo = '';
        inicioCampo = true;
      } else {
        campo += c;
        inicioCampo = false;
      }
    }

    if (campo !== '' || linha.length > 0) {
      linha.push(campo);
      linhas.push(linha);
    }

    // Remove linhas totalmente vazias.
    return linhas.filter(function (l) {
      return l.some(function (v) {
        return v.trim() !== '';
      });
    });
  }

  PO.importers.csv = Object.freeze({
    decodificar: decodificar,
    detectarDelimitador: detectarDelimitador,
    parse: parse
  });
})(window.PO);
