# syncLogicProcess.js - Process Version Synchronization Logic

Documentação do módulo responsável pela lógica central de sincronização de **versões de processos** entre o sistema de arquivos local e a plataforma Sydle.

## 📋 Visão Geral

Este módulo fornece as funções principais para:
- **Publicar versões de processos** locais no Sydle (criação automática)
- **Sincronizar métodos do pin** (métodos da versão do processo)
- **Sincronizar campos** de versões de processos
- **Gerenciar o ciclo de vida** de versões de processos

## 🔧 Funções Exportadas

### `ensureProcessVersionExists(versionJsonPath, logger)`

Garante que uma versão de processo existe no Sydle, criando-a automaticamente se necessário.

#### Parâmetros
- `versionJsonPath` (string): Caminho absoluto para o arquivo `version.json`
- `logger` (Object): Instância do logger para mensagens de progresso

#### Retorno
```javascript
{
  success: boolean,         // Se a operação foi bem-sucedida
  versionData: Object|null, // Dados da versão do Sydle
  created: boolean          // Se a versão foi criada (true) ou já existia (false)
}
```

#### Fluxo de Operação

1. **Validação**: Verifica se o arquivo `version.json` existe
2. **Análise de Status**: 
   - `_revision: "0"` ou `_revision: 0` → Versão não publicada (draft local)
   - `_revision > 0` → Versão já publicada no Sydle
3. **Criação (se draft)**:
   - Remove campos de metadados temporários:
     - `_revision`, `_lastUpdateDate`, `_lastUpdateUser`
     - `_creationDate`, `_creationUser`, `_classRevision`, `_id`
   - Cria a versão no Sydle via API `create(PROCESS_VERSION_CLASS_ID, createData)`
   - Atualiza `version.json` local com `_id` e `_revision` retornados
4. **Verificação (se já existe)**:
   - Busca dados atualizados da versão via `get(PROCESS_VERSION_CLASS_ID, versionData._id)`

#### Exemplo de Uso
```javascript
const result = await ensureProcessVersionExists(
  '/path/to/sydle-process-dev/group/process/1_0/version.json',
  logger
);
if (result.success && result.created) {
  console.log('Versão criada com ID:', result.versionData._id);
}
```

---

### `syncProcessMethodCore(methodJsonPath, rootPath, logger)`

Sincroniza um método do **pin** (métodos da versão do processo) para o Sydle, criando-o se não existir ou atualizando-o via JSON Patch.

#### Parâmetros
- `methodJsonPath` (string): Caminho absoluto para `method.json` (dentro da pasta `pin/`)
- `rootPath` (string): Caminho raiz do ambiente (ex: `sydle-process-dev`)
- `logger` (Object): Instância do logger

#### Retorno
```javascript
{
  success: boolean,    // Se a sincronização foi bem-sucedida
  skipped?: boolean,   // Se o método foi pulado (método de sistema sem scripts)
  message?: string     // Mensagem adicional (se houver)
}
```

#### Estrutura Esperada
```
sydle-process-dev/
  group/
    process/
      version/
        pin/                    ← Métodos da versão do processo
          method/
            method.json
            scripts/
              script_0.js
```

#### Fluxo de Operação

1. **Extração de Contexto**:
   - Extrai `processName`, `versionLabel` e `methodName` do caminho
   - Detecta se é método de sistema (começa com `_`)

2. **Leitura de Scripts**:
   - Busca todos os arquivos `script_N.js` na pasta `scripts/`
   - Ordena numericamente
   - Lê o conteúdo de cada script
   - **Comportamento especial para métodos de sistema**:
     - Se não houver pasta `scripts/` ou estiver vazia → Pula o método

3. **Atualização do method.json**:
   - Adiciona array `scripts` ao objeto `methodData`
   - Salva `method.json` atualizado localmente

4. **Busca da Versão no Sydle**:
   - Lê `version.json` para obter `_id` da versão
   - Busca versão atual no Sydle via `get(PROCESS_VERSION_CLASS_ID, versionRecordId)`
   - Encontra índice do método no array `methods[]`

5. **Preparação da Operação Patch**:
   - **Se método NÃO existe** (`methodIndex === -1`):
     - Operação: `add`
     - Caminho: `/methods/-`
     - Descrição: `"Created"`
   - **Se método JÁ existe**:
     - Operação: `replace`
     - Caminho: `/methods/{index}`
     - Descrição: `"Synced"`

6. **Sincronização**:
   - Executa `patch(PROCESS_VERSION_CLASS_ID, updateData)` com JSON Patch operation
   - Registra sucesso com número de scripts sincronizados

#### Exemplo de Uso
```javascript
const result = await syncProcessMethodCore(
  '/path/to/sydle-process-dev/group/process/1_0/pin/start/method.json',
  '/path/to/sydle-process-dev',
  logger
);
if (result.success && !result.skipped) {
  console.log('Método do pin sincronizado!');
}
```

---

### `syncProcessFieldsCore(versionJsonPath, logger)`

Sincroniza os **campos** (fields) de uma versão de processo para o Sydle.

#### Parâmetros
- `versionJsonPath` (string): Caminho absoluto para `version.json`
- `logger` (Object): Instância do logger

#### Retorno
```javascript
{
  success: boolean    // Se a sincronização foi bem-sucedida
}
```

#### Fluxo de Operação

1. **Validação**: Verifica se `version.json` existe
2. **Leitura**: Lê dados da versão local
3. **Busca no Sydle**: Obtém versão atual via `get()`
4. **Preparação do Patch**:
   - Operação: `replace`
   - Caminho: `/fields`
   - Valor: Array completo de campos do `version.json`
5. **Sincronização**: Executa `patch()` e registra resultado

#### Exemplo de Uso
```javascript
const result = await syncProcessFieldsCore(
  '/path/to/sydle-process-dev/group/process/1_0/version.json',
  logger
);
if (result.success) {
  console.log('Campos sincronizados!');
}
```

---

## 🔑 Constantes

### `PROCESS_VERSION_CLASS_ID`
```javascript
const PROCESS_VERSION_CLASS_ID = '595c20500000000000000110';
```
ID da classe de versões de processos do Sydle, usada para todas as operações em versões.

---

## 🔗 Dependências

- **fs**: Sistema de arquivos Node.js
- **path**: Manipulação de caminhos
- **../api/main**: Funções `get()`, `patch()`, `create()` para comunicação com API Sydle

---

## 📊 Fluxograma de Sincronização

```
┌─────────────────────────────────────────┐
│  ensureProcessVersionExists()           │
├─────────────────────────────────────────┤
│ 1. Lê version.json                      │
│ 2. Verifica _revision                   │
│    ├─ "0" → cria versão no Sydle       │
│    └─ >0  → busca dados atuais         │
│ 3. Atualiza version.json local         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  syncProcessMethodCore()                │
├─────────────────────────────────────────┤
│ 1. Lê scripts do método (pin/)         │
│ 2. Atualiza method.json                 │
│ 3. Busca versão no Sydle                │
│ 4. Verifica se método existe            │
│    ├─ Não → add operation              │
│    └─ Sim → replace operation          │
│ 5. Executa patch no Sydle               │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  syncProcessFieldsCore()                │
├─────────────────────────────────────────┤
│ 1. Lê version.json                      │
│ 2. Busca versão no Sydle                │
│ 3. Prepara replace de /fields           │
│ 4. Executa patch no Sydle               │
└─────────────────────────────────────────┘
```

---

## 💡 Conceitos Importantes

### Ciclo de Vida de uma Versão de Processo

1. **Draft Local** (`_revision: "0"`)
   - Criada apenas localmente
   - Ainda não existe no Sydle
   - Não possui `_id` válido

2. **Primeira Publicação**
   - `ensureProcessVersionExists()` detecta `_revision: "0"`
   - Cria a versão no Sydle
   - Atualiza `version.json` com `_id` e `_revision` retornados

3. **Versão Publicada** (`_revision > 0`)
   - Possui `_id` válido
   - Sincronizações subsequentes apenas atualizam métodos/campos

### Estrutura Pin vs Diagram

**Pin (Versão de Processo)**:
- Representa a versão como uma "classe executável"
- Contém **métodos** (`start`, `end`, `_getMetadata`, etc.)
- Contém **campos** (fields) da versão
- Local: `version/pin/`

**Diagram (Fluxo Visual)**:
- Representa o diagrama BPMN
- Contém **tasks**, **gateways**, **events**
- Local: `version/tasks/`, `version/events/`, etc.

### Diferenças entre syncLogic.js e syncLogicProcess.js

| Aspecto | syncLogic.js (Classes) | syncLogicProcess.js (Processos) |
|---------|------------------------|----------------------------------|
| **Arquivo JSON** | `class.json` | `version.json` |
| **Class ID** | `000000000000000000000000` | `595c20500000000000000110` |
| **Estrutura de Métodos** | `package/class/method/` | `group/process/version/pin/method/` |
| **Campos** | Sempre presentes | Opcionais (pin fields) |
| **Função de Campos** | `syncFields.js` (separado) | `syncProcessFieldsCore()` (integrado) |

---

## 🚨 Tratamento de Erros

Todas as funções tratam erros de forma robusta:

1. **Validação de arquivos**: Retorna `{success: false}` se arquivos não existirem
2. **Erros de API**: Captura exceções e registra via logger
3. **Retorno consistente**: Sempre retorna objeto com `success: boolean`

### Exemplo de Tratamento
```javascript
try {
  const result = await syncProcessMethodCore(...);
  if (!result.success) {
    console.error('Sincronização falhou');
  }
} catch (error) {
  // Erros já foram logados internamente
  console.error('Erro fatal:', error.message);
}
```

---

## 📝 Logs Produzidos

### ensureProcessVersionExists()
- `📤 Publishing process version '1.0' to Sydle...` (progress)
- `✓ Process version published in Sydle (ID: 69713d18...)` (success)
- `❌ Failed to publish process version: error message` (error)

### syncProcessMethodCore()
- `🔄 testProcess/1_0/pin/start` (progress)
- `⏭ Skipped (system method, no scripts)` (log)
- `✓ Synced (2 script(s))` (success)
- `✓ Created (1 script(s))` (success)
- `❌ Failed: error message` (error)

### syncProcessFieldsCore()
- `🔄 Syncing fields for process version '1.0'` (progress)
- `✓ Fields synced (3 field(s))` (success)
- `❌ Failed to sync fields: error message` (error)

---

## 🔄 Integração com Outros Módulos

Este módulo pode ser usado por:
- **watchProcess.js**: Monitoramento automático de processos (futuro)
- **syncProcess.js**: Comando de sincronização manual de processos (futuro)
- **processProcesses.js**: Processamento em lote de processos

---

## 🎯 Casos de Uso Típicos

### 1. Publicar uma versão de processo draft
```javascript
const { ensureProcessVersionExists } = require('./syncLogicProcess');
await ensureProcessVersionExists(
  '/sydle-process-dev/group/process/1_0/version.json',
  logger
);
```

### 2. Sincronizar um método do pin modificado
```javascript
const { syncProcessMethodCore } = require('./syncLogicProcess');
await syncProcessMethodCore(
  '/sydle-process-dev/group/process/1_0/pin/start/method.json',
  '/sydle-process-dev',
  logger
);
```

### 3. Sincronizar campos da versão
```javascript
const { syncProcessFieldsCore } = require('./syncLogicProcess');
await syncProcessFieldsCore(
  '/sydle-process-dev/group/process/1_0/version.json',
  logger
);
```

### 4. Pipeline completo (versão + métodos + campos)
```javascript
// 1. Garantir que versão existe
const versionResult = await ensureProcessVersionExists(versionJsonPath, logger);
if (!versionResult.success) return;

// 2. Sincronizar campos
await syncProcessFieldsCore(versionJsonPath, logger);

// 3. Sincronizar métodos do pin
const methodResult = await syncProcessMethodCore(
  methodJsonPath,
  rootPath,
  logger
);
if (methodResult.success && !methodResult.skipped) {
  console.log('Método sincronizado!');
}
```

---

## ⚡ Exemplo de Estrutura Completa

```
sydle-process-dev/
  testes/                              # Group
    group.json
    teste_cli_sydle/                   # Process
      process.json
      1_0/                             # Version
        version.json                   # ← ensureProcessVersionExists()
        pin/                           # Pin structure (process as "class")
          class.json                   # Copy of version data
          start/                       # Pin method
            method.json                # ← syncProcessMethodCore()
            scripts/
              script_0.js
          end/
            method.json
            scripts/
              script_0.js
          _getMetadata/
            method.json
            scripts/
              script_0.js
        tasks/                         # Diagram elements (separate)
          ...
        events/
          ...
```

---

## 📚 Referências

- [JSON Patch RFC 6902](https://jsonpatch.com/)
- [Sydle API Documentation](../api/main.js)
- [Logger Utility](../utils/logger.js)
- [syncLogic.js Documentation](./DOCUMENTATION.md) - Versão para classes
- [processProcesses.js](./processProcesses.js) - Processamento de processos
