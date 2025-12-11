@echo off
echo Instalando dependencias do Sydle CLI...
call npm install
if %errorlevel% neq 0 (
    echo Erro ao instalar dependencias.
    pause
    exit /b %errorlevel%
)

echo Configurando comando global 'sydle'...
call npm link
if %errorlevel% neq 0 (
    echo Erro ao criar link global.
    pause
    exit /b %errorlevel%
)

echo.
echo Instalacao concluida com sucesso!
echo Agora voce pode usar o comando 'sydle' no seu terminal.
pause
