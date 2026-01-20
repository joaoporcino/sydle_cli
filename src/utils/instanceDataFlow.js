/**
 * @fileoverview Instance Data Flow Utility
 * 
 * Utilities for managing class instances in sydle-dev-data/ folder.
 * Handles extraction of complex fields (scripts, HTML) to separate files
 * and recomposition back to JSON for API updates.
 * 
 * @module utils/instanceDataFlow
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { get, update, searchPaginated } = require('../api/main');
const { validatePackage, findClassByIdentifier, CLASS_METADATA_ID } = require('./createClassFlow');
const { createLogger } = require('./logger');

/**
 * Gets the data directory path based on environment
 * @returns {string} Path to sydle-dev-data folder
 */
function getDataDir() {
    let url = process.env.SYDLE_API_URL || '';
    let env = 'prod';
    if (url.includes('dev')) env = 'dev';
    else if (url.includes('hom')) env = 'hom';

    return path.join(process.cwd(), `sydle-${env}-data`);
}

/**
 * Gets the dev directory path based on environment (for validation)
 * @returns {string} Path to sydle-dev folder
 */
function getDevDir() {
    let url = process.env.SYDLE_API_URL || '';
    let env = 'prod';
    if (url.includes('dev')) env = 'dev';
    else if (url.includes('hom')) env = 'hom';

    return path.join(process.cwd(), `sydle-${env}`);
}

/**
 * Parses package.class format into separate components
 * @param {string} packageClass - Format: "package.className"
 * @returns {{ packageId: string, classId: string } | null}
 */
function parsePackageClass(packageClass) {
    const parts = packageClass.split('.');
    if (parts.length < 2) {
        return null;
    }
    return {
        packageId: parts[0],
        classId: parts.slice(1).join('.')
    };
}

/**
 * Sanitizes a string to be a valid folder name
 * @param {string} name - Name to sanitize
 * @returns {string} Valid folder name
 */
function sanitizeFolderName(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9_-]/g, '_')    // Replace invalid chars
        .replace(/_+/g, '_')              // Collapse multiple underscores
        .replace(/^_|_$/g, '');           // Trim underscores
}

/**
 * Gets the instance directory path
 * @param {string} packageId - Package identifier
 * @param {string} classId - Class identifier
 * @param {string} instanceName - Instance folder name
 * @returns {string} Full path to instance directory
 */
function getInstanceDir(packageId, classId, instanceName) {
    return path.join(getDataDir(), packageId, classId, instanceName);
}

/**
 * Determines an appropriate folder name for an instance based on its data
 * @param {Object} instanceData - Instance data
 * @returns {string} Folder name
 */
function determineInstanceFolderName(instanceData) {
    // Try common identifier fields
    const identifierFields = ['name', 'nome', 'nomeDoDocumento', 'identifier', 'codigo', 'titulo', 'title'];

    for (const field of identifierFields) {
        if (instanceData[field] && typeof instanceData[field] === 'string') {
            return sanitizeFolderName(instanceData[field]);
        }
    }

    // Fallback to _id
    return instanceData._id || 'unknown';
}

/**
 * Extracts complex fields from instance data to separate files
 * @param {Object} instanceData - Full instance data
 * @param {string} instanceDir - Directory to save files
 * @returns {{ cleanedData: Object, extractedFiles: string[] }}
 */
function extractComplexFields(instanceData, instanceDir) {
    const extractedFiles = [];
    const cleanedData = { ...instanceData };

    // Ensure directory exists
    if (!fs.existsSync(instanceDir)) {
        fs.mkdirSync(instanceDir, { recursive: true });
    }

    // Extract 'script' field if present and is a string
    if (cleanedData.script && typeof cleanedData.script === 'string') {
        const scriptPath = path.join(instanceDir, 'script.js');
        fs.writeFileSync(scriptPath, cleanedData.script);
        extractedFiles.push(scriptPath);
        cleanedData.script = '<<EXTERNAL_FILE:script.js>>';
    }

    // Extract 'html' field if present
    if (cleanedData.html && typeof cleanedData.html === 'string') {
        const htmlPath = path.join(instanceDir, 'template.html');
        fs.writeFileSync(htmlPath, cleanedData.html);
        extractedFiles.push(htmlPath);
        cleanedData.html = '<<EXTERNAL_FILE:template.html>>';
    }

    // Extract versoes array if present (embedded objects with html/script)
    if (Array.isArray(cleanedData.versoes) && cleanedData.versoes.length > 0) {
        const versoesDir = path.join(instanceDir, 'versoes');
        if (!fs.existsSync(versoesDir)) {
            fs.mkdirSync(versoesDir, { recursive: true });
        }

        cleanedData.versoes = cleanedData.versoes.map((versao, index) => {
            const versaoCopy = { ...versao };
            const versaoFolderName = versao.descricao
                ? `${index}_${sanitizeFolderName(versao.descricao)}`
                : `${index}`;
            const versaoDir = path.join(versoesDir, versaoFolderName);

            if (!fs.existsSync(versaoDir)) {
                fs.mkdirSync(versaoDir, { recursive: true });
            }

            // Extract HTML from version
            if (versaoCopy.html && typeof versaoCopy.html === 'string') {
                const htmlPath = path.join(versaoDir, 'template.html');
                fs.writeFileSync(htmlPath, versaoCopy.html);
                extractedFiles.push(htmlPath);
                versaoCopy.html = `<<EXTERNAL_FILE:versoes/${versaoFolderName}/template.html>>`;
            }

            // Extract script from version if present
            if (versaoCopy.script && typeof versaoCopy.script === 'string') {
                const scriptPath = path.join(versaoDir, 'script.js');
                fs.writeFileSync(scriptPath, versaoCopy.script);
                extractedFiles.push(scriptPath);
                versaoCopy.script = `<<EXTERNAL_FILE:versoes/${versaoFolderName}/script.js>>`;
            }

            return versaoCopy;
        });
    }

    return { cleanedData, extractedFiles };
}

/**
 * Recomposes instance data by reading external files back
 * @param {string} instanceDir - Instance directory
 * @returns {Object} Full instance data with external files integrated
 */
function recomposeInstance(instanceDir) {
    const instanceJsonPath = path.join(instanceDir, 'instance.json');

    if (!fs.existsSync(instanceJsonPath)) {
        throw new Error(`instance.json not found in ${instanceDir}`);
    }

    const instanceData = JSON.parse(fs.readFileSync(instanceJsonPath, 'utf8'));

    /**
     * Recursively replaces external file references with actual content
     * @param {any} obj - Object to process
     * @returns {any} Processed object
     */
    function replaceExternalRefs(obj) {
        if (typeof obj === 'string' && obj.startsWith('<<EXTERNAL_FILE:')) {
            const relativePath = obj.replace('<<EXTERNAL_FILE:', '').replace('>>', '');
            const fullPath = path.join(instanceDir, relativePath);
            if (fs.existsSync(fullPath)) {
                return fs.readFileSync(fullPath, 'utf8');
            }
            return obj; // Return as-is if file not found
        }

        if (Array.isArray(obj)) {
            return obj.map(item => replaceExternalRefs(item));
        }

        if (obj && typeof obj === 'object') {
            const result = {};
            for (const key of Object.keys(obj)) {
                result[key] = replaceExternalRefs(obj[key]);
            }
            return result;
        }

        return obj;
    }

    return replaceExternalRefs(instanceData);
}

/**
 * Validates package and class identifiers
 * @param {string} packageId - Package identifier
 * @param {string} classId - Class identifier
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<{ packageData: Object, classData: Object } | null>}
 */
async function validatePackageAndClass(packageId, classId, logger) {
    const devDir = getDevDir();

    // 1. Check package locally first
    const localPackagePath = path.join(devDir, packageId);
    let packageData = null;

    if (fs.existsSync(localPackagePath)) {
        logger.log(`   ✓ Pacote encontrado localmente: ${packageId}`);
        packageData = { identifier: packageId, _local: true };
    } else {
        // Search via API
        packageData = await validatePackage(packageId, logger);
        if (!packageData) {
            return null;
        }
    }

    // 2. Check class locally first
    const localClassPath = path.join(devDir, packageId, classId, 'class.json');
    let classData = null;

    if (fs.existsSync(localClassPath)) {
        try {
            classData = JSON.parse(fs.readFileSync(localClassPath, 'utf8'));
            logger.log(`   ✓ Classe encontrada localmente: ${classId}`);
        } catch (e) {
            logger.warn(`   ⚠ Erro ao ler class.json local`);
        }
    }

    if (!classData) {
        // Search via API
        classData = await findClassByIdentifier(classId, devDir, logger);
        if (!classData) {
            logger.error(`   ❌ Classe '${classId}' não encontrada`);
            return null;
        }
    }

    return { packageData, classData };
}

/**
 * Prompts for instance ID if not provided
 * @param {string | undefined} idArg - ID argument from CLI
 * @returns {Promise<string>} Instance ID
 */
async function promptInstanceId(idArg) {
    if (idArg) return idArg;

    const ans = await inquirer.prompt([{
        type: 'input',
        name: 'id',
        message: 'ID da instância (_id):',
        validate: input => input.trim() ? true : 'ID é obrigatório'
    }]);
    return ans.id.trim();
}

/**
 * Saves instance to local folder structure
 * @param {Object} instanceData - Instance data from API
 * @param {string} packageId - Package identifier
 * @param {string} classId - Class identifier
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {{ instanceDir: string, extractedFiles: string[] }}
 */
function saveInstanceToLocal(instanceData, packageId, classId, logger) {
    const instanceName = determineInstanceFolderName(instanceData);
    const instanceDir = getInstanceDir(packageId, classId, instanceName);

    logger.log(`   📁 Salvando em: ${instanceDir}`);

    // Extract complex fields
    const { cleanedData, extractedFiles } = extractComplexFields(instanceData, instanceDir);

    // Save cleaned instance.json
    const instanceJsonPath = path.join(instanceDir, 'instance.json');
    fs.writeFileSync(instanceJsonPath, JSON.stringify(cleanedData, null, 2));

    return { instanceDir, extractedFiles };
}

module.exports = {
    getDataDir,
    getDevDir,
    parsePackageClass,
    sanitizeFolderName,
    getInstanceDir,
    determineInstanceFolderName,
    extractComplexFields,
    recomposeInstance,
    validatePackageAndClass,
    promptInstanceId,
    saveInstanceToLocal
};
