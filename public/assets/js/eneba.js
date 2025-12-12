/* ARCHIVO: public/assets/js/eneba.js */
import { initStorePage } from './storeLogic.js';
import { db, auth } from './config.js';
import { ref, set, get, remove, child, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";


// 1. Inicializamos la lógica base (Presupuesto, Auth, etc.)
initStorePage({
    platformName: 'Eneba',
    budgetRefString: 'presupuesto_eneba',
    statusRefString: 'estado_eneba'
});

// 2. Lógica de Scraping Específica para Eneba
document.addEventListener('DOMContentLoaded', () => {
    const btnBuscar = document.getElementById('btnBuscarEneba');
    const inputUrl = document.getElementById('enebaUrlInput');
    const inputNombre = document.getElementById('juego');
    const previewContainer = document.getElementById('previewContainer');
    const gameCoverImg = document.getElementById('gameCover');
    const bgDiv = document.getElementById('gamePreviewBg');

    if (btnBuscar && inputUrl) {
        btnBuscar.addEventListener('click', async () => {
            const url = inputUrl.value.trim();

            if (!url.includes('eneba.com')) {
                Swal.fire('Link inválido', 'Por favor ingresa un link válido de Eneba.', 'warning');
                return;
            }

            // UI Loading
            Swal.fire({
                title: 'Analizando Eneba...',
                text: 'Obteniendo imagen y título exacto',
                didOpen: () => Swal.showLoading()
            });

            try {
                // Usamos el proxy para saltar CORS y obtener el HTML
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                
                if (!response.ok) throw new Error('No se pudo acceder a la página');

                // Obtenemos el texto HTML
                const htmlText = await response.text();

                // Convertimos el texto a un documento HTML real para poder leerlo
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');

                // --- EXTRACCIÓN DE DATOS MEJORADA ---
                
                // 1. Imagen (og:image suele ser la mejor calidad)
                const metaImg = doc.querySelector('meta[property="og:image"]');
                const imgUrl = metaImg ? metaImg.content : null;

                // 2. Título: ESTRATEGIA MIXTA
                // Intento A: Buscar el H1 (Es lo que el usuario ve en la pantalla, ej: "Juego X Clave Latam")
                const h1Element = doc.querySelector('h1');
                let rawTitle = h1Element ? h1Element.innerText : '';

                // Intento B: Si no hay H1, usar el Meta Title (og:title)
                if (!rawTitle || rawTitle.length < 3) {
                    const metaTitle = doc.querySelector('meta[property="og:title"]');
                    rawTitle = metaTitle ? metaTitle.content : '';
                }

                // LIMPIEZA PROFUNDA (Regex Case Insensitive)
                // Elimina: "Comprar", "más barato", "| Eneba", "al mejor precio", etc.
                let title = rawTitle
                    .replace(/^Comprar\s+/i, '')            // Quita "Comprar " al inicio
                    .replace(/^Buy\s+/i, '')                // Quita "Buy " al inicio
                    .replace(/\s+más barato.*/i, '')        // Quita " más barato..." y todo lo que sigue
                    .replace(/\s+al mejor precio.*/i, '')   // Quita " al mejor precio..."
                    .replace(/\s+\|\s+Eneba.*/i, '')        // Quita " | Eneba..."
                    .replace(/\s+-\s+Eneba.*/i, '')         // Quita " - Eneba..."
                    .trim(); // Quita espacios extra al inicio y final

                Swal.close();

                if (title && inputNombre) {
                    // Rellenar Nombre Limpio
                    inputNombre.value = title;
                    
                    // Mostrar Imagen
                    if (imgUrl && previewContainer && gameCoverImg) {
                        gameCoverImg.src = imgUrl;
                        if(bgDiv) {
                            bgDiv.style.backgroundImage = `url('${imgUrl}')`;
                            bgDiv.style.opacity = '1';
                        }
                        previewContainer.style.display = 'block';
                        
                        // Animación suave
                        gameCoverImg.style.opacity = 0;
                        setTimeout(() => gameCoverImg.style.opacity = 1, 100);
                    }

                    // Feedback visual
                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                    Toast.fire({ icon: 'success', title: 'Datos cargados' });

                } else {
                    throw new Error('No se encontraron metadatos');
                }

            } catch (error) {
                console.error(error);
                Swal.fire({
                    icon: 'error',
                    title: 'Ups...',
                    text: 'No pudimos leer los datos automáticamente. Por favor, llena el nombre manualmente.',
                });
                if(previewContainer) previewContainer.style.display = 'none';
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const previewContainer = document.getElementById('previewContainer');
    const cardWrapper = document.getElementById('cardWrapper');
    const cardImage = document.getElementById('gameCover');

    if (previewContainer && cardWrapper && cardImage) {
        
        previewContainer.addEventListener('mousemove', (e) => {
            const rect = previewContainer.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // --- AJUSTE DE ROTACIÓN ---
            // Aumentado a 25 grados para que se note más el giro
            const maxRotation = 25; 
            
            // Cálculos
            let rotateY = ((mouseX - width / 2) / (width / 2)) * maxRotation;
            let rotateX = ((mouseY - height / 2) / (height / 2)) * -maxRotation;

            // Limites de seguridad
            rotateX = Math.max(-maxRotation, Math.min(maxRotation, rotateX));
            rotateY = Math.max(-maxRotation, Math.min(maxRotation, rotateY));

            const bgX = (mouseX / width) * 100;
            const bgY = (mouseY / height) * 100;

            requestAnimationFrame(() => {
                cardWrapper.style.setProperty('--rotate-x', `${rotateX}deg`);
                cardWrapper.style.setProperty('--rotate-y', `${rotateY}deg`);
                cardWrapper.style.setProperty('--bg-x', `${bgX}%`);
                cardWrapper.style.setProperty('--bg-y', `${bgY}%`);
                cardWrapper.style.setProperty('--show-shine', '1');
            });
        });

        previewContainer.addEventListener('mouseleave', () => {
            requestAnimationFrame(() => {
                cardWrapper.style.setProperty('--rotate-x', '0deg');
                cardWrapper.style.setProperty('--rotate-y', '0deg');
                cardWrapper.style.setProperty('--show-shine', '0');
            });
        });
    }
});

// =========================================
// >>> NUEVA LÓGICA DE CARGA DE FEEDBACK <<<
// =========================================

async function loadFeedback() {
    const feedbackContainer = document.getElementById('feedback-container');
    
    // Consulta para obtener solo las órdenes con feedback_recibido: true
    const feedbackQuery = query(
        ref(db, 'ordenes'), // Usar 'db'
        orderByChild('feedback/feedback_recibido'),
        equalTo(true)
    );

    try {
        const snapshot = await get(feedbackQuery);
        if (snapshot.exists()) {
            let feedbackHTML = '';
            
            const feedbacks = [];
            snapshot.forEach((childSnapshot) => {
                const orderData = childSnapshot.val();
                if (orderData.feedback && orderData.feedback.comment) {
                    feedbacks.push(orderData);
                }
            });
            
            // Ordenar por fecha_feedback descendente (más reciente primero)
            feedbacks.sort((a, b) => new Date(b.feedback.fecha_feedback) - new Date(a.feedback.fecha_feedback));
            
            const feedbacksToShow = feedbacks.slice(0, 4); // Mostrar solo los 4 más recientes

            feedbacksToShow.forEach((orderData) => {
                const feedback = orderData.feedback;
                
                // Generar las estrellas 
                const rating = feedback.rating || 5; 
                const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
                
                // Formatear la fecha
                const dateString = feedback.fecha_feedback || orderData.fecha_completo;
                // Intentamos un formato de fecha seguro (YYYY-MM-DD)
                const safeDateString = dateString ? dateString.split('T')[0] : '';
                const formattedDate = safeDateString || 'Fecha Desconocida';
                
                // Identificador del cliente (ej. la parte del email antes del @)
                const clientIdentifier = orderData.email ? orderData.email.split('@')[0] : 'Cliente Anónimo'; 
                
                feedbackHTML += `
                    <div class="feedback-card">
                        <div class="rating">${stars}</div>
                        <p class="feedback-text">"${feedback.comment}"</p>
                        <div class="client-info">
                            <span class="client-name">${clientIdentifier}</span>
                            <span class="client-date">${formattedDate}</span>
                        </div>
                    </div>
                `;
            });
            
            feedbackContainer.innerHTML = feedbackHTML;
            
        } else {
            feedbackContainer.innerHTML = '<p style="text-align: center; color: var(--text-light);">Aún no tenemos valoraciones de clientes. ¡Sé el primero!</p>';
        }
    } catch (error) {
        console.error("Error al cargar el feedback:", error);
        feedbackContainer.innerHTML = '<p style="text-align: center; color: var(--danger);">Lo sentimos, no pudimos cargar las opiniones en este momento.</p>';
    }
}

// Llama a la función cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', loadFeedback);