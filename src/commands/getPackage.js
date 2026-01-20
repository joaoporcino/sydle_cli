/**
 * @fileoverview Get Package Command
 * 
 * CLI command to fetch all classes from a Sydle package.
 * Portuguese: sydle obterPacote
 * English alias: sydle getPackage
 * 
 * @module commands/getPackage
 */

const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { runGetPackageFlow } = require('../utils/packageFlow');
const { createLogger } = require('../utils/logger');

const obterPacoteCommand = new Command('obterPacote')
    .alias('getPackage')
    .alias('gp')
    .description('Obter todas as classes de um pacote (Get all classes from a package)')
    .argument('[identifier]', 'Identificador do pacote (Package identifier)')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (identifier, options) => {
        const logger = createLogger(options.verbose);
        try {
            // 1. Authentication Check
            if (!(await ensureAuth())) {
                return;
            }

            // 2. Run Package Flow
            await runGetPackageFlow(identifier, options);

        } catch (error) {
            logger.error(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
            process.exit(1);
        }
    });

module.exports = obterPacoteCommand;
