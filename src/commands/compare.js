const { Command } = require('commander');
const { createClient } = require('../api/client');
const fs = require('fs');
const path = require('path');
const config = require('../utils/config');
const inquirer = require('inquirer');
const { performLogin } = require('../utils/authFlow');

const compareCommand = new Command('compare')
    .description('Compare method code between two environments (dev, hom, prod)')
    .argument('[classIdentifier]', 'Class identifier')
    .argument('[methodIdentifier]', 'Method identifier')
    .argument('[sourceEnv]', 'Source environment (dev, hom, prod)')
    .argument('[targetEnv]', 'Target environment (dev, hom, prod)')
    .action(async (classIdentifierArg, methodIdentifierArg, sourceEnvArg, targetEnvArg) => {
        try {
            // Interactive flow for missing arguments
            let answers = {
                classIdentifier: classIdentifierArg,
                methodIdentifier: methodIdentifierArg,
                sourceEnv: sourceEnvArg,
                targetEnv: targetEnvArg
            };

            const questions = [];
            if (!answers.classIdentifier) {
                questions.push({ type: 'input', name: 'classIdentifier', message: 'Class identifier:' });
            }
            if (!answers.methodIdentifier) {
                questions.push({ type: 'input', name: 'methodIdentifier', message: 'Method identifier:' });
            }
            if (!answers.sourceEnv) {
                questions.push({ type: 'list', name: 'sourceEnv', message: 'Source environment:', choices: ['dev', 'hom', 'prod'], default: 'dev' });
            }
            if (!answers.targetEnv) {
                questions.push({ type: 'list', name: 'targetEnv', message: 'Target environment:', choices: ['dev', 'hom', 'prod'], default: 'hom' });
            }

            if (questions.length > 0) {
                const promptAnswers = await inquirer.prompt(questions);
                answers = { ...answers, ...promptAnswers };
            }

            const { classIdentifier, methodIdentifier, sourceEnv, targetEnv } = answers;

            // Dynamic config access
            const getEnvTokens = () => config.get('envTokens') || {};
            const getCurrentUrl = () => config.get('baseUrl') || process.env.SYDLE_API_URL;
            const getDefaultToken = () => config.get('token');

            // Helper to figure out the URL for a given environment alias
            const resolveUrl = (envAlias) => {
                // 0. Check for explicit environment variables in .env
                const envVarName = `SYDLE_URL_${envAlias.toUpperCase()}`;
                if (process.env[envVarName]) return process.env[envVarName];

                const envTokens = getEnvTokens();
                // 1. Check if we have a stored token for a URL matching the alias
                const storedUrl = Object.keys(envTokens).find(url => url.includes(`-${envAlias}`) || url.includes(`/${envAlias}`));
                if (storedUrl) return storedUrl;

                const currentUrl = getCurrentUrl();
                // 2. Heuristic based on current URL
                if (currentUrl) {
                    let base = currentUrl;
                    let currentEnv = 'prod';
                    if (base.includes('-dev')) currentEnv = 'dev';
                    else if (base.includes('-hom')) currentEnv = 'hom';

                    if (envAlias === currentEnv) return base;

                    if (currentEnv !== 'prod' && envAlias !== 'prod') {
                        return base.replace(`-${currentEnv}`, `-${envAlias}`);
                    }

                    if (base.includes('dev')) return base.replace('dev', envAlias === 'prod' ? '' : envAlias).replace('-.', '.').replace('..', '.');
                    if (base.includes('hom')) return base.replace('hom', envAlias === 'prod' ? '' : envAlias).replace('-.', '.').replace('..', '.');

                    return base;
                }

                // 3. Fallback
                return envAlias;
            };

            const getTokenForUrl = (url) => {
                const envTokens = getEnvTokens();
                if (envTokens[url]) return envTokens[url];
                const currentUrl = getCurrentUrl();
                const defaultToken = getDefaultToken();
                if (currentUrl && url === currentUrl) return defaultToken;
                return defaultToken;
            };

            // Ensure access to environments
            const ensureAccess = async (envAlias) => {
                let url = resolveUrl(envAlias);
                const isUrl = (u) => u && (u.startsWith('http://') || u.startsWith('https://'));
                let token = isUrl(url) ? getTokenForUrl(url) : null;

                if (!isUrl(url) || !token) {
                    console.log(`\n! Access missing for environment: ${envAlias} (URL: ${url})`);
                    const { shouldLogin } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'shouldLogin',
                        message: `Would you like to login to ${envAlias} now?`,
                        default: true
                    }]);

                    if (shouldLogin) {
                        const loginAnswers = await inquirer.prompt([
                            {
                                type: 'input',
                                name: 'url',
                                message: `API URL for ${envAlias}:`,
                                default: isUrl(url) ? url : undefined,
                                validate: input => (input.startsWith('http') ? true : 'Must be a valid URL starting with http')
                            },
                            { type: 'input', name: 'username', message: 'Username:' },
                            { type: 'password', name: 'password', message: 'Password:' }
                        ]);

                        // Perform login (updates config and .env)
                        await performLogin(loginAnswers.username, loginAnswers.password, loginAnswers.url);
                    }
                }
            };

            await ensureAccess(sourceEnv);
            await ensureAccess(targetEnv);

            const sourceUrl = resolveUrl(sourceEnv);
            const targetUrl = resolveUrl(targetEnv);

            console.log(`Source URL (${sourceEnv}): ${sourceUrl}`);
            console.log(`Target URL (${targetEnv}): ${targetUrl}`);

            const sourceToken = getTokenForUrl(sourceUrl);
            const targetToken = getTokenForUrl(targetUrl);

            if (!sourceToken) console.warn(`Warning: No token found for source URL ${sourceUrl}`);
            if (!targetToken) console.warn(`Warning: No token found for target URL ${targetUrl}`);

            // Fetch method data (all scripts + package identifier)
            const fetchMethodData = async (baseUrl, envName, token) => {
                try {
                    if (!token) throw new Error('No authentication token available.');

                    // Create isolated client for this environment
                    const client = createClient(baseUrl, token);

                    // Search for class
                    // Note: createClient sets baseURL, so we use relative paths or just the path part
                    const searchUrl = `/main/_classId/000000000000000000000000/_search`;
                    const searchResponse = await client.post(searchUrl, {
                        query: { term: { "identifier.keyword": classIdentifier } },
                        size: 1
                    });

                    const hits = searchResponse.data?.hits?.hits;
                    if (!hits || hits.length === 0) throw new Error(`Class ${classIdentifier} not found in ${envName}`);

                    const classId = hits[0]._id;
                    const packageId = hits[0]._source.package._id;

                    // Fetch full class
                    const classUrl = `/main/_classId/000000000000000000000000/_get`;
                    const classResponse = await client.post(classUrl, { _id: classId });

                    const _class = classResponse.data;
                    const method = (_class.methods || []).find(m => m.identifier === methodIdentifier);
                    if (!method) throw new Error(`Method ${methodIdentifier} not found in class ${classIdentifier} in ${envName}`);

                    // Fetch package info for folder structure
                    const packageUrl = `/main/_classId/000000000000000000000015/_get`;
                    const packageResponse = await client.post(packageUrl, { _id: packageId });

                    return {
                        scripts: method.scripts || [],
                        packageIdentifier: packageResponse.data.identifier
                    };

                } catch (error) {
                    console.error(`Failed to fetch from ${envName}:`, error.message);
                    throw error;
                }
            };

            const [sourceData, targetData] = await Promise.all([
                fetchMethodData(sourceUrl, sourceEnv, sourceToken),
                fetchMethodData(targetUrl, targetEnv, targetToken)
            ]);

            const sourceScripts = sourceData.scripts;
            const targetScripts = targetData.scripts;
            const packageIdentifier = sourceData.packageIdentifier;

            // Determine folder structure: sydle-[env]/[package]/[class]/[method]
            // We use standard logic to find root folder
            const currentUrl = getCurrentUrl();
            let rootEnv = 'dev';
            if (currentUrl && currentUrl.includes('hom')) rootEnv = 'hom';
            if (currentUrl && currentUrl.includes('prod')) rootEnv = 'prod';

            const rootName = `sydle-${rootEnv}`;
            const scriptsPath = path.join(process.cwd(), rootName, ...packageIdentifier.split('.'), classIdentifier, methodIdentifier, 'scripts');

            if (!fs.existsSync(scriptsPath)) {
                fs.mkdirSync(scriptsPath, { recursive: true });
            }

            const maxScripts = Math.max(sourceScripts.length, targetScripts.length);
            console.log(`\nFound ${sourceScripts.length} script(s) in Source and ${targetScripts.length} in Target.`);
            console.log(`Output folder: ${scriptsPath}`);

            // Temp dir for visual diff files
            const tempDir = path.join(process.cwd(), '.tmp_diff');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            for (let i = 0; i < maxScripts; i++) {
                const sScript = sourceScripts[i] || '';
                const tScript = targetScripts[i] || '';

                // 1. Define final output file (target for the merge result)
                const scriptFileName = `script_${i + 1}.js`;
                const scriptPath = path.join(scriptsPath, scriptFileName);

                // Ensure it exists with Source content (as "Local" base)
                if (!fs.existsSync(scriptPath)) {
                    fs.writeFileSync(scriptPath, sScript);
                }

                console.log(`Target Script: ${scriptFileName}`);

                // 2. Prepare temporary files for 3-way merge
                try {
                    const tempDir = path.join(process.cwd(), '.tmp_diff');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

                    const sourceFile = path.join(tempDir, `merge_local_${i + 1}.js`);  // Local (Source)
                    const targetFile = path.join(tempDir, `merge_remote_${i + 1}.js`); // Remote (Target)
                    const baseFile = path.join(tempDir, `merge_base_${i + 1}.js`);     // Base (Source initial)

                    fs.writeFileSync(sourceFile, sScript);
                    fs.writeFileSync(targetFile, tScript);
                    fs.writeFileSync(baseFile, sScript); // Using Source as base

                    // 3. Launch Editor
                    // Check for VS Code environment
                    const isVsCode = process.env.TERM_PROGRAM === 'vscode';

                    if (i === 0 && isVsCode) {
                        console.log('Opening VS Code Merge Editor...');
                        console.log('  Current (Left): Source Env');
                        console.log('  Incoming (Right): Target Env');
                        console.log('  Result: Saving will update script file');

                        const { exec } = require('child_process');
                        // code --merge <local> <remote> <base> <result>
                        exec(`code --merge "${sourceFile}" "${targetFile}" "${baseFile}" "${scriptPath}"`);
                    } else {
                        // Fallback: still generate conflict file for other editors or if not first script
                        const conflictContent = `<<<<<<< ${sourceEnv.toUpperCase()} (${sourceUrl})
${sScript}
=======
${tScript}
>>>>>>> ${targetEnv.toUpperCase()} (${targetUrl})
`;
                        const diffFileName = `diff_script_${i + 1}_${sourceEnv}_${targetEnv}.js`;
                        const fullDiffPath = path.join(scriptsPath, diffFileName);
                        fs.writeFileSync(fullDiffPath, conflictContent);

                        if (i === 0) console.log(`Manual merge required (Editor auto-launch skipped).`);
                        console.log(`Generated standard conflict file: ${diffFileName}`);
                    }
                } catch (e) {
                    console.warn('Failed to setup merge:', e.message);
                }
            }

            console.log('Open the conflict file(s) to view and merge changes manually if preferred.');

        } catch (error) {
            console.error('Compare command failed:', error.message);
        }
    });

module.exports = compareCommand;
