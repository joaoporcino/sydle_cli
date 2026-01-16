const { get } = require('../api/main');

// Helper: Map field to TypeScript type
function mapToTsType(field, classIdToIdentifier) {
    let type = 'any';
    const baseType = field.type;

    // For REFERENCE fields, use the referenced class interface
    if (baseType === 'REFERENCE' && field.refClass && field.refClass._id) {
        const refClassName = classIdToIdentifier.get(field.refClass._id);
        if (refClassName) {
            type = `I_Data_${refClassName}`;
        } else {
            console.warn(`Warning: Referenced class ${field.refClass._id} not found for field ${field.identifier}`);
            type = 'string';
        }
    }
    else if (['STRING', 'ID', 'DATE', 'FILE'].includes(baseType)) type = 'string';
    else if (baseType === 'BOOLEAN') type = 'boolean';
    else if (['INTEGER', 'DECIMAL'].includes(baseType)) type = 'number';

    return field.multiple ? `${type}[]` : type;
}

/**
 * Generate class.d.ts with all TypeScript interfaces
 * @param {Object} classData - Class object from Sydle API
 * @param {string} outputPath - Path to write class.d.ts
 * @param {Object} options - Additional options
 * @param {Map} options.classIdToIdentifier - Map of class IDs to identifiers
 * @param {string} options.classId - Class ID for API calls
 */
async function generateClassDts(classData, outputPath, options) {
    const { classIdToIdentifier, classId } = options;
    const fs = require('fs');
    const path = require('path');

    const fields = (classData.fields || []).filter(f => !f.identifier.startsWith('_'));
    const methods = classData.methods || [];

    // Interface names
    const dataInterfaceName = `I_Data_${classData.identifier}`;
    const searchQueryName = `I_Search_${classData.identifier}`;
    const searchFieldsName = `I_SearchFields_${classData.identifier}`;

    // Generate field paths for patch operations
    const fieldPaths = fields.map(f => `"${f.identifier}"`).concat(
        fields.map(f => `"${f.identifier}/"`),
        fields.map(f => `\`${f.identifier}/\${number}\``)
    );
    const fieldPathsUnion = fieldPaths.join(' | ') || 'string';

    // Generate search fields union
    const searchFieldsUnion = fields
        .map(f => `"${f.identifier}" | "${f.identifier}.keyword"`)
        .join(' | ') || 'string';

    // Find nested fields for advanced search
    // Only multiple (array) fields with embedded or reference classes need nested queries
    const nestedFields = fields.filter(f => {
        // Embedded classes
        if (f.multiple && f.embeddedClass && f.embeddedClass._id) return true;
        // Multiple REFERENCE fields need nested queries too
        if (f.multiple && f.type === 'REFERENCE' && f.refClass && f.refClass._id) return true;
        return false;
    });

    // Process embedded classes for nested queries
    const embeddedClassTypes = [];
    for (const embField of nestedFields) {
        try {
            const targetClassId = embField.embeddedClass?._id || embField.refClass?._id;
            const targetClass = await get(classId, targetClassId);

            if (targetClass && targetClass.fields) {
                const embFields = targetClass.fields.filter(ef => !ef.identifier.startsWith('_'));
                const embSearchFieldsUnionPrefixed = embFields.map(ef => `"${embField.identifier}.${ef.identifier}" | "${embField.identifier}.${ef.identifier}.keyword"`).join(' | ') || 'string';
                const embSearchFieldsNamePrefixed = `I_SearchFields_${targetClass.identifier}_Prefixed_${embField.identifier}`;
                const embSearchQueryNamePrefixed = `I_Search_${targetClass.identifier}_Body_Prefixed_${embField.identifier}`;

                embeddedClassTypes.push({
                    fieldIdentifier: embField.identifier,
                    searchFieldsNamePrefixed: embSearchFieldsNamePrefixed,
                    searchQueryNamePrefixed: embSearchQueryNamePrefixed,
                    searchFieldsUnionPrefixed: embSearchFieldsUnionPrefixed
                });
            }
        } catch (error) {
            console.error(`Failed to load embedded class for field ${embField.identifier}:`, error.message);
        }
    }

    // Start building class.d.ts content
    let classDtsContent = `/**\n * Auto-generated types for class ${classData.identifier}\n */\n\n`;

    // Generate input/output interfaces for custom methods
    methods.forEach(m => {
        // Input interface
        if (m.inputParameters && m.inputParameters.fields && m.inputParameters.fields.length > 0) {
            const inputFields = m.inputParameters.fields.filter(f => !f.identifier.startsWith('_'));
            if (inputFields.length > 0) {
                const inputInterfaceName = `I_Input_${m.identifier}`;
                classDtsContent += `declare interface ${inputInterfaceName} {\n`;
                inputFields.forEach(f => {
                    classDtsContent += `    ${f.identifier}${f.required ? '' : '?'}: ${mapToTsType(f, classIdToIdentifier)};\n`;
                });
                classDtsContent += `}\n\n`;
            }
        }

        // Output interface
        if (m.outputParameters && m.outputParameters.fields && m.outputParameters.fields.length > 0) {
            const outputFields = m.outputParameters.fields.filter(f => !f.identifier.startsWith('_'));
            if (outputFields.length > 0) {
                const outputInterfaceName = `I_Output_${m.identifier}`;
                classDtsContent += `declare interface ${outputInterfaceName} {\n`;
                outputFields.forEach(f => {
                    classDtsContent += `    ${f.identifier}${f.required ? '' : '?'}: ${mapToTsType(f, classIdToIdentifier)};\n`;
                });
                classDtsContent += `}\n\n`;
            }
        }
    });

    // Data Interface
    classDtsContent += `declare interface ${dataInterfaceName} {\n`;
    fields.forEach(f => {
        classDtsContent += `    ${f.identifier}${f.required ? '' : '?'}: ${mapToTsType(f, classIdToIdentifier)};\n`;
    });
    classDtsContent += `}\n\n`;

    // Generate embedded class search types
    embeddedClassTypes.forEach(emb => {
        // Prefixed version for nested queries
        classDtsContent += `type ${emb.searchFieldsNamePrefixed} = ${emb.searchFieldsUnionPrefixed};\n\n`;
        classDtsContent += `declare interface ${emb.searchQueryNamePrefixed} {\n`;
        classDtsContent += `    bool?: {\n`;
        classDtsContent += `        must?: ${emb.searchQueryNamePrefixed} | ${emb.searchQueryNamePrefixed}[];\n`;
        classDtsContent += `        should?: ${emb.searchQueryNamePrefixed} | ${emb.searchQueryNamePrefixed}[];\n`;
        classDtsContent += `        must_not?: ${emb.searchQueryNamePrefixed} | ${emb.searchQueryNamePrefixed}[];\n`;
        classDtsContent += `        filter?: ${emb.searchQueryNamePrefixed} | ${emb.searchQueryNamePrefixed}[];\n`;
        classDtsContent += `    };\n`;
        classDtsContent += `    term?: { [P in ${emb.searchFieldsNamePrefixed}]?: any };\n`;
        classDtsContent += `    terms?: { [P in ${emb.searchFieldsNamePrefixed}]?: any[] };\n`;
        classDtsContent += `    match?: { [P in ${emb.searchFieldsNamePrefixed}]?: any };\n`;
        classDtsContent += `    range?: { [P in ${emb.searchFieldsNamePrefixed}]?: { gte?: any; lte?: any; gt?: any; lt?: any } };\n`;
        classDtsContent += `    exists?: { field: ${emb.searchFieldsNamePrefixed} };\n`;
        classDtsContent += `}\n\n`;
    });

    // Search Types
    classDtsContent += `type ${searchFieldsName} = ${searchFieldsUnion};\n\n`;

    // Generate conditional nested type if there are embedded classes
    if (embeddedClassTypes.length > 0) {
        classDtsContent += `type NestedQuery_${classData.identifier} =\n`;
        embeddedClassTypes.forEach((emb, index) => {
            classDtsContent += `    | { path: "${emb.fieldIdentifier}"; query: ${emb.searchQueryNamePrefixed}; score_mode?: "avg" | "sum" | "min" | "max" | "none"; ignore_unmapped?: boolean }\n`;
        });
        classDtsContent += `;\n\n`;
    }

    classDtsContent += `declare interface ${searchQueryName}_Body {\n`;
    classDtsContent += `    bool?: {\n`;
    classDtsContent += `        must?: ${searchQueryName}_Body | ${searchQueryName}_Body[];\n`;
    classDtsContent += `        should?: ${searchQueryName}_Body | ${searchQueryName}_Body[];\n`;
    classDtsContent += `        must_not?: ${searchQueryName}_Body | ${searchQueryName}_Body[];\n`;
    classDtsContent += `        filter?: ${searchQueryName}_Body | ${searchQueryName}_Body[];\n`;
    classDtsContent += `    };\n`;
    classDtsContent += `    term?: { [P in ${searchFieldsName}]?: any };\n`;
    classDtsContent += `    terms?: { [P in ${searchFieldsName}]?: any[] };\n`;
    classDtsContent += `    match?: { [P in ${searchFieldsName}]?: any };\n`;
    classDtsContent += `    range?: { [P in ${searchFieldsName}]?: { gte?: any; lte?: any; gt?: any; lt?: any } };\n`;
    classDtsContent += `    exists?: { field: ${searchFieldsName} };\n`;

    // Use conditional nested type if available
    if (embeddedClassTypes.length > 0) {
        classDtsContent += `    nested?: NestedQuery_${classData.identifier};\n`;
    } else {
        const nestedPaths = nestedFields.map(f => `"${f.identifier}"`);
        const nestedPathsUnion = nestedPaths.length > 0 ? nestedPaths.join(' | ') : 'never';
        classDtsContent += `    nested?: { path: ${nestedPathsUnion}; query: ${searchQueryName}_Body };\n`;
    }
    classDtsContent += `}\n\n`;
    classDtsContent += `declare interface ${searchQueryName} {\n`;
    classDtsContent += `    query?: ${searchQueryName}_Body;\n`;
    classDtsContent += `    sort?: Array<{ [P in ${searchFieldsName}]?: "asc" | "desc" } | ${searchFieldsName}>;\n`;
    classDtsContent += `    from?: number;\n`;
    classDtsContent += `    size?: number;\n`;
    classDtsContent += `    _source?: boolean | ${searchFieldsName}[];\n`;
    classDtsContent += `}\n\n`;

    // Class Interface
    classDtsContent += `declare interface I_${classData.identifier} {\n`;
    classDtsContent += `    _get(params: I_GetParams): ${dataInterfaceName};\n`;
    classDtsContent += `    _create(data: ${dataInterfaceName}): ${dataInterfaceName};\n`;
    classDtsContent += `    _createDraft(data: ${dataInterfaceName}): any;\n`;
    classDtsContent += `    _update(data: Partial<${dataInterfaceName}> & { _id: string }): ${dataInterfaceName};\n`;
    classDtsContent += `    _patch(data: I_PatchOperation<${fieldPathsUnion}>): any;\n`;
    classDtsContent += `    _save(data: ${dataInterfaceName}): any;\n`;
    classDtsContent += `    _search(query: ${searchQueryName}): I_ElasticSearchResult<${dataInterfaceName}>;\n`;

    // Add custom methods
    methods.forEach(m => {
        let methodSignature = `    ${m.identifier}(data?: any): any;\n`;

        // Generate specific input/output types if they exist
        if (m.inputParameters && m.inputParameters.fields && m.inputParameters.fields.length > 0) {
            const inputInterfaceName = `I_Input_${m.identifier}`;
            const inputFields = m.inputParameters.fields.filter(f => !f.identifier.startsWith('_'));
            if (inputFields.length > 0) {
                methodSignature = `    ${m.identifier}(data: ${inputInterfaceName}): `;
            } else {
                methodSignature = `    ${m.identifier}(data?: any): `;
            }
        } else if (!['_create', '_createDraft', '_update', '_patch', '_save', '_search'].includes(m.identifier)) {
            methodSignature = `    ${m.identifier}(data?: any): `;
        } else {
            // For standard methods, we keep existing signatures, handled above
            return;
        }

        if (m.outputParameters && m.outputParameters.fields && m.outputParameters.fields.length > 0) {
            const outputInterfaceName = `I_Output_${m.identifier}`;
            const outputFields = m.outputParameters.fields.filter(f => !f.identifier.startsWith('_'));
            if (outputFields.length > 0) {
                methodSignature += `${outputInterfaceName};\n`;
            } else {
                methodSignature += `any;\n`;
            }
        } else {
            methodSignature += `any;\n`;
        }

        classDtsContent += methodSignature;
    });

    classDtsContent += `}\n`;
    classDtsContent += `declare var ${classData.identifier}: I_${classData.identifier};\n\n`;

    // Script global
    classDtsContent += `// Script global - available in all method scripts\n`;
    classDtsContent += `declare var _object: ${dataInterfaceName};\n`;

    // Write to file
    fs.writeFileSync(path.join(outputPath, 'class.d.ts'), classDtsContent);
}

module.exports = { generateClassDts };
