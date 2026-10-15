// JAVASCRIPT
/**
 * @file config.js
 * @description Configuração central e tabelas de referência (somente leitura).
 *
 * Para incluir/remover Secretarias basta editar a lista `orgaos`.
 * Códigos: coluna "Unidade orçamentária" do cronograma de despesas.
 * Nomes: informados pela equipe de orçamento (v0.1.1).
 */
(function (PO) {
  'use strict';

  /**
   * Cria um órgão (Unidade Orçamentária).
   * @param {string} codigo Código da Unidade Orçamentária (ex.: "02.01").
   * @param {'secretaria'|'outro'} tipo Secretarias aparecem no menu "Secretarias".
   * @param {string} [nome]
   */
  function orgao(codigo, tipo, nome) {
    return Object.freeze({
      codigo: codigo,
      tipo: tipo,
      nome: nome || (tipo === 'secretaria' ? 'Secretaria ' + codigo : 'Órgão ' + codigo)
    });
  }

  PO.core.config = Object.freeze({
    app: Object.freeze({
      nome: 'Planejamento Orçamentário',
      municipio: 'Botucatu/SP'
    }),

    exercicioPadrao: 2027,

    db: Object.freeze({
      nome: 'planejamentoOrcamentario',
      versao: 2
    }),

    /** Faixa aceita para cadastro de exercícios (sem teto fixo de 4 anos). */
    exercicioMinimo: 2000,
    exercicioMaximo: 2100,

    /** Tamanho máximo aceito na importação (bytes). */
    importacaoTamanhoMaximo: 20 * 1024 * 1024,

    /** Biblioteca SheetJS: tenta a cópia local primeiro, depois a CDN oficial. */
    vendor: Object.freeze({
      xlsxLocal: 'vendor/xlsx.full.min.js',
      xlsxCdn: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
    }),

    /** Unidades Orçamentárias. 21 Secretarias (02.xx) + órgãos 01.01 e 03.01. */
    orgaos: Object.freeze([
      orgao('01.01', 'outro', 'Câmara Municipal de Botucatu'),
      orgao('02.01', 'secretaria', 'Gabinete'),
      orgao('02.02', 'secretaria', 'Habitação'),
      orgao('02.04', 'secretaria', 'Educação'),
      orgao('02.06', 'secretaria', 'Saúde'),
      orgao('02.07', 'secretaria', 'Esportes'),
      orgao('02.08', 'secretaria', 'Segurança'),
      orgao('02.09', 'secretaria', 'Assistência Social'),
      orgao('02.10', 'secretaria', 'Fundo Municipal de Assistência Social'),
      orgao('02.11', 'secretaria', 'Cultura'),
      orgao('02.12', 'secretaria', 'Infraestrutura'),
      orgao('02.21', 'secretaria', 'Encargos Gerais'),
      orgao('02.32', 'secretaria', 'Procuradoria'),
      orgao('02.34', 'secretaria', 'Desenvolvimento Econômico'),
      orgao('02.35', 'secretaria', 'Zeladoria'),
      orgao('02.36', 'secretaria', 'Governo'),
      orgao('02.37', 'secretaria', 'Administração'),
      orgao('02.38', 'secretaria', 'Fazenda'),
      orgao('02.39', 'secretaria', 'Comunicação'),
      orgao('02.40', 'secretaria', 'Turismo'),
      orgao('02.41', 'secretaria', 'Meio Ambiente'),
      orgao('02.42', 'secretaria', 'Agricultura'),
      orgao('03.01', 'outro', 'Fundo Municipal de Previdência Social')
    ]),

    /**
     * Receitas (CSV Fiorilli): a 1ª coluna de valor (VLR6_CALC) refere-se ao
     * ano ANTERIOR ao exercício planejado. Arquivo 2027: VLR6=2026, VLR7=2027,
     * VLR8=2028, VLR9=2029. Usado como valor padrão no formulário de importação.
     */
    receitasDeslocamentoAnoInicial: -1,

    /** Fontes de recurso — codificação AUDESP/TCE-SP. */
    fontes: Object.freeze({
      '1': 'Tesouro',
      '2': 'Transferências e Convênios Estaduais — Vinculados',
      '3': 'Recursos Próprios de Fundos Especiais de Despesa — Vinculados',
      '4': 'Recursos Próprios da Administração Indireta',
      '5': 'Transferências e Convênios Federais — Vinculados',
      '6': 'Outras Fontes de Recursos',
      '7': 'Operações de Crédito',
      '8': 'Emendas Parlamentares Individuais — Legislativo Municipal'
    }),

    /** Natureza da despesa — 1º dígito. */
    categoriasDespesa: Object.freeze({
      '3': 'Despesas Correntes',
      '4': 'Despesas de Capital',
      '9': 'Reserva de Contingência'
    }),

    /** Natureza da despesa — 2º dígito (Grupo de Natureza da Despesa). */
    gnd: Object.freeze({
      '1': 'Pessoal e Encargos Sociais',
      '2': 'Juros e Encargos da Dívida',
      '3': 'Outras Despesas Correntes',
      '4': 'Investimentos',
      '5': 'Inversões Financeiras',
      '6': 'Amortização da Dívida',
      '9': 'Reserva de Contingência'
    }),

    /** Funções de governo (Portaria MOG nº 42/1999) — 2 primeiros dígitos da funcional. */
    funcoes: Object.freeze({
      '01': 'Legislativa', '02': 'Judiciária', '03': 'Essencial à Justiça', '04': 'Administração',
      '05': 'Defesa Nacional', '06': 'Segurança Pública', '07': 'Relações Exteriores',
      '08': 'Assistência Social', '09': 'Previdência Social', '10': 'Saúde', '11': 'Trabalho',
      '12': 'Educação', '13': 'Cultura', '14': 'Direitos da Cidadania', '15': 'Urbanismo',
      '16': 'Habitação', '17': 'Saneamento', '18': 'Gestão Ambiental', '19': 'Ciência e Tecnologia',
      '20': 'Agricultura', '21': 'Organização Agrária', '22': 'Indústria', '23': 'Comércio e Serviços',
      '24': 'Comunicações', '25': 'Energia', '26': 'Transporte', '27': 'Desporto e Lazer',
      '28': 'Encargos Especiais', '99': 'Reserva de Contingência'
    }),

    /**
     * Siglas usuais → prefixo do código de receita (busca na tela Receitas).
     * Os arquivos Fiorilli trazem o nome por extenso, sem a sigla.
     */
    siglasReceita: Object.freeze({
      iptu: '1112.50',
      itbi: '1112.53',
      itr: '1112.01',
      irrf: '1113.03',
      iss: '1114.51',
      issqn: '1114.51',
      cip: '1241',
      cosip: '1241',
      fpm: '1711.51',
      icms: '1721.50',
      ipva: '1721.51',
      fundeb: '1751',
      sus: '1713'
    }),

    /** Natureza da receita — classificação pelo 1º dígito do código. */
    categoriasReceita: Object.freeze({
      '1': Object.freeze({ chave: 'corrente', rotulo: 'Receitas Correntes' }),
      '2': Object.freeze({ chave: 'capital', rotulo: 'Receitas de Capital' }),
      '7': Object.freeze({ chave: 'intra-corrente', rotulo: 'Receitas Correntes Intraorçamentárias' }),
      '8': Object.freeze({ chave: 'intra-capital', rotulo: 'Receitas de Capital Intraorçamentárias' }),
      '9': Object.freeze({ chave: 'deducao', rotulo: 'Deduções da Receita' })
    })
  });
})(window.PO);
