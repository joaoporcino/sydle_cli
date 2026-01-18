/**
 * @fileoverview Get Instance Command
 * 
 * CLI command to fetch a class instance and view its content.
 * Portuguese: sydle obterInstancia
 * English alias: sydle getInstance
 * 
 * @module commands/getInstance
 */

const { Command } = require('commander');
const { ensureAuth } = require('../utils/authFlow');
const {
    promptClassIdentifier,
    resolveClassIdentifier,
    promptSearchMethod,
    promptInstanceId,
    promptFieldSearch,
    fetchInstanceById,
    fetchInstanceByField,
    saveInstanceJson,
    extractHtmlFields,
    openFileInEditor
} = require('../utils/getInstanceFlow');

const obterInstanciaCommand = new Command('obterInstancia')
    .alias('getInstance')
    .description('Fetch a class instance and view its content')
    .action(async () => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            // 1. Ask for Class Identifier
            const classIdentifier = await promptClassIdentifier();

            // 2. Resolve Class Identifier to Class Definition
            const classResult = await resolveClassIdentifier(classIdentifier);
            if (!classResult) return;

            const { classDefinition, targetClassId } = classResult;

            // 3. Ask for Search Method
            const searchMethod = await promptSearchMethod();

            let instanceData = null;

            if (searchMethod === 'id') {
                const idValue = await promptInstanceId();
                instanceData = await fetchInstanceById(targetClassId, idValue);
            } else {
                const { fieldName, fieldValue } = await promptFieldSearch();
                instanceData = await fetchInstanceByField(targetClassId, fieldName, fieldValue);
            }

            if (!instanceData) return;

            // 4. Save JSON and Open
            const filePath = saveInstanceJson(instanceData);
            openFileInEditor(filePath);

            // 5. Extract HTML Fields
            const fields = classDefinition.fields || [];
            const htmlFiles = extractHtmlFields(instanceData, fields);

            for (const htmlFile of htmlFiles) {
                openFileInEditor(htmlFile);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Operation failed:', message);
        }
    });

module.exports = obterInstanciaCommand;
