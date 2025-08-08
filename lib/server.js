import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));
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
        this.lastData = '';
        this.routes = {
            enrichmentProgress: { method: 'get', route: '/gsa-enrichment-progress' },
            stop: { method: 'post', route: '/gsa-stop-server' }
        }
        const bool = this.options.isLocalServer;
        this.options.isLocalServer = typeof bool === 'boolean' ? bool : true;
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
    }

    start() {
        const port = this.options.port || getUnusedPort();
        //this._enrichmentProgress(emitter);
        //this.stop();
        server = app.listen(port, () => {
            console.log(`📡 SSE server started at http://localhost:${port}/`);
        });

        function getUnusedPort() {
            return 16500;
        }
    }

    stop() {
        const route = this.routes.stop.route;
        this.openRoute(route);
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
    }

    enrichmentProgress(emitter) {
        const route = this.routes.enrichmentProgress.route;
        this.openRoute(route);
        app.get(route, (req, res) => {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const onProgress = (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
                this.lastData = data;
            };

            if (this.lastData && this.lastData.isCompleted) {
                console.log("Last data:", this.lastData);
                res.write(`data: ${JSON.stringify(this.lastData)}\n\n`)
            }

            emitter.on('progress', onProgress);

            req.on('close', () => {
                emitter.off('progress', onProgress);
            });
        });
    }
}