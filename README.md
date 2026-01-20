# Sydle CLI

Ferramenta de linha de comando para interagir com a plataforma Sydle.

## Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 14 ou superior) instalado.

## Instalação

### Windows (Automático)

1. Clone o repositório ou baixe os arquivos.
2. Execute o arquivo `setup.bat` como administrador.
   - Isso irá instalar as dependências e configurar o comando `sydle` globalmente.

### Manual (Qualquer SO)

1. Abra o terminal na pasta do projeto.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Link o pacote globalmente:
   ```bash
   npm link
   ```

## Uso

Após a instalação, você pode usar o comando `sydle` em qualquer lugar do terminal.

### Comandos Disponíveis

#### Login
Realiza autenticação na plataforma.
```bash
sydle login
# Ou com credenciais diretas:
sydle login <usuario> <senha>
# Opcionalmente passando a URL:
sydle login <usuario> <senha> <url>
```

#### Iniciar (Init)
Configura o ambiente e baixa a estrutura de classes base.
```bash
sydle iniciar
# Alias:
sydle init
```

#### Obter Pacote
Baixa a estrutura de arquivos para um pacote específico.
```bash
sydle obterPacote <identificador_do_pacote>
# Alias:
sydle getPackage <id>
# Exemplo:
sydle obterPacote com.sydle.one.sybox.Sybox
```

#### Obter Classe
Baixa e gera arquivos para uma classe específica.
```bash
sydle obterClasse <identificador_da_classe>
# Alias:
sydle getClass <id>
# Exemplo:
sydle obterClasse com.sydle.one.sybox.Sybox.MyClass
```

#### Criar Método (Create Method)
Cria a estrutura de um novo método (scaffolding).
```bash
sydle criarMetodo [pacote] [classe] [metodo]
# Exemplo (Interativo):
sydle criarMetodo
# Exemplo (Direto):
sydle criarMetodo recursosHumanos Aprendiz novoMetodo
# Alias:
sydle createMethod ...
```

#### Excluir Método (Delete Method)
Exclui a pasta local e remove do Sydle (com confirmação).
```bash
sydle excluirMetodo [pacote] [classe] [metodo]
# Exemplo:
sydle excluirMetodo recursosHumanos Aprendiz metodoAntigo
# Alias:
sydle deleteMethod ...
```

#### Executar Método (Main)
Executa um método genérico na API.
```bash
sydle executar <id> <metodo> --data <json> --http-method <POST|GET>
# Alias:
sydle main ...
```

#### Comparar Código (Compare)
Compara o código de um método entre dois ambientes (dev, hom, prod).
Se os argumentos não forem fornecidos, um modo interativo será iniciado.
Também automatiza o merge utilizando o VS Code se disponível.
```bash
sydle comparar [classIdentifier] [methodIdentifier] [sourceEnv] [targetEnv]
# Alias:
sydle compare com.MyClass myMethod dev hom
```

#### Monitorar (Watch)
Monitora alterações em scripts locais e sincroniza automaticamente com o Sydle.
```bash
sydle monitorar [package]
# Alias:
sydle watch [package]
# Exemplo:
sydle monitorar recursosHumanos
```
Opções:
* `-v, --verbose`: Exibir logs detalhados.

#### Sincronizar (Sync)
Sincroniza scripts locais para o Sydle sob demanda.
```bash
sydle sincronizar [path]
# Alias:
sydle sync [path]
# Exemplos:
sydle sincronizar recursosHumanos
```
Opções:
* `-v, --verbose`: Exibir logs detalhados.

#### Listar Processos (List Processes)
Busca processos de um grupo e baixa suas versões e metadados.
Os arquivos são organizados em `sydle-process-[env]/[Grupo]/[Processo]/[Versao]/version.json`.
```bash
sydle listarProcessos [identificador_do_grupo]
# Alias:
sydle listProcesses [id]
sydle lp [id]
# Exemplo:
sydle listarProcessos DP
```

## Configuração

A URL da API e o Token são armazenados localmente.
- URL: Salva no arquivo `.env` na raiz da execução ou do projeto.
- Token: Gerenciado automaticamente pelo sistema de configuração do usuário (`conf`).
