import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Mobile Safari/537.36'
];

export const getUserAgent = () => {
    const index = Math.floor(Math.random() * userAgents.length);
    return userAgents[index] || userAgents[0];
};

export const isProductionEnv = () => {
    // eslint-disable-next-line no-undef
    return process.env.NODE_ENV === 'production'
};

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