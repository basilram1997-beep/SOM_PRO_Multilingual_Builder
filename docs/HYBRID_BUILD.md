# SOM PRO Hybrid Build

This project is prepared for two outputs:

1. Web page build: `npm run build:web`
2. Windows desktop build: `npm run build:hybrid`

The desktop app first tries to open `SOM_PRO_APP_URL` or `http://localhost:5173` during development. If no web server is available, it opens the bundled web build from the packaged resources.

The web build still needs the backend API at `VITE_API_URL` or `http://localhost:4000`.
