/**
 * @fileoverview Update Instance Command
 * 
 * CLI command to send local changes of an instance back to Sydle.
 * Portuguese: sydle atualizarInstancia
 * English alias: sydle updateInstance
 * 
 * @module commands/updateInstance
 */

const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { createLogger } = require('../utils/logger');
const { update } = require('../api/main');
const {
    parsePackageClass,
    validatePackageAndClass,
    getInstanceDir,
    recomposeInstance
} = require('../utils/instanceDataFlow');
const fs = require('fs');
const path = require('path');

const updateInstanceCommand = new Command('atualizarInstancia')
    .alias('updateInstance')
    .alias('ui')
    .description('Envia mudanças locais de uma instância para o Sydle (Update instance from local folder)')
    .argument('<package.class>', 'Pacote e classe (ex: recursosHumanos.templatesDemissao)')
    .argument('<instanceName>', 'Nome da pasta da instância em sydle-dev-data/')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .option('--dry-run', 'Simular sem enviar para o Sydle')
    .action(async (packageClass, instanceName, options) => {
        const logger = createLogger(options.verbose);

        try {
            // 1. Authentication Check
            if (!(await ensureAuth())) {
                return;
            }

            // 2. Parse package.class
            const parsed = parsePackageClass(packageClass);
            if (!parsed) {
                logger.error('❌ Formato inválido. Use: package.class');
                return;
            }

            const { packageId, classId } = parsed;
            const instanceDir = getInstanceDir(packageId, classId, instanceName);

            logger.info(`\n📤 Atualizando instância ${instanceName}...`);

            // 3. Check if instance exists locally
            if (!fs.existsSync(instanceDir)) {
                logger.error(`❌ Instância não encontrada: ${instanceDir}`);
                return;
            }

            // 4. Validate package and class (to get classId for API)
            const validation = await validatePackageAndClass(packageId, classId, logger);
            if (!validation) {
                return;
            }

            const { classData } = validation;

            // 5. Recompose instance data
            logger.progress('   🔄 Recompondo dados...');
            const instanceData = recomposeInstance(instanceDir);

            if (!instanceData._id) {
                logger.error('❌ instance.json não contém _id');
                return;
            }

            if (options.dryRun) {
                logger.info('\n🔍 Dry-run - dados que seriam enviados:');
                console.log(JSON.stringify(instanceData, null, 2));
                return;
            }

            // 6. Send update to API
            logger.progress('   🔄 Enviando para o Sydle...');

            try {
                const result = await update(classData._id, instanceData);

                // Update local _revision if returned
                if (result && result._revision) {
                    const instanceJsonPath = path.join(instanceDir, 'instance.json');
                    const localData = JSON.parse(fs.readFileSync(instanceJsonPath, 'utf8'));
                    localData._revision = result._revision;
                    fs.writeFileSync(instanceJsonPath, JSON.stringify(localData, null, 2));
                }

                logger.success('\n✅ Instância atualizada no Sydle!');
                if (result && result._revision) {
                    logger.log(`   _revision: ${result._revision}`);
                }
            } catch (apiError) {
                const message = apiError instanceof Error ? apiError.message : String(apiError);
                logger.error(`❌ Erro ao atualizar: ${message}`);
            }

        } catch (error) {
            logger.error(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
        }
    });

module.exports = updateInstanceCommand;
