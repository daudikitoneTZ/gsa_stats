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

/**
 * Enhanced retry utility with network reconnection handling
 * @param {Function} operation 
 * @param {number} [maxRetries=3] 
 * @param {number} [maxWaitForReconnect=600000] 
 * @returns 
 */
export const withRetry = async (operation, maxRetries = 3, maxWaitForReconnect = 600000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let returnValue;
        try {
            returnValue = await operation();
            return returnValue;
        } 
        catch (error) {
            lastError = error;
            const isNetworkError = (
                error.message.includes('net::ERR_INTERNET_DISCONNECTED') ||
                error.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
                error.message.includes('timeout')
            );
            if (isNetworkError && attempt <= maxRetries) {
                console.warn(`Retry ${attempt}/${maxRetries} after ${Math.pow(2, attempt)}s: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                if (isNetworkError) {
                    console.warn('Network error detected. Waiting for reconnection...');
                    const startTime = Date.now();
                    while (Date.now() - startTime < maxWaitForReconnect) {
                        try {
                            // Test network by fetching a small resource
                            await fetch('https://www.google.com', { method: 'HEAD', timeout: 5000 });
                            console.log('Network reconnected.');
                            break;
                        } catch {
                            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
                        }
                    }
                    if (Date.now() - startTime >= maxWaitForReconnect) {
                        throw new Error('Network reconnection timeout exceeded');
                    }
                }
            } else if (attempt === maxRetries) {
                throw lastError;
            }
        }
    }
    throw lastError;
}