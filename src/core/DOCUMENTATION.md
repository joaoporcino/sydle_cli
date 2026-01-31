# syncLogic.js - Core Synchronization Logic

Documentação do módulo responsável pela lógica central de sincronização entre o sistema de arquivos local e a plataforma Sydle.

## 📋 Visão Geral

Este módulo fornece as funções principais para:
- **Publicar classes** locais no Sydle (criação automática)
- **Sincronizar métodos** de classes para o Sydle
- **Gerenciar o ciclo de vida** de classes e métodos

## 🔧 Funções Exportadas

### `ensureClassExists(classJsonPath, logger)`

Garante que uma classe existe no Sydle, criando-a automaticamente se necessário.

#### Parâmetros
- `classJsonPath` (string): Caminho absoluto para o arquivo `class.json`
- `logger` (Object): Instância do logger para mensagens de progresso

#### Retorno
```javascript
{
  success: boolean,      // Se a operação foi bem-sucedida
  classData: Object|null, // Dados da classe do Sydle
  created: boolean       // Se a classe foi criada (true) ou já existia (false)
}
```

#### Fluxo de Operação

1. **Validação**: Verifica se o arquivo `class.json` existe
2. **Análise de Status**: 
   - `_revision: "0"` ou `_revision: 0` → Classe não publicada (draft local)
   - `_revision > 0` → Classe já publicada no Sydle
3. **Criação (se draft)**:
   - Remove campos de metadados temporários:
     - `_revision`, `_lastUpdateDate`, `_lastUpdateUser`
     - `_creationDate`, `_creationUser`, `_classRevision`, `_id`
   - Cria a classe no Sydle via API `create(CLASS_METADATA_ID, createData)`
   - Atualiza `class.json` local com `_id` e `_revision` retornados
4. **Verificação (se já existe)**:
   - Busca dados atualizados da classe via `get(CLASS_METADATA_ID, classData._id)`

#### Exemplo de Uso
```javascript
const result = await ensureClassExists('/path/to/sydle-dev/pkg/MyClass/class.json', logger);
if (result.success && result.created) {
  console.log('Classe criada com ID:', result.classData._id);
}
```

---

### `syncMethodCore(methodJsonPath, classId, rootPath, logger)`

Sincroniza um método específico para o Sydle, criando-o se não existir ou atualizando-o via JSON Patch.

#### Parâmetros
- `methodJsonPath` (string): Caminho absoluto para `method.json`
- `classId` (string): ID da classe de metadados (`000000000000000000000000`)
- `rootPath` (string): Caminho raiz do ambiente (ex: `sydle-dev`)
- `logger` (Object): Instância do logger

#### Retorno
```javascript
{
  success: boolean,    // Se a sincronização foi bem-sucedida
  skipped?: boolean,   // Se o método foi pulado (método de sistema sem scripts)
  message?: string     // Mensagem adicional (se houver)
}
```

#### Fluxo de Operação

1. **Extração de Contexto**:
   - Extrai `className` e `methodName` do caminho do arquivo
   - Detecta se é método de sistema (começa com `_`)

2. **Leitura de Scripts**:
   - Busca todos os arquivos `script_N.js` na pasta `scripts/`
   - Ordena numericamente (`script_0.js`, `script_1.js`, ...)
   - Lê o conteúdo de cada script
   - **Comportamento especial para métodos de sistema**:
     - Se não houver pasta `scripts/` ou estiver vazia → Pula o método (retorna `{skipped: true}`)

3. **Atualização do method.json**:
   - Adiciona array `scripts` ao objeto `methodData`
   - Salva `method.json` atualizado localmente

4. **Busca da Classe no Sydle**:
   - Lê `class.json` para obter `_id` da classe
   - Busca classe atual no Sydle via `get(classId, classRecordId)`
   - Encontra índice do método no array `methods[]`

5. **Preparação da Operação Patch**:
   - **Se método NÃO existe** (`methodIndex === -1`):
     - Operação: `add`
     - Caminho: `/methods/-` (adiciona ao final do array)
     - Descrição: `"Created"`
   - **Se método JÁ existe**:
     - Operação: `replace`
     - Caminho: `/methods/{index}`
     - Descrição: `"Synced"`

6. **Sincronização**:
   - Executa `patch(classId, updateData)` com JSON Patch operation
   - Registra sucesso com número de scripts sincronizados

#### Exemplo de JSON Patch Gerado

**Criar novo método:**
```javascript
{
  _id: "696d4f52...",
  _operationsList: [{
    op: "add",
    path: "/methods/-",
    value: { /* methodData completo */ }
  }]
}
```

**Atualizar método existente:**
```javascript
{
  _id: "696d4f52...",
  _operationsList: [{
    op: "replace",
    path: "/methods/3",  // índice do método
    value: { /* methodData atualizado */ }
  }]
}
```

#### Exemplo de Uso
```javascript
const result = await syncMethodCore(
  '/path/to/sydle-dev/pkg/MyClass/myMethod/method.json',
  '000000000000000000000000',
  '/path/to/sydle-dev',
  logger
);
if (result.success && !result.skipped) {
  console.log('Método sincronizado com sucesso!');
}
```

---

## 🔑 Constantes

### `CLASS_METADATA_ID`
```javascript
const CLASS_METADATA_ID = '000000000000000000000000';
```
ID especial da classe de metadados do Sydle, usada para operações em classes.

---

## 🔗 Dependências

- **fs**: Sistema de arquivos Node.js
- **path**: Manipulação de caminhos
- **../api/main**: Funções `get()`, `patch()`, `create()` para comunicação com API Sydle

---

## 📊 Fluxograma de Sincronização

```
┌─────────────────────────────────────┐
│  ensureClassExists()                │
├─────────────────────────────────────┤
│ 1. Lê class.json                    │
│ 2. Verifica _revision               │
│    ├─ "0" → cria no Sydle          │
│    └─ >0  → busca dados atuais     │
│ 3. Atualiza class.json local       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  syncMethodCore()                   │
├─────────────────────────────────────┤
│ 1. Lê scripts do método             │
│ 2. Atualiza method.json             │
│ 3. Busca classe no Sydle            │
│ 4. Verifica se método existe        │
│    ├─ Não → add operation          │
│    └─ Sim → replace operation      │
│ 5. Executa patch no Sydle           │
└─────────────────────────────────────┘
```

---

## 💡 Conceitos Importantes

### Ciclo de Vida de uma Classe

1. **Draft Local** (`_revision: "0"`)
   - Criada apenas localmente via `sydle createClass`
   - Ainda não existe no Sydle
   - Não possui `_id` válido

2. **Primeira Publicação**
   - `ensureClassExists()` detecta `_revision: "0"`
   - Cria a classe no Sydle
   - Atualiza `class.json` com `_id` e `_revision` retornados

3. **Classe Publicada** (`_revision > 0`)
   - Possui `_id` válido
   - Sincronizações subsequentes apenas atualizam métodos/campos

### JSON Patch Operations

O módulo usa [JSON Patch (RFC 6902)](https://jsonpatch.com/) para atualizações granulares:

- **`add`**: Adiciona elemento ao final de array (`path: "/methods/-"`)
- **`replace`**: Substitui elemento em índice específico (`path: "/methods/3"`)

**Vantagens:**
- ✅ Atualização eficiente (apenas o necessário)
- ✅ Evita conflitos de concorrência
- ✅ Histórico de alterações mais claro

### Tratamento de Métodos de Sistema

Métodos que começam com `_` (ex: `_get`, `_search`, `_getMetadata`) são **métodos de sistema**.

**Regra especial:**
- Se não tiverem pasta `scripts/` ou scripts customizados → **são pulados** silenciosamente
- Se tiverem scripts customizados → são sincronizados normalmente

Isso permite customizar métodos de sistema quando necessário, sem forçar sua sincronização.

---

## 🚨 Tratamento de Erros

Ambas as funções tratam erros de forma robusta:

1. **Validação de arquivos**: Retorna `{success: false}` se arquivos não existirem
2. **Erros de API**: Captura exceções e registra via logger
3. **Retorno consistente**: Sempre retorna objeto com `success: boolean`

### Exemplo de Tratamento
```javascript
try {
  const result = await syncMethodCore(...);
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

O módulo produz logs estruturados para acompanhamento:

### ensureClassExists()
- `📤 Publishing class 'MyClass' to Sydle...` (progress)
- `✓ Class published in Sydle (ID: 696d4f52...)` (success)
- `❌ Failed to publish class: error message` (error)

### syncMethodCore()
- `🔄 MyClass/myMethod` (progress)
- `⏭ Skipped (system method, no scripts)` (log)
- `✓ Synced (3 script(s))` (success)
- `✓ Created (1 script(s))` (success)
- `❌ Failed: error message` (error)

---

## 🔄 Integração com Outros Módulos

Este módulo é usado por:
- **syncClass.js**: Comando de sincronização manual
- **watchClass.js**: Sincronização automática em watch mode
- **processClasses.js**: Processamento em lote de classes

---

## 🎯 Casos de Uso Típicos

### 1. Publicar uma classe draft
```javascript
const { ensureClassExists } = require('./syncLogic');
await ensureClassExists('/sydle-dev/pkg/MyClass/class.json', logger);
```

### 2. Sincronizar um método modificado
```javascript
const { syncMethodCore } = require('./syncLogic');
await syncMethodCore(
  '/sydle-dev/pkg/MyClass/myMethod/method.json',
  CLASS_METADATA_ID,
  '/sydle-dev',
  logger
);
```

### 3. Pipeline completo (classe + método)
```javascript
// 1. Garantir que classe existe
const classResult = await ensureClassExists(classJsonPath, logger);
if (!classResult.success) return;

// 2. Sincronizar método
const methodResult = await syncMethodCore(methodJsonPath, CLASS_METADATA_ID, rootPath, logger);
if (methodResult.success && !methodResult.skipped) {
  console.log('Método sincronizado!');
}
```

---

## 📚 Referências

- [JSON Patch RFC 6902](https://jsonpatch.com/)
- [Sydle API Documentation](../api/main.js)
- [Logger Utility](../utils/logger.js)
