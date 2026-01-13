const chalk = require('chalk');

/**
 * Standardized logger for CLI commands
 * Provides consistent formatting with colors and emojis
 */
class Logger {
    constructor(verbose = false) {
        this.verbose = verbose;
    }

    /**
     * Get timestamp for verbose mode
     */
    _timestamp() {
        return this.verbose ? `[${new Date().toLocaleTimeString('pt-BR')}] ` : '';
    }

    /**
     * Info message (blue)
     */
    info(message) {
        console.log(chalk.blue(`${this._timestamp()}${message}`));
    }

    /**
     * Success message (green)
     */
    success(message) {
        console.log(chalk.green(`${this._timestamp()}${message}`));
    }

    /**
     * Warning message (yellow)
     */
    warn(message) {
        console.log(chalk.yellow(`${this._timestamp()}${message}`));
    }

    /**
     * Error message (red)
     */
    error(message) {
        console.log(chalk.red(`${this._timestamp()}${message}`));
    }

    /**
     * Plain message (no color)
     */
    log(message) {
        console.log(`${this._timestamp()}${message}`);
    }

    /**
     * Summary box
     */
    summary(lines) {
        const separator = '='.repeat(50);
        console.log('\n' + chalk.gray(separator));
        lines.forEach(line => console.log(line));
        console.log(chalk.gray(separator));
    }

    /**
     * Progress indicator
     */
    progress(message) {
        console.log(chalk.cyan(`${this._timestamp()}${message}`));
    }

    /**
     * Debug message (only in verbose mode)
     */
    debug(message) {
        if (this.verbose) {
            console.log(chalk.gray(`${this._timestamp()}[DEBUG] ${message}`));
        }
    }
}

/**
 * Create logger instance
 */
function createLogger(verbose = false) {
    return new Logger(verbose);
}

module.exports = { Logger, createLogger };
