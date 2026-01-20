/**
 * @fileoverview Get Process Command
 * 
 * CLI command to fetch processes from a group and save them locally.
 * Portuguese: sydle obterProcesso
 * English alias: sydle getProcess
 * 
 * @module commands/getProcess
 */

const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const { runGetProcessFlow } = require('../utils/processFlow');
const { createLogger } = require('../utils/logger');

const listarProcessosCommand = new Command('listarProcessos')
    .alias('listProcesses')
    .alias('lp')
    .description('Listar e baixar todos os processos de um grupo (List and download all processes from a group)')
    .argument('[group]', 'Identificador do grupo (Group identifier)')
    .option('-v, --verbose', 'Mostrar logs detalhados')
    .action(async (groupIdentifier, options) => {
        const logger = createLogger(options.verbose);
        try {
            // 1. Authentication Check
            if (!(await ensureAuth())) {
                return;
            }

            // 2. Run Process Flow
            await runGetProcessFlow(groupIdentifier, options);

        } catch (error) {
            logger.error(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
            if (options.verbose && error instanceof Error) logger.debug(error.stack);
            process.exit(1);
        }
    });

module.exports = listarProcessosCommand;
