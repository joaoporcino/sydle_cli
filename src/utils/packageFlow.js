/**
 * @fileoverview Package Flow Utility
 * 
 * Interactive wizard for gathering package information and fetching classes.
 * Separated from command for reusability and cleaner code structure.
 * 
 * @module utils/packageFlow
 */

const inquirer = require('inquirer');
const { searchPaginated, get } = require('../api/main');
const { processClasses } = require('../core/processClasses');
const { createLogger } = require('./logger');

const PACKAGE_METADATA_ID = '000000000000000000000015';
const CLASS_METADATA_ID = '000000000000000000000000';

/**
 * Prompts for package identifier if not provided
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<string | null>} Package identifier or null
 */
async function promptPackageIdentifier(logger) {
    const { identifier } = await inquirer.prompt([{
        type: 'input',
        name: 'identifier',
        message: 'Identificador do pacote (Package identifier):',
        validate: input => input.trim() ? true : 'Identificador é obrigatório'
    }]);

    return identifier.trim() || null;
}

/**
 * Fetches all classes for a given package identifier
 * @param {string} identifier - Package identifier
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<Object[]>} Array of full class data
 */
async function fetchPackageClasses(identifier, logger) {
    logger.progress(`   🔄 Buscando classes do pacote ${identifier}...`);

    const query = {
        query: {
            term: { "package.identifier.keyword": identifier }
        },
        sort: [{ "_id": "asc" }]
    };

    const classesData = [];

    try {
        await searchPaginated(CLASS_METADATA_ID, query, 50, async (hits) => {
            logger.progress(`   📦 Encontradas ${hits.length} classes no lote...`);
            for (const hit of hits) {
                if (hit._source) {
                    try {
                        // Fetch full class to ensure we have all details including scripts
                        const fullClass = await get(CLASS_METADATA_ID, hit._source._id);
                        classesData.push(fullClass);
                    } catch (error) {
                        logger.warn(`   ⚠ Falha ao buscar classe completa ${hit._source.identifier}, usando resultado da busca.`);
                        classesData.push(hit._source);
                    }
                }
            }
        });

        return classesData;
    } catch (error) {
        logger.error(`   ❌ Erro ao buscar classes: ${error.message}`);
        return [];
    }
}

/**
 * Orchestrates the full getPackage flow
 * @param {string | undefined} identifier - Optional package identifier
 * @param {Object} options - Command options (verbose, etc)
 */
async function runGetPackageFlow(identifier, options = {}) {
    const logger = createLogger(options.verbose);

    let targetIdentifier = identifier;

    if (!targetIdentifier) {
        targetIdentifier = await promptPackageIdentifier(logger);
    }

    if (!targetIdentifier) {
        return;
    }

    const classesData = await fetchPackageClasses(targetIdentifier, logger);

    if (classesData.length === 0) {
        logger.error(`   ❌ Nenhuma classe encontrada no pacote '${targetIdentifier}'`);
        return;
    }

    logger.info(`   ✅ Total de classes obtidas: ${classesData.length}`);

    await processClasses(classesData, {
        description: `Processando pacote ${targetIdentifier}...`
    });
}

module.exports = {
    promptPackageIdentifier,
    fetchPackageClasses,
    runGetPackageFlow
};
