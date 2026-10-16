# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [0.7.2] — 2026-10-16

### Alterado
- **Secretarias → Dotações: o layout do Mensal (v0.7.1) passa a valer para Bimestral, Trimestral, Quadrimestral e
  Anual.** Mesmas colunas (UE, Funcional, Natureza, Descrição, Fonte, Total orçamento, Situação, Ações), alinhamento à
  esquerda, Situação com semáforo e sem a coluna "Valor insuficiente".
  - **Resumo:** o painel ao clicar na linha mostra as barras do período escolhido, com o valor por extenso sobre
    cada barra. Bimestral e Trimestral trazem a faixa de subtotais por semestre; Quadrimestral, só as barras. O 4º
    indicador vira "Períodos com valor".
  - **Anual:** o painel mostra os indicadores e os 12 meses como referência (barras esmaecidas). O alternador fica
    oculto, pois a Grade teria uma única coluna.
  - **Grade completa (Bim/Tri/Quad):** valores por extenso em mapa de calor; rodapé com o total por período.
- Sai a tabela antiga dos períodos agregados (com "Valor insuficiente" e selos OK/Divergente). Com isso,
  `celula-valor-insuficiente` deixa de existir na tela de Secretarias (use `celula-situacao`).

## [0.7.1] — 2026-10-16

### Alterado
- **Secretarias → Dotações (Mensal), visões Resumo e Grade completa:**
  - Voltam as colunas essenciais **UE, Funcional, Natureza, Descrição, Fonte e Total orçamento**.
  - Títulos e dados de todas as colunas alinhados à esquerda.
  - A coluna **"Valor insuficiente" sai** e a **"Situação"** passa a exibir a diferença entre o total do orçamento e o
    valor diluído nos meses, com semáforo: **verde "Atende"** (0,00), **amarelo "Falta diluir"** (diluído menor que o
    total) e **vermelho "Excede"** (diluído maior que o total). Os selos "Não diluída", "Manual" e "Alterada" seguem
    ao lado.
  - Botões Alterar/Excluir sempre visíveis.
- **Resumo:** sai a coluna "Distribuição Jan–Dez". Clicar na linha (ou em ▸) abre um painel com Total orçamento,
  Diluído Jan–Dez, Situação, meses com valor e média, gráfico de barras dos 12 meses (valor sobre cada barra; exato
  no tooltip) e subtotais por trimestre. Sai o rodapé com minigráfico.
- **Grade completa:** total do orçamento por extenso; meses seguem abreviados em mapa de calor. O rodapé mantém os
  totais por mês.
- Importar planilhas e Base Excel mantêm os indicadores atuais (Negativo/Atende/Positivo).

### `data-testid`
Novo: `celula-situacao` (substitui `celula-valor-insuficiente` nas visões do Mensal; nos demais períodos ela continua).

## [0.7.0] — 2026-10-16

### Alterado
- **Secretarias → Dotações (período Mensal): novo layout com duas visões**, escolhidas no alternador acima da
  tabela (a escolha fica lembrada no navegador):
  - **Resumo** (padrão): uma linha enxuta por dotação — natureza · fonte, descrição em até 2 linhas, total,
    **minigráfico Jan–Dez** (valor exato no tooltip de cada barra) e situação. Clicar na linha (ou em ▸) abre o
    detalhe com UE, funcional e os 12 meses em grade 6 × 2. O rodapé traz o minigráfico consolidado.
  - **Grade completa**: os 12 meses lado a lado com valores abreviados ("287,5 mil"; exato no tooltip), zeros
    como "—", fundo em tom proporcional ao peso do mês e separadores por trimestre.
  - "Valor insuficiente" e "Situação" passam a ser **uma só coluna**: o valor da coluna H aparece só quando há
    diferença (ex.: "-15.000,00 · Negativo").
  - Os botões Alterar/Excluir aparecem ao passar o mouse na linha (sempre visíveis em telas de toque e no foco
    por teclado).
  - Sai o modo "semestres empilhados" (pares Jan/Jul…), substituído pelas visões acima.
- Os demais períodos (bimestral, trimestral…) mantêm a tabela anterior.
- `componentes.tabela`: coluna aceita `classe` (classe extra em `th`/`td`).

### `data-testid` novos / removidos
Novos: `btn-visao-resumo`, `btn-visao-grade`, `txt-visao-mensal`, `btn-expandir-dotacao-{id}`, `detalhe-dotacao-{id}`.
Removido: `txt-mensal-semestres`. `celula-valor-insuficiente` passa a marcar a coluna "Situação" no Mensal.

- **Gráficos → "2. Receitas de Capital"**: o total passa a ser `2200.00.0.0.00.00` + `2400.00.0.0.00.00`, lido
  direto dessas linhas do arquivo Fiorilli (antes: soma das analíticas iniciadas por `2`). Novo subgrupo
  "Transferências de Capital" (2400).
- **Gráficos → "6. Orçamento por grupo"**: a origem "Receita de Capital" segue a mesma regra (2200 + 2400).
- A regra fica em um só lugar: `CODIGOS_CAPITAL` em `js/domain/composicao-receita.js`.

## [0.6.1] — 2026-10-15

### Adicionado
- **Secretarias → Dotações: coluna "Valor insuficiente"** (coluna H) ao lado do Total, com o valor (total − soma
  dos meses) e o indicador **Negativo** (vermelho) / **Atende** (azul) / **Positivo** (verde). O rodapé traz a soma
  da coluna. Funciona em todos os períodos e no modo Mensal compacto/empilhado.

### `data-testid` novos
`celula-valor-insuficiente`.

## [0.6.0] — 2026-10-15

### Adicionado
- **Importar planilhas → Despesas: coluna H "Valor insuficiente" calculada** (valor total − soma dos meses), com
  indicador no padrão dos selos da coluna "Situação": **Negativo** (vermelho), **Atende** (azul), **Positivo** (verde).
  A prévia mostra a contagem por situação, quanto falta no total e o bloco recolhível "Conferência da coluna H"
  (colunas A–H + indicador, com filtro por situação). Regra pura em `js/domain/valor-insuficiente.js`.
- **Novo módulo "Base Excel"** (`#/base-excel`): "Gerar base Excel" cria um `.xlsx` com as dotações efetivas
  (lote + ajustes) no mesmo layout de colunas do Cronograma de Orçamento (A–T; H como fórmula `=G-SUM(I:T)`),
  mais as abas "Ajustes" (trilha de auditoria) e "Informações". No Chrome/Edge o arquivo fica vinculado na sessão e
  "Salvar modificações na base" o regrava; nos demais navegadores a base é baixada. Avisa quando há modificações
  ainda não salvas. A base é reimportável em Importar planilhas → Despesas (verificado sem perdas nas 1.335 dotações
  do cronograma 2027).
- Selo `badge--info` (azul) e utilitário global `[hidden] { display: none !important }`.
- 9 testes unitários em `tests/unit/valor-insuficiente.test.js` (regra da coluna H, layout e reimportação da base).

### Alterado
- `insuficienteCentavos` deixa de ser lido da planilha: passa a ser calculado na importação e nos ajustes
  (inclusão/alteração), mantendo-se coerente com o cronograma.

### `data-testid` novos
`previa-valor-insuficiente`, `select-filtro-valor-insuficiente`, `tabela-valor-insuficiente`, `nav-base-excel`,
`painel-base-excel`, `kpis-base-excel`, `kpi-base-dotacoes`, `kpi-base-ajustes`, `kpi-base-negativo`,
`kpi-base-atende-positivo`, `btn-gerar-base-excel`, `btn-salvar-base-excel`, `txt-base-excel-vinculo`,
`txt-base-excel-status`, `aviso-base-desatualizada`, `base-excel-vazia`.

## [0.5.0] — 2026-10-15

### Adicionado
- **Botão "Modo escuro"** no cabeçalho (☾/☀; só o ícone no celular). A escolha fica salva no navegador; sem
  escolha salva, a aplicação segue a preferência do sistema operacional. O tema é aplicado no `<head>`
  (`js/ui/tema.js`), antes da primeira pintura, para a tela não piscar em branco.
- Tema escuro definido apenas por tokens em `css/base.css` (`:root[data-tema="escuro"]`), restrito a `screen`:
  **a impressão dos relatórios sai sempre no tema claro.**
- 3 testes unitários em `tests/unit/tema.test.js` (regra `tema.resolver`).

### Alterado
- Novos tokens `--cor-cabecalho`, `--cor-destaque-texto`, `--cor-destaque-texto-forte` e
  `--cor-erro-preenchimento`: separam a cor primária usada como *preenchimento* da usada como *texto*, que no
  modo escuro precisam de tons diferentes. Links, abas, botões secundários e itens ativos do menu passaram a usá-los.
- Seletor de exercício do cabeçalho usa `--cor-superficie` em vez de branco fixo.

### `data-testid` novos
`btn-modo-escuro`.

## [0.4.0] — 2026-10-15

### Adicionado
- **Identidade visual:** brasão da Prefeitura Municipal de Botucatu no cabeçalho da aplicação e como favicon.
- **Relatórios impressos com brasão:** cabeçalho institucional exclusivo de impressão (`.print-header`, oculto na
  tela) no topo de toda impressão — Relatórios Gerenciais, Relatório de Projeção das Secretarias e Gráficos.

### Alterado
- Imagem `brasao.png` da raiz movida para `assets/img/brasao-botucatu.png` (nova pasta de recursos estáticos).

### `data-testid` novos
`img-logo-header`, `cabecalho-impressao`.

## [0.3.0] — 2026-10-15

### Adicionado
- **Secretarias — aba "Histórico de ajustes"** (somente leitura): trilha de auditoria das inclusões, alterações e
  anulações da unidade, da mais recente para a mais antiga, com nº do ajuste, data/hora, operação, natureza,
  descrição, valor antes/depois e motivo. Ajustes sobre dotação já anulada aparecem como "Sem efeito".
- **Importar — aviso de ajustes substituídos.** Ao reimportar despesas de um exercício cujo lote ativo tem ajustes
  manuais, a prévia mostra quantos ajustes deixarão de valer e oferece (marcado por padrão) **reaplicar as inclusões
  manuais vigentes** no novo lote. Cada uma é gravada como um *novo* ajuste de inclusão, com `origemAjuste`
  (lote e nº originais) e motivo de referência; os ajustes antigos permanecem intactos. A reaplicação é idempotente.
  Alterações e anulações de dotações importadas não são reaplicadas (as chaves do lote antigo não existem no novo).
- `ajustesDespesa.historico`, `resumir` e `inclusoesParaReaplicar` (domínio puro);
  `repositorio.obterAjustesDoLoteAtivo` e `reaplicarInclusoes`; `listarDespesas` passa a devolver também `base`.
- 8 testes unitários novos em `tests/unit/ajustes-despesa.test.js` (55 no total).

### `data-testid` novos
`aba-historico-ajustes`, `painel-historico-ajustes`, `tabela-historico-ajustes`, `aviso-ajustes-substituidos`,
`chk-reaplicar-inclusoes`.

## [0.2.0] — 2026-10-15

### Adicionado
- **Secretarias — Adicionar, Alterar e Excluir dotações.** Cada ação vira um *ajuste* auditável
  (store `ajustesDespesa`, somente inserção, com motivo e data/hora). O lote importado nunca é modificado;
  "Excluir" é uma anulação formal (a dotação sai dos totais e permanece na trilha de auditoria).
  Os ajustes ficam vinculados à importação ativa: uma nova importação do mesmo exercício começa sem eles.
- **Secretarias — Busca rápida** (descrição, natureza, funcional, UE, fonte ou valor; vários termos) e botão **Limpar filtros**.
- **Secretarias — aba "Relatório de Projeção"** imprimível, que respeita a busca e os filtros da aba Dotações,
  com agrupamento por UE, GND, categoria, natureza (até elemento), fonte ou função.
- **Módulo Gráficos** (`#/graficos`): Receitas Correntes (Tributárias, Contribuições, Patrimoniais, Serviços,
  Transferências, Outras), Receitas de Capital, Intraorçamentárias (RPPS), Deduções FUNDEB, Orçamento Geral e
  Orçamento por Grupo de Receita e Despesa (PLOA). Gráficos em HTML/CSS (sem biblioteca, funcionam offline),
  com tabela equivalente em cada cartão e impressão.
- **Cadastro de exercícios** (botão "+" ao lado do seletor de Exercício), sem o limite anterior de 2029.
- Botão ☰ também no desktop: recolhe o menu lateral para liberar largura.
- Relatórios Gerenciais: agrupamento por órgão, função, categoria, GND ou fonte.
- Testes unitários de `ajustes-despesa.js` e `composicao-receita.js` (47 testes no total).

### Alterado
- Menu lateral: **Visão geral** (Painel, Gráficos, Receitas, Relatórios de Projeção, Exportar, Importar planilhas)
  → **Secretarias** → **Outros órgãos**. O grupo "Ferramentas" deixou de existir.
- Período **Mensal** nas Secretarias: tabela compacta, sem barra de rolagem. Se os 12 meses não couberem na
  largura, a tabela passa a mostrar os meses em pares (Jan/Jul, Fev/Ago…), em duas linhas, sem omitir valores.
- Banco local passa para a versão 2 do schema (stores `ajustesDespesa` e `exercicios`; migração automática).
- `data-testid` dos Relatórios: `select-relatorio-projecao-periodo`, `select-relatorio-projecao-agrupamento`,
  `btn-relatorio-projecao-imprimir` (antes `select-relatorio-periodo` e `btn-imprimir-relatorio`).

## [0.1.1] — 2026-10-14

### Alterado
- Nomes oficiais das 21 Secretarias, da Câmara Municipal (01.01) e do Fundo Municipal de Previdência Social (03.01).
- Receitas Fiorilli: a 1ª coluna de valor (`VLR6_CALC`) passa a corresponder ao ano anterior ao exercício
  (arquivo 2027: VLR6=2026, VLR7=2027, VLR8=2028, VLR9=2029). O formulário sugere esse ano automaticamente
  (`receitasDeslocamentoAnoInicial` em `config.js`).

## [0.1.0] — 2026-10-14

### Adicionado
- Esqueleto da SPA (HTML semântico, CSS BEM, JS modular sob o namespace `PO`), que funciona via `file://`.
- Navegação: Painel, Receitas, 21 Secretarias + 2 outros órgãos, Relatórios, Exportar e Importar.
- Persistência local em IndexedDB, com lotes de importação imutáveis (status `ativa`/`substituida`).
- Importador em duas etapas (prévia → gravação) para:
  - Despesas — cronograma `.xlsx/.xls/.csv`;
  - Receitas — CSV Fiorilli "Fontes de Financiamento dos Programas Governamentais".
- Diluição da despesa por período: mensal, bimestral, trimestral, quadrimestral e anual.
- Filtros por Unidade Executora, Categoria, GND, Fonte e prefixo de Natureza de Despesa.
- Relatório de projeção por órgão × período, com impressão (A4 paisagem).
- Exportação `.xlsx`, `.xls` e `.csv`.
- Testes unitários no navegador (`tests/index.html`).
