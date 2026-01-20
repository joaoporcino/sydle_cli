/**
 * @fileoverview Process Flow Utility
 * 
 * Interactive wizard for gathering process information and fetching data.
 * 
 * @module utils/processFlow
 */

const inquirer = require('inquirer');
const { searchPaginated } = require('../api/main');
const { processProcesses } = require('../core/processProcesses');
const { createLogger } = require('./logger');

const PROCESS_CLASS_ID = '595c20500000000000000100';

/**
 * Prompts for group identifier if not provided
 * @returns {Promise<string | null>} Group identifier or null
 */
async function promptGroupIdentifier() {
    const { identifier } = await inquirer.prompt([{
        type: 'input',
        name: 'identifier',
        message: 'Identificador do grupo de processos (Process group identifier):',
        validate: input => input.trim() ? true : 'Identificador é obrigatório'
    }]);

    return identifier.trim() || null;
}

/**
 * Fetches all processes for a given group identifier
 * @param {string} groupIdentifier - Group identifier
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<Object[]>} Array of process data
 */
async function fetchProcessesByGroup(groupIdentifier, logger) {
    logger.progress(`   🔄 Buscando processos do grupo ${groupIdentifier}...`);

    const query = {
        query: {
            term: { "group.name.keyword": groupIdentifier }
        },
        sort: [{ "_id": "asc" }]
    };

    const processesData = [];

    try {
        await searchPaginated(PROCESS_CLASS_ID, query, 50, async (hits) => {
            logger.progress(`   📦 Encontrados ${hits.length} processos no lote...`);
            for (const hit of hits) {
                if (hit._source) {
                    processesData.push(hit._source);
                }
            }
        });

        return processesData;
    } catch (error) {
        logger.error(`   ❌ Erro ao buscar processos: ${error.message}`);
        return [];
    }
}

/**
 * Orchestrates the full getProcess flow
 * @param {string | undefined} groupIdentifier - Optional group identifier
 * @param {Object} options - Command options
 */
async function runGetProcessFlow(groupIdentifier, options = {}) {
    const logger = createLogger(options.verbose);

    let targetGroup = groupIdentifier;

    if (!targetGroup) {
        targetGroup = await promptGroupIdentifier();
    }

    if (!targetGroup) {
        return;
    }

    const processes = await fetchProcessesByGroup(targetGroup, logger);

    if (processes.length === 0) {
        logger.error(`   ❌ Nenhum processo encontrado para o grupo '${targetGroup}'`);
        return;
    }

    logger.info(`   ✅ Total de processos encontrados: ${processes.length}`);

    await processProcesses(processes, {
        description: `Processando processos do grupo ${targetGroup}...`
    });
}

module.exports = {
    promptGroupIdentifier,
    fetchProcessesByGroup,
    runGetProcessFlow
};
