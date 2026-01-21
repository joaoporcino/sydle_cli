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
 * Prompts for process identifier if not provided
 * @returns {Promise<string | null>} Process identifier or null
 */
async function promptProcessIdentifier() {
    const { identifier } = await inquirer.prompt([{
        type: 'input',
        name: 'identifier',
        message: 'Identificador ou ID do processo (Process identifier or ID):',
        validate: input => input.trim() ? true : 'Identificador é obrigatório'
    }]);

    return identifier.trim() || null;
}

/**
 * Prompts for version fetching option
 * @returns {Promise<boolean>} True if only current version should be fetched
 */
async function promptVersionOption() {
    const { versionOption } = await inquirer.prompt([{
        type: 'list',
        name: 'versionOption',
        message: 'Quais versões deseja buscar? (Which versions to fetch?)',
        choices: [
            { name: '📌 Apenas versão corrente (Only current version)', value: 'current' },
            { name: '📚 Todas as versões (All versions)', value: 'all' }
        ],
        default: 'current'
    }]);

    return versionOption === 'current';
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
 * Fetches a specific process by identifier or ID
 * @param {string} processIdentifier - Process identifier or ID
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<Object | null>} Process data or null
 */
async function fetchProcessByIdentifier(processIdentifier, logger) {
    logger.progress(`   🔄 Buscando processo ${processIdentifier}...`);

    const { executeMainMethod, get } = require('../api/main');

    try {
        // Try as identifier first
        const queryByIdentifier = {
            query: {
                term: { "identifier.keyword": processIdentifier }
            },
            size: 1
        };

        let result = await executeMainMethod(PROCESS_CLASS_ID, '_search', queryByIdentifier, 'POST');

        if (result.hits.hits.length > 0) {
            logger.success(`   ✅ Processo encontrado por identifier`);
            return result.hits.hits[0]._source;
        }

        // Try as _id
        try {
            const processData = await get(PROCESS_CLASS_ID, processIdentifier);
            logger.success(`   ✅ Processo encontrado por ID`);
            return processData;
        } catch (error) {
            logger.error(`   ❌ Processo não encontrado: ${processIdentifier}`);
            return null;
        }
    } catch (error) {
        logger.error(`   ❌ Erro ao buscar processo: ${error.message}`);
        return null;
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

    // Ask user which versions to fetch
    const currentVersionOnly = await promptVersionOption();

    await processProcesses(processes, {
        description: `Processando processos do grupo ${targetGroup}...`,
        currentVersionOnly
    });
}

/**
 * Orchestrates the flow for fetching a single process
 * @param {string | undefined} processIdentifier - Optional process identifier
 * @param {Object} options - Command options
 */
async function runGetSingleProcessFlow(processIdentifier, options = {}) {
    const logger = createLogger(options.verbose);

    let targetProcess = processIdentifier;

    if (!targetProcess) {
        targetProcess = await promptProcessIdentifier();
    }

    if (!targetProcess) {
        return;
    }

    const process = await fetchProcessByIdentifier(targetProcess, logger);

    if (!process) {
        logger.error(`   ❌ Processo '${targetProcess}' não encontrado`);
        return;
    }

    logger.info(`   ✅ Processo encontrado: ${process.name || process.identifier}`);

    // Ask user which versions to fetch
    const currentVersionOnly = await promptVersionOption();

    await processProcesses([process], {
        description: `Processando processo ${process.identifier || process._id}...`,
        currentVersionOnly
    });
}

module.exports = {
    promptGroupIdentifier,
    promptProcessIdentifier,
    promptVersionOption,
    fetchProcessesByGroup,
    fetchProcessByIdentifier,
    runGetProcessFlow,
    runGetSingleProcessFlow
};
