/**
 * @fileoverview Create Class Flow Utility
 * 
 * Interactive wizard for gathering class creation information.
 * Separated from command for reusability and cleaner code structure.
 * 
 * @module utils/createClassFlow
 */

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { searchPaginated } = require('../api/main');

const CLASS_METADATA_ID = '000000000000000000000000';
const PACKAGE_METADATA_ID = '000000000000000000000015';

/**
 * Available field types in Sydle
 */
const FIELD_TYPES = [
    'STRING',
    'INTEGER',
    'LONG',
    'DOUBLE',
    'BOOLEAN',
    'DATE',
    'REFERENCE',
    'FILE',
    'ID',
    'DYNAMIC',
    'GEOPOINT'
];

/**
 * Converts a name to camelCase identifier
 * @param {string} name - The name to convert
 * @returns {string} The camelCase identifier
 */
function toCamelCase(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\W+(.?)/g, (match, chr) => chr.toUpperCase())
        .replace(/^\w/, c => c.toLowerCase())
        .trim();
}

/**
 * Validates package identifier via API
 * @param {string} packageIdentifier - Package identifier to validate
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<{ _id: string, identifier: string } | null>} Package data or null
 */
async function validatePackage(packageIdentifier, logger) {
    logger.progress(`   🔄 Validando pacote '${packageIdentifier}'...`);

    try {
        /** @type {{ _id: string, identifier: string } | null} */
        let foundPackage = null;
        await searchPaginated(PACKAGE_METADATA_ID, {
            query: { term: { "identifier.keyword": packageIdentifier } },
            size: 1
        }, 1, async (hits) => {
            if (hits.length > 0 && hits[0]._source) {
                foundPackage = hits[0]._source;
            }
        });

        if (!foundPackage) {
            logger.error(`❌ Pacote '${packageIdentifier}' não encontrado no Sydle`);
            return null;
        }

        logger.log(`   ✓ Pacote encontrado: ${foundPackage.identifier} (${foundPackage._id})`);
        return foundPackage;
    } catch (apiError) {
        const message = apiError instanceof Error ? apiError.message : String(apiError);
        logger.error(`❌ Erro ao buscar pacote: ${message}`);
        return null;
    }
}

/**
 * Finds a class by identifier locally or via API
 * @param {string} identifier - Class identifier to find
 * @param {string} rootPath - Root path for local search
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<{ _id: string, identifier: string } | null>} Class data or null
 */
async function findClassByIdentifier(identifier, rootPath, logger) {
    const findLocalClass = (dir) => {
        if (!fs.existsSync(dir)) return null;
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                const classJsonPath = path.join(itemPath, 'class.json');
                if (fs.existsSync(classJsonPath)) {
                    try {
                        const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
                        if (classData.identifier === identifier) {
                            return classData;
                        }
                    } catch (e) { /* skip */ }
                }
                const found = findLocalClass(itemPath);
                if (found) return found;
            }
        }
        return null;
    };

    const localClass = findLocalClass(rootPath);
    if (localClass) {
        logger.log(`      ✓ Encontrado localmente: ${identifier}`);
        return localClass;
    }

    logger.log(`      🔄 Buscando na API: ${identifier}...`);
    try {
        /** @type {{ _id: string, identifier: string } | null} */
        let foundClass = null;
        await searchPaginated(CLASS_METADATA_ID, {
            query: { term: { "identifier.keyword": identifier } },
            size: 1
        }, 1, async (hits) => {
            if (hits.length > 0 && hits[0]._source) {
                foundClass = hits[0]._source;
            }
        });

        if (foundClass) {
            logger.log(`      ✓ Encontrado na API: ${identifier}`);
            return foundClass;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`      ⚠ Erro ao buscar na API: ${message}`);
    }

    return null;
}

/**
 * Creates a field object with required structure
 * @param {Object} fieldData - Field data from wizard
 * @returns {Object} Complete field object for Sydle
 */
function createFieldObject(fieldData) {
    const now = Date.now().toString();
    return {
        valueExpression: null,
        hidden: false,
        additionalConfigs: null,
        defaultValue: fieldData.defaultValue || null,
        section: fieldData.section || null,
        minMultiplicity: null,
        type: fieldData.type,
        required: fieldData.required || false,
        valueOptions: null,
        engine: 'DEFAULT',
        shiftable: true,
        relevancy: 'COMMON',
        editHelp: null,
        embedded: fieldData.embedded || false,
        calculated: false,
        identifier: fieldData.identifier,
        multiple: fieldData.multiple || false,
        refClass: fieldData.refClass || null,
        maxMultiplicity: null,
        _classRevision: now,
        readOnly: false,
        calculationStrategy: null,
        searchable: true,
        i18n: false,
        displayOnEditMode: false,
        encrypted: false,
        unique: false,
        encryptionAlgorithmType: null,
        name: fieldData.name,
        _class: {
            _id: '000000000000000000000001',
            _classId: '000000000000000000000000'
        }
    };
}

/**
 * Prompts for package identifier
 * @param {string | undefined} pkgArg - Package argument from CLI
 * @returns {Promise<string>} Package identifier
 */
async function promptPackageIdentifier(pkgArg) {
    if (pkgArg) return pkgArg;

    const ans = await inquirer.prompt([{
        type: 'input',
        name: 'pkg',
        message: 'Identificador do pacote:',
        validate: input => input.trim() ? true : 'Pacote é obrigatório'
    }]);
    return ans.pkg.trim();
}

/**
 * Prompts for class name
 * @param {string | undefined} nameArg - Name argument from CLI
 * @returns {Promise<string>} Class name
 */
async function promptClassName(nameArg) {
    if (nameArg) return nameArg;

    const ans = await inquirer.prompt([{
        type: 'input',
        name: 'name',
        message: 'Nome da classe:',
        validate: input => input.trim() ? true : 'Nome é obrigatório'
    }]);
    return ans.name.trim();
}

/**
 * Prompts for class identifier
 * @param {string | undefined} identifierOption - Identifier from CLI options
 * @param {string} className - Class name for suggestion
 * @returns {Promise<string>} Class identifier
 */
async function promptClassIdentifier(identifierOption, className) {
    if (identifierOption) return identifierOption;

    const suggestedIdentifier = toCamelCase(className);
    const idAns = await inquirer.prompt([{
        type: 'input',
        name: 'identifier',
        message: 'Identificador da classe:',
        default: suggestedIdentifier,
        validate: input => /^[a-zA-Z][a-zA-Z0-9]*$/.test(input)
            ? true
            : 'Identificador deve começar com letra e conter apenas letras e números'
    }]);
    return idAns.identifier;
}

/**
 * Prompts for class type
 * @param {string} typeOption - Type option from CLI
 * @returns {Promise<string>} Class type (STANDARD or INTERFACE)
 */
async function promptClassType(typeOption) {
    if (typeOption && typeOption !== 'STANDARD') return typeOption;

    const typeAns = await inquirer.prompt([{
        type: 'list',
        name: 'type',
        message: 'Tipo da classe:',
        choices: [
            { name: 'Standard (classe normal)', value: 'STANDARD' },
            { name: 'Interface (contrato)', value: 'INTERFACE' }
        ],
        default: 'STANDARD'
    }]);
    return typeAns.type;
}

/**
 * Runs the field creation wizard
 * @param {string} rootPath - Root path for class lookups
 * @param {import('./logger').Logger} logger - Logger instance
 * @returns {Promise<Object[]>} Array of field objects
 */
async function runFieldWizard(rootPath, logger) {
    const wantFields = await inquirer.prompt([{
        type: 'confirm',
        name: 'create',
        message: 'Deseja criar campos para esta classe?',
        default: true
    }]);

    if (!wantFields.create) return [];

    logger.info('\n📋 Assistente de Campos');
    logger.log('   (Digite "sair" para finalizar)\n');

    const customFields = [];
    let addingFields = true;

    while (addingFields) {
        const nameAns = await inquirer.prompt([{
            type: 'input',
            name: 'name',
            message: 'Nome do campo (ou "sair"):',
        }]);

        if (nameAns.name.toLowerCase() === 'sair' || !nameAns.name.trim()) {
            addingFields = false;
            continue;
        }

        const fieldName = nameAns.name.trim();
        const suggestedFieldId = toCamelCase(fieldName);

        const idAns = await inquirer.prompt([{
            type: 'input',
            name: 'identifier',
            message: 'Identificador:',
            default: suggestedFieldId,
            validate: input => /^[a-zA-Z][a-zA-Z0-9]*$/.test(input) ? true : 'Identificador inválido'
        }]);

        const typeAns = await inquirer.prompt([{
            type: 'list',
            name: 'type',
            message: 'Tipo:',
            choices: FIELD_TYPES,
            default: 'STRING'
        }]);

        const fieldData = {
            name: fieldName,
            identifier: idAns.identifier,
            type: typeAns.type,
            refClass: null,
            embedded: false
        };

        if (typeAns.type === 'REFERENCE') {
            const refAns = await inquirer.prompt([{
                type: 'input',
                name: 'refClass',
                message: 'Identificador da classe referenciada:',
                validate: input => input.trim() ? true : 'Classe é obrigatória para REFERENCE'
            }]);

            const refClass = await findClassByIdentifier(refAns.refClass, rootPath, logger);

            if (refClass) {
                fieldData.refClass = {
                    _id: refClass._id,
                    _classId: CLASS_METADATA_ID
                };
            } else {
                logger.warn(`      ⚠ Classe '${refAns.refClass}' não encontrada.`);
                fieldData.refClass = { identifier: refAns.refClass };
            }

            const embeddedAns = await inquirer.prompt([{
                type: 'confirm',
                name: 'embedded',
                message: 'Embutir (embedded)?',
                default: false
            }]);
            fieldData.embedded = embeddedAns.embedded;
        }

        const reqAns = await inquirer.prompt([{
            type: 'confirm',
            name: 'required',
            message: 'Obrigatório?',
            default: false
        }]);
        fieldData.required = reqAns.required;

        customFields.push(createFieldObject(fieldData));
        logger.success(`   ✓ Campo '${fieldName}' adicionado\n`);
    }

    return customFields;
}

module.exports = {
    toCamelCase,
    validatePackage,
    findClassByIdentifier,
    createFieldObject,
    promptPackageIdentifier,
    promptClassName,
    promptClassIdentifier,
    promptClassType,
    runFieldWizard,
    CLASS_METADATA_ID,
    PACKAGE_METADATA_ID,
    FIELD_TYPES
};
