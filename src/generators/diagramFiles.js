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
 * @param {string} rootPath - Root path (sydle-process-[env])
 * @param {Map} classIdToIdentifier - Map of class IDs to identifiers
 */
async function generateDiagramFiles(versionPath, diagram, rootPath, classIdToIdentifier) {
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

        // Generate diagram elements using generic generator
        const { generateDiagramElementFiles } = require('./diagramElementFiles');

        let totalFiltered = 0;

        // Filter and generate tasks (only active elements)
        if (resolvedDiagramData.tasks && resolvedDiagramData.tasks.length > 0) {
            const activeTasks = resolvedDiagramData.tasks.filter(task => task.active !== false);
            const filteredCount = resolvedDiagramData.tasks.length - activeTasks.length;
            if (filteredCount > 0) {
                logger.debug(`      ⏭ Filtered ${filteredCount} inactive task(s)`);
                totalFiltered += filteredCount;
            }
            if (activeTasks.length > 0) {
                generateDiagramElementFiles(diagramPath, activeTasks, 'tasks', rootPath, classIdToIdentifier);
            }
        }

        // Filter and generate subprocesses (only active elements)
        if (resolvedDiagramData.subprocesses && resolvedDiagramData.subprocesses.length > 0) {
            const activeSubprocesses = resolvedDiagramData.subprocesses.filter(subprocess => subprocess.active !== false);
            const filteredCount = resolvedDiagramData.subprocesses.length - activeSubprocesses.length;
            if (filteredCount > 0) {
                logger.debug(`      ⏭ Filtered ${filteredCount} inactive subprocess(es)`);
                totalFiltered += filteredCount;
            }
            if (activeSubprocesses.length > 0) {
                generateDiagramElementFiles(diagramPath, activeSubprocesses, 'subprocesses', rootPath, classIdToIdentifier);
            }
        }

        // Filter and generate events (only active elements)
        if (resolvedDiagramData.events && resolvedDiagramData.events.length > 0) {
            const activeEvents = resolvedDiagramData.events.filter(event => event.active !== false);
            const filteredCount = resolvedDiagramData.events.length - activeEvents.length;
            if (filteredCount > 0) {
                logger.debug(`      ⏭ Filtered ${filteredCount} inactive event(s)`);
                totalFiltered += filteredCount;
            }
            if (activeEvents.length > 0) {
                generateDiagramElementFiles(diagramPath, activeEvents, 'events', rootPath, classIdToIdentifier);
            }
        }

        // Filter and generate gateways (only active elements)
        if (resolvedDiagramData.gateways && resolvedDiagramData.gateways.length > 0) {
            const activeGateways = resolvedDiagramData.gateways.filter(gateway => gateway.active !== false);
            const filteredCount = resolvedDiagramData.gateways.length - activeGateways.length;
            if (filteredCount > 0) {
                logger.debug(`      ⏭ Filtered ${filteredCount} inactive gateway(s)`);
                totalFiltered += filteredCount;
            }
            if (activeGateways.length > 0) {
                generateDiagramElementFiles(diagramPath, activeGateways, 'gateways', rootPath, classIdToIdentifier);
            }
        }

        const filterMessage = totalFiltered > 0
            ? ` (${totalFiltered} inactive element(s) filtered)`
            : '';
        logger.debug(`   📊 Fetched and saved diagram with resolved settings${filterMessage}`);

        // Generate Mermaid diagram visualization
        const { generateDiagramMermaid } = require('./diagramMermaid');
        generateDiagramMermaid(diagramPath, resolvedDiagramData);
    } catch (error) {
        logger.warn(`   ⚠ Failed to fetch diagram: ${error.message}`);
    }
}

module.exports = {
    generateDiagramFiles
};
