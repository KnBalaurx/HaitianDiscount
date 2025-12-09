/* ARCHIVO: assets/js/main.js */
import { initStorePage } from './storeLogic.js';

// 1. INICIALIZAMOS LA LÓGICA COMPARTIDA
initStorePage({
    platformName: 'Steam',
    budgetRefString: 'presupuesto_steam',
    statusRefString: 'estado_steam'
});

// 2. LÓGICA ESPECÍFICA DE STEAM (BUSCADOR DE JUEGOS API)
document.addEventListener('DOMContentLoaded', () => {
    
    const btnBuscarSteam = document.getElementById('btnBuscarSteam');
    const inputUrlSteam = document.getElementById('steamUrlInput');
    const previewContainer = document.getElementById('previewContainer');
    const gameCoverImg = document.getElementById('gameCover');

    if(btnBuscarSteam && inputUrlSteam) {
        
        btnBuscarSteam.addEventListener('click', async () => {
            console.log("Buscando juego..."); 
            
            const url = inputUrlSteam.value;
            const regex = /app\/(\d+)/;
            const match = url.match(regex);
            
            if(previewContainer) previewContainer.style.display = 'none';

            if (!match) {
                window.Swal.fire('Link no válido', 'Usa un link de Steam válido (store.steampowered.com/app/...).', 'warning');
                return;
            }

            const appId = match[1];
            console.log("ID encontrado:", appId); 

            window.Swal.fire({ title: 'Buscando en Steam...', didOpen: () => window.Swal.showLoading() });

            try {
                // CAMBIO IMPORTANTE: Usamos 'corsproxy.io' que es más estable
                const targetUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=cl`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Error de conexión con el proxy');
                
                // CAMBIO IMPORTANTE: Este proxy devuelve el JSON directo, no hay que hacer JSON.parse extra
                const steamData = await response.json();

                if (steamData[appId] && steamData[appId].success) {
                    const gameInfo = steamData[appId].data;
                    console.log("Datos recibidos:", gameInfo.name);
                    
                    // 1. Rellenar Nombre
                    const inputJuego = document.getElementById('juego');
                    if(inputJuego) inputJuego.value = gameInfo.name;

                    // 2. Mostrar Portada (CÓDIGO ACTUALIZADO)
                    if (gameInfo.header_image && previewContainer && gameCoverImg) {
                        // Foto principal
                        gameCoverImg.src = gameInfo.header_image;
                        
                        // Foto de fondo (Ambient Glow)
                        const bgDiv = document.getElementById('gamePreviewBg');
                        if(bgDiv) {
                            bgDiv.style.backgroundImage = `url('${gameInfo.header_image}')`;
                            bgDiv.style.opacity = '1'; // Hacemos que aparezca suavemente
                        }

                        previewContainer.style.display = 'block';
                    }

                    // 3. Rellenar Precio
                    const inputPrecio = document.getElementById('precioSteam');
                    window.Swal.close();
                    
                    const Toast = window.Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

                    if (gameInfo.is_free) {
                        inputPrecio.value = 0;
                        Toast.fire({ icon: 'info', title: 'El juego es Gratis' });
                    } else if (gameInfo.price_overview) {
                        // La API devuelve centavos (ej: 10000 para $100 CLP), dividimos por 100
                        let precio = gameInfo.price_overview.final / 100;
                        inputPrecio.value = precio;
                        
                        // Avisamos que cambió el input para activar validaciones
                        inputPrecio.dispatchEvent(new Event('input')); 

                        if(gameInfo.price_overview.discount_percent > 0) {
                            Toast.fire({ icon: 'success', title: `¡Oferta! -${gameInfo.price_overview.discount_percent}%` });
                        } else {
                            Toast.fire({ icon: 'success', title: 'Datos cargados' });
                        }
                    } else {
                        Toast.fire({ icon: 'warning', title: 'No se encontró precio (¿No está a la venta?)' });
                    }
                } else {
                    throw new Error('Juego no encontrado o ID inválido');
                }
            } catch (error) {
                console.error("Error en búsqueda:", error);
                window.Swal.fire('Error', 'No pudimos cargar los datos automáticamente. Intenta ingresarlos manualmente.', 'error');
            }
        });
    }
});