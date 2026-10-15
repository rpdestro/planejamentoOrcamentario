// JAVASCRIPT
/**
 * @file mapeador-despesas.js
 * @description Converte a tabela do "Cronograma de Orçamento" (despesas)
 * em registros de domínio validados.
 *
 * Layout esperado (cabeçalhos casados sem acento/caixa):
 *   Unidade orçamentária | unidade executora | funcional | natureza de despesa |
 *   descrição | fonte | valor total orçamento AAAA | valor insuficiente |
 *   janeiro … dezembro
 *
 * Regras:
 *   - Linhas sem UO, UE e natureza são ignoradas (totais no rodapé).
 *   - UO vazia com UE preenchida ⇒ UO derivada da UE (ex.: 02.35.08 → 02.35), com aviso.
 *   - Valor total vazio/inválido ⇒ importado como 0,00, com aviso (nada é descartado em silêncio).
 *   - Meses todos vazios ⇒ dotação "não diluída" (mesesCentavos = null).
 *   - Soma mensal ≠ total ⇒ aviso de divergência (o registro é importado).
 */
(function (PO) {
  'use strict';

  var texto = PO.core.texto;
  var dinheiro = PO.core.dinheiro;
  var classif = PO.domain.classificacaoDespesa;

  var MESES_CABECALHO = Object.freeze([
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ]);

  /** Sinônimos aceitos para cada coluna (já normalizados). */
  var COLUNAS = Object.freeze({
    uo: ['unidade orcamentaria'],
    ue: ['unidade executora'],
    funcional: ['funcional', 'funcional programatica'],
    natureza: ['natureza de despesa', 'natureza da despesa', 'natureza'],
    descricao: ['descricao', 'descricao da despesa'],
    fonte: ['fonte', 'fonte de recurso', 'fonte de recursos'],
    insuficiente: ['valor insuficiente']
  });

  var OBRIGATORIAS = Object.freeze(['uo', 'natureza', 'total']);

  /**
   * Localiza o índice de cada coluna no cabeçalho.
   * A coluna de total aceita "valor total orçamento 2027" e captura o ano.
   * @param {string[]} cabecalho
   */
  function mapearColunas(cabecalho) {
    var normalizado = cabecalho.map(texto.normalizar);
    var indices = { meses: [] };
    var anoCabecalho = null;

    Object.keys(COLUNAS).forEach(function (chave) {
      indices[chave] = normalizado.findIndex(function (h) {
        return COLUNAS[chave].indexOf(h) !== -1;
      });
    });

    indices.total = normalizado.findIndex(function (h) {
      return h.indexOf('valor total') === 0;
    });
    if (indices.total !== -1) {
      var m = /(\d{4})/.exec(normalizado[indices.total]);
      anoCabecalho = m ? Number(m[1]) : null;
    }

    indices.meses = MESES_CABECALHO.map(function (mes) {
      return normalizado.indexOf(mes);
    });

    return { indices: indices, anoCabecalho: anoCabecalho };
  }

  /** Lê uma célula pelo índice (−1 ⇒ vazio). */
  function valor(linha, indice) {
    return indice >= 0 ? linha[indice] : null;
  }

  /**
   * @param {{cabecalho:string[], linhas:Array[]}} tabela
   * @param {{exercicio:number}} opcoes
   * @returns {{registros:Array, avisos:Array<{linha:number,mensagem:string}>, erros:string[], resumo:Object}}
   */
  function mapear(tabela, opcoes) {
    var resultado = { registros: [], avisos: [], erros: [], resumo: null };
    var mapa = mapearColunas(tabela.cabecalho);
    var idx = mapa.indices;

    OBRIGATORIAS.forEach(function (chave) {
      if (idx[chave] === -1) {
        resultado.erros.push('Coluna obrigatória não encontrada: "' + rotuloColuna(chave) + '".');
      }
    });
    var mesesAusentes = idx.meses.filter(function (i) {
      return i === -1;
    }).length;
    if (mesesAusentes > 0 && mesesAusentes < 12) {
      resultado.erros.push('Cronograma incompleto: ' + mesesAusentes + ' coluna(s) de mês não encontrada(s).');
    }
    if (resultado.erros.length) {
      return resultado;
    }

    if (mapa.anoCabecalho && mapa.anoCabecalho !== opcoes.exercicio) {
      resultado.avisos.push({
        linha: 1,
        mensagem: 'O cabeçalho indica ' + mapa.anoCabecalho + ', mas o exercício informado é ' + opcoes.exercicio + '.'
      });
    }

    var ignoradas = 0;
    var naoDiluidas = 0;
    var divergentes = 0;
    var total = 0;

    tabela.linhas.forEach(function (linha, i) {
      var numeroLinha = i + 2; // +1 cabeçalho, +1 base 1
      var registro = mapearLinha(linha, idx, numeroLinha, opcoes.exercicio, resultado.avisos);
      if (!registro) {
        ignoradas += 1;
        return;
      }
      if (!registro.diluida) {
        naoDiluidas += 1;
      }
      if (registro.divergenciaCentavos !== 0) {
        divergentes += 1;
      }
      total += registro.totalCentavos;
      resultado.registros.push(registro);
    });

    if (!resultado.registros.length) {
      resultado.erros.push('Nenhuma linha de despesa válida foi encontrada.');
    }

    resultado.resumo = {
      linhasLidas: tabela.linhas.length,
      importadas: resultado.registros.length,
      ignoradas: ignoradas,
      naoDiluidas: naoDiluidas,
      divergentes: divergentes,
      totalCentavos: total,
      anoCabecalho: mapa.anoCabecalho
    };
    return resultado;
  }

  /**
   * Converte uma linha em registro de despesa. Retorna null para linhas
   * a ignorar (sem UO ou com valor total inválido — este último gera aviso).
   */
  function mapearLinha(linha, idx, numeroLinha, exercicio, avisos) {
    var uo = texto.celula(valor(linha, idx.uo));
    var ue = texto.celula(valor(linha, idx.ue));
    var natureza = texto.celula(valor(linha, idx.natureza));

    if (!uo) {
      // Sem UO, UE e natureza ⇒ linha de total/rodapé: ignorar em silêncio.
      if (!ue && !natureza) {
        return null;
      }
      // UE "02.35.08" pertence à UO "02.35": deriva e avisa.
      var derivada = /^(\d{2}\.\d{2})\.\d+$/.exec(ue);
      if (!derivada) {
        avisos.push({ linha: numeroLinha, mensagem: 'Unidade Orçamentária não informada — linha ignorada.' });
        return null;
      }
      uo = derivada[1];
      avisos.push({ linha: numeroLinha, mensagem: 'Unidade Orçamentária vazia — derivada da Unidade Executora (' + uo + ').' });
    }

    var brutoTotal = valor(linha, idx.total);
    var totalCentavos = dinheiro.paraCentavos(brutoTotal);
    if (totalCentavos === null) {
      avisos.push({
        linha: numeroLinha,
        mensagem: (texto.celula(brutoTotal) ? 'Valor total inválido ("' + brutoTotal + '")' : 'Valor total vazio') + ' — importado como R$ 0,00.'
      });
      totalCentavos = 0;
    }

    var nat = classif.parseNatureza(natureza);
    if (!nat.valido) {
      avisos.push({ linha: numeroLinha, mensagem: 'Natureza de despesa fora do padrão C.G.MM.EE: "' + natureza + '".' });
    }

    var funcional = texto.celula(valor(linha, idx.funcional));
    var fun = classif.parseFuncional(funcional);
    if (funcional && !fun.valido) {
      avisos.push({ linha: numeroLinha, mensagem: 'Funcional fora do padrão FF.SSS.PPPP.AAAA: "' + funcional + '".' });
    }

    var fonte = texto.celula(valor(linha, idx.fonte));
    if (!fonte) {
      avisos.push({ linha: numeroLinha, mensagem: 'Fonte de recurso não informada.' });
    }

    var meses = lerMeses(linha, idx.meses, numeroLinha, avisos);
    var diluida = meses !== null;
    var divergencia = diluida ? dinheiro.somar(meses) - totalCentavos : 0;
    if (divergencia !== 0) {
      avisos.push({
        linha: numeroLinha,
        mensagem: 'Soma dos meses difere do total em ' + dinheiro.formatar(divergencia) + '.'
      });
    }

    return {
      exercicio: exercicio,
      linhaOrigem: numeroLinha,
      uo: uo,
      ue: ue,
      funcional: funcional,
      funcao: fun.valido ? fun.funcao : '',
      subfuncao: fun.valido ? fun.subfuncao : '',
      programa: fun.valido ? fun.programa : '',
      acao: fun.valido ? fun.acao : '',
      natureza: natureza,
      categoria: nat.valido ? nat.categoria : '',
      gnd: nat.valido ? nat.gnd : '',
      modalidade: nat.valido ? nat.modalidade : '',
      elemento: nat.valido ? nat.elemento : '',
      descricao: texto.celula(valor(linha, idx.descricao)),
      fonte: fonte,
      totalCentavos: totalCentavos,
      insuficienteCentavos: dinheiro.paraCentavos(valor(linha, idx.insuficiente), { vazioComoZero: true }) || 0,
      mesesCentavos: meses,
      diluida: diluida,
      divergenciaCentavos: divergencia
    };
  }

  /**
   * Lê as 12 colunas mensais. Todas vazias ⇒ null (não diluída).
   * Valores inválidos viram 0 com aviso.
   */
  function lerMeses(linha, indicesMeses, numeroLinha, avisos) {
    if (indicesMeses.every(function (i) { return i === -1; })) {
      return null;
    }
    var algumPreenchido = false;
    var meses = indicesMeses.map(function (indice, m) {
      var bruto = valor(linha, indice);
      if (bruto === null || bruto === undefined || String(bruto).trim() === '') {
        return 0;
      }
      algumPreenchido = true;
      var centavos = dinheiro.paraCentavos(bruto);
      if (centavos === null) {
        avisos.push({ linha: numeroLinha, mensagem: 'Valor inválido em ' + MESES_CABECALHO[m] + ': "' + bruto + '" (considerado 0).' });
        return 0;
      }
      return centavos;
    });
    return algumPreenchido ? meses : null;
  }

  function rotuloColuna(chave) {
    return chave === 'total' ? 'valor total orçamento' : COLUNAS[chave][0];
  }

  PO.importers.mapeadorDespesas = Object.freeze({ mapear: mapear, mapearColunas: mapearColunas });
})(window.PO);
