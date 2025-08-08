import { deleteDirectory } from "../utils/utilities";

/**
 * Attach a route to the server
 * @param {string} route 
 * @param {any} server 
 * @param {any} emitter 
 */
export const setupProgressRoute = (route, server, emitter) => {
    server.get(route, (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const onProgress = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        emitter.on('progress', onProgress);

        req.on('close', () => {
            emitter.off('progress', onProgress);
        });
    });
}

/**
 * Attach task report route to the server
 * @param {string} route 
 * @param {any} server 
 * @param {Map} taskTracker 
 */
export const setupTaskReportRoute = (route, server, taskTracker) => {
    server.post(route, (_, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(JSON.stringify(trackedTasks()));

        function trackedTasks() {
            const result = {};
            for (let key of taskTracker.keys()) {
                result[key] = taskTracker.get(key)
            }
            return result
        }
    });
}

export const setupServerStopperRoute = (route, server, killProcess = true) => {
    server.post(route, (_, res) => {
        const ms = Math.floor(Math.random() * 5000 + 1000);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(JSON.stringify({ success: true, data: `Server will be stopped in ${ms/1000} seconds` }));
        setTimeout(() => {
            server.close(() => {
            console.log('🛑 Server stopped successfully.\n');
            // eslint-disable-next-line no-undef
            killProcess && process.exit(0);
        }, ms);
    });
    });
}

/**
 * @param {*} route 
 * @param {*} server 
 * @param {*} taskTracker 
 */
export const setupTaskCleanerRoute = (route, server, taskTracker) => {
    server.post(route, async (req, res) => {
        const response = {};
        try {
            const data = await requestData(req);
            const trackedTask = taskTracker.get(data.taskId);
            await deleteDirectory(trackedTask.dataDir);
            response.success = true;
        } 
        catch (error) {
            response.success = false;
            response.reason = error.message;    
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(JSON.stringify(response));
    });
}

/**
 * Attach task report route to the server
 * @param {string} route 
 * @param {any} server 
 * @param {Map} taskTracker 
 */
export const setupTaskRemoverRoute = async (route, server, taskTracker) => {
    server.post(route, async (req, res) => {
        const response = {};
        
        try {
            const data = await requestData(req);
            taskTracker.delete(data.taskId);
            response.success = true;
        } 
        catch (error) {
            response.success = false;
            response.reason = error.message;    
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(JSON.stringify(response));
    });
}

async function requestData(req) {
    return new Promise((resolve) => {
        let data = '';
        req.on('data', (chunk) => data += chunk);
        req.on('end', () => {
            resolve(JSON.parse(data))
        })
    })
}

