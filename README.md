# Planejamento Orçamentário — Prefeitura Municipal de Botucatu

**Versão:** 0.5.0 (ver [`VERSION`](VERSION) e [`CHANGELOG.md`](CHANGELOG.md))

Ferramenta web para o planejamento orçamentário municipal. Ela importa as planilhas oficiais (cronograma de despesas e receitas do Fiorilli), distribui as despesas por período e oferece um painel, telas por Secretaria, relatórios de projeção e exportação.

Toda a aplicação é **HTML + CSS + JavaScript puros**, sem servidor, sem Node e sem instalação. Os dados ficam no **IndexedDB do navegador**. As planilhas (.xlsx/.xls/.csv) funcionam como entrada e saída de dados.

---

## Como usar

1. Abra o arquivo `index.html` no **Chrome** ou no **Edge** (duplo clique).
2. Vá em **Importar planilhas** e importe:
   - **Despesas**: `2027 - cronograma de orçamento.xlsx`. Informe o ano 2027.
   - **Receitas**: `FONTES DE FINANCIAMENTO DOS PROGRAMAS GOVERNAMENTAIS CONSOLIDADO.csv`. O ano já vem preenchido com o ano da 1ª coluna de valor, que é o ano anterior ao exercício. No arquivo atual: `VLR6_CALC`=2026, `VLR7_CALC`=2027, `VLR8_CALC`=2028, `VLR9_CALC`=2029.
3. Confira a prévia (resumo, erros e avisos) e clique em **Confirmar e gravar**.
4. Navegue pelo **Painel**, pelos **Gráficos**, por **Receitas**, pelos **Relatórios**, por **Exportar** e pelas **Secretarias**.

### Telas das Secretarias

- **Busca rápida**: digite parte da descrição, natureza, funcional, UE, fonte ou valor. Vários termos são combinados (ex.: `material 3.3.90.30`).
- **Filtros** por UE, categoria, GND, fonte, prefixo de natureza e período. **Limpar filtros** volta tudo ao padrão (Mensal).
- **+ Adicionar dotação**, e em cada linha **✎ Alterar** e **✕ Excluir**. Alterar e Excluir pedem um motivo, que fica na trilha de auditoria. A exclusão é uma *anulação*: a dotação sai dos totais, mas nada é apagado.
- Período **Mensal** sem barra de rolagem: em telas largas os 12 meses ficam lado a lado; em telas menores, aparecem em pares (linha de cima Jan–Jun, linha de baixo Jul–Dez). O botão ☰ recolhe o menu lateral para ganhar espaço.
- Aba **Relatório de Projeção**: projeção imprimível das dotações filtradas, agrupada por UE, GND, categoria, natureza, fonte ou função.
- Aba **Histórico de ajustes**: trilha de auditoria somente leitura (nº, data/hora, operação, natureza, descrição, valor antes/depois e motivo) dos ajustes da unidade na importação ativa.

### Reimportação de despesas com ajustes

Os ajustes ficam vinculados à importação ativa. Ao reimportar o cronograma do mesmo exercício, a prévia avisa quantos ajustes deixarão de valer e oferece **reaplicar as inclusões manuais vigentes** no novo lote, como novos ajustes que apontam para o original. Alterações e anulações de dotações importadas não são reaplicadas: confira se a nova planilha já traz essas correções. Nada é apagado; os ajustes do lote anterior continuam gravados.

### Novo exercício

Clique em **+** ao lado do seletor **Exercício** (cabeçalho) e informe o ano (2000 a 2100). Depois importe as planilhas desse exercício.

> **Planilhas Excel (.xls/.xlsx)** dependem da biblioteca SheetJS. Para usar sem internet, baixe `xlsx.full.min.js` (versão 0.20.3) do site oficial
> `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js` e salve-o em `vendor/xlsx.full.min.js`.
> Sem esse arquivo, a aplicação tenta carregar a biblioteca da internet. Arquivos **.csv** não dependem dela.

### Testes unitários

Abra `tests/index.html` no navegador. Os resultados aparecem na página e ficam disponíveis em `window.__resultadosTestes`, para uso em automação.

---

## Estrutura de pastas

```
planejamentoOrcamentario/
├── index.html                  # <!-- HTML --> casca da SPA (sem CSS/JS inline)
├── assets/                     # recursos estáticos (não código)
│   └── img/
│       └── brasao-botucatu.png # brasão oficial: cabeçalho, favicon e relatórios impressos
├── css/                        # /* CSS */ BEM + Flexbox/Grid
│   ├── base.css                # tokens (variáveis) dos temas claro e escuro, reset, utilitários
│   ├── layout.css              # header, navegação, área principal, responsivo
│   ├── components.css          # painel, KPI, tabela, formulário, alertas, toast
│   ├── views.css               # ajustes específicos de telas
│   └── print.css               # impressão dos relatórios (A4 paisagem)
├── js/                         # // JAVASCRIPT — namespace único window.PO
│   ├── core/                   # transversais
│   │   ├── namespace.js        # cria PO e a versão
│   │   ├── config.js           # órgãos, fontes, GND, categorias, siglas
│   │   ├── dinheiro.js         # aritmética em CENTAVOS INTEIROS
│   │   ├── texto.js · dom.js · eventos.js · estado.js · vendor-loader.js
│   ├── domain/                 # regras de negócio puras (testáveis)
│   │   ├── periodos.js         # mensal/bimestral/trimestral/quadrimestral/anual
│   │   ├── classificacao-despesa.js   # natureza C.G.MM.EE e funcional
│   │   ├── classificacao-receita.js   # hierarquia da natureza de receita
│   │   ├── ajustes-despesa.js  # inclusão/alteração/anulação auditáveis de dotações
│   │   └── composicao-receita.js      # agrupamentos dos Gráficos e quadro PLOA (configurável)
│   ├── data/
│   │   ├── db.js               # IndexedDB (gravação atômica de lotes)
│   │   └── repositorio.js      # acesso a dados por domínio, lote ativo
│   ├── importers/
│   │   ├── csv-parser.js       # CSV tolerante ao padrão Fiorilli, UTF-8/ANSI
│   │   ├── leitor-planilha.js  # .csv/.xls/.xlsx → tabela uniforme (+ .xml futuro)
│   │   ├── mapeador-despesas.js
│   │   ├── mapeador-receitas.js
│   │   └── importador.js       # analisar (prévia) → confirmar (gravar)
│   ├── ui/
│   │   ├── componentes.js      # tabela, campo, diálogo modal, abas, KPI…
│   │   ├── graficos.js         # barras e barra empilhada em HTML/CSS (offline)
│   │   ├── relatorio-projecao.js      # relatório agrupado × período (geral e Secretarias)
│   │   ├── formulario-dotacao.js      # diálogos Adicionar/Alterar/Excluir
│   │   ├── tema.js             # modo claro/escuro (carregado no <head>, evita "piscar")
│   │   ├── notificador.js · roteador.js · navegacao.js
│   │   └── views/              # painel, graficos, secretaria, receitas, importar, relatorios, exportar
│   └── app.js                  # bootstrap
├── tests/                      # executor no navegador + suítes unitárias
├── vendor/                     # bibliotecas de terceiros (opcional, ver acima)
└── .claude/                    # commands/ e mcp/ (skills futuras, ver CLAUDE.md)
```

A ordem das camadas é **core → domain → data → importers → ui → app**. Uma camada só depende das camadas anteriores.

---

## Decisões de arquitetura

| Decisão | Motivo |
|---|---|
| **Scripts clássicos + namespace `PO`** (sem ES Modules) | ES Modules não carregam via `file://`, e o ambiente não permite servidor local. O namespace único evita poluir o escopo global. |
| **Centavos inteiros** em todo o domínio | Exigência de precisão numérica do CLAUDE.md. A conversão para decimal só acontece ao exportar para célula do Excel. |
| **Lotes de importação imutáveis** | Não existe exclusão física. Uma nova importação do mesmo tipo e exercício marca a anterior como `substituida`, que continua no histórico como trilha de auditoria. |
| **Edição por ajustes** (inclusão, alteração, anulação) | O lote importado continua intacto. Cada ação do usuário é um registro novo em `ajustesDespesa`, com motivo e data/hora. A visão exibida = lote + ajustes, aplicados em ordem. Isso atende à imutabilidade e à trilha de auditoria do CLAUDE.md. |
| **Gráficos sem biblioteca** | Barras em HTML/CSS funcionam via `file://` e offline, imprimem bem e cada gráfico tem uma tabela equivalente (acessibilidade). Cores em ordem fixa (tokens `--serie-1…8`). |
| **Importação em 2 etapas** (prévia → gravar) | O usuário revisa os avisos antes de gravar. A análise é pura, o que facilita os testes. |
| **DOM via `textContent`** (nunca `innerHTML`) | Os dados vêm de planilhas externas; isso elimina o risco de injeção de HTML/script. |
| **`data-testid`** em todos os elementos interativos | Prontidão para QA e automação (Playwright, Cypress, Selenium). |

### Regras de importação

**Despesas** (cronograma):
- Os cabeçalhos são reconhecidos sem diferenciar acentos, maiúsculas ou espaços.
- O ano é lido do cabeçalho "valor total orçamento AAAA" e conferido com o ano informado.
- Linha com Unidade Orçamentária vazia e Unidade Executora preenchida: a UO é derivada da UE (ex.: `02.35.08` → `02.35`), com aviso.
- Valor total vazio é importado como R$ 0,00, com aviso. Nenhuma linha com dados é descartada em silêncio.
- Dotação com os 12 meses vazios fica como **não diluída**. Nas projeções ela é distribuída em 1/12 por mês, com o resíduo no último mês.
- Se a soma dos meses for diferente do total, a dotação fica como **Divergente** e gera aviso. Os valores são mantidos como estão na planilha.

**Receitas** (Fiorilli):
- Linhas **analíticas** são identificadas pela hierarquia do código. O arquivo vem com o pai antes dos filhos, e os totais somam só as analíticas, para não contar os níveis sintéticos duas vezes.
- A categoria vem do 1º dígito: 1 corrente, 2 capital, 7/8 intraorçamentária, 9 dedução.
- Na tela Receitas, siglas como IPTU, ITBI, ISS, IPVA, ICMS e FPM são reconhecidas na busca.

### Módulo Gráficos

As composições ficam em `js/domain/composicao-receita.js`, como uma lista de **rótulo + prefixo(s) da natureza de receita**. Para mudar um item, basta editar essa lista. Exemplos: IPTU `1112.50`, ISS `1114.51`, FPM `1711.51`, SUS `1713` + `1723`, SUAS `1716` + `1729.51`, Comprev `1999.03`, Repasse Sabesp `1999.99.2.1.01`.
Cada subgrupo inclui o item **"Demais"**, com o que não foi detalhado (ex.: IRRF nas Tributárias). Assim os gráficos sempre fecham com o total oficial.

Seções:
1. Receitas Correntes · 2. Receitas de Capital · 3. Intraorçamentárias · 4. Deduções FUNDEB · 5. Orçamento Geral (receita bruta, deduções, receita líquida, despesa fixada, equilíbrio, dependência de transferências, despesa por categoria, função, GND, órgão e fonte) · 6. Orçamento por Grupo de Receita e Despesa (origem × aplicação, com escala comum e verificação de equilíbrio).
---

## 👨‍💻 Autor:
```text
Renato Pinheiro Destro
renato.destro@gmail.com
Auxiliar de Escritório / Prefeitura Municipal de Botucatu/SP
```
#### Seja LIVRE, use Linux!

##
