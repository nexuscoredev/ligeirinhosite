import { defineConfig, loadEnv } from 'vite';
import { authConfigFromEnv } from './scripts/auth-config-from-env.mjs';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        server: {
            port: 5173,
        },
        plugins: [
            {
                name: 'ligeirinho-auth-config-api',
                configureServer(server) {
                    server.middlewares.use('/api/auth-config', (req, res) => {
                        const host = req.headers.host || 'localhost:5173';
                        const config = authConfigFromEnv(
                            { ...process.env, ...env },
                            `http://${host}`
                        );

                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.end(JSON.stringify(config));
                    });
                },
            },
        ],
    };
});
