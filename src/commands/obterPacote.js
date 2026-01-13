const { Command } = require('commander');
const inquirer = require('inquirer');
const { searchPaginated, get } = require('../api/main');
const config = require('../utils/config');
const { ensureAuth } = require('../utils/authFlow');
const fs = require('fs');
const path = require('path');

const obterPacoteCommand = new Command('obterPacote')
    .description('Fetch and generate files for a specific package identifier')
    .argument('<identifier>', 'Package identifier')
    .action(async (identifier) => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            let url = process.env.SYDLE_API_URL;

            // Perform search and create folders
            console.log(`Fetching package ${identifier} and creating folders...`);
            const classId = '000000000000000000000000';
            const classPakageId = '000000000000000000000015';

            // Query filtering by identifier
            const query = {
                query: {
                    term: { "package.identifier.keyword": identifier }
                },
                sort: [{ "_id": "asc" }]
            };

            console.log('Search query:', JSON.stringify(query, null, 2));
            let totalHits = 0;
            const packageInfoMap = new Map();

            // Phase 0: Load existing classes from previously downloaded packages
            const classIdToIdentifier = new Map();
            const allClassesData = [];

            console.log('Phase 0: Loading existing classes from other packages...');
            let env = 'prod';
            if (url.includes('dev')) env = 'dev';
            else if (url.includes('hom')) env = 'hom';
            const rootFolder = `sydle-${env}`;
            const rootPath = path.join(process.cwd(), rootFolder);

            if (fs.existsSync(rootPath)) {
                const loadClassesRecursively = (dir) => {
                    const items = fs.readdirSync(dir);
                    for (const item of items) {
                        const itemPath = path.join(dir, item);
                        const stat = fs.statSync(itemPath);

                        if (stat.isDirectory()) {
                            // Check if this directory has a class.json
                            const classJsonPath = path.join(itemPath, 'class.json');
                            if (fs.existsSync(classJsonPath)) {
                                try {
                                    const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf8'));
                                    classIdToIdentifier.set(classData._id, classData.identifier);
                                } catch (error) {
                                    // Silently skip malformed files
                                }
                            }
                            // Recursively check subdirectories
                            loadClassesRecursively(itemPath);
                        }
                    }
                };

                loadClassesRecursively(rootPath);
                console.log(`Loaded ${classIdToIdentifier.size} existing classes from other packages.`);
            }

            console.log('Phase 1: Collecting all classes from package...');
            await searchPaginated(classId, query, 50, async (hits) => {
                totalHits += hits.length;
                console.log(`Found ${hits.length} results in this batch (total: ${totalHits})`);
                for (const hit of hits) {
                    console.log('Processing hit:', hit._id);
                    if (hit._source && hit._source) {
                        let _class = hit._source;
                        // Fetch full class to ensure we have all details including scripts
                        try {
                            _class = await get(classId, _class._id);
                        } catch (error) {
                            console.error(`Failed to fetch full class ${_class._id}, using search result.`);
                        }

                        // Store in map for reference resolution
                        classIdToIdentifier.set(_class._id, _class.identifier);

                        // Store class data for phase 2
                        allClassesData.push(_class);
                    }
                }
            });

            console.log(`Phase 1 complete. Collected ${allClassesData.length} classes.`);
            console.log('Phase 2: Generating files and type definitions...');

            // Phase 2: Generate folders and .d.ts files
            for (const _class of allClassesData) {
                const _pakage = await get(classPakageId, _class.package._id);
                let nameParts = _pakage.identifier.trim().split('.');

                let env = 'prod';
                if (url.includes('dev')) env = 'dev';
                else if (url.includes('hom')) env = 'hom';

                const rootFolder = `sydle-${env}`;

                const packagePath = path.join(process.cwd(), rootFolder, ...nameParts);
                if (!fs.existsSync(packagePath)) {
                    fs.mkdirSync(packagePath, { recursive: true });
                }
                fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify(_pakage, null, 2));

                const classPath = path.join(packagePath, _class.identifier);
                if (!fs.existsSync(classPath)) {
                    fs.mkdirSync(classPath, { recursive: true });
                }
                fs.writeFileSync(path.join(classPath, 'class.json'), JSON.stringify(_class, null, 2));

                const methods = (_class.methods || []);
                methods.forEach(method => {
                    const methodPath = path.join(classPath, method.identifier);

                    if (!fs.existsSync(methodPath)) {
                        fs.mkdirSync(methodPath, { recursive: true });
                    }

                    if (method.scripts && method.scripts.length > 0) {
                        const scriptsFolderPath = path.join(methodPath, 'scripts');
                        if (!fs.existsSync(scriptsFolderPath)) {
                            fs.mkdirSync(scriptsFolderPath, { recursive: true });
                        }

                        method.scripts.forEach((scriptContent, index) => {
                            if (scriptContent) {
                                const scriptName = `script_${index + 1}.js`;
                                const scriptPath = path.join(scriptsFolderPath, scriptName);
                                fs.writeFileSync(scriptPath, scriptContent);
                            }
                        });
                    }

                    const jsonFilePath = path.join(methodPath, 'method.json');
                    fs.writeFileSync(jsonFilePath, JSON.stringify(method, null, 2));
                });

                // Field mapping helpers
                const mapToTsType = (field) => {
                    let type = 'any';
                    const baseType = field.type;

                    // For REFERENCE fields, use the referenced class interface
                    if (baseType === 'REFERENCE' && field.refClass && field.refClass._id) {
                        const refClassName = classIdToIdentifier.get(field.refClass._id);
                        if (refClassName) {
                            type = `I_Data_${refClassName}`;
                        } else {
                            console.warn(`Warning: Referenced class ${field.refClass._id} not found for field ${_class.identifier}.${field.identifier}`);
                            type = 'string';
                        }
                    }
                    else if (['STRING', 'ID', 'DATE', 'FILE'].includes(baseType)) type = 'string';
                    else if (baseType === 'BOOLEAN') type = 'boolean';
                    else if (['INTEGER', 'DECIMAL'].includes(baseType)) type = 'number';

                    return field.multiple ? `${type}[]` : type;
                };

                const mapToZodSchema = (field) => {
                    let schema = 'z.any()';
                    const baseType = field.type;
                    if (['STRING', 'ID', 'REFERENCE', 'DATE'].includes(baseType)) {
                        schema = 'z.string()';
                        if (field.additionalConfigs && field.additionalConfigs.maxLength) {
                            schema += `.max(${field.additionalConfigs.maxLength})`;
                        }
                    } else if (baseType === 'BOOLEAN') {
                        schema = 'z.boolean()';
                    } else if (['INTEGER', 'DECIMAL'].includes(baseType)) {
                        schema = 'z.number()';
                    } else if (baseType === 'FILE') {
                        schema = 'z.any()';
                    }

                    if (field.multiple) schema = `z.array(${schema})`;
                    if (!field.required) schema += '.optional().nullable()';
                    return schema;
                };

                const fields = (_class.fields || []).filter(f => !f.identifier.startsWith('_'));
                const dataInterfaceName = `I_Data_${_class.identifier}`;
                const patchInterfaceName = `I_Patch_${_class.identifier}`;
                const searchFieldsName = `I_SearchFields_${_class.identifier}`;
                const searchQueryName = `I_Search_${_class.identifier}`;

                const fieldPathsUnion = fields.map(f => `"${f.identifier}" | "${f.identifier}/" | \`${f.identifier}/\${number}\``).join(' | ') || 'string';
                const searchFieldsUnion = fields.map(f => `"${f.identifier}" | "${f.identifier}.keyword"`).join(' | ') || 'string';
                const nestedPathsUnion = fields.filter(f => f.multiple).map(f => `"${f.identifier}"`).join(' | ') || 'never';

                // Detect embedded classes AND multiple reference fields for nested queries
                const nestedFields = fields.filter(f => {
                    // Embedded classes
                    if (f.multiple && f.embeddedClass && f.embeddedClass._id) return true;
                    // Multiple REFERENCE fields need nested queries too
                    if (f.multiple && f.type === 'REFERENCE' && f.refClass && f.refClass._id) return true;
                    return false;
                });
                const embeddedClassTypes = [];

                for (const embField of nestedFields) {
                    try {
                        // Load class definition (embedded or referenced)
                        const targetClassId = embField.embeddedClass?._id || embField.refClass?._id;
                        const targetClass = await get(classId, targetClassId);

                        if (targetClass && targetClass.fields) {
                            const embFields = targetClass.fields.filter(ef => !ef.identifier.startsWith('_'));
                            // Create field union WITHOUT prefix (for base types)
                            const embSearchFieldsUnion = embFields.map(ef => `"${ef.identifier}" | "${ef.identifier}.keyword"`).join(' | ') || 'string';
                            // Create field union WITH prefix (for nested queries)
                            const embSearchFieldsUnionPrefixed = embFields.map(ef => `"${embField.identifier}.${ef.identifier}" | "${embField.identifier}.${ef.identifier}.keyword"`).join(' | ') || 'string';
                            const embSearchFieldsName = `I_SearchFields_${targetClass.identifier}`;
                            const embSearchFieldsNamePrefixed = `I_SearchFields_${targetClass.identifier}_Prefixed_${embField.identifier}`;
                            const embSearchQueryName = `I_Search_${targetClass.identifier}_Body`;
                            const embSearchQueryNamePrefixed = `I_Search_${targetClass.identifier}_Body_Prefixed_${embField.identifier}`;

                            embeddedClassTypes.push({
                                fieldIdentifier: embField.identifier,
                                className: targetClass.identifier,
                                searchFieldsName: embSearchFieldsName,
                                searchFieldsNamePrefixed: embSearchFieldsNamePrefixed,
                                searchQueryName: embSearchQueryName,
                                searchQueryNamePrefixed: embSearchQueryNamePrefixed,
                                searchFieldsUnion: embSearchFieldsUnion,
                                searchFieldsUnionPrefixed: embSearchFieldsUnionPrefixed
                            });
                        }
                    } catch (error) {
                        console.error(`Failed to load embedded class for field ${embField.identifier}:`, error.message);
                    }
                }

                // Generate class.d.ts inside the class folder
                let classDtsContent = `/**\n * Auto-generated types for class ${_class.identifier}\n */\n\n`;

                // Data Interface
                classDtsContent += `declare interface ${dataInterfaceName} {\n`;
                fields.forEach(f => {
                    classDtsContent += `    ${f.identifier}${f.required ? '' : '?'}: ${mapToTsType(f)};\n`;
                });
                classDtsContent += `}\n\n`;

                // Patch Interface
                classDtsContent += `declare interface ${patchInterfaceName} {\n`;
                classDtsContent += `    _id: string;\n`;
                classDtsContent += `    _operationsList: Array<{\n`;
                classDtsContent += `        op: "add" | "replace" | "move" | "remove";\n`;
                classDtsContent += `        path: ${fieldPathsUnion};\n`;
                classDtsContent += `        value?: any;\n`;
                classDtsContent += `        from?: string;\n`;
                classDtsContent += `    }>;\n`;
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
                    classDtsContent += `type NestedQuery_${_class.identifier} =\n`;
                    embeddedClassTypes.forEach((emb, index) => {
                        classDtsContent += `    | { path: \"${emb.fieldIdentifier}\"; query: ${emb.searchQueryNamePrefixed}; score_mode?: \"avg\" | \"sum\" | \"min\" | \"max\" | \"none\"; ignore_unmapped?: boolean }\n`;
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

                // Use conditional nested type if available, otherwise use generic
                if (embeddedClassTypes.length > 0) {
                    classDtsContent += `    nested?: NestedQuery_${_class.identifier};\n`;
                } else {
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
                classDtsContent += `declare interface I_${_class.identifier} {\n`;
                classDtsContent += `    _create(data: ${dataInterfaceName}): any;\n`;
                classDtsContent += `    _createDraft(data: ${dataInterfaceName}): any;\n`;
                classDtsContent += `    _update(data: Partial<${dataInterfaceName}> & { _id: string }): any;\n`;
                classDtsContent += `    _patch(data: ${patchInterfaceName}): any;\n`;
                classDtsContent += `    _save(data: ${dataInterfaceName}): any;\n`;
                classDtsContent += `    _search(query: ${searchQueryName}): I_ElasticSearchResult<${dataInterfaceName}>;\n`;
                methods.forEach(m => {
                    if (!['_create', '_createDraft', '_update', '_patch', '_save', '_search'].includes(m.identifier)) {
                        classDtsContent += `    ${m.identifier}(data?: any): any;\n`;
                    }
                });
                classDtsContent += `}\ndeclare var ${_class.identifier}: I_${_class.identifier};\n`;
                fs.writeFileSync(path.join(classPath, 'class.d.ts'), classDtsContent);

                // Generate class.schema.js
                let zodContent = `const { z } = require('zod');\n\n`;
                zodContent += `/**\n * Zod validation schema for class ${_class.identifier}\n */\n`;
                zodContent += `const Schema_${_class.identifier} = z.object({\n`;
                fields.forEach(f => {
                    zodContent += `    ${f.identifier}: ${mapToZodSchema(f)},\n`;
                });
                zodContent += `});\n\n`;
                zodContent += `module.exports = { Schema_${_class.identifier} };\n`;
                fs.writeFileSync(path.join(classPath, 'class.schema.js'), zodContent);

                // Collect info for package.d.ts
                if (!packageInfoMap.has(packagePath)) {
                    packageInfoMap.set(packagePath, {
                        identifier: _pakage.identifier,
                        classes: []
                    });
                }
                packageInfoMap.get(packagePath).classes.push({
                    identifier: _class.identifier
                });
            }

            // Generate package.d.ts for each package folder
            packageInfoMap.forEach((info, pkgPath) => {
                let pkgDtsContent = `/**\n * Auto-generated types for package ${info.identifier}\n */\n\n`;
                const safePkgId = info.identifier.replace(/[^a-zA-Z0-9]/g, '_');
                pkgDtsContent += `declare interface I_Package_${safePkgId} {\n` +
                    info.classes.map(cls => `    ${cls.identifier}: I_${cls.identifier};`).join('\n') +
                    `\n}\ndeclare var ${info.identifier}: I_Package_${safePkgId};\n`;

                fs.writeFileSync(path.join(pkgPath, 'package.d.ts'), pkgDtsContent);
                console.log(`Generated package.d.ts in ${pkgPath}`);
            });

            console.log(`Search completed. Total hits processed: ${totalHits}`);
            console.log('Operation complete.');

        } catch (error) {
            console.error('Operation failed:', error.message);
        }
    });

module.exports = obterPacoteCommand;
