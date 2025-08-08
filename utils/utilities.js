import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';

/**
 * 
 * @param {string} filepath 
 * @param {Array | Object} data 
 * @param {string} logMessage 
 */
export const saveJSON = async (filepath, data, logMessage = "") => {
    try {
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
        if (logMessage) console.log(logMessage);
    } 
    catch (error) {
        console.log(`⚠️ Failed to save JSON file to ${filepath}:`, error.message);
        console.log(JSON.stringify(data));    
    }
}

/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/** @param {string} filepath */
export const normalizeFilepath = (filepath) => filepath.replace(/[\s:/$\\]/g, '_');


export class ProgressEmitter extends EventEmitter {
    constructor() {
        super();
        this.isCompleted = false;
    }
    sendProgress(data) {
        this.isCompleted = data.isCompleted;
        this.emit('progress', data);
    }
}