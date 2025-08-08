import { execSync } from 'node:child_process';
import fs from 'node:fs';


/**
 * Function to decompress tar file to extractTo (directory)
 * @param {string} tarFilePath 
 * @param {string} extractTo
 * @param {boolean} [removeTarFile=false]
 * @returns {string} 
 */
export const decompressTarBz2File = (tarFilePath, extractTo, removeTarFile = false) => {
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
        removeTarFile && fs.unlinkSync(tarFilePath);
        return extractTo;
    } 
    catch (err) {
        throw new Error(`Decompression failed: ${err.message}`);
    }
}