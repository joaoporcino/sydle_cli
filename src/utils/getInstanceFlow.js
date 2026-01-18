/**
 * @fileoverview Get Instance Flow Utility
 * 
 * Interactive wizard for fetching and viewing class instances.
 * Handles class resolution, instance search methods, and file output.
 * 
 * @module utils/getInstanceFlow
 */

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { executeMainMethod, get } = require('../api/main');

const META_CLASS_ID = '000000000000000000000000';

/**
 * Prompts for class identifier
 * @returns {Promise<string>} Class identifier
 */
async function promptClassIdentifier() {
    const { classIdentifier } = await inquirer.prompt([{
        type: 'input',
        name: 'classIdentifier',
        message: 'Class Identifier (e.g. com.sydle.one.sybox.Sybox):',
        validate: input => input.trim() ? true : 'Class identifier is required'
    }]);
    return classIdentifier;
}

/**
 * Resolves class identifier to class definition
 * @param {string} classIdentifier - Class identifier to resolve
 * @returns {Promise<{ classDefinition: any, targetClassId: string } | null>}
 */
async function resolveClassIdentifier(classIdentifier) {
    console.log(`Resolving class ${classIdentifier}...`);

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
        return null;
    }

    const classDefinition = classHits[0]._source;
    const targetClassId = classDefinition._id;
    console.log(`✓ Found Class ID: ${targetClassId}`);

    return { classDefinition, targetClassId };
}

/**
 * Prompts for search method (by ID or by field)
 * @returns {Promise<'id' | 'field'>} Search method
 */
async function promptSearchMethod() {
    const { searchMethod } = await inquirer.prompt([{
        type: 'list',
        name: 'searchMethod',
        message: 'How do you want to find the instance?',
        choices: [
            { name: 'By ID (_id)', value: 'id' },
            { name: 'By specific Field', value: 'field' }
        ]
    }]);
    return searchMethod;
}

/**
 * Prompts for instance ID
 * @returns {Promise<string>} Instance ID
 */
async function promptInstanceId() {
    const { idValue } = await inquirer.prompt([{
        type: 'input',
        name: 'idValue',
        message: 'Enter the instance _id:',
        validate: input => input.trim() ? true : 'Instance ID is required'
    }]);
    return idValue;
}

/**
 * Prompts for field search parameters
 * @returns {Promise<{ fieldName: string, fieldValue: string }>}
 */
async function promptFieldSearch() {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'fieldName',
            message: 'Field name (e.g. name):',
            validate: input => input.trim() ? true : 'Field name is required'
        },
        {
            type: 'input',
            name: 'fieldValue',
            message: 'Value to search:',
            validate: input => input.trim() ? true : 'Field value is required'
        }
    ]);
    return answers;
}

/**
 * Fetches instance by ID
 * @param {string} targetClassId - Target class ID
 * @param {string} instanceId - Instance ID
 * @returns {Promise<any | null>} Instance data or null
 */
async function fetchInstanceById(targetClassId, instanceId) {
    console.log(`Fetching instance ${instanceId}...`);
    try {
        return await get(targetClassId, instanceId);
    } catch (e) {
        console.error('❌ Failed to get instance by ID. It may not exist.');
        return null;
    }
}

/**
 * Fetches instance by field search
 * @param {string} targetClassId - Target class ID
 * @param {string} fieldName - Field name to search
 * @param {string} fieldValue - Field value to match
 * @returns {Promise<any | null>} Instance data or null
 */
async function fetchInstanceByField(targetClassId, fieldName, fieldValue) {
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
        return null;
    }

    let instanceData = hits[0]._source;

    // Fetch full instance data by ID for completeness
    if (instanceData._id) {
        console.log(`✓ Found instance ${instanceData._id}. Fetching full content...`);
        instanceData = await get(targetClassId, instanceData._id);
    }

    return instanceData;
}

/**
 * Saves instance data to JSON file
 * @param {any} instanceData - Instance data to save
 * @returns {string} Path to saved file
 */
function saveInstanceJson(instanceData) {
    const tmpDir = path.join(process.cwd(), '.tmp_json');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
    }

    const fileName = `instance_${instanceData._id || 'unknown'}.json`;
    const filePath = path.join(tmpDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(instanceData, null, 2));
    console.log(`\n📄 Saved JSON to: ${filePath}`);

    return filePath;
}

/**
 * Extracts and saves HTML fields from instance
 * @param {any} instanceData - Instance data
 * @param {any[]} fields - Class field definitions
 * @returns {string[]} Paths to saved HTML files
 */
function extractHtmlFields(instanceData, fields) {
    console.log('Checking for HTML content...');

    const tmpDir = path.join(process.cwd(), '.tmp_json');
    const htmlFiles = [];

    for (const field of fields) {
        if (field.type === 'HTML' && instanceData[field.identifier]) {
            const htmlContent = instanceData[field.identifier];
            if (htmlContent) {
                const htmlFileName = `instance_${instanceData._id}_${field.identifier}.html`;
                const htmlFilePath = path.join(tmpDir, htmlFileName);

                fs.writeFileSync(htmlFilePath, htmlContent);
                console.log(`🌐 Found HTML field '${field.identifier}'. Saved to: ${htmlFilePath}`);
                htmlFiles.push(htmlFilePath);
            }
        }
    }

    if (htmlFiles.length === 0) {
        console.log('No HTML fields found with content.');
    }

    return htmlFiles;
}

/**
 * Opens a file in the system default editor
 * @param {string} filePath - Path to file to open
 */
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

module.exports = {
    META_CLASS_ID,
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
};
