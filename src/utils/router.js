// ========================================
// Basit SPA Router
// ========================================
// Hash tabanlı routing (#/login, #/app gibi)

const routes = {};
let currentRoute = null;

/**
 * Rota tanımla
 * @param {string} path - Rota yolu
 * @param {Function} handler - Sayfa render fonksiyonu
 */
export function route(path, handler) {
    routes[path] = handler;
}

/**
 * Rotaya git
 * @param {string} path - Gidilecek rota
 */
export function navigate(path) {
    window.location.hash = path;
}

/**
 * Router'ı başlat
 */
export function startRouter() {
    function handleRoute() {
        const hash = window.location.hash.slice(1) || '/login';

        if (hash === currentRoute) return;
        currentRoute = hash;

        const handler = routes[hash];
        if (handler) {
            handler();
        } else {
            // 404 - varsayılan rotaya git
            navigate('/login');
        }
    }

    window.addEventListener('hashchange', handleRoute);
    handleRoute(); // İlk yükleme
}

export default { route, navigate, startRouter };
