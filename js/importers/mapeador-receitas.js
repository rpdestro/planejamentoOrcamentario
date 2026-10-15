// JAVASCRIPT
/**
 * @file mapeador-receitas.js
 * @description Converte o CSV Fiorilli "Fontes de Financiamento dos Programas
 * Governamentais — Consolidado" em registros de receita.
 *
 * Layout: CODRE;NOMRE;TIPOREC;FONTE_STN;VLR6_CALC;VLR7_CALC;VLR8_CALC;VLR9_CALC
 *   - CODRE: natureza da receita (hierárquica, ex.: 1112.50.0.1.00.00)
 *   - VLRn_CALC: valores previstos para anos consecutivos. O ano da 1ª
 *     coluna de valor é informado pelo usuário (`anoInicial`).
 *
 * Linhas analíticas: o arquivo vem em pré-ordem (pai antes dos filhos),
 * então uma linha é analítica quando a linha seguinte NÃO é sua
 * descendente. Totais são calculados somente sobre analíticas, evitando
 * dupla contagem dos níveis sintéticos.
 */
(function (PO) {
  'use strict';

  var texto = PO.core.texto;
  var dinheiro = PO.core.dinheiro;
  var classif = PO.domain.classificacaoReceita;

  /** Localiza colunas fixas e as colunas de valor (VLRn_CALC) em ordem. */
  function mapearColunas(cabecalho) {
    var normalizado = cabecalho.map(texto.normalizar);
    var valores = [];
    normalizado.forEach(function (h, i) {
      var m = /^vlr(\d+)(_calc)?$/.exec(h);
      if (m) {
        valores.push({ indice: i, ordem: Number(m[1]), titulo: cabecalho[i] });
      }
    });
    valores.sort(function (a, b) {
      return a.ordem - b.ordem;
    });
    return {
      codigo: normalizado.indexOf('codre'),
      nome: normalizado.indexOf('nomre'),
      tipoRec: normalizado.indexOf('tiporec'),
      fonteStn: normalizado.indexOf('fonte_stn'),
      valores: valores
    };
  }

  /**
   * @param {{cabecalho:string[], linhas:Array[]}} tabela
   * @param {{anoInicial:number}} opcoes
   */
  function mapear(tabela, opcoes) {
    var resultado = { registros: [], avisos: [], erros: [], resumo: null };
    var col = mapearColunas(tabela.cabecalho);

    if (col.codigo === -1) {
      resultado.erros.push('Coluna obrigatória não encontrada: "CODRE".');
    }
    if (col.nome === -1) {
      resultado.erros.push('Coluna obrigatória não encontrada: "NOMRE".');
    }
    if (!col.valores.length) {
      resultado.erros.push('Nenhuma coluna de valor (VLRn_CALC) encontrada.');
    }
    if (resultado.erros.length) {
      return resultado;
    }

    var anos = col.valores.map(function (_, i) {
      return opcoes.anoInicial + i;
    });

    var ignoradas = 0;
    tabela.linhas.forEach(function (linha, i) {
      var registro = mapearLinha(linha, col, anos, i + 2, resultado.avisos);
      if (registro) {
        resultado.registros.push(registro);
      } else {
        ignoradas += 1;
      }
    });

    marcarAnaliticas(resultado.registros, resultado.avisos);

    if (!resultado.registros.length) {
      resultado.erros.push('Nenhuma linha de receita válida foi encontrada.');
    }

    resultado.resumo = {
      linhasLidas: tabela.linhas.length,
      importadas: resultado.registros.length,
      ignoradas: ignoradas,
      analiticas: resultado.registros.filter(function (r) { return r.analitica; }).length,
      anos: anos,
      totaisPorAno: totaisPorAno(resultado.registros, anos)
    };
    return resultado;
  }

  /** Converte uma linha; null para linhas de total/vazias/inválidas. */
  function mapearLinha(linha, col, anos, numeroLinha, avisos) {
    var codigo = texto.celula(linha[col.codigo]);
    if (!codigo || texto.normalizar(codigo) === 'total') {
      return null;
    }
    if (!classif.niveis(codigo)) {
      avisos.push({ linha: numeroLinha, mensagem: 'Código de receita fora do padrão: "' + codigo + '" — linha ignorada.' });
      return null;
    }
    var categoria = classif.categoria(codigo);
    if (!categoria) {
      avisos.push({ linha: numeroLinha, mensagem: 'Categoria econômica desconhecida para "' + codigo + '".' });
    }

    var valores = {};
    col.valores.forEach(function (c, i) {
      var centavos = dinheiro.paraCentavos(linha[c.indice], { vazioComoZero: true });
      if (centavos === null) {
        avisos.push({ linha: numeroLinha, mensagem: 'Valor inválido em ' + c.titulo + ': "' + linha[c.indice] + '" (considerado 0).' });
        centavos = 0;
      }
      valores[anos[i]] = centavos;
    });

    return {
      linhaOrigem: numeroLinha,
      codigo: codigo,
      nome: texto.celula(linha[col.nome]),
      tipoRec: col.tipoRec >= 0 ? texto.celula(linha[col.tipoRec]) : '',
      fonteStn: col.fonteStn >= 0 ? texto.celula(linha[col.fonteStn]) : '',
      categoria: categoria ? categoria.chave : '',
      nivel: classif.niveis(codigo).length,
      analitica: false,
      valoresCentavos: valores
    };
  }

  /**
   * Define `analitica` olhando a próxima linha. Códigos repetidos em
   * sequência (ocorre no topo do arquivo Fiorilli) são tratados como
   * sintéticos e geram aviso para conferência.
   */
  function marcarAnaliticas(registros, avisos) {
    registros.forEach(function (atual, i) {
      var proxima = registros[i + 1];
      if (proxima && proxima.codigo === atual.codigo) {
        avisos.push({
          linha: atual.linhaOrigem,
          mensagem: 'Código "' + atual.codigo + '" repetido na linha seguinte — tratado como sintético (conferir origem).'
        });
        atual.analitica = false;
        return;
      }
      atual.analitica = !proxima || !classif.ehDescendente(atual.codigo, proxima.codigo);
    });
  }

  /** Totais por ano e categoria, somando apenas linhas analíticas. */
  function totaisPorAno(registros, anos) {
    var totais = {};
    anos.forEach(function (ano) {
      totais[ano] = { liquido: 0, porCategoria: {} };
    });
    registros.forEach(function (r) {
      if (!r.analitica) {
        return;
      }
      anos.forEach(function (ano) {
        var v = r.valoresCentavos[ano] || 0;
        totais[ano].liquido += v;
        totais[ano].porCategoria[r.categoria] = (totais[ano].porCategoria[r.categoria] || 0) + v;
      });
    });
    return totais;
  }

  PO.importers.mapeadorReceitas = Object.freeze({
    mapear: mapear,
    mapearColunas: mapearColunas,
    totaisPorAno: totaisPorAno
  });
})(window.PO);
