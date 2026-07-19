# Meu Financeiro — Dashboard pessoal

MVP funcional em Next.js para acompanhar patrimônio, valores a receber, parcelas, gastos e a meta de R$ 10 mil.

## Novidades na Arquitetura e Engenharia de Software

Implementamos uma base estável, robusta e modular de engenharia de software para garantir a integridade dos dados e preparar o sistema para produção (Supabase):

### 1. Camada de Persistência Desacoplada (Repository Pattern)
Toda a interação com o `localStorage` agora é intermediada por um repositório abstrato:
- [finance-repository.ts](file:///c:/Users/marcu/Downloads/financasv3/financas-marcola/lib/storage/finance-repository.ts): Declaração da interface de leitura, escrita e submissão de transações.
- [local-storage-repository.ts](file:///c:/Users/marcu/Downloads/financasv3/financas-marcola/lib/storage/local-storage-repository.ts): Implementação concreta baseada em browser.

### 2. Migrações de Dados Versionadas e Seguras (Migration Runner)
No carregamento do sistema, o [migration-runner.ts](file:///c:/Users/marcu/Downloads/financasv3/financas-marcola/lib/storage/migration-runner.ts) intercepta o estado:
- Executa um backup de segurança automático e temporário antes de aplicar migrações.
- Roda funções de upgrade incrementais atualizando o schema local de forma sequencial até a versão atual (`schemaVersion: 4`), prevenindo corrupção ou perda acidental de dados.

### 3. Validação de Integridade Automatizada
A biblioteca [validation.ts](file:///c:/Users/marcu/Downloads/financasv3/financas-marcola/lib/validation.ts) executa 4 regras críticas de sanidade:
- **IDs Duplicados:** Garante chaves primárias únicas.
- **Valores Extremos:** Alerta sobre valores vazios, negativos ou desproporcionais.
- **Vínculos Órfãos:** Detecta pagamentos sem o lançamento de despesa correspondente.
- **Anomalias Temporais:** Alerta sobre faturas fechadas com modificações pendentes ou datas de compra posteriores ao vencimento.
Estas validações estão integradas na aba **Integridade** na **Central de Correções** do dashboard.

### 4. Cobertura Completa de Testes (Vitest)
Instalado o `vitest` com testes nas pastas `/tests`:
- **Testes Unitários Financeiros:** Validação de cálculos de caixa, patrimônio e regras de vencimento de cartões.
- **Testes de Integridade:** Validação das regras de validação contra anomalias.
- **Testes de Integração de Fluxos completos:** Validação de fluxos ponta a ponta (cadastro, edição com trilha de auditoria, lixeira, backup automático e manual).

## Rodar os Testes

```bash
npm run test
```

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Estrutura esperada para CSV

A importação reconhece vírgula ou ponto e vírgula e tenta mapear:

```csv
data;descricao;valor;tipo;categoria;conta
2026-07-21;Pagamento Clara;50;entrada;Presentes;Mercado Pago
2026-07-24;Passagem;80;despesa;Transporte;Nubank
```

Também aceita cabeçalhos equivalentes em inglês, como `date`, `description`, `amount`, `type`, `category` e `account`.

## Estrutura de Componentes Modulares
O dashboard principal foi refatorado e dividido em componentes focados, eliminando a dependência do arquivo monolítico gigante:
- `Overview`: Visão geral e cartões de estatísticas rápidas.
- `CorrectionCenter`: Resolução de pendências de categorias, lixeira, auditoria de mudanças e validações de integridade.
- `LogViewerPage`: Monitoramento em tempo real de logs de diagnóstico e observabilidade do sistema.
- `ToolsPage`: Gerenciamento e download de exportações manuais (CSV, JSON) e restauração de backups.
- `RecoveryDiagnostics`: Painel técnico de reconciliação de dados recuperados.
- `AllEntries`: Tabela tabular completa com todos os lançamentos ativos do sistema.
