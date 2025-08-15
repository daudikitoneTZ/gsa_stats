import path from 'node:path';
import fs from 'node:fs';

/**
 * Check if a directory is empty or doesn't exist
 * @param {string} dirPath 
 * @returns {boolean}
 */
export const isEmptyDirectory = (dirPath) => {
    try {
        if (!fs.existsSync(dirPath)) {
            return true; // Directory doesn't exist
        }
        const files = fs.readdirSync(dirPath);
        return files.length === 0; // Directory is empty
    } 
    catch (err) {
        console.error(`Error checking directory ${dirPath}:`, err.message);
        return true; // Treat errors (e.g., no access) as empty/non-existent
    }
}

/**
 * Create a new folder with only composed.json and/or repaired.json, preserving structure
 * @param {{
 *  sourceDir: string, 
 *  targetDir: string, 
 *  neededFiles: Array<string>, 
 *  removeFilteredDir?: boolean
 * }} options
 * @returns {Promise<string>}
 */
export const createFilteredFolder = (options) => {
    const { sourceDir, targetDir, neededFiles } = options;
    const removeFilteredDir = (
        typeof options.removeFilteredDir === 'boolean' && 
        options.removeFilteredDir
    ) ? true : false;

    try {
        // Ensure source exists
        if (!fs.existsSync(sourceDir)) {
            throw new Error(`Source directory ${sourceDir} not found`)
        }

        walkDir(sourceDir); // Start walking from sourceDir
        
        return new Promise((resolve, reject) => {
            (async () => {
                try {
                    if (removeFilteredDir) {
                        const { rm } = await import('node:fs/promises');
                        await rm(sourceDir, { recursive: true, force: true });
                    }
                    resolve(targetDir);
                } 
                catch (error) {
                    reject(`Failed to remove filtered directory: ${error.message}`)
                }
            })();
        });

        // Walk through source directory recursively
        function walkDir(currentDir, relativePath = '') {
            const files = fs.readdirSync(currentDir, { withFileTypes: true });
            let hasNeededFiles = false;

            // Check for needed files in current directory
            const filteredFiles = files.filter(file => file.isFile() && neededFiles.includes(file.name));

            if (filteredFiles.length > 0) {
                // Create corresponding directory in target
                const targetPath = path.join(targetDir, relativePath);
                if (!fs.existsSync(targetPath)) {
                    fs.mkdirSync(targetPath, { recursive: true });
                }

                // Copy only needed files
                filteredFiles.forEach(file => {
                    const sourceFile = path.join(currentDir, file.name);
                    const targetFile = path.join(targetPath, file.name);
                    fs.copyFileSync(sourceFile, targetFile);
                });

                hasNeededFiles = true;
            }

            // Recurse into subdirectories
            for (const file of files) {
                if (file.isDirectory()) {
                    const subDir = path.join(currentDir, file.name);
                    const subRelativePath = path.join(relativePath, file.name);
                    if (walkDir(subDir, subRelativePath)) {
                        hasNeededFiles = true; // Subdirectory has needed files, so keep parent
                    }
                }
            }

            return hasNeededFiles;
        }
    } 
    catch (err) {
        throw new Error(`Failed to create filtered folder: ${err.message}`)
    }
}