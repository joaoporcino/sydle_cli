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

#### Executar Método (Main)
Executa um método genérico na API.
```bash
sydle main <id> <metodo> --data <json> --http-method <POST|GET>
```

## Configuração

A URL da API e o Token são armazenados localmente.
- URL: Salva no arquivo `.env` na raiz da execução ou do projeto.
- Token: Gerenciado automaticamente pelo sistema de configuração do usuário.
