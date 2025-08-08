import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';


/**
 * Function to decompress tar file to extractTo (directory)
 * @param {string} tarFilePath 
 * @param {string} extractTo
 * @param {{
 *  removeTarFile: boolean, 
 *  renameTo: string
 * }} [options={}]
 * @returns {string} 
 */
export const decompressTarBz2File = (tarFilePath, extractTo, options) => {
    // Check if the tar file exists
    if (!fs.existsSync(tarFilePath)) {
        throw new Error(`File ${tarFilePath} not found`);
    }

    // Ensure the output directory exists
    if (!fs.existsSync(extractTo)) {
        fs.mkdirSync(extractTo, { recursive: true });
    }

    // Decompress using tar command
    try {
        execSync(`tar -xjf ${tarFilePath} -C ${extractTo}`);
        console.log(`Decompressed ${tarFilePath} to ${extractTo}`);
        options.removeTarFile && fs.unlinkSync(tarFilePath);
        return new Promise((resolve) => {
            (async () => {
                if (options.renameTo) {
                    const { rename } = await import('node:fs/promises');
                    await rename(path.resolve('data'), options.renameTo);
                }
                resolve(options.renameTo || extractTo);
            })();
        })
    } 
    catch (err) {
        throw new Error(`Decompression failed: ${err.message}`);
    }
}