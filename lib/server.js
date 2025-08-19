import { fileURLToPath } from "node:url";
import express from "express";
//import helmet from "helmet";
import path from "node:path";
import cors from "cors";
import { isProductionEnv } from "../utils/utilities.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
//app.use(helmet());
app.use(cors({ 
    origin: isProductionEnv()
     ? 'https://patlabs.netbucket.net' 
     : '*' 
}));
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

let server;

export default class Server {
    /** 
     * @param {{ 
     *  isLocalServer?: boolean, 
     *  port?: number 
     * }} [options={}]
     */
    constructor(options = {}) {
        this.options = options;
        this.activeRoutes = [];
        this.lastEnrichmentData = '';
        this.routes = {
            enrichmentProgress: { method: 'get', route: '/api/gsa-enrichment-progress' },
            stop: { method: 'post', route: '/api/gsa-stop-server' }
        };
        this.options.isLocalServer = ((bool) => {
            return typeof bool === 'boolean' ? bool : false;
        })(this.options.isLocalServer);
    }

    status(log = true) {
        if (log) {
            console.log('Active Routes:', this.activeRoutes.length);
            this.activeRoutes.forEach(route => {
                console.log(`Method: ${route.method.toLowerCase()}    Route: ${route.route.toLowerCase()}`);
            });
            return
        }
        return this.activeRoutes;
    }

    openRoute(route) {
        const isRegistered = Object.keys(this.routes).some(v => this.routes[v].route === route);
        if (!isRegistered) {
            throw new Error(`The route ${route} is not registered`);
        }
        this.activeRoutes.push(route);
    }

    start() {
        if (server && server.listening) return;
        const port = this.options.port || getUnusedPort();
        server = app.listen(port, () => {
            console.log(`📡 SSE server started at http://localhost:${port}/\n`);
        });
    
        function getUnusedPort() {
            // Modify this function
            return 12500;
        }
    }

    isRunning() {
        return !!(server && server.listening);
    }

    stop() {
        const route = this.routes.stop.route;
        if (this.activeRoutes.includes(route)) return;
        app.post(route, (_, res) => {
            const ms = Math.floor(Math.random() * 5000 + 1000);
            res.status(200).json({ success: true, data: `Server will be stopped in ${ms/1000} seconds` });
            setTimeout(() => {
                server.close(() => {
                    console.log('🛑 Server stopped successfully.\n');
                    // eslint-disable-next-line no-undef
                    this.options.isLocalServer && process.exit(0);
                }, ms);
            });
        });
        this.openRoute(route);
    }

    enrichmentProgress(emitter) {
        const route = this.routes.enrichmentProgress.route;
        if (this.activeRoutes.includes(route)) return;
        app.get(route, (req, res) => {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const onProgress = (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
                this.lastEnrichmentData = data;
            };

            if (this.lastEnrichmentData && this.lastEnrichmentData.isCompleted) {
                console.log("Last data:", this.lastEnrichmentData);
                res.write(`data: ${JSON.stringify(this.lastEnrichmentData)}\n\n`)
            }

            emitter.on('progress', onProgress);

            req.on('close', () => {
                emitter.off('progress', onProgress);
            });
        });
        this.openRoute(route);
    }
}