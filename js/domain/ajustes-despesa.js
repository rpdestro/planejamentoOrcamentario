// JAVASCRIPT
/**
 * @file ajustes-despesa.js
 * @description Regras puras (sem DOM/IndexedDB) para "Adicionar, Alterar e
 * Excluir" dotações sem violar a imutabilidade dos lotes importados.
 *
 * Modelo: o lote importado nunca é modificado. Cada ação do usuário vira um
 * AJUSTE (somente inserção, com motivo e data/hora — trilha de auditoria):
 *   - inclusao  : nova dotação manual            → chave "m<idAjuste>"
 *   - alteracao : substitui os campos de uma dotação existente (chave alvo)
 *   - exclusao  : anulação formal (a dotação deixa de compor os totais)
 *
 * A visão "efetiva" = lote importado + ajustes aplicados em ordem de id.
 * Dotações importadas têm chave "i<id do IndexedDB>".
 *
 * Também gera a trilha de auditoria legível (historico: valor antes/depois de
 * cada ajuste) e seleciona as inclusões manuais vigentes que podem ser
 * reaplicadas num lote novo após reimportação (inclusoesParaReaplicar).
 */
(function (PO) {
  'use strict';

  var dinheiro = PO.core.dinheiro;
  var classif = PO.domain.classificacaoDespesa;

  var OPERACOES = Object.freeze({ inclusao: 'inclusao', alteracao: 'alteracao', exclusao: 'exclusao' });

  /** Chave estável de uma dotação importada. */
  function chaveImportada(registro) {
    return 'i' + registro.id;
  }

  /**
   * Campos derivados (classificação, diluição) a partir dos campos editáveis.
   * @param {{ue:string, funcional:string, natureza:string, descricao:string, fonte:string,
   *          totalCentavos:number, mesesCentavos:(number[]|null)}} dados
   * @returns {Object} campos prontos para mesclar no registro
   */
  function camposDerivados(dados) {
    var nat = classif.parseNatureza(dados.natureza);
    var fun = classif.parseFuncional(dados.funcional);
    var meses = dados.mesesCentavos && dados.mesesCentavos.length === 12 ? dados.mesesCentavos.slice() : null;
    return {
      ue: dados.ue,
      funcional: dados.funcional,
      funcao: fun.valido ? fun.funcao : '',
      subfuncao: fun.valido ? fun.subfuncao : '',
      programa: fun.valido ? fun.programa : '',
      acao: fun.valido ? fun.acao : '',
      natureza: dados.natureza,
      categoria: nat.valido ? nat.categoria : '',
      gnd: nat.valido ? nat.gnd : '',
      modalidade: nat.valido ? nat.modalidade : '',
      elemento: nat.valido ? nat.elemento : '',
      descricao: dados.descricao,
      fonte: dados.fonte,
      totalCentavos: dados.totalCentavos,
      mesesCentavos: meses,
      diluida: meses !== null,
      divergenciaCentavos: meses ? dinheiro.somar(meses) - dados.totalCentavos : 0,
      insuficienteCentavos: PO.domain.valorInsuficiente.calcular({ totalCentavos: dados.totalCentavos, mesesCentavos: meses }).saldoCentavos
    };
  }

  /**
   * Aplica os ajustes sobre o lote importado.
   * A ordem do lote é preservada; inclusões entram ao final.
   * @param {Array} base registros do lote (com `id`)
   * @param {Array} ajustes registros de ajuste (com `id`)
   * @returns {Array} registros efetivos (cópias), cada um com `chave` e `origem`
   */
  function aplicar(base, ajustes) {
    var mapa = mapaBase(base);
    ordenar(ajustes).forEach(function (a) {
      aplicarUm(mapa, a);
    });
    return Array.from(mapa.values());
  }

  /** Mapa chave → cópia do registro importado (ponto de partida da reaplicação). */
  function mapaBase(base) {
    var mapa = new Map();
    base.forEach(function (r) {
      var chave = chaveImportada(r);
      mapa.set(chave, Object.assign({}, r, { chave: chave, origem: 'importada', alterada: false }));
    });
    return mapa;
  }

  /** Cópia dos ajustes em ordem cronológica de gravação (id autoincremento). */
  function ordenar(ajustes) {
    return ajustes.slice().sort(function (a, b) { return a.id - b.id; });
  }

  /** Aplica UM ajuste sobre o mapa de dotações efetivas (muta o mapa). */
  function aplicarUm(mapa, a) {
    if (a.operacao === OPERACOES.inclusao) {
      var chave = 'm' + a.id;
      mapa.set(chave, Object.assign({ exercicio: a.exercicio, uo: a.uo, linhaOrigem: null },
        camposDerivados(a.dados), { chave: chave, origem: 'manual', alterada: false }));
    } else if (a.operacao === OPERACOES.alteracao && mapa.has(a.alvo)) {
      mapa.set(a.alvo, Object.assign({}, mapa.get(a.alvo), camposDerivados(a.dados), { alterada: true }));
    } else if (a.operacao === OPERACOES.exclusao) {
      mapa.delete(a.alvo);
    }
  }

  /**
   * Trilha de auditoria legível: uma linha por ajuste, com o estado da
   * dotação ANTES e DEPOIS dele. Reaplica os ajustes em ordem sobre o lote
   * para saber qual era o valor vigente no momento de cada ajuste.
   *
   * @param {Array} base registros do lote (com `id`)
   * @param {Array} ajustes registros de ajuste (com `id`)
   * @returns {Array<{id:number, dataHora:string, operacao:string, uo:string, alvo:string,
   *   naturezaAntes:(string|null), naturezaDepois:(string|null), descricaoAntes:(string|null),
   *   descricaoDepois:(string|null), antesCentavos:(number|null), depoisCentavos:(number|null),
   *   motivo:string, alvoEncontrado:boolean}>} em ordem cronológica
   */
  function historico(base, ajustes) {
    var mapa = mapaBase(base);
    return ordenar(ajustes).map(function (a) {
      var chave = a.operacao === OPERACOES.inclusao ? 'm' + a.id : a.alvo;
      var antes = a.operacao === OPERACOES.inclusao ? null : (mapa.get(a.alvo) || null);
      aplicarUm(mapa, a);
      // Alteração/anulação de dotação já anulada não tem efeito (antes = depois = null).
      var depois = a.operacao === OPERACOES.exclusao ? null : (mapa.get(chave) || null);
      return {
        id: a.id,
        dataHora: a.dataHora || '',
        operacao: a.operacao,
        uo: a.uo || (antes && antes.uo) || '',
        alvo: chave,
        naturezaAntes: antes ? antes.natureza : null,
        naturezaDepois: depois ? depois.natureza : null,
        descricaoAntes: antes ? antes.descricao : null,
        descricaoDepois: depois ? depois.descricao : null,
        antesCentavos: antes ? antes.totalCentavos : null,
        // Anulação: a dotação deixa de compor os totais ⇒ R$ 0,00 depois.
        depoisCentavos: a.operacao === OPERACOES.exclusao ? (antes ? 0 : null) : (depois ? depois.totalCentavos : null),
        motivo: a.motivo || '',
        alvoEncontrado: a.operacao === OPERACOES.inclusao || Boolean(antes)
      };
    });
  }

  /**
   * Contagem de ajustes por operação.
   * @param {Array} ajustes
   * @returns {{total:number, inclusao:number, alteracao:number, exclusao:number}}
   */
  function resumir(ajustes) {
    var r = { total: ajustes.length, inclusao: 0, alteracao: 0, exclusao: 0 };
    ajustes.forEach(function (a) {
      if (Object.prototype.hasOwnProperty.call(r, a.operacao)) {
        r[a.operacao] += 1;
      }
    });
    return r;
  }

  /**
   * Inclusões manuais ainda VIGENTES num lote, com os dados finais (já
   * considerando alterações posteriores) — candidatas a reaplicação num lote
   * novo após reimportação. Inclusões anuladas não são reaplicadas.
   * Alterações/anulações de dotações IMPORTADAS não entram: as chaves "i<id>"
   * não existem no lote novo, e a planilha nova pode já trazer a correção.
   *
   * @param {Array} ajustes do lote anterior
   * @returns {Array<{origemId:number, uo:string, dados:Object, motivoOriginal:string}>}
   */
  function inclusoesParaReaplicar(ajustes) {
    var mapa = new Map();
    var origem = new Map();
    ordenar(ajustes).forEach(function (a) {
      aplicarUm(mapa, a);
      if (a.operacao === OPERACOES.inclusao) {
        origem.set('m' + a.id, a);
      }
    });
    var lista = [];
    origem.forEach(function (a, chave) {
      var atual = mapa.get(chave);
      if (atual) {
        lista.push({
          origemId: a.id,
          uo: a.uo,
          dados: {
            ue: atual.ue, funcional: atual.funcional, natureza: atual.natureza, descricao: atual.descricao,
            fonte: atual.fonte, totalCentavos: atual.totalCentavos,
            mesesCentavos: atual.mesesCentavos ? atual.mesesCentavos.slice() : null
          },
          motivoOriginal: a.motivo || ''
        });
      }
    });
    return lista;
  }

  /**
   * Valida os dados digitados no formulário de dotação.
   * Recebe textos crus (como digitados) e devolve dados normalizados + erros por campo.
   * @param {{ue:string, funcional:string, natureza:string, descricao:string, fonte:string,
   *          total:string, meses:string[], motivo:string}} entrada
   * @param {'inclusao'|'alteracao'} operacao
   * @returns {{dados:Object|null, erros:Object<string,string>}}
   */
  function validar(entrada, operacao) {
    var erros = {};
    var ue = String(entrada.ue || '').trim();
    var funcional = String(entrada.funcional || '').trim();
    var natureza = String(entrada.natureza || '').trim();
    var descricao = String(entrada.descricao || '').trim();
    var fonte = String(entrada.fonte || '').trim();
    var motivo = String(entrada.motivo || '').trim();

    if (!ue) {
      erros.ue = 'Informe a Unidade Executora.';
    }
    if (funcional && !classif.parseFuncional(funcional).valido) {
      erros.funcional = 'Use o padrão FF.SSS.PPPP.AAAA (ex.: 12.361.0004.2010).';
    }
    if (!classif.parseNatureza(natureza).valido) {
      erros.natureza = 'Use o padrão C.G.MM.EE (ex.: 3.3.90.39).';
    }
    if (!descricao) {
      erros.descricao = 'Informe a descrição.';
    }
    if (!fonte) {
      erros.fonte = 'Informe a fonte de recurso.';
    }

    var total = dinheiro.paraCentavos(entrada.total);
    if (total === null || total < 0) {
      erros.total = 'Informe um valor válido, maior ou igual a zero (ex.: 1.234,56).';
    }

    // Meses: todos vazios ⇒ não diluída (projeção 1/12); algum preenchido ⇒ precisa fechar com o total.
    var brutos = entrada.meses || [];
    var algum = brutos.some(function (m) { return String(m || '').trim() !== ''; });
    var meses = null;
    if (algum) {
      meses = brutos.map(function (m) { return dinheiro.paraCentavos(m, { vazioComoZero: true }); });
      if (meses.some(function (v) { return v === null || v < 0; })) {
        erros.meses = 'Há valores mensais inválidos.';
      } else if (total !== null && dinheiro.somar(meses) !== total) {
        erros.meses = 'A soma dos meses (' + dinheiro.formatar(dinheiro.somar(meses)) + ') difere do valor total (' + dinheiro.formatar(total) + ').';
      }
    }

    if (operacao === OPERACOES.alteracao && motivo.length < 5) {
      erros.motivo = 'Descreva o motivo da alteração (mínimo 5 caracteres) — obrigatório para a trilha de auditoria.';
    }

    if (Object.keys(erros).length) {
      return { dados: null, erros: erros };
    }
    return {
      dados: { ue: ue, funcional: funcional, natureza: natureza, descricao: descricao, fonte: fonte, totalCentavos: total, mesesCentavos: meses },
      erros: erros
    };
  }

  /** Valida o motivo de uma anulação. @returns {string|null} mensagem de erro */
  function validarMotivo(motivo) {
    return String(motivo || '').trim().length < 5 ? 'Descreva o motivo (mínimo 5 caracteres) — obrigatório para a trilha de auditoria.' : null;
  }

  PO.domain.ajustesDespesa = Object.freeze({
    OPERACOES: OPERACOES,
    chaveImportada: chaveImportada,
    camposDerivados: camposDerivados,
    aplicar: aplicar,
    historico: historico,
    resumir: resumir,
    inclusoesParaReaplicar: inclusoesParaReaplicar,
    validar: validar,
    validarMotivo: validarMotivo
  });
})(window.PO);
