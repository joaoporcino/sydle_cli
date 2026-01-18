/**
 * @fileoverview Field API Converter
 * 
 * Converts SchemaField objects from sydleZod to Sydle API format.
 * Handles the complex structure of additionalConfigs and exhibitionConfigs
 * with proper _class._id mappings for each field type.
 * 
 * @module generators/fieldApiConverter
 */

// ============ CLASS ID MAPPINGS ============

/**
 * additionalConfigs class IDs by field type
 */
const ADDITIONAL_CONFIGS_CLASS = {
    DATE: '000000000000005550000000',
    INTEGER: '000000000000005550000001',
    LONG: '000000000000005550000001',
    DOUBLE: '000000000000005550000001',
    STRING: '000000000000005550000002',
    REFERENCE: '000000000000005550000003',
    REFERENCE_EMBEDDED: '000000000000005550000005',
    FILE: '000000000000005550000004'
};

/**
 * exhibitionConfigs class IDs by field type
 */
const EXHIBITION_CONFIGS_CLASS = {
    DEFAULT: 'fffff0000000000000000001',
    REFERENCE: 'fffff0000000000000000002',
    BOOLEAN: 'fffff0000000000000000003',
    STRING: 'fffff0000000000000000004',
    INTEGER: 'fffff0000000000000000005',
    LONG: 'fffff0000000000000000005',
    DOUBLE: 'fffff0000000000000000006'
};

/**
 * valueOptions class ID (shared)
 */
const VALUE_OPTION_CLASS = '000000000000000000000088';

// ============ HELPER FUNCTIONS ============

/**
 * Gets the additionalConfigs class ID for a field type
 * @param {string} type - Field type
 * @param {boolean} embedded - Whether field is embedded
 * @returns {string|null} Class ID or null if not applicable
 */
function getAdditionalConfigsClassId(type, embedded = false) {
    if (type === 'REFERENCE' && embedded) {
        return ADDITIONAL_CONFIGS_CLASS.REFERENCE_EMBEDDED;
    }
    return ADDITIONAL_CONFIGS_CLASS[type] || null;
}

/**
 * Gets the exhibitionConfigs class ID for a field type
 * @param {string} type - Field type
 * @returns {string} Class ID (defaults to DEFAULT)
 */
function getExhibitionConfigsClassId(type) {
    return EXHIBITION_CONFIGS_CLASS[type] || EXHIBITION_CONFIGS_CLASS.DEFAULT;
}

/**
 * Builds additionalConfigs object for a field
 * @param {Object} fieldData - Field data from sydleZod
 * @param {Object} existingField - Existing field (to preserve _id)
 * @returns {Object|null} additionalConfigs object
 */
function buildAdditionalConfigs(fieldData, existingField = null) {
    const classId = getAdditionalConfigsClassId(fieldData.type, fieldData.embedded);
    if (!classId) return null;

    const existingConfigs = existingField?.additionalConfigs || {};

    const configs = {
        _class: { _id: classId, _classId: '000000000000000000000000' }
    };

    // Preserve existing _id if same class
    if (existingConfigs._id && existingConfigs._class?._id === classId) {
        configs._id = existingConfigs._id;
        configs._classRevision = existingConfigs._classRevision;
    }

    // Type-specific defaults
    switch (fieldData.type) {
        case 'STRING':
            configs.contentType = fieldData.additionalConfigs?.contentType || 'simpleText';
            break;
        case 'REFERENCE':
            if (!fieldData.embedded) {
                configs.indexedFields = 'REFERENCE_ONLY';
                configs.onDelete = 'BLOCK';
                configs.listingOption = 'ONLY_ACCESSIBLE';
            }
            break;
        case 'DATE':
            configs.noTime = fieldData.additionalConfigs?.noTime || false;
            configs.localGMT = fieldData.additionalConfigs?.localGMT || false;
            break;
    }

    return configs;
}

/**
 * Builds exhibitionConfigs object for a field
 * @param {Object} fieldData - Field data from sydleZod
 * @param {Object} existingField - Existing field (to preserve _id)
 * @returns {Object} exhibitionConfigs object
 */
function buildExhibitionConfigs(fieldData, existingField = null) {
    const classId = getExhibitionConfigsClassId(fieldData.type);
    const existingConfigs = existingField?.exhibitionConfigs || {};

    const configs = {
        _class: { _id: classId, _classId: '000000000000000000000000' },
        size: fieldData.exhibitionConfigs?.size || 'md',
        breakLine: fieldData.exhibitionConfigs?.breakLine !== undefined
            ? fieldData.exhibitionConfigs.breakLine
            : true
    };

    // Preserve existing _id if same class
    if (existingConfigs._id && existingConfigs._class?._id === classId) {
        configs._id = existingConfigs._id;
        configs._classRevision = existingConfigs._classRevision;
    }

    return configs;
}

/**
 * Builds valueOptions array for a field
 * @param {Array} options - Value options from sydleZod
 * @param {Array} existingOptions - Existing options (to preserve _ids)
 * @returns {Array|null} valueOptions array or null
 */
function buildValueOptions(options, existingOptions = []) {
    if (!options || options.length === 0) return null;

    return options.map((opt, index) => {
        const identifier = typeof opt === 'object' ? opt.identifier : opt;
        const value = typeof opt === 'object' ? opt.value : opt;

        // Try to find existing option with same identifier to preserve _id
        const existing = existingOptions.find(e => e.identifier === identifier);

        const option = {
            identifier,
            value,
            _class: { _id: VALUE_OPTION_CLASS, _classId: '000000000000000000000000' }
        };

        if (existing?._id) {
            option._id = existing._id;
            option._classRevision = existing._classRevision;
        }

        return option;
    });
}

// ============ MAIN CONVERSION FUNCTIONS ============

/**
 * Converts a SchemaField to Sydle API format
 * 
 * @param {string} identifier - Field identifier
 * @param {Object} schemaField - SchemaField object from sydleZod (or its toJSON result)
 * @param {Object} existingField - Existing field from class.json (to preserve _ids)
 * @returns {Object} Field in Sydle API format
 * 
 * @example
 * const field = sy.section('Campos').name('Nome').type('STRING').required();
 * const apiField = convertToApiField('nome', field, existingFields.nome);
 */
function convertToApiField(identifier, schemaField, existingField = null) {
    // Handle both SchemaField objects and plain objects
    const fieldData = typeof schemaField.toJSON === 'function'
        ? schemaField.toJSON()
        : schemaField;

    // Base field structure
    const apiField = {
        identifier,
        name: fieldData.name,
        type: fieldData.type || 'STRING',
        section: fieldData.section || null,
        relevancy: fieldData.relevancy || 'COMMON',

        // Boolean flags
        required: fieldData.required || false,
        readOnly: fieldData.readOnly || false,
        hidden: fieldData.hidden || false,
        searchable: fieldData.searchable !== undefined ? fieldData.searchable : true,
        multiple: fieldData.multiple || false,
        unique: fieldData.unique || false,
        i18n: fieldData.i18n || false,
        embedded: fieldData.embedded || false,
        shiftable: fieldData.shiftable || false,
        encrypted: fieldData.encrypted || false,
        displayOnEditMode: fieldData.displayOnEditMode || false,
        calculated: fieldData.calculated || false,

        // Nullable fields
        defaultValue: fieldData.defaultValue || null,
        editHelp: fieldData.editHelp || null,
        minMultiplicity: fieldData.minMultiplicity || null,
        maxMultiplicity: fieldData.maxMultiplicity || null,
        valueExpression: fieldData.valueExpression || null,
        calculationStrategy: fieldData.calculationStrategy || null,
        engine: fieldData.engine || 'GRAAL',
        encryptionAlgorithmType: fieldData.encrypted ? (fieldData.encryptionAlgorithmType || 'REVERSIBLE') : null,

        // Reference specific
        refClass: null,

        // Complex objects
        additionalConfigs: buildAdditionalConfigs(fieldData, existingField),
        exhibitionConfigs: buildExhibitionConfigs(fieldData, existingField),
        valueOptions: buildValueOptions(fieldData.valueOptions, existingField?.valueOptions),

        // System fields (preserved from existing)
        _class: existingField?._class || { _id: '000000000000000000000001', _classId: '000000000000000000000000' }
    };

    // Handle refClass for REFERENCE types
    if (fieldData.type === 'REFERENCE' && fieldData.refClass) {
        if (typeof fieldData.refClass === 'string') {
            // If it's a string (ID), wrap it
            apiField.refClass = { _id: fieldData.refClass, _classId: '000000000000000000000000' };
        } else if (fieldData.refClass.identifier || fieldData.refClass._id) {
            // If it's an object with identifier or _id
            apiField.refClass = {
                _id: fieldData.refClass._id || fieldData.refClass.identifier,
                _classId: '000000000000000000000000'
            };
        }
    }

    // Preserve existing field _id if available
    if (existingField?._id) {
        apiField._id = existingField._id;
        apiField._classRevision = existingField._classRevision;
    }

    return apiField;
}

/**
 * Converts all fields from a fields.js module to Sydle API format
 * 
 * @param {Object} fieldsModule - The exports from fields.js (object with field definitions)
 * @param {Array} existingFields - Existing fields from class.json
 * @returns {Array} Array of fields in Sydle API format
 * 
 * @example
 * const fieldsModule = require('./fields.js');
 * const existingFields = classData.fields;
 * const apiFields = convertFieldsToApi(fieldsModule, existingFields);
 */
function convertFieldsToApi(fieldsModule, existingFields = []) {
    // Create a map of existing fields by identifier for quick lookup
    const existingMap = {};
    for (const field of existingFields) {
        if (field.identifier) {
            existingMap[field.identifier] = field;
        }
    }

    // Convert each field
    const apiFields = [];
    for (const [identifier, schemaField] of Object.entries(fieldsModule)) {
        const existingField = existingMap[identifier] || null;
        const apiField = convertToApiField(identifier, schemaField, existingField);
        apiFields.push(apiField);
    }

    return apiFields;
}

module.exports = {
    convertToApiField,
    convertFieldsToApi,
    // Export helpers for testing/extension
    buildAdditionalConfigs,
    buildExhibitionConfigs,
    buildValueOptions,
    // Export constants for reference
    ADDITIONAL_CONFIGS_CLASS,
    EXHIBITION_CONFIGS_CLASS,
    VALUE_OPTION_CLASS
};
