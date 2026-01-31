/**
 * Core logic for processing Sydle processes
 * Similar to processClasses.js but for processes.
 * 
 * Receives an array of process objects and generates the folder structure:
 * sydle-process-[env]/[group]/[process]
 */

const { get } = require('../api/main');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');
const {
    generateMethodFiles,
    generateFieldsSchema,
    generateClassDts,
    generateClassSchema,
    generateProcessRolesFiles,
    generateDiagramFiles
} = require('../generators');

const PROCESS_GROUP_CLASS_ID = '595c20500000000000000133';
const PROCESS_VERSION_CLASS_ID = '595c20500000000000000110';
const CLASS_CLASS_ID = '000000000000000000000000';

/**
 * Sanitizes a name to be used as a folder name
 * @param {string|Object} name - Name to sanitize
 * @returns {string} Sanitized name
 */
function sanitizeFolderName(name) {
    if (typeof name === 'object' && name !== null) {
        name = name.pt || name.en || Object.values(name)[0];
    }
    if (!name || typeof name !== 'string') return '';

    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9_-]/g, '_')    // Replace invalid chars
        .replace(/_+/g, '_')              // Collapse multiple underscores
        .replace(/^_|_$/g, '');           // Trim underscores
}

/**
 * Generate pin structure for a process version
 * @param {string} versionPath - Path to the version folder
 * @param {Object} versionData - Version data object
 * @param {string} rootPath - Root path (sydle-process-[env])
 * @param {Map} classIdToIdentifier - Map of class IDs to identifiers
 */
async function generatePinStructure(versionPath, versionData, rootPath, classIdToIdentifier) {
    const pinPath = path.join(versionPath, 'pin');

    if (!fs.existsSync(pinPath)) {
        fs.mkdirSync(pinPath, { recursive: true });
    }

    // Save version data as class.json inside pin/
    fs.writeFileSync(
        path.join(pinPath, 'class.json'),
        JSON.stringify(versionData, null, 2)
    );

    // Generate method files for pin (reuse existing generator - creates methods/ folder)
    generateMethodFiles(pinPath, versionData.methods || [], rootPath, classIdToIdentifier, versionData);

    // Generate fields schema (reuse existing generator - create fields/ folder)
    if (versionData.fields && versionData.fields.length > 0) {
        const fieldsFolder = path.join(pinPath, 'fields');
        if (!fs.existsSync(fieldsFolder)) {
            fs.mkdirSync(fieldsFolder, { recursive: true });
        }
        generateFieldsSchema(versionData, fieldsFolder, rootPath);
    }

    // Generate processRoles inside pin/ directory
    if (versionData.processRoles && versionData.processRoles.length > 0) {
        generateProcessRolesFiles(pinPath, versionData.processRoles);
    }

    // Generate class.d.ts for pin types (reuse existing generator)
    await generateClassDts(versionData, pinPath, { classIdToIdentifier, classId: CLASS_CLASS_ID });

    // Generate class.schema.js (reuse existing generator)
    generateClassSchema(versionData, pinPath);

    logger.debug(`   📁 Generated pin/ structure with ${(versionData.methods || []).length} methods, ${(versionData.processRoles || []).length} roles`);
}


/**
 * Process an array of processes and generate folders/files
 * @param {Object[]} processesData - Array of process objects to process
 * @param {Object} [options] - Processing options
 * @param {string} [options.description] - Description for logging
 * @param {boolean} [options.currentVersionOnly=false] - If true, fetch only current version
 * @returns {Promise<Object>} Processing results
 */
async function processProcesses(processesData, options = {}) {
    const { description, currentVersionOnly = false } = options;

    logger.info(description || 'Processing processes...');

    let url = process.env.SYDLE_API_URL || '';
    let env = 'prod';
    if (url.includes('dev')) env = 'dev';
    else if (url.includes('hom')) env = 'hom';

    const rootFolder = `sydle-process-${env}`;
    const rootPath = path.join(process.cwd(), rootFolder);

    // Ensure root folder exists
    if (!fs.existsSync(rootPath)) {
        fs.mkdirSync(rootPath, { recursive: true });
    }

    const groupInfoMap = new Map();
    const classIdToIdentifier = new Map();
    let processedCount = 0;
    let versionsCount = 0;

    // Phase 0: Load existing classes from sydle-dev for type resolution
    logger.info('Phase 0: Loading existing classes for type resolution...');
    const sydleDevPath = path.join(process.cwd(), `sydle-${env}`);
    if (fs.existsSync(sydleDevPath)) {
        const loadClassesRecursively = (dir) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    const classJsonPath = path.join(itemPath, 'class.json');
                    if (fs.existsSync(classJsonPath)) {
                        try {
                            const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
                            classIdToIdentifier.set(classData._id, classData.identifier);
                        } catch (error) {
                            // Silently skip malformed files
                        }
                    }
                    loadClassesRecursively(itemPath);
                }
            }
        };

        loadClassesRecursively(sydleDevPath);
        logger.debug(`Loaded ${classIdToIdentifier.size} existing classes for type resolution.`);
    }

    logger.info(`Phase 1: Processing ${processesData.length} processes...`);

    for (const processData of processesData) {
        logger.progress(`Generating folders for process: ${processData.identifier || processData._id}`);

        try {
            // 1. Get/Fetch group info
            const groupId = processData.group?._id;
            if (!groupId) {
                logger.warn(`   ⚠ Process ${processData.identifier} has no group associated.`);
                continue;
            }

            let groupData;
            if (groupInfoMap.has(groupId)) {
                groupData = groupInfoMap.get(groupId);
            } else {
                try {
                    groupData = await get(PROCESS_GROUP_CLASS_ID, groupId);
                    groupInfoMap.set(groupId, groupData);
                } catch (error) {
                    logger.error(`   ❌ Failed to fetch group metadata for ID ${groupId}: ${error.message}`);
                    continue;
                }
            }

            // 2. Create Group folder
            const groupName = groupData.name ? sanitizeFolderName(groupData.name) : (groupData.identifier || groupData._id);
            const groupPath = path.join(rootPath, groupName);

            if (!fs.existsSync(groupPath)) {
                fs.mkdirSync(groupPath, { recursive: true });
            }

            // Save group.json
            fs.writeFileSync(
                path.join(groupPath, 'group.json'),
                JSON.stringify(groupData, null, 2)
            );

            // 3. Create Process folder
            const processName = processData.name ? sanitizeFolderName(processData.name) : (processData.identifier || processData._id);
            const processPath = path.join(groupPath, processName);

            if (!fs.existsSync(processPath)) {
                fs.mkdirSync(processPath, { recursive: true });
            }

            // Save process.json
            fs.writeFileSync(
                path.join(processPath, 'process.json'),
                JSON.stringify(processData, null, 2)
            );

            // 4. Fetch versions for this process
            if (currentVersionOnly) {
                // Fetch only the current version
                if (processData.currentVersion?._id) {
                    try {
                        const versionData = await get(PROCESS_VERSION_CLASS_ID, processData.currentVersion._id);

                        const versionLabel = sanitizeFolderName(versionData.versionLabel || 'current');
                        const versionPath = path.join(processPath, versionLabel);

                        if (!fs.existsSync(versionPath)) {
                            fs.mkdirSync(versionPath, { recursive: true });
                        }

                        fs.writeFileSync(
                            path.join(versionPath, 'version.json'),
                            JSON.stringify(versionData, null, 2)
                        );
                        versionsCount++;
                        logger.debug(`   📌 Fetched current version: ${versionLabel}`);

                        // Generate pin structure (includes processRoles)
                        await generatePinStructure(versionPath, versionData, rootPath, classIdToIdentifier);

                        // Generate diagram structure
                        await generateDiagramFiles(versionPath, versionData.diagram, rootPath, classIdToIdentifier);
                    } catch (vError) {
                        logger.warn(`   ⚠ Failed to fetch current version for process ${processData.identifier}: ${vError.message}`);
                    }
                } else {
                    logger.warn(`   ⚠ Process ${processData.identifier} has no currentVersion field.`);
                }
            } else {
                // Fetch all versions using pagination (existing behavior)
                try {
                    const { searchPaginated } = require('../api/main');
                    const versionQuery = {
                        query: {
                            term: { "process._id": processData._id }
                        },
                        sort: [{ "_creationDate": "desc" }]
                    };

                    await searchPaginated(PROCESS_VERSION_CLASS_ID, versionQuery, 50, async (hits) => {
                        for (const hit of hits) {
                            const versionData = hit._source;
                            if (!versionData) continue;

                            const versionLabel = sanitizeFolderName(versionData.versionLabel || 'unknown');
                            const versionPath = path.join(processPath, versionLabel);

                            if (!fs.existsSync(versionPath)) {
                                fs.mkdirSync(versionPath, { recursive: true });
                            }

                            // Save version.json (keeping full metadata as requested)
                            fs.writeFileSync(
                                path.join(versionPath, 'version.json'),
                                JSON.stringify(versionData, null, 2)
                            );
                            versionsCount++;

                            // Generate pin structure (includes processRoles)
                            await generatePinStructure(versionPath, versionData, rootPath, classIdToIdentifier);

                            // Generate diagram structure
                            await generateDiagramFiles(versionPath, versionData.diagram, rootPath, classIdToIdentifier);
                        }
                    });
                } catch (vError) {
                    logger.warn(`   ⚠ Failed to fetch versions for process ${processData.identifier}: ${vError.message}`);
                }
            }

            processedCount++;
        } catch (error) {
            logger.error(`   ❌ Error processing process ${processData.identifier}: ${error.message}`);
        }
    }

    logger.success(`\n✅ Processing completed. Total processes: ${processedCount}, Total versions: ${versionsCount}`);

    return {
        groupsGenerated: groupInfoMap.size,
        processesGenerated: processedCount,
        versionsGenerated: versionsCount
    };
}

module.exports = {
    processProcesses
};
