/**
 * Generator for process diagram files
 * Fetches diagram data via API and saves to diagram folder
 */

const fs = require('fs');
const path = require('path');
const { get } = require('../api/main');
const { logger } = require('../utils/logger');

/**
 * Recursively resolves settings references in a diagram object
 * @param {any} obj - Object to process
 * @returns {Promise<any>} - Processed object with resolved settings
 */
async function resolveSettings(obj) {
    // Se não é um objeto nem array, retorna o valor original
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Se é array, processa cada item
    if (Array.isArray(obj)) {
        return Promise.all(obj.map(item => resolveSettings(item)));
    }

    // Se é objeto, verifica se tem campo settings
    const resolvedObj = {};

    for (const [key, value] of Object.entries(obj)) {
        if (key === 'settings' && value?._id && value?._classId) {
            // Buscar dados completos do settings
            try {
                const settingsData = await get(value._classId, value._id);
                resolvedObj[key] = settingsData;
                logger.debug(`      ✓ Resolved settings ${value._id}`);
            } catch (error) {
                logger.warn(`      ⚠ Failed to resolve settings ${value._id}: ${error.message}`);
                resolvedObj[key] = value; // Mantém a referência original em caso de erro
            }
        } else {
            // Processa recursivamente outros campos
            resolvedObj[key] = await resolveSettings(value);
        }
    }

    return resolvedObj;
}

/**
 * Generate diagram structure for a process version
 * @param {string} versionPath - Path to the version folder
 * @param {Object} diagram - Diagram reference object with _id and _classId
 */
async function generateDiagramFiles(versionPath, diagram) {
    if (!diagram?._id || !diagram?._classId) {
        return;
    }

    try {
        // Fetch diagram data from API
        const diagramData = await get(diagram._classId, diagram._id);

        logger.debug(`   📊 Fetching diagram and resolving settings references...`);

        // Resolve all settings references recursively
        const resolvedDiagramData = await resolveSettings(diagramData);

        const diagramPath = path.join(versionPath, 'diagram');

        if (!fs.existsSync(diagramPath)) {
            fs.mkdirSync(diagramPath, { recursive: true });
        }

        // Save diagram.json with resolved settings
        fs.writeFileSync(
            path.join(diagramPath, 'diagram.json'),
            JSON.stringify(resolvedDiagramData, null, 2)
        );

        logger.debug(`   📊 Fetched and saved diagram with resolved settings`);
    } catch (error) {
        logger.warn(`   ⚠ Failed to fetch diagram: ${error.message}`);
    }
}

module.exports = {
    generateDiagramFiles
};
