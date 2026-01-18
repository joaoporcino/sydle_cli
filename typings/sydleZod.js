/**
 * Sydle Schema Builder (sy)
 * 
 * Fluent API for defining Sydle Fields.
 * Entry point: sy.section() - starts with section definition.
 * Default type: STRING. Use .type() to change.
 * 
 * Follows Sydle naming convention exactly.
 * 
 * Usage:
 *   sy.section('Seção').name('Campo')
 *   sy.section('Dados').name('Idade').type('INTEGER')
 */

/**
 * @typedef {'STRING' | 'DOUBLE' | 'INTEGER' | 'LONG' | 'BOOLEAN' | 'DATE' | 'REFERENCE' | 'FILE' | 'ID' | 'DYNAMIC' | 'GEOPOINT'} SydleType
 */

/**
 * Schema builder class
 */
class SchemaField {
    /**
     * @param {string} section 
     */
    constructor(section) {
        this.fieldData = {
            section: section,
            name: null,
            identifier: null,
            relevancy: null,
            searchable: false,
            type: null, // REQUIRED - use .type()
            embedded: false,
            refClass: null,
            multiple: false,
            minMultiplicity: null,
            maxMultiplicity: null,
            shiftable: false,
            required: false,
            readOnly: false,
            hidden: false,
            defaultValue: null,
            valueOptions: null,
            unique: false,
            i18n: false,
            editHelp: null,
            encrypted: false,
            displayOnEditMode: false,
            encryptionAlgorithmType: null,
            calculated: false,
            engine: null,
            valueExpression: null,
            calculationStrategy: null,
            additionalConfigs: {},
            exhibitionConfigs: {}
        };
    }

    // ============ REQUIRED ============

    /** @param {string} val @returns {SchemaField} */
    name(val) { this.fieldData.name = val; return this; }

    // ============ TYPE ============

    /** @param {SydleType} val @returns {SchemaField} */
    type(val) { this.fieldData.type = val; return this; }

    // ============ ALL FIELDS (Sydle naming) ============

    /** @param {string} val @returns {SchemaField} */
    identifier(val) { this.fieldData.identifier = val; return this; }

    /** @param {'IDENTITY'|'FEATURED'|'COMMON'|'ADVANCED'|'SYSTEM'} val @returns {SchemaField} */
    relevancy(val) { this.fieldData.relevancy = val; return this; }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    searchable(val = true) { this.fieldData.searchable = val; return this; }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    embedded(val = true) { this.fieldData.embedded = val; return this; }

    /** @param {string} classIdentifier - Nome da classe (ex: 'recursosHumanos.Funcionario') @returns {SchemaField} */
    refClass(classIdentifier) {
        this.fieldData.refClass = { identifier: classIdentifier };
        return this;
    }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    multiple(val = true) {
        this.fieldData.multiple = val;
        if (!val) {
            this.fieldData.minMultiplicity = null;
            this.fieldData.maxMultiplicity = null;
            this.fieldData.shiftable = false;
        }
        return this;
    }

    /** @param {number} val @returns {SchemaField} */
    minMultiplicity(val) {
        this.fieldData.minMultiplicity = val;
        if (val > 0) this.fieldData.required = true;
        return this;
    }

    /** @param {number} val @returns {SchemaField} */
    maxMultiplicity(val) { this.fieldData.maxMultiplicity = val; return this; }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    shiftable(val = true) { this.fieldData.shiftable = val; return this; }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    required(val = true) { this.fieldData.required = val; return this; }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    readOnly(val = true) { this.fieldData.readOnly = val; return this; }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    hidden(val = true) { this.fieldData.hidden = val; return this; }

    /** @param {any} val @returns {SchemaField} */
    defaultValue(val) { this.fieldData.defaultValue = val; return this; }

    /** @param {Array<string|{value:any,identifier:string}>} vals @returns {SchemaField} */
    valueOptions(vals) {
        if (!vals) {
            this.fieldData.valueOptions = null;
            return this;
        }
        this.fieldData.valueOptions = vals.map(v =>
            typeof v === 'object' ? v : { value: v, identifier: v }
        );
        return this;
    }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    unique(val = true) {
        this.fieldData.unique = val;
        if (val) {
            this.fieldData.defaultValue = null;
            this.fieldData.valueOptions = null;
            this.fieldData.i18n = false;
            this.fieldData.encrypted = false;
        }
        return this;
    }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    i18n(val = true) {
        this.fieldData.i18n = val;
        if (val) {
            this.fieldData.encrypted = false;
            this.fieldData.unique = false;
        }
        return this;
    }

    /** @param {string} val @returns {SchemaField} */
    editHelp(val) { this.fieldData.editHelp = val; return this; }

    /** @param {boolean} [val=true] @param {'REVERSIBLE'|'IRREVERSIBLE'} [algorithm='REVERSIBLE'] @returns {SchemaField} */
    encrypted(val = true, algorithm = 'REVERSIBLE') {
        this.fieldData.encrypted = val;
        if (val) {
            this.fieldData.encryptionAlgorithmType = algorithm;
            this.fieldData.displayOnEditMode = true;
            this.fieldData.unique = false;
            this.fieldData.i18n = false;
            this.fieldData.valueOptions = null;
        } else {
            this.fieldData.encryptionAlgorithmType = null;
            this.fieldData.displayOnEditMode = false;
        }
        return this;
    }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    displayOnEditMode(val = true) { this.fieldData.displayOnEditMode = val; return this; }

    /** @param {string} script @param {'GRAAL'|'RHINO'|'DEFAULT'} [engine='GRAAL'] @returns {SchemaField} */
    calculated(script, engine = 'GRAAL') {
        this.fieldData.calculated = true;
        this.fieldData.valueExpression = script;
        this.fieldData.engine = engine;
        this.fieldData.calculationStrategy = 'ON_WRITE';
        this.fieldData.readOnly = true;
        return this;
    }

    /** @param {'ON_READ'|'ON_WRITE'|'ON_INDEX'} val @returns {SchemaField} */
    calculationStrategy(val) { this.fieldData.calculationStrategy = val; return this; }

    /** @param {Object} cfg @returns {SchemaField} */
    additionalConfigs(cfg) {
        this.fieldData.additionalConfigs = { ...this.fieldData.additionalConfigs, ...cfg };
        return this;
    }

    /** @param {'simpleText'|'longText'|'html'|'markdown'} type @returns {SchemaField} */
    contentType(type) { return this.additionalConfigs({ contentType: type }); }

    /** @param {string} fmt @returns {SchemaField} */
    format(fmt) { return this.additionalConfigs({ format: fmt }); }

    /** @param {number} num @returns {SchemaField} */
    decimalPlaces(num) { return this.additionalConfigs({ decimalPlaces: num }); }

    /** @param {Object} cfg @returns {SchemaField} */
    exhibitionConfigs(cfg) {
        this.fieldData.exhibitionConfigs = { ...this.fieldData.exhibitionConfigs, ...cfg };
        return this;
    }

    /** @param {'sm'|'md'|'lg'} val @returns {SchemaField} */
    size(val) { return this.exhibitionConfigs({ size: val }); }

    /** @param {boolean} [val=true] @returns {SchemaField} */
    breakLine(val = true) { return this.exhibitionConfigs({ breakLine: val }); }

    toJSON() {
        return JSON.parse(JSON.stringify(this.fieldData));
    }
}

/**
 * Sydle Schema Builder
 */
const sy = {
    /**
     * Entry point - creates field starting with section
     * @param {string} sectionName 
     * @returns {SchemaField}
     */
    section: (sectionName) => new SchemaField(sectionName),

    /**
     * Helper to define schema
     * @param {Object<string, SchemaField>} schema 
     * @returns {Object}
     */
    object: (schema) => schema
};

module.exports = { sy };
