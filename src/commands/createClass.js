/**
 * @fileoverview Create Class Command
 * 
 * CLI command to create a new class locally.
 * Portuguese: sydle criarClasse
 * English alias: sydle createClass
 * 
 * Creates class structure locally using _createDraft as template.
 * Validates package via API (PACKAGE_METADATA_ID).
 * Does NOT send to Sydle API - use sync or watch to push changes.
 * 
 * @module commands/createClass
 */

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { createDraft } = require('../api/main');
const { processClasses } = require('../core/processClasses');
const {
    validatePackage,
    promptPackageIdentifier,
    promptClassName,
    promptClassIdentifier,
    promptClassType,
    runFieldWizard,
    CLASS_METADATA_ID,
    PACKAGE_METADATA_ID
} = require('../utils/createClassFlow');

const createClassCommand = new Command('criarClasse')
    .alias('createClass')
    .description('Cria uma nova classe localmente (Create a new class locally)')
    .argument('[package]', 'Identificador do pacote (e.g., recursosHumanos)')
    .argument('[name]', 'Nome da classe (e.g., "Novo Funcionário")')
    .option('-i, --identifier <id>', 'Identificador da classe (default: nome em camelCase)')
    .option('-t, --type <type>', 'Tipo da classe (STANDARD, INTERFACE)', 'STANDARD')
    .option('--no-fields', 'Pular assistente de campos')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .addHelpText('after', `
Exemplos:
  $ sydle criarClasse recursosHumanos "Novo Funcionário"
  $ sydle createClass recursosHumanos "Novo Funcionário" -i novoFuncionario
  $ sydle criarClasse --no-fields
  $ sydle criarClasse

O comando valida o pacote via API e cria arquivos locais.
Use 'sydle watch' ou 'sydle sync' para enviar ao Sydle.
`)
    .action(async (pkgArg, nameArg, options) => {
        const logger = createLogger(options.verbose);

        try {
            // 1. Authentication Check
            if (!(await ensureAuth())) {
                return;
            }

            // 2. Determine Environment and Root Path
            let url = process.env.SYDLE_API_URL;
            let env = 'prod';
            if (url.includes('dev')) env = 'dev';
            else if (url.includes('hom')) env = 'hom';

            const rootFolder = `sydle-${env}`;
            const rootPath = path.join(process.cwd(), rootFolder);

            // Create root folder if not exists
            if (!fs.existsSync(rootPath)) {
                fs.mkdirSync(rootPath, { recursive: true });
            }

            // 3. Interactive prompts via createClassFlow
            const packageIdentifier = await promptPackageIdentifier(pkgArg);

            // 4. Validate package via API
            const packageData = await validatePackage(packageIdentifier, logger);
            if (!packageData) return;

            // 5. Get class details
            const className = await promptClassName(nameArg);
            const classIdentifier = await promptClassIdentifier(options.identifier, className);
            const classType = await promptClassType(options.type);

            // 6. Check if class already exists locally
            const packagePath = path.join(rootPath, packageIdentifier);
            const classPath = path.join(packagePath, classIdentifier);
            if (fs.existsSync(classPath)) {
                logger.error(`❌ Classe '${classIdentifier}' já existe localmente`);
                return;
            }

            logger.info(`\n📦 Criando classe '${className}' (${classIdentifier})...`);
            logger.log(`   Pacote: ${packageIdentifier}`);
            logger.log(`   Tipo: ${classType}`);

            // 7. Get template from Sydle API via _createDraft
            logger.progress(`   🔄 Obtendo template da API Sydle...`);

            let classTemplate;
            try {
                classTemplate = await createDraft(CLASS_METADATA_ID, {});
            } catch (apiError) {
                const message = apiError instanceof Error ? apiError.message : String(apiError);
                logger.error(`❌ Erro ao obter template da API: ${message}`);
                return;
            }

            if (!classTemplate) {
                logger.error(`❌ API retornou template vazio`);
                return;
            }

            logger.log(`   ✓ Template obtido da API`);

            // 8. Fill in the template with our values
            classTemplate.name = className;
            classTemplate.identifier = classIdentifier;
            classTemplate.type = classType;
            classTemplate.index = true;
            classTemplate.package = {
                _id: packageData._id,
                _classId: PACKAGE_METADATA_ID
            };

            // 9. Field Creation Wizard (if enabled)
            let customFields = [];
            if (options.fields !== false) {
                customFields = await runFieldWizard(rootPath, logger);
            }

            if (customFields.length > 0) {
                classTemplate.fields = [...(classTemplate.fields || []), ...customFields];
                logger.log(`   📋 ${customFields.length} campo(s) personalizado(s) adicionado(s)`);
            }

            // 10. Generate local files via processClasses
            logger.progress(`   🔄 Gerando arquivos locais...`);

            try {
                await processClasses([classTemplate], {
                    description: `Generating files for class ${classIdentifier}...`
                });
            } catch (processError) {
                const message = processError instanceof Error ? processError.message : String(processError);
                logger.error(`❌ Erro ao gerar arquivos: ${message}`);
                return;
            }

            logger.success('\n✅ Classe criada localmente!');
            logger.info(`   📁 ${classPath}`);
            logger.info('\n   Próximos passos:');
            logger.info('   1. Edite o fields.js para ajustar os campos');
            logger.info('   2. Execute "sydle watch" ou "sydle sync" para enviar ao Sydle');

        } catch (error) {
            logger.error(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
        }
    });

module.exports = createClassCommand;
