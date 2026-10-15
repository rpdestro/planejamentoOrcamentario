// JAVASCRIPT
/**
 * @file repositorio.js
 * @description Camada de acesso a dados orientada ao domínio. As views só
 * conversam com este módulo — nunca com o IndexedDB diretamente.
 *
 * Regra do "lote ativo": para cada tipo (despesas/receitas) e exercício,
 * vale a importação mais recente com status "ativa".
 */
(function (PO) {
  'use strict';

  var db = PO.data.db;
  var STORES = db.STORES;

  /** Cache em memória por loteId (dados de lote são imutáveis). */
  var cacheRegistros = new Map();

  /** @returns {Promise<Array>} importações, mais recentes primeiro */
  function listarImportacoes() {
    return db.listarTodos(STORES.importacoes).then(function (lista) {
      return lista.sort(function (a, b) {
        return b.dataHora.localeCompare(a.dataHora);
      });
    });
  }

  /**
   * Lote ativo de um tipo que cobre o exercício.
   * Despesas: lote.exercicio === exercicio. Receitas: exercício ∈ lote.anos.
   * @param {'despesas'|'receitas'} tipo
   * @param {number} exercicio
   * @returns {Promise<Object|null>}
   */
  function obterLoteAtivo(tipo, exercicio) {
    return listarImportacoes().then(function (lista) {
      return lista.find(function (imp) {
        return imp.tipo === tipo && imp.status === 'ativa' && cobreExercicio(imp, exercicio);
      }) || null;
    });
  }

  function cobreExercicio(importacao, exercicio) {
    if (Array.isArray(importacao.anos)) {
      return importacao.anos.indexOf(exercicio) !== -1;
    }
    return importacao.exercicio === exercicio;
  }

  /**
   * Registros do lote ativo.
   * @param {'despesas'|'receitas'} tipo
   * @param {number} exercicio
   * @returns {Promise<{lote:Object|null, registros:Array}>}
   */
  function listarRegistros(tipo, exercicio) {
    return obterLoteAtivo(tipo, exercicio).then(function (lote) {
      if (!lote) {
        return { lote: null, registros: [] };
      }
      if (cacheRegistros.has(lote.id)) {
        return { lote: lote, registros: cacheRegistros.get(lote.id) };
      }
      return db.listarPorIndice(STORES[tipo], 'loteId', lote.id).then(function (registros) {
        registros.sort(function (a, b) {
          return a.linhaOrigem - b.linhaOrigem;
        });
        cacheRegistros.set(lote.id, registros);
        return { lote: lote, registros: registros };
      });
    });
  }

  /**
   * Dotações EFETIVAS: lote ativo + ajustes manuais (inclusão/alteração/anulação).
   * `base` traz o lote sem ajustes (necessário para a trilha antes/depois).
   * @returns {Promise<{lote, registros, base?, ajustes?}>}
   */
  function listarDespesas(exercicio) {
    return listarRegistros('despesas', exercicio).then(function (res) {
      if (!res.lote) {
        return res;
      }
      return listarAjustes(res.lote.id).then(function (ajustes) {
        return { lote: res.lote, registros: PO.domain.ajustesDespesa.aplicar(res.registros, ajustes), base: res.registros, ajustes: ajustes };
      });
    });
  }

  /**
   * Lote de despesas ativo do exercício e seus ajustes — usado para avisar,
   * antes de gravar uma reimportação, quais ajustes deixarão de valer.
   * @param {number} exercicio
   * @returns {Promise<{lote:Object, ajustes:Array}|null>} null se não houver lote ativo
   */
  function obterAjustesDoLoteAtivo(exercicio) {
    return obterLoteAtivo('despesas', exercicio).then(function (lote) {
      if (!lote) {
        return null;
      }
      return listarAjustes(lote.id).then(function (ajustes) {
        return { lote: lote, ajustes: ajustes };
      });
    });
  }

  /**
   * Reaplica no lote ATIVO, como NOVOS ajustes de inclusão, as inclusões
   * manuais vigentes de um lote anterior (substituído). Os ajustes antigos
   * permanecem intactos; cada novo registra `origemAjuste` para rastreio.
   * Idempotente: inclusões já reaplicadas neste lote são ignoradas.
   *
   * @param {string} loteAnteriorId
   * @param {number} exercicio
   * @returns {Promise<Array>} ajustes gravados
   */
  function reaplicarInclusoes(loteAnteriorId, exercicio) {
    return Promise.all([listarAjustes(loteAnteriorId), obterAjustesDoLoteAtivo(exercicio)]).then(function (res) {
      var ativo = res[1];
      if (!ativo || ativo.lote.id === loteAnteriorId) {
        throw new Error('Não há um novo lote de despesas ativo para ' + exercicio + '.');
      }
      var jaReaplicados = new Set(ativo.ajustes
        .filter(function (a) { return a.origemAjuste && a.origemAjuste.loteId === loteAnteriorId; })
        .map(function (a) { return a.origemAjuste.id; }));
      var pendentes = PO.domain.ajustesDespesa.inclusoesParaReaplicar(res[0]).filter(function (i) {
        return !jaReaplicados.has(i.origemId);
      });
      // Sequencial: mantém a ordem original dos ids (ordem de aplicação).
      return pendentes.reduce(function (cadeia, inc) {
        return cadeia.then(function (gravados) {
          return registrarAjuste(exercicio, {
            operacao: PO.domain.ajustesDespesa.OPERACOES.inclusao,
            uo: inc.uo,
            alvo: null,
            dados: inc.dados,
            motivo: 'Reaplicação da inclusão manual nº ' + inc.origemId + ' do lote ' + loteAnteriorId +
              (inc.motivoOriginal ? ' (' + inc.motivoOriginal + ')' : ''),
            origemAjuste: { loteId: loteAnteriorId, id: inc.origemId }
          }).then(function (ajuste) {
            return gravados.concat([ajuste]);
          });
        });
      }, Promise.resolve([]));
    });
  }

  /**
   * Ajustes manuais vinculados a um lote de despesas.
   * @param {string} loteId
   * @returns {Promise<Array>}
   */
  function listarAjustes(loteId) {
    return db.listarPorIndice(STORES.ajustesDespesa, 'loteId', loteId);
  }

  /**
   * Registra um ajuste (inclusão, alteração ou anulação) no lote ativo do
   * exercício. Somente inserção — o histórico nunca é reescrito.
   * @param {number} exercicio
   * @param {{operacao:string, uo:string, alvo?:string, dados?:Object, motivo?:string}} ajuste
   * @returns {Promise<Object>} o ajuste gravado (com id)
   */
  function registrarAjuste(exercicio, ajuste) {
    return obterLoteAtivo('despesas', exercicio).then(function (lote) {
      if (!lote) {
        throw new Error('Não há cronograma de despesas importado para ' + exercicio + '. Importe a planilha antes de lançar ajustes.');
      }
      var registro = Object.assign({}, ajuste, {
        loteId: lote.id,
        exercicio: exercicio,
        dataHora: new Date().toISOString()
      });
      return db.inserir(STORES.ajustesDespesa, registro).then(function (id) {
        registro.id = id;
        PO.core.eventos.emit('dados:atualizados', { tipo: 'ajustesDespesa' });
        return registro;
      });
    });
  }

  /**
   * Cadastra um exercício manualmente (ex.: 2030), sem depender de importação.
   * @param {number} ano
   * @returns {Promise<number>}
   */
  function cadastrarExercicio(ano) {
    return listarExercicios().then(function (anos) {
      if (anos.indexOf(ano) !== -1) {
        throw new Error('O exercício ' + ano + ' já está cadastrado.');
      }
      return db.inserir(STORES.exercicios, { ano: ano, dataHora: new Date().toISOString() });
    }).then(function () {
      PO.core.eventos.emit('dados:atualizados', { tipo: 'exercicios' });
      return ano;
    });
  }

  /** @returns {Promise<{lote, registros}>} */
  function listarReceitas(exercicio) {
    return listarRegistros('receitas', exercicio);
  }

  /**
   * Salva um lote importado. Lotes ativos do mesmo tipo e mesmo exercício
   * de referência passam a "substituida" (sem exclusão física).
   * @param {Object} importacao
   * @param {Array} registros (sem loteId — será atribuído aqui)
   * @returns {Promise<Object>} a importação gravada
   */
  function salvarImportacao(importacao, registros) {
    return listarImportacoes().then(function (lista) {
      var substituidos = lista
        .filter(function (imp) {
          return imp.tipo === importacao.tipo && imp.status === 'ativa' && imp.exercicio === importacao.exercicio;
        })
        .map(function (imp) {
          return imp.id;
        });

      var comLote = registros.map(function (registro) {
        return Object.assign({}, registro, { loteId: importacao.id });
      });

      return db.gravarLote(importacao, substituidos, STORES[importacao.tipo], comLote).then(function () {
        PO.core.eventos.emit('dados:atualizados', { tipo: importacao.tipo });
        return importacao;
      });
    });
  }

  /** Exercícios conhecidos (padrão + cobertos por importações + cadastrados manualmente). */
  function listarExercicios() {
    return Promise.all([listarImportacoes(), db.listarTodos(STORES.exercicios)]).then(function (res) {
      var anos = new Set([PO.core.config.exercicioPadrao]);
      res[0].forEach(function (imp) {
        (imp.anos || [imp.exercicio]).forEach(function (ano) {
          anos.add(ano);
        });
      });
      res[1].forEach(function (ex) {
        anos.add(ex.ano);
      });
      return Array.from(anos).sort(function (a, b) { return a - b; });
    });
  }

  PO.data.repositorio = Object.freeze({
    listarImportacoes: listarImportacoes,
    obterLoteAtivo: obterLoteAtivo,
    listarDespesas: listarDespesas,
    listarReceitas: listarReceitas,
    salvarImportacao: salvarImportacao,
    listarExercicios: listarExercicios,
    listarAjustes: listarAjustes,
    obterAjustesDoLoteAtivo: obterAjustesDoLoteAtivo,
    registrarAjuste: registrarAjuste,
    reaplicarInclusoes: reaplicarInclusoes,
    cadastrarExercicio: cadastrarExercicio
  });
})(window.PO);
