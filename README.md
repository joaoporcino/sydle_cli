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

#### Inicializar (Init)
Configura o ambiente e baixa a estrutura de classes base.
```bash
sydle init
```

#### Obter Pacote
Baixa a estrutura de arquivos para um pacote específico.
```bash
sydle obterPacote <identificador_do_pacote>
# Exemplo:
sydle obterPacote com.sydle.one.sybox.Sybox
```

#### Obter Classe
Baixa e gera arquivos para uma classe específica.
```bash
sydle obterClasse <identificador_da_classe>
# Exemplo:
sydle obterClasse com.sydle.one.sybox.Sybox.MyClass
```

#### Executar Método (Main)
Executa um método genérico na API.
```bash
sydle main <id> <metodo> --data <json> --http-method <POST|GET>
```

#### Comparar Código (Compare)
Compara o código de um método entre dois ambientes (dev, hom, prod).
Se os argumentos não forem fornecidos, um modo interativo será iniciado.
Também automatiza o merge utilizando o VS Code se disponível.
```bash
sydle compare [classIdentifier] [methodIdentifier] [sourceEnv] [targetEnv]
# Exemplo:
sydle compare com.MyClass myMethod dev hom
```

#### Watch
Monitora alterações em scripts locais e sincroniza automaticamente com o Sydle.
```bash
sydle watch [package]
# Exemplo (monitorar tudo):
sydle watch
# Exemplo (filtrar por pacote):
sydle watch recursosHumanos
```
Opções:
* `-v, --verbose`: Exibir logs detalhados.

#### Sync
Sincroniza scripts locais para o Sydle sob demanda.
```bash
sydle sync [path]
# Exemplos:
sydle sync                           # Sincroniza tudo
sydle sync recursosHumanos           # Sincroniza pacote
sydle sync recursosHumanos.MyClass   # Sincroniza classe
```
Opções:
* `-v, --verbose`: Exibir logs detalhados.

## Configuração

A URL da API e o Token são armazenados localmente.
- URL: Salva no arquivo `.env` na raiz da execução ou do projeto.
- Token: Gerenciado automaticamente pelo sistema de configuração do usuário (`conf`).
