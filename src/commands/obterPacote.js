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
                    term: { "identifier": identifier }
                },
                sort: [{ "_id": "asc" }]
            };

            await searchPaginated(classId, query, 50, async (hits) => {
                for (const hit of hits) {
                    if (hit._source && hit._source) {
                        let _class = hit._source;
                        // Fetch full class to ensure we have all details including scripts
                        try {
                            _class = await get(classId, _class._id);
                        } catch (error) {
                            console.error(`Failed to fetch full class ${_class._id}, using search result.`);
                        }

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

                        (_class.methods || []).forEach(method => {
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
                                        fs.writeFileSync(path.join(scriptsFolderPath, scriptName), scriptContent);
                                    }
                                });
                            }

                            const jsonFilePath = path.join(methodPath, 'method.json');
                            fs.writeFileSync(jsonFilePath, JSON.stringify(method, null, 2));
                        });

                    }
                }
            });

            console.log('Operation complete.');

        } catch (error) {
            console.error('Operation failed:', error.message);
        }
    });

module.exports = obterPacoteCommand;
