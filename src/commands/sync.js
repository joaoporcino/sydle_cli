const { Command } = require('commander');
const { glob } = require('glob');
const fs = require('fs');
const path = require('path');
const { get, patch } = require('../api/main');
const { ensureAuth } = require('../utils/authFlow');

const syncCommand = new Command('sync')
    .description('Sync local scripts to Sydle')
    .argument('[path]', 'Optional path: package.class.method, package.class, or package')
    .option('-v, --verbose', 'Show verbose logging')
    .action(async (syncPath, options) => {
        try {
            if (!(await ensureAuth())) {
                return;
            }

            const classId = '000000000000000000000000';
            let url = process.env.SYDLE_API_URL;
            let env = 'prod';
            if (url.includes('dev')) env = 'dev';
            else if (url.includes('hom')) env = 'hom';

            const rootFolder = `sydle-${env}`;
            const rootPath = path.join(process.cwd(), rootFolder);

            if (!fs.existsSync(rootPath)) {
                console.error(`❌ Directory not found: ${rootPath}`);
                console.error(`   Run 'sydle init' or 'sydle obterPacote' first.`);
                return;
            }

            console.log('🔍 Scanning for methods to sync...\n');

            // Build glob pattern based on path
            let pattern = '**/method.json';
            if (syncPath) {
                const parts = syncPath.split('.');
                if (parts.length === 3) {
                    // Specific method: package.class.method
                    const [pkg, cls, method] = parts;
                    pattern = `${pkg.split('.').join('/')}/${cls}/${method}/method.json`;
                } else if (parts.length === 2) {
                    // Specific class: package.class
                    const [pkg, cls] = parts;
                    pattern = `${pkg.split('.').join('/')}/${cls}/*/method.json`;
                } else if (parts.length === 1) {
                    // Specific package
                    pattern = `${parts[0].split('.').join('/')}/**/method.json`;
                }
            }

            // Find all method.json files
            const methodFiles = await glob(pattern, {
                cwd: rootPath,
                absolute: false,
                nodir: true
            });

            if (methodFiles.length === 0) {
                console.error(`❌ No methods found matching: ${syncPath || 'all'}`);
                return;
            }

            console.log(`📦 Found ${methodFiles.length} method(s) to sync\n`);

            let successCount = 0;
            let failCount = 0;

            // Sync each method
            for (const methodFile of methodFiles) {
                const result = await syncMethod(path.join(rootPath, methodFile), classId, rootPath, options.verbose);
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            // Summary
            console.log('\n' + '='.repeat(50));
            console.log(`✓ Successfully synced: ${successCount} method(s)`);
            if (failCount > 0) {
                console.log(`✗ Failed: ${failCount} method(s)`);
            }
            console.log('='.repeat(50));

        } catch (error) {
            console.error('❌ Sync command failed:', error.message);
            if (options.verbose) {
                console.error(error);
            }
        }
    });

async function syncMethod(methodJsonPath, classId, rootPath, verbose) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const relativePath = path.relative(rootPath, methodJsonPath);
    const parts = relativePath.split(path.sep);

    // Extract className and methodName
    const methodName = parts[parts.length - 2];
    const className = parts[parts.length - 3];

    try {
        if (verbose) {
            console.log(`[${timestamp}] 🔄 Syncing: ${className}/${methodName}`);
        } else {
            console.log(`🔄 ${className}/${methodName}`);
        }

        // Read method.json
        const methodData = JSON.parse(fs.readFileSync(methodJsonPath, 'utf-8'));

        // Read all scripts
        const methodFolder = path.dirname(methodJsonPath);
        const scriptsFolder = path.join(methodFolder, 'scripts');

        if (!fs.existsSync(scriptsFolder)) {
            console.log(`   ⚠ No scripts folder found`);
            return { success: false };
        }

        const scriptFiles = fs.readdirSync(scriptsFolder)
            .filter(file => file.match(/^script_\d+\.js$/))
            .sort();

        if (scriptFiles.length === 0) {
            console.log(`   ⚠ No script files found`);
            return { success: false };
        }

        // Read all scripts
        const scripts = [];
        for (const scriptFile of scriptFiles) {
            const scriptPath = path.join(scriptsFolder, scriptFile);
            const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
            scripts.push(scriptContent);
        }

        methodData.scripts = scripts;

        // Write updated method.json
        fs.writeFileSync(methodJsonPath, JSON.stringify(methodData, null, 4), 'utf-8');

        // Get class _id
        const classFolder = path.dirname(methodFolder);
        const classJsonPath = path.join(classFolder, 'class.json');

        if (!fs.existsSync(classJsonPath)) {
            console.log(`   ❌ class.json not found`);
            return { success: false };
        }

        const classData = JSON.parse(fs.readFileSync(classJsonPath, 'utf-8'));
        const classRecordId = classData._id;

        // Get current class to find method index
        const currentClass = await get(classId, classRecordId);
        if (!currentClass || !currentClass.methods) {
            console.log(`   ❌ Failed to fetch class data`);
            return { success: false };
        }

        const methodIndex = currentClass.methods.findIndex(m => m.identifier === methodName);
        if (methodIndex === -1) {
            console.log(`   ❌ Method not found in class`);
            return { success: false };
        }

        // Patch
        const updateData = {
            _id: classRecordId,
            _operationsList: [{
                op: 'replace',
                path: `/methods/${methodIndex}`,
                value: methodData
            }]
        };

        await patch(classId, updateData);

        console.log(`   ✓ Synced (${scripts.length} script(s))`);
        return { success: true };

    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        if (verbose) {
            console.error(error);
        }
        return { success: false };
    }
}

module.exports = syncCommand;
