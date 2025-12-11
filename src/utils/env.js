const fs = require('fs');
const path = require('path');
const os = require('os');

const setEnvValue = (key, value) => {
    const envFilePath = path.resolve(process.cwd(), '.env');
    const envVars = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, 'utf8').split(os.EOL) : [];
    const targetLine = envVars.find((line) => line.split('=')[0] === key);
    if (targetLine !== undefined) {
        const targetLineIndex = envVars.indexOf(targetLine);
        envVars.splice(targetLineIndex, 1, `${key}=${value}`);
    } else {
        envVars.push(`${key}=${value}`);
    }
    fs.writeFileSync(envFilePath, envVars.join(os.EOL));
};

module.exports = { setEnvValue };
