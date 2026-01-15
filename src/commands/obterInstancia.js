const { Command } = require('commander');
const inquirer = require('inquirer');
const { executeMainMethod, get } = require('../api/main'); // executeMainMethod allows raw access for _search
const { ensureAuth } = require('../utils/authFlow');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const obterInstanciaCommand = new Command('obterInstancia')
    .description('Fetch a class instance and view its content')
    .action(async () => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            // 1. Ask for Class Identifier
            const { classIdentifier } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'classIdentifier',
                    message: 'Class Identifier (e.g. com.sydle.one.sybox.Sybox):'
                }
            ]);

            // 2. Resolve Class Identifier to Class Definition ID
            // We search in the Sydle Class Metadata class (000000000000000000000000)
            const META_CLASS_ID = '000000000000000000000000';
            console.log(`Resolving class ${classIdentifier}...`);

            // Using direct search query
            const classSearchQuery = {
                query: {
                    term: { "identifier.keyword": classIdentifier }
                },
                size: 1
            };

            const classSearchResponse = await executeMainMethod(META_CLASS_ID, '_search', classSearchQuery, 'POST');
            const classHits = classSearchResponse?.hits?.hits;

            if (!classHits || classHits.length === 0) {
                console.error(`❌ Class not found: ${classIdentifier}`);
                return;
            }

            const classDefinition = classHits[0]._source;
            const targetClassId = classDefinition._id;
            console.log(`✓ Found Class ID: ${targetClassId}`);

            // 3. Ask for Search Method (ID vs Field)
            const { searchMethod } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'searchMethod',
                    message: 'How do you want to find the instance?',
                    choices: [
                        { name: 'By ID (_id)', value: 'id' },
                        { name: 'By specific Field', value: 'field' }
                    ]
                }
            ]);

            let initialInstanceData = null;

            if (searchMethod === 'id') {
                const { idValue } = await inquirer.prompt([
                    { type: 'input', name: 'idValue', message: 'Enter the instance _id:' }
                ]);

                console.log(`Fetching instance ${idValue}...`);
                // Use _get
                // get() helper does exactly this: (classId, id) -> returns data
                try {
                    initialInstanceData = await get(targetClassId, idValue);
                } catch (e) {
                    console.error('❌ Failed to get instance by ID. It may not exist.');
                    return;
                }

            } else {
                // By Field
                const { fieldName, fieldValue } = await inquirer.prompt([
                    { type: 'input', name: 'fieldName', message: 'Field name (e.g. name):' },
                    { type: 'input', name: 'fieldValue', message: 'Value to search:' }
                ]);

                console.log(`Searching for ${fieldName} = ${fieldValue}...`);

                const instanceQuery = {
                    query: {
                        term: { [`${fieldName}.keyword`]: fieldValue }
                    },
                    size: 1
                };

                const searchRes = await executeMainMethod(targetClassId, '_search', instanceQuery, 'POST');
                const hits = searchRes?.hits?.hits;

                if (!hits || hits.length === 0) {
                    console.log('❌ No instance found matching criteria.');
                    return;
                }

                initialInstanceData = hits[0]._source;
                // If it was a search result, it might not have the full data (depending on _source mapping), 
                // but usually it's fine. Explicitly fetching again by ID is safer for full content.
                if (initialInstanceData._id) {
                    console.log(`✓ Found instance ${initialInstanceData._id}. Fetching full content...`);
                    initialInstanceData = await get(targetClassId, initialInstanceData._id);
                }
            }

            if (!initialInstanceData) {
                return;
            }

            // 4. Handle Response (Save JSON)
            const tmpDir = path.join(process.cwd(), '.tmp_json');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir);
            }

            const fileName = `instance_${initialInstanceData._id || 'unknown'}.json`;
            const filePath = path.join(tmpDir, fileName);

            fs.writeFileSync(filePath, JSON.stringify(initialInstanceData, null, 2));
            console.log(`\n📄 Saved JSON to: ${filePath}`);

            // Open JSON file
            openFileInEditor(filePath);

            // 5. Check for HTML fields and extract
            console.log('Checking for HTML content...');

            // We need to know which fields are HTML. We can check the class definition we fetched earlier.
            // We might need to fetch the FULL class definition to be sure about fields, 
            // as the search result for the class metadata might be partial? 
            // Usually search returns full source, let's assume so.
            // If classDefinition comes from search result of metadata class, it has 'fields'.

            const fields = classDefinition.fields || [];
            let htmlFound = false;

            for (const field of fields) {
                // Check if field type is HTML (assuming 'HTML' is the type identifier, based on user context)
                // Common Sydle types: STRING, INTEGER, BOOLEAN, REFERENCE... 
                // Let's assume there is a specific type or we check the data content.
                // The prompt says "analisar se existe algum campo do tipo html".

                // Let's look for type 'HTML' or 'TEXT_HTML' commonly used.
                // Also check if the data actually contains this field.

                if (field.type === 'HTML' && initialInstanceData[field.identifier]) {
                    const htmlContent = initialInstanceData[field.identifier];
                    if (htmlContent) {
                        htmlFound = true;
                        const htmlFileName = `instance_${initialInstanceData._id}_${field.identifier}.html`;
                        const htmlFilePath = path.join(tmpDir, htmlFileName);

                        fs.writeFileSync(htmlFilePath, htmlContent);
                        console.log(`🌐 Found HTML field '${field.identifier}'. Saved to: ${htmlFilePath}`);
                        openFileInEditor(htmlFilePath);
                    }
                }
            }

            if (!htmlFound) {
                console.log('No HTML fields found with content.');
            }

        } catch (error) {
            console.error('Operation failed:', error.message);
        }
    });

function openFileInEditor(filePath) {
    let command;
    switch (process.platform) {
        case 'win32':
            command = `start "" "${filePath}"`;
            break;
        case 'darwin':
            command = `open "${filePath}"`;
            break;
        case 'linux':
            command = `xdg-open "${filePath}"`;
            break;
        default:
            console.log(`Please open ${filePath} manually.`);
            return;
    }
    exec(command);
}

module.exports = obterInstanciaCommand;
