/**
 * @fileoverview Sync Diagram Tasks
 * 
 * Synchronizes diagram tasks (in tasks folder) to the Process Diagram (Class ...120).
 * Matches local task.json with the 'subprocesses' array in diagram.json.
 * 
 * @module core/syncLogicDiagram
 */

const fs = require('fs');
const path = require('path');
const { get, patch } = require('../api/main');

const PROCESS_DIAGRAM_CLASS_ID = '595c20500000000000000120';

/**
 * Synchronizes a specific method within a diagram task using granular patch
 * Path: /methods/<methodIndex> (directly on task class)
 * 
 * @param {string} methodJsonPath - Absolute path to the method.json file
 * @param {string} rootPath - Root project path
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function syncTaskMethodCore(methodJsonPath, rootPath, logger) {
    try {
        // 1. Identify paths and read method data
        // Structure: tasks/<taskName>/methods/<methodName>/method.json
        const methodFolder = path.dirname(methodJsonPath);     // tasks/<taskName>/methods/<methodName>
        const methodsFolder = path.dirname(methodFolder);      // tasks/<taskName>/methods
        const taskFolder = path.dirname(methodsFolder);        // tasks/<taskName>
        const scriptsFolder = path.join(methodFolder, 'scripts');
        const taskJsonPath = path.join(taskFolder, 'task.json');

        const methodName = path.basename(methodFolder);
        const taskName = path.basename(taskFolder);

        logger.debug(`[DEBUG] methodJsonPath: ${methodJsonPath}`);
        logger.debug(`[DEBUG] methodFolder: ${methodFolder}`);
        logger.debug(`[DEBUG] methodsFolder: ${methodsFolder}`);
        logger.debug(`[DEBUG] taskFolder: ${taskFolder}`);
        logger.debug(`[DEBUG] taskJsonPath: ${taskJsonPath}`);

        if (!fs.existsSync(methodJsonPath)) {
            logger.error(`❌ method.json not found: ${methodJsonPath}`);
            return { success: false };
        }

        if (!fs.existsSync(taskJsonPath)) {
            logger.error(`❌ task.json not found: ${taskJsonPath}`);
            return { success: false };
        }

        logger.progress(`🔄 [DIAGRAM] Syncing task method '${taskName}/${methodName}'`);

        // 2. Read all scripts
        const methodData = JSON.parse(fs.readFileSync(methodJsonPath, 'utf-8'));

        if (!fs.existsSync(scriptsFolder)) {
            logger.warn(`   ⚠ No scripts folder found`);
            return { success: false };
        }

        const scriptFiles = fs.readdirSync(scriptsFolder)
            .filter(file => file.match(/^script_\d+\.js$/))
            .sort((a, b) => {
                const numA = parseInt(a.match(/script_(\d+)\.js/)[1], 10);
                const numB = parseInt(b.match(/script_(\d+)\.js/)[1], 10);
                return numA - numB;
            });

        if (scriptFiles.length === 0) {
            logger.warn(`   ⚠ No script files found`);
            return { success: false };
        }

        const scripts = [];
        for (const sf of scriptFiles) {
            scripts.push(fs.readFileSync(path.join(scriptsFolder, sf), 'utf-8'));
        }

        methodData.scripts = scripts;

        // Write updated method.json
        fs.writeFileSync(methodJsonPath, JSON.stringify(methodData, null, 4), 'utf-8');

        // 3. Read task data to get task's class ID
        const taskData = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'));

        if (!taskData.settings || !taskData.settings._id || !taskData.settings._class || !taskData.settings._class._id) {
            logger.error(`   ❌ Task settings not found or missing _id/_class._id in task.json`);
            return { success: false };
        }

        const taskClassId = taskData.settings._class._id;
        const taskInstanceId = taskData.settings._id;

        logger.debug(`[DEBUG] Using task class ID: ${taskClassId}`);
        logger.debug(`[DEBUG] Using task instance ID: ${taskInstanceId}`);

        // 4. Fetch current task instance from API to get methods array
        let currentTaskInstance;
        try {
            currentTaskInstance = await get(taskClassId, taskInstanceId);
        } catch (apiError) {
            logger.error(`   ❌ Failed to fetch task instance: ${apiError.message}`);
            return { success: false };
        }

        if (!currentTaskInstance) {
            logger.error(`   ❌ Task instance not found in Sydle`);
            return { success: false };
        }

        // 5. Find method index in methods array
        const methods = currentTaskInstance.methods || [];
        const methodIndex = methods.findIndex(m => m.identifier === methodData.identifier);

        let patchOperation;
        let patchPath;
        let actionDescription;

        if (methodIndex === -1) {
            // Method doesn't exist, add it
            patchOperation = 'add';
            patchPath = `/methods/-`;
            actionDescription = 'Created';
        } else {
            // Method exists, replace it
            patchOperation = 'replace';
            patchPath = `/methods/${methodIndex}`;
            actionDescription = 'Synced';
        }

        // 6. Execute patch directly on task class
        const updateData = {
            _id: taskInstanceId,
            _operationsList: [{
                op: patchOperation,
                path: patchPath,
                value: methodData
            }]
        };

        await patch(taskClassId, updateData);

        // 7. Update local task.json with new method data
        if (!taskData.settings.methods) taskData.settings.methods = [];

        const localMethodIndex = taskData.settings.methods.findIndex(m => m.identifier === methodData.identifier);
        if (localMethodIndex === -1) {
            taskData.settings.methods.push(methodData);
        } else {
            taskData.settings.methods[localMethodIndex] = methodData;
        }

        fs.writeFileSync(taskJsonPath, JSON.stringify(taskData, null, 4), 'utf-8');

        // 8. Update local diagram.json (keep it in sync)
        const diagramFolder = path.dirname(path.dirname(taskFolder)); // tasks -> diagram
        const diagramJsonPath = path.join(diagramFolder, 'diagram.json');

        if (fs.existsSync(diagramJsonPath)) {
            const diagramData = JSON.parse(fs.readFileSync(diagramJsonPath, 'utf-8'));
            if (!diagramData.tasks) diagramData.tasks = [];

            const localTaskIndex = diagramData.tasks.findIndex(item => {
                return item.identifier === taskData.identifier ||
                    (item.settings && item.settings.identifier === taskData.identifier);
            });

            if (localTaskIndex !== -1) {
                if (!diagramData.tasks[localTaskIndex].settings) {
                    diagramData.tasks[localTaskIndex].settings = {};
                }
                if (!diagramData.tasks[localTaskIndex].settings.methods) {
                    diagramData.tasks[localTaskIndex].settings.methods = [];
                }

                const localDiagramMethodIndex = diagramData.tasks[localTaskIndex].settings.methods.findIndex(
                    m => m.identifier === methodData.identifier
                );

                if (localDiagramMethodIndex === -1) {
                    diagramData.tasks[localTaskIndex].settings.methods.push(methodData);
                } else {
                    diagramData.tasks[localTaskIndex].settings.methods[localDiagramMethodIndex] = methodData;
                }

                fs.writeFileSync(diagramJsonPath, JSON.stringify(diagramData, null, 4), 'utf-8');
            }
        }

        logger.success(`   ✓ ${actionDescription} (${scripts.length} script(s)) - Path: ${patchPath}`);
        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed to sync task method: ${error.message}`);
        return { success: false, message: error.message };
    }
}

/**
 * Synchronizes a diagram task from task.json to Sydle
 * 
 * NOTE: This function is currently DISABLED because task metadata should not be
 * automatically synced back to the diagram. Task structure is managed by the diagram
 * editor. Only methods within tasks should be synced via syncTaskMethodCore.
 * 
 * @param {string} taskJsonPath - Absolute path to the task.json file
 * @param {string} rootPath - Root project path
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, skipped?: boolean, message?: string}>}
 */
async function syncDiagramTaskCore(taskJsonPath, rootPath, logger) {
    try {
        const taskFolder = path.dirname(taskJsonPath);
        const taskName = path.basename(taskFolder);

        logger.debug(`[DEBUG] Syncing task metadata for ${taskName}`);

        if (!fs.existsSync(taskJsonPath)) {
            logger.error(`❌ task.json not found: ${taskJsonPath}`);
            return { success: false };
        }

        const taskData = JSON.parse(fs.readFileSync(taskJsonPath, 'utf-8'));

        if (!taskData.settings || !taskData.settings._id || !taskData.settings._class || !taskData.settings._class._id) {
            logger.error(`   ❌ Task settings not found or missing _id/_class._id in task.json`);
            return { success: false };
        }

        const taskClassId = taskData.settings._class._id;
        const taskInstanceId = taskData.settings._id;

        logger.progress(`🔄 [DIAGRAM] Syncing task settings for '${taskName}'`);

        // We want to patch the whole settings object, OR specific fields.
        // For safety and simplicity given we just updated processFields, let's patch the fields we know about. 
        // Ideally we'd patch 'processFields' and 'fields'.
        // Let's create an operations list.

        const operations = [];

        // 1. processFields
        if (taskData.settings.processFields) {
            operations.push({
                op: 'replace',
                path: '/processFields',
                value: taskData.settings.processFields
            });
        }

        // 2. fields (local)
        if (taskData.settings.fields) {
            operations.push({
                op: 'replace',
                path: '/fields',
                value: taskData.settings.fields
            });
        }

        // 3. name (if changed)
        if (taskData.settings._name) {
            operations.push({
                op: 'replace',
                path: '/_name',
                value: taskData.settings._name
            });
        }

        if (operations.length === 0) {
            logger.warn(`   ⚠ No syncable settings found to patch.`);
            return { success: true, skipped: true };
        }

        const updateData = {
            _id: taskInstanceId,
            _operationsList: operations
        };

        await patch(taskClassId, updateData);

        // Update diagram.json as well to keep it consistent
        const diagramFolder = path.dirname(path.dirname(taskFolder)); // tasks -> diagram
        const diagramJsonPath = path.join(diagramFolder, 'diagram.json');

        if (fs.existsSync(diagramJsonPath)) {
            const diagramData = JSON.parse(fs.readFileSync(diagramJsonPath, 'utf-8'));
            if (diagramData.tasks) {
                const localTaskIndex = diagramData.tasks.findIndex(item => {
                    // Check identifier on item or item.settings
                    const id = item.identifier || (item.settings && item.settings.identifier);
                    const targetId = taskData.identifier || taskData.settings.identifier;
                    return id === targetId;
                });

                if (localTaskIndex !== -1) {
                    // Update the settings in diagram.json
                    // We merge to avoid losing other properties that might be in diagram.json but not task.json (if any)
                    // But effectively task.json settings should override.

                    // Helper to merge specific props we care about to avoid overwriting structural diagram props
                    const currentSettings = diagramData.tasks[localTaskIndex].settings || {};

                    if (taskData.settings.processFields) currentSettings.processFields = taskData.settings.processFields;
                    if (taskData.settings.fields) currentSettings.fields = taskData.settings.fields;
                    if (taskData.settings._name) currentSettings._name = taskData.settings._name;

                    diagramData.tasks[localTaskIndex].settings = currentSettings;

                    fs.writeFileSync(diagramJsonPath, JSON.stringify(diagramData, null, 4), 'utf-8');
                }
            }
        }

        logger.success(`   ✓ Task settings synced (processFields/fields)`);
        return { success: true };

    } catch (error) {
        logger.error(`   ❌ Failed to sync task settings: ${error.message}`);
        return { success: false, message: error.message };
    }
}

/**
 * Synchronizes a script file within a diagram task to Sydle
 * 
 * @param {string} scriptPath - Absolute path to the script.js file
 * @param {string} rootPath - Root project path
 * @param {Object} logger - Logger instance
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function syncDiagramTaskScriptCore(scriptPath, rootPath, logger) {
    // Structure: .../diagram/tasks/TaskName/methods/MethodName/scripts/script_0.js

    // 1. Identify paths - navigate to method.json
    const scriptsFolder = path.dirname(scriptPath);
    const methodFolder = path.dirname(scriptsFolder);
    const methodJsonPath = path.join(methodFolder, 'method.json');

    if (!fs.existsSync(methodJsonPath)) {
        logger.error(`❌ method.json not found for task method`);
        return { success: false };
    }

    // 2. Use syncTaskMethodCore for granular method patch
    return await syncTaskMethodCore(methodJsonPath, rootPath, logger);
}

module.exports = { syncDiagramTaskCore, syncDiagramTaskScriptCore, syncTaskMethodCore };
