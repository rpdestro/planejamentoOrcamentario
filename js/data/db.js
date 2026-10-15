// JAVASCRIPT
/**
 * @file db.js
 * @description Wrapper Promise sobre IndexedDB (banco local do navegador).
 *
 * Object stores:
 *   - importacoes : lotes de importação (trilha de auditoria). keyPath "id".
 *   - despesas    : linhas de despesa. autoIncrement; índice "loteId".
 *   - receitas    : linhas de receita. autoIncrement; índice "loteId".
 *   - ajustesDespesa : inclusões/alterações/anulações manuais de dotações
 *                   (v2). autoIncrement; índice "loteId". Somente inserção.
 *   - exercicios  : exercícios cadastrados manualmente (v2). keyPath "ano".
 *
 * Imutabilidade (CLAUDE.md): não há operação de exclusão. Uma nova
 * importação do mesmo tipo/exercício marca o lote anterior como
 * "substituida" — os registros antigos permanecem para auditoria.
 * "Excluir" uma dotação grava um ajuste de anulação; nada é apagado.
 */
(function (PO) {
  'use strict';

  var STORES = Object.freeze({
    importacoes: 'importacoes',
    despesas: 'despesas',
    receitas: 'receitas',
    ajustesDespesa: 'ajustesDespesa',
    exercicios: 'exercicios'
  });

  var conexao = null;

  /** Converte um IDBRequest em Promise. */
  function promessa(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  /** Cria/atualiza o schema. Cada versão adiciona apenas o que falta. */
  function migrar(db) {
    if (!db.objectStoreNames.contains(STORES.importacoes)) {
      var imp = db.createObjectStore(STORES.importacoes, { keyPath: 'id' });
      imp.createIndex('tipo', 'tipo', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORES.despesas)) {
      var desp = db.createObjectStore(STORES.despesas, { keyPath: 'id', autoIncrement: true });
      desp.createIndex('loteId', 'loteId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORES.receitas)) {
      var rec = db.createObjectStore(STORES.receitas, { keyPath: 'id', autoIncrement: true });
      rec.createIndex('loteId', 'loteId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORES.ajustesDespesa)) {
      var aj = db.createObjectStore(STORES.ajustesDespesa, { keyPath: 'id', autoIncrement: true });
      aj.createIndex('loteId', 'loteId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORES.exercicios)) {
      db.createObjectStore(STORES.exercicios, { keyPath: 'ano' });
    }
  }

  /**
   * Abre (uma única vez) a conexão com o banco.
   * @returns {Promise<IDBDatabase>}
   */
  function abrir() {
    if (conexao) {
      return conexao;
    }
    if (!window.indexedDB) {
      return Promise.reject(new Error('Este navegador não suporta IndexedDB. Use Chrome, Edge ou Firefox atualizados.'));
    }
    var cfg = PO.core.config.db;
    conexao = new Promise(function (resolve, reject) {
      var request = window.indexedDB.open(cfg.nome, cfg.versao);
      request.onupgradeneeded = function () {
        migrar(request.result);
      };
      request.onsuccess = function () {
        // Libera a conexão se outra aba abrir uma versão mais nova do schema.
        request.result.onversionchange = function () {
          request.result.close();
        };
        resolve(request.result);
      };
      request.onerror = function () {
        conexao = null;
        reject(request.error || new Error('Falha ao abrir o banco local.'));
      };
      request.onblocked = function () {
        reject(new Error('Banco local bloqueado por outra aba. Feche as outras abas da aplicação.'));
      };
    });
    return conexao;
  }

  /**
   * Lista todos os registros de um store.
   * @param {string} store
   * @returns {Promise<Array>}
   */
  function listarTodos(store) {
    return abrir().then(function (db) {
      return promessa(db.transaction(store, 'readonly').objectStore(store).getAll());
    });
  }

  /**
   * Lista registros por valor de índice.
   * @param {string} store
   * @param {string} indice
   * @param {*} valor
   * @returns {Promise<Array>}
   */
  function listarPorIndice(store, indice, valor) {
    return abrir().then(function (db) {
      return promessa(db.transaction(store, 'readonly').objectStore(store).index(indice).getAll(valor));
    });
  }

  /**
   * Grava um lote de importação de forma ATÔMICA: registra a importação,
   * marca as importações ativas substituídas e insere os registros.
   * Se qualquer passo falhar, nada é gravado.
   *
   * @param {Object} importacao  registro do lote (com id)
   * @param {string[]} idsSubstituidos  ids de lotes que deixam de ser ativos
   * @param {string} storeRegistros  "despesas" | "receitas"
   * @param {Array} registros
   * @returns {Promise<void>}
   */
  function gravarLote(importacao, idsSubstituidos, storeRegistros, registros) {
    return abrir().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORES.importacoes, storeRegistros], 'readwrite');
        var stImp = tx.objectStore(STORES.importacoes);
        var stReg = tx.objectStore(storeRegistros);

        idsSubstituidos.forEach(function (id) {
          var req = stImp.get(id);
          req.onsuccess = function () {
            var anterior = req.result;
            if (anterior) {
              anterior.status = 'substituida';
              anterior.substituidaPor = importacao.id;
              stImp.put(anterior);
            }
          };
        });

        stImp.add(importacao);
        registros.forEach(function (registro) {
          stReg.add(registro);
        });

        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error || new Error('Falha ao gravar a importação.'));
        };
        tx.onabort = function () {
          reject(tx.error || new Error('Gravação cancelada.'));
        };
      });
    });
  }

  /**
   * Insere um registro (falha se a chave já existir — nunca sobrescreve).
   * @param {string} store
   * @param {Object} registro
   * @returns {Promise<*>} chave gerada
   */
  function inserir(store, registro) {
    return abrir().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var req = tx.objectStore(store).add(registro);
        tx.oncomplete = function () {
          resolve(req.result);
        };
        tx.onerror = function () {
          reject(tx.error || new Error('Falha ao gravar no banco local.'));
        };
        tx.onabort = function () {
          reject(tx.error || new Error('Gravação cancelada.'));
        };
      });
    });
  }

  PO.data.db = Object.freeze({
    STORES: STORES,
    abrir: abrir,
    listarTodos: listarTodos,
    listarPorIndice: listarPorIndice,
    gravarLote: gravarLote,
    inserir: inserir
  });
})(window.PO);
