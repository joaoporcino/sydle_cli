/**
 * @fileoverview Get Process Command
 * 
 * CLI command to fetch a specific process and save it locally.
 * Portuguese: sydle obterProcesso
 * English alias: sydle getProcess
 * 
 * @module commands/getProcess
 */

const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { runGetSingleProcessFlow } = require('../utils/processFlow');
const { createLogger } = require('../utils/logger');

const obterProcessoCommand = new Command('obterProcesso')
    .alias('getProcess')
    .alias('gproc')
    .description('Buscar e baixar um processo específico (Fetch and download a specific process)')
    .argument('[processIdentifier]', 'Identificador ou ID do processo (Process identifier or ID)')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (processIdentifier, options) => {
        const logger = createLogger(options.verbose);
        try {
            // 1. Authentication Check
            if (!(await ensureAuth())) {
                return;
            }

            // 2. Run Single Process Flow
            await runGetSingleProcessFlow(processIdentifier, options);

        } catch (error) {
            logger.error(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
            process.exit(1);
        }
    });

module.exports = obterProcessoCommand;
