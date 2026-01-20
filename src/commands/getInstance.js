/**
 * @fileoverview Get Instance Command
 * 
 * CLI command to fetch a class instance and save it locally for editing.
 * Portuguese: sydle obterInstancia
 * English alias: sydle getInstance
 * 
 * @module commands/getInstance
 */

const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { get } = require('../api/main');
const {
    parsePackageClass,
    validatePackageAndClass,
    promptInstanceId,
    saveInstanceToLocal
} = require('../utils/instanceDataFlow');
const path = require('path');

const obterInstanciaCommand = new Command('obterInstancia')
    .alias('getInstance')
    .description('Baixa uma instância do Sydle para edição local (Get instance for local editing)')
    .argument('<package.class>', 'Pacote e classe (ex: recursosHumanos.templatesDemissao)')
    .argument('[id]', 'ID da instância (_id)')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (packageClass, idArg, options) => {
        const logger = createLogger(options.verbose);

        try {
            // 1. Authentication Check
            if (!(await ensureAuth())) {
                return;
            }

            // 2. Parse package.class
            const parsed = parsePackageClass(packageClass);
            if (!parsed) {
                logger.error('❌ Formato inválido. Use: package.class (ex: recursosHumanos.templatesDemissao)');
                return;
            }

            const { packageId, classId } = parsed;
            logger.info(`\n📦 Buscando instância de ${packageId}.${classId}...`);

            // 3. Validate package and class
            const validation = await validatePackageAndClass(packageId, classId, logger);
            if (!validation) {
                return;
            }

            const { classData } = validation;

            // 4. Get instance ID
            const instanceId = await promptInstanceId(idArg);

            // 5. Fetch instance from API
            logger.progress(`   🔄 Buscando instância ${instanceId}...`);

            let instanceData;
            try {
                instanceData = await get(classData._id, instanceId);
            } catch (apiError) {
                const message = apiError instanceof Error ? apiError.message : String(apiError);
                logger.error(`❌ Erro ao buscar instância: ${message}`);
                return;
            }

            if (!instanceData) {
                logger.error(`❌ Instância não encontrada: ${instanceId}`);
                return;
            }

            logger.log(`   ✓ Instância encontrada`);

            // 6. Save to local folder
            const { instanceDir, extractedFiles } = saveInstanceToLocal(
                instanceData,
                packageId,
                classId,
                logger
            );

            // 7. Summary
            logger.success('\n✅ Instância salva localmente!');
            logger.info(`   📁 ${instanceDir}`);

            if (extractedFiles.length > 0) {
                logger.info(`   📄 Arquivos extraídos:`);
                for (const file of extractedFiles) {
                    logger.log(`      - ${path.basename(file)}`);
                }
            }

            logger.info('\n   Próximos passos:');
            logger.info('   1. Edite os arquivos conforme necessário');
            logger.info(`   2. Execute "sydle atualizarInstancia ${packageClass} ${path.basename(instanceDir)}" para enviar ao Sydle`);

        } catch (error) {
            logger.error(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
        }
    });

module.exports = obterInstanciaCommand;
