/* ARCHIVO: assets/js/admin.js */
import { ref, onValue, set, update, remove, child, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth, provider, initTheme, EMAIL_CONFIG, initEmailService } from './config.js';

initTheme();
initEmailService();

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const adminContent = document.getElementById('adminContent');
const vipList = document.getElementById('vipList');
const ordersList = document.getElementById('ordersList');
const loaderView = document.getElementById('loaderView');
const loginCard = document.getElementById('loginCard');

// Variables para Gráficos
let salesChartInstance = null;
let platformChartInstance = null;

// 1. AUTH
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const adminRef = ref(db, `admins/${user.uid}`);
        try {
            const snapshot = await get(adminRef);
            if (snapshot.exists() && snapshot.val() === true) {
                loginOverlay.style.display = 'none';
                adminContent.style.display = 'block';
                iniciarListeners(); 
            } else {
                throw new Error("No admin");
            }
        } catch (e) {
            Swal.fire({
                icon: 'error', title: 'Acceso Denegado', text: 'No tienes permisos de administrador.',
                allowOutsideClick: false
            }).then(() => {
                signOut(auth).then(() => window.location.href = "../index.html");
            });
        }
    } else {
        loginOverlay.style.display = 'flex';
        adminContent.style.display = 'none';
        loaderView.style.display = 'none'; 
        loginCard.style.display = 'block'; 
    }
});

document.getElementById('btnGoogleAdmin').addEventListener('click', () => {
    loginCard.style.display = 'none'; loaderView.style.display = 'block';
    signInWithPopup(auth, provider).catch((error) => {
        loaderView.style.display = 'none'; loginCard.style.display = 'block';
        Swal.fire('Error', error.message, 'error');
    });
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    loginCard.style.display = 'none'; loaderView.style.display = 'block';
    signInWithEmailAndPassword(auth, email, pass).catch(err => {
        loaderView.style.display = 'none'; loginCard.style.display = 'block';
        Swal.fire('Error', 'Credenciales incorrectas', 'error');
    });
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

// --- FUNCIÓN DE ENVÍO DE CORREO ---
async function sendSurveyEmail(orderId, customerEmail, gameTitle, gameKey = null) {
    if (typeof emailjs === 'undefined') {
        Swal.fire('Error', 'EmailJS no está cargado.', 'error');
        return false;
    }

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const productionHost = "https://haitiandiscount.web.app";
    const baseUrl = isLocal 
        ? `http://${window.location.host}/public/pages/encuesta.html` 
        : `${productionHost}/pages/encuesta.html`;
        
    const templateParams = {
        to_email: customerEmail,
        game_title: gameTitle,
        order_id: orderId,
        game_key: gameKey || "Ver en tu perfil",
        current_year: new Date().getFullYear(),
        link_rating_5: `${baseUrl}?order=${orderId}&rating=5`,
        link_rating_3: `${baseUrl}?order=${orderId}&rating=3`,
        link_rating_1: `${baseUrl}?order=${orderId}&rating=1`
    };

    try {
        const response = await emailjs.send(
            EMAIL_CONFIG.SERVICE_ID, 
            EMAIL_CONFIG.TEMPLATE_SURVEY, 
            templateParams
        );

        if (response.status === 200) {
            Swal.fire('¡Enviado!', `Correo enviado a ${customerEmail}.`, 'success');
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Fallo EmailJS:", error);
        return false;
    }
}


// 2. DATA LISTENERS
function iniciarListeners() {
    
    // --- GESTIÓN TIENDA ---
    const saldoSteamRef = ref(db, 'presupuesto_steam');
    const estadoSteamRef = ref(db, 'estado_steam');
    onValue(saldoSteamRef, (s) => document.getElementById('budgetSteamDisplay').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(s.val()||0));
    document.getElementById('btnUpdateBudgetSteam').addEventListener('click', () => {
        const val = parseInt(document.getElementById('newBudgetSteam').value);
        if(val >= 0) set(saldoSteamRef, val).then(() => Swal.fire('Steam', 'Cupo actualizado', 'success'));
    });
    let estSteam = '';
    onValue(estadoSteamRef, (s) => {
        estSteam = s.val() || 'abierto';
        document.getElementById('statusSteamDisplay').innerHTML = estSteam === 'abierto' ? '<span class="status-badge status-open">ABIERTA ONLINE</span>' : '<span class="status-badge status-closed">CERRADA</span>';
    });
    document.getElementById('btnToggleSteam').addEventListener('click', () => set(estadoSteamRef, estSteam === 'abierto' ? 'cerrado' : 'abierto'));

    const saldoEnebaRef = ref(db, 'presupuesto_eneba');
    const estadoEnebaRef = ref(db, 'estado_eneba');
    onValue(saldoEnebaRef, (s) => document.getElementById('budgetEnebaDisplay').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(s.val()||0));
    document.getElementById('btnUpdateBudgetEneba').addEventListener('click', () => {
        const val = parseInt(document.getElementById('newBudgetEneba').value);
        if(val >= 0) set(saldoEnebaRef, val).then(() => Swal.fire('Eneba', 'Cupo actualizado', 'success'));
    });
    let estEneba = '';
    onValue(estadoEnebaRef, (s) => {
        estEneba = s.val() || 'abierto';
        document.getElementById('statusEnebaDisplay').innerHTML = estEneba === 'abierto' ? '<span class="status-badge status-open">ABIERTA ONLINE</span>' : '<span class="status-badge status-closed">CERRADA</span>';
    });
    document.getElementById('btnToggleEneba').addEventListener('click', () => set(estadoEnebaRef, estEneba === 'abierto' ? 'cerrado' : 'abierto'));
    
    // --- VIP ---
    const vipRef = ref(db, 'codigos_vip');
    onValue(vipRef, (snap) => {
        vipList.innerHTML = ''; 
        const codigos = snap.val();
        if(codigos) {
            Object.keys(codigos).forEach(key => {
                vipList.innerHTML += `<tr><td><strong>${key}</strong></td><td>${Math.round(codigos[key] * 100)}%</td><td><button class="btn btn-danger btn-sm" onclick="borrarCodigo('${key}')">Eliminar</button></td></tr>`;
            });
        }
    });
    document.getElementById('btnAddVip').addEventListener('click', () => {
        const code = document.getElementById('vipCodeName').value.trim().toUpperCase();
        const discount = parseFloat(document.getElementById('vipDiscount').value);
        if(code && discount > 0 && discount < 1) {
            set(child(vipRef, code), discount).then(() => {
                Swal.fire({ icon: 'success', title: 'Creado', timer: 1500, showConfirmButton: false });
                document.getElementById('vipCodeName').value = '';
            });
        }
    });
    window.borrarCodigo = (key) => {
        Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true }).then((r) => { if (r.isConfirmed) remove(child(vipRef, key)); });
    };

    // --- PEDIDOS ---
    const ordenesRef = ref(db, 'ordenes');
    let todasLasOrdenes = [];
    const searchInput = document.getElementById('searchInput');
    const filterStatus = document.getElementById('filterStatus');

    onValue(ordenesRef, (snap) => {
        const data = snap.val();
        todasLasOrdenes = []; 
        if (data) {
            todasLasOrdenes = Object.entries(data).map(([id, info]) => ({ id, ...info }))
                                     .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }
        renderizarTabla();
        actualizarKPIs();     
        actualizarGraficos(); 
    });

    function renderizarTabla() {
        ordersList.innerHTML = '';
        const textoBusqueda = searchInput.value.toLowerCase();
        const estadoFiltro = filterStatus.value;

        const ordenesFiltradas = todasLasOrdenes.filter(orden => {
            const cumpleEstado = estadoFiltro === 'todos' || orden.estado === estadoFiltro;
            const email = (orden.email || '').toLowerCase();
            const rut = (orden.rut || '').toLowerCase();
            const juego = (orden.juego || '').toLowerCase();
            const cumpleBusqueda = email.includes(textoBusqueda) || rut.includes(textoBusqueda) || juego.includes(textoBusqueda);
            return cumpleEstado && cumpleBusqueda;
        });
        if (ordenesFiltradas.length === 0) {
            ordersList.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No se encontraron pedidos.</td></tr>';
            return;
        }

        window.imagenesComprobantes = {};
        ordenesFiltradas.forEach(orden => {
            const fecha = new Date(orden.fecha).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'});
            const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(orden.precio_pagado);
            const estado = orden.estado || 'pendiente';
            const plat = orden.plataforma || 'Steam';
            const platStyle = plat === 'Eneba' ? 'color: #a855f7;' : 'color: #2563eb;';
            const tieneKey = orden.game_key ? '<span title="Key Entregada">🔑</span>' : '';

            // BOTÓN VER FOTO: Estilo pildora, centrado
            let btnComprobante = '<span style="color:#ccc; font-size:0.7rem; display:block; margin-top:4px;">Sin foto</span>';
            if(orden.comprobante_img) {
                window.imagenesComprobantes[orden.id] = orden.comprobante_img;
                btnComprobante = `<button class="btn-foto" onclick="verComprobante('${orden.id}')">Ver Foto</button>`;
            }

            // BOTONES DE ACCIÓN: CENTRADOS
            let actionBtnsHtml = `<button class="btn btn-danger btn-sm" onclick="borrarOrden('${orden.id}')" title="Borrar">X</button>`;
            
            if (plat === 'Eneba' && estado !== 'cancelado') {
                actionBtnsHtml = `
                    <button class="btn btn-sm" style="background: #a855f7; color: white; border:none;" onclick="iniciarEntregaKey('${orden.id}')" title="Entregar Key">
                        🔑
                    </button>
                    ${actionBtnsHtml}
                `;
            }

            const fila = `
                <tr>
                    <td class="col-fecha" style="font-size: 0.8rem; color: #64748b;">${fecha}</td>
                    <td class="col-usuario">
                        <div class="cell-content">
                            <div class="text-primary" title="${orden.email}">${orden.email}</div>
                            <div class="text-secondary">RUT: ${orden.rut || 'N/A'}</div>
                        </div>
                    </td>
                    <td class="col-juego">
                        <div class="cell-content">
                            <div style="${platStyle} font-weight: bold; font-size: 0.75rem; margin-bottom:2px;">${plat.toUpperCase()} ${tieneKey}</div>
                            <div class="text-primary" title="${orden.juego}">${orden.juego}</div>
                        </div>
                    </td>
                    <td class="col-precio">
                        <div style="font-weight:bold; font-size:0.95rem;">${monto}</div>
                        ${btnComprobante}
                    </td>
                    <td class="col-estado">
                        <select onchange="cambiarEstado('${orden.id}', this.value)" class="status-select status-${estado}">
                            <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="completado" ${estado === 'completado' ? 'selected' : ''}>✅ Completado</option>
                            <option value="cancelado" ${estado === 'cancelado' ? 'selected' : ''}>🚫 Cancelado</option>
                        </select>
                    </td>
                    <td class="col-accion">
                        <div class="action-cell-content">
                            ${actionBtnsHtml}
                        </div>
                    </td>
                </tr>`;
            ordersList.innerHTML += fila;
        });
    }

    searchInput.addEventListener('input', renderizarTabla);
    filterStatus.addEventListener('change', renderizarTabla);

    // --- KPI & Graficos ---
    function actualizarKPIs() {
        const ordenesCompletadas = todasLasOrdenes.filter(o => o.estado === 'completado');
        const pendientes = todasLasOrdenes.filter(o => o.estado === 'pendiente');
        const totalVentas = ordenesCompletadas.reduce((acc, curr) => acc + (parseInt(curr.precio_pagado) || 0), 0);
        document.getElementById('kpiTotalVentas').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalVentas);
        document.getElementById('kpiTotalPedidos').innerText = ordenesCompletadas.length;
        document.getElementById('kpiPendientes').innerText = pendientes.length;
    }

    function actualizarGraficos() {
        const ordenesCompletadas = todasLasOrdenes.filter(o => o.estado === 'completado');
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const ventasPorDia = Array(7).fill(0);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); 
        const etiquetasDias = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(hoy);
            d.setDate(d.getDate() - i);
            etiquetasDias.push(diasSemana[d.getDay()]);
        }
        ordenesCompletadas.forEach(orden => {
            const fechaOrden = new Date(orden.fecha);
            fechaOrden.setHours(0, 0, 0, 0);
            const diffTime = hoy.getTime() - fechaOrden.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays >= 0 && diffDays <= 6) {
                const index = 6 - diffDays;
                ventasPorDia[index] += parseInt(orden.precio_pagado) || 0;
            }
        });
        const ctxSales = document.getElementById('salesChart');
        if(ctxSales) {
            if (salesChartInstance) salesChartInstance.destroy();
            salesChartInstance = new Chart(ctxSales, {
                type: 'bar',
                data: { labels: etiquetasDias, datasets: [{ label: 'Ventas (CLP)', data: ventasPorDia, backgroundColor: '#2563eb', borderRadius: 5 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        }
        let steamCount = 0;
        let enebaCount = 0;
        ordenesCompletadas.forEach(orden => { 
            const plat = (orden.plataforma || '').toLowerCase();
            if (plat.includes('steam')) steamCount++;
            else if (plat.includes('eneba')) enebaCount++;
        });
        const ctxPlatform = document.getElementById('platformChart');
        if(ctxPlatform) {
            if (platformChartInstance) platformChartInstance.destroy();
            platformChartInstance = new Chart(ctxPlatform, {
                type: 'doughnut',
                data: { labels: ['Steam', 'Eneba'], datasets: [{ data: [steamCount, enebaCount], backgroundColor: ['#2563eb', '#a855f7'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }
    
    // Funciones Globales
    window.verComprobante = (id) => {
        Swal.fire({ title: 'Comprobante', imageUrl: window.imagenesComprobantes[id], imageAlt: 'Comprobante', showCloseButton: true });
    };

    window.iniciarEntregaKey = async (id) => {
        const ordenRef = ref(db, `ordenes/${id}`);
        try {
            const snapshot = await get(ordenRef);
            if(!snapshot.exists()) return;
            const orden = snapshot.val();

            const { value: keyIngresada } = await Swal.fire({
                title: 'Entrega de Key Eneba',
                input: 'text',
                inputLabel: `Juego: ${orden.juego}`,
                inputPlaceholder: 'XXXXX-XXXXX-XXXXX',
                showCancelButton: true,
                confirmButtonText: 'Confirmar y Enviar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#a855f7',
                inputValue: orden.game_key || '', 
                inputValidator: (value) => {
                    if (!value) {
                        return '¡Debes escribir la key!';
                    }
                }
            });

            if (keyIngresada) {
                Swal.fire({ title: 'Enviando correo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                const emailSent = await sendSurveyEmail(id, orden.email, orden.juego, keyIngresada);

                if(emailSent) {
                    await update(ordenRef, {
                        game_key: keyIngresada,
                        estado: 'completado',
                        fecha_completado: new Date().toISOString()
                    });
                    
                    Swal.fire({ icon: 'success', title: '¡Key enviada y Pedido completado!' });
                } else {
                    Swal.fire('Error', 'Falló el envío del correo. No se guardaron cambios.', 'error');
                }
            }

        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'Ocurrió un error inesperado.', 'error');
        }
    };

    window.cambiarEstado = async (id, nuevoEstado) => {
        const ordenRef = ref(db, `ordenes/${id}`);
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        try {
            const snapshot = await get(ordenRef);
            if (!snapshot.exists()) return;
            const orden = snapshot.val();
            const costoOriginal = orden.precio_steam; 
            const plataforma = orden.plataforma;
            const estadoOriginal = orden.estado;
            
            if (nuevoEstado === 'cancelado' && estadoOriginal !== 'cancelado') {
                let presupuestoRefStr = plataforma === 'Steam' ? 'presupuesto_steam' : 'presupuesto_eneba';
                if (costoOriginal > 0) {
                    const budgetRef = ref(db, presupuestoRefStr);
                    await runTransaction(budgetRef, (cupo) => (cupo || 0) + costoOriginal);
                    Swal.fire({ icon: 'info', title: 'Cupo Reembolsado', text: `$${costoOriginal} a ${plataforma}`, timer: 1500, showConfirmButton: false });
                }
            }
            
            if (plataforma === 'Eneba' && nuevoEstado === 'completado') {
                document.querySelector(`[onchange="cambiarEstado('${id}', this.value)"]`).value = estadoOriginal;
                window.iniciarEntregaKey(id); 
                return;
            }

            if (plataforma !== 'Eneba' && nuevoEstado === 'completado' && estadoOriginal !== 'completado') {
                const result = await Swal.fire({
                    title: 'Confirmar Pedido Steam',
                    text: `El pedido pasará a COMPLETADO y se enviará correo a ${orden.email}.`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, Completar',
                    confirmButtonColor: '#10b981'
                });
                if (result.isConfirmed) {
                    Swal.fire({ title: 'Enviando correo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    const emailSent = await sendSurveyEmail(id, orden.email, orden.juego, null);
                    if (emailSent) {
                        await update(ordenRef, { 
                            estado: nuevoEstado, 
                            fecha_completado: new Date().toISOString() 
                        });
                        Toast.fire({ icon: 'success', title: 'Pedido completado' });
                    } else {
                        document.querySelector(`[onchange="cambiarEstado('${id}', this.value)"]`).value = estadoOriginal;
                        Swal.fire('Error', 'No se pudo enviar el correo.', 'error');
                    }
                } else {
                    document.querySelector(`[onchange="cambiarEstado('${id}', this.value)"]`).value = estadoOriginal;
                }
                return;
            }

            await update(ordenRef, { 
                estado: nuevoEstado, 
                fecha_completado: (nuevoEstado === 'completado' ? orden.fecha_completado || null : null) 
            });
            Toast.fire({ icon: 'success', title: 'Estado actualizado' });

        } catch (error) { 
            console.error(error);
            Toast.fire({ icon: 'error', title: 'Error interno' });
        }
    };

    window.borrarOrden = (id) => {
        Swal.fire({ title: '¿Borrar?', text: "Se perderá el registro.", icon: 'warning', showCancelButton: true }).then((r) => { if (r.isConfirmed) remove(child(ordenesRef, id)); });
    };
}

// --- LÓGICA DE GESTIÓN DE USUARIOS (UNIFICADA Y MEJORADA) ---
    
    // 1. FUNCIÓN DE UTILIDAD: Para obtener la etiqueta de estado
    function getStatusTag(status) {
        status = (status || 'activo').toLowerCase();
        switch (status) {
            case 'pausado':
                return '<span class="status-tag paused">⏸️ Pausado</span>';
            case 'baneado':
                return '<span class="status-tag banned">❌ Baneado</span>';
            case 'activo':
            default:
                return '<span class="status-tag active">✅ Activo</span>';
        }
    }

    // 2. FUNCIÓN DE UTILIDAD: Para restablecer el SELECT a "Seleccionar Acción"
    function resetUserSelect(userId) {
        const selectElement = document.querySelector(`.status-select[data-user-id="${userId}"]`);
        if (selectElement) {
            selectElement.value = "";
        }
    }
    
    // 3. FUNCIÓN PRINCIPAL DE CARGA DE USUARIOS
    window.loadUsers = function() {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando usuarios de Firebase...</td></tr>';
        
        const dbRef = ref(db);
        get(child(dbRef, 'usuarios')).then((snapshot) => {
            if (snapshot.exists()) {
                const users = snapshot.val();
                let userHtml = '';

                // Recorrer los usuarios obtenidos de Firebase
                for (const userId in users) {
                    try {
                        const user = users[userId];
                        const statusText = user.status || 'activo'; 
                        const toggleOptionText = statusText === 'pausado' ? '▶️ Reactivar' : '⏸️ Pausar';
                        
                        // LÓGICA WISHLIST: Cuenta cuántas claves hay en el nodo 'wishlist'.
                        const wishlistCount = user.wishlist ? Object.keys(user.wishlist).length : 0;
                        
                        // Generación del SELECT mejorado
                        const selectHtml = `
                            <select class="input-admin status-select action-select" data-user-id="${userId}" onchange="handleUserAction(this.value, '${userId}', '${statusText}')" style="font-weight: 500;">
                                <option value="" selected disabled>⚙️ Acción...</option>
                                <option value="toggle_status">${toggleOptionText}</option>
                                <option value="banear">❌ Banear</option>
                                <option value="eliminar" style="color: #dc3545;">🗑️ Eliminar</option>
                            </select>
                        `;

                        userHtml += `
                            <tr>
                                <td>
                                    <div style="font-size: 0.75rem; word-break: break-all;">
                                        ${userId}
                                    </div>
                                </td>
                                
                                <td>
                                    <div>
                                        <div style="font-weight: bold;">${user.nombre || 'N/D'}</div>
                                        <div style="font-size: 0.85rem; color: #a0a0a0;">RUT: ${user.rut || 'N/D'}</div>
                                    </div>
                                </td>
                                
                                <td style="font-weight: bold; color: var(--accent);">${wishlistCount} items</td>
                                
                                <td>${getStatusTag(statusText)}</td>
                                <td>
                                    ${selectHtml}
                                </td>
                            </tr>
                        `;
                    } catch (e) {
                        console.error(`ERROR al procesar usuario ${userId}:`, e);
                        userHtml += `<tr><td colspan="5" style="color:red; font-size: 0.8rem;">Error al cargar datos del usuario ${userId.substring(0, 8)}...</td></tr>`;
                    }
                }
                usersList.innerHTML = userHtml;
            } else {
                usersList.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay usuarios registrados.</td></tr>';
            }
        }).catch((error) => {
            console.error("Error al cargar usuarios de Firebase (Reglas/Conexión):", error);
            usersList.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #f87171;">Error de conexión con la base de datos o permisos.</td></tr>';
        });
    }

    // 4. FUNCIÓN QUE INTERPRETA EL SELECT Y LLAMA A LAS ACCIONES
    window.handleUserAction = function(action, userId, currentStatus) {
        if (action === 'toggle_status') {
            window.toggleUserStatus(userId, currentStatus);
        } else if (action === 'banear') {
            window.banUser(userId, currentStatus);
        } else if (action === 'eliminar') {
            window.deleteUser(userId);
        } else {
            return;
        }
    }

    // FUNCIÓN DE PAUSAR/REACTIVAR (REEMPLAZAR FUNCIÓN GLOBAL EXISTENTE)
    window.toggleUserStatus = function(userId, currentStatus) {
        let newStatus = currentStatus === 'pausado' ? 'activo' : 'pausado';
        
        Swal.fire({
            title: `Confirmar cambio de estado`,
            text: `¿Estás seguro de que deseas cambiar el estado del usuario ${userId}... a "${newStatus.toUpperCase()}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, cambiar estado'
        }).then((result) => {
            if (result.isConfirmed) {
                const userRef = ref(db, 'usuarios/' + userId);
                update(userRef, { status: newStatus })
                .then(() => {
                    Swal.fire('¡Cambiado!', `Estado actualizado a ${newStatus}.`, 'success');
                    loadUsers(); 
                })
                .catch((error) => {
                    Swal.fire('Error', `Fallo al actualizar el estado: ${error.message}`, 'error');
                    resetUserSelect(userId);
                });
            } else {
                resetUserSelect(userId);
            }
        });
    }

    // FUNCIÓN DE BANEAR (REEMPLAZAR FUNCIÓN GLOBAL EXISTENTE)
    window.banUser = function(userId, currentStatus) {
        if (currentStatus === 'baneado') {
             Swal.fire('Atención', 'Este usuario ya está baneado.', 'info');
             resetUserSelect(userId);
             return;
        }

        Swal.fire({
            title: `Confirmar baneo`,
            text: `¿Estás seguro de que quieres BANEAR permanentemente al usuario ${userId}... ?`,
            icon: 'error',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, BANEAR'
        }).then((result) => {
            if (result.isConfirmed) {
                const userRef = ref(db, 'usuarios/' + userId);
                update(userRef, { status: 'baneado' })
                .then(() => {
                    Swal.fire('¡Baneado!', `El usuario ${userId}... ha sido baneado.`, 'success');
                    loadUsers(); 
                })
                .catch((error) => {
                    Swal.fire('Error', `Fallo al banear: ${error.message}`, 'error');
                    resetUserSelect(userId);
                });
            } else {
                resetUserSelect(userId);
            }
        });
    }

    // FUNCIÓN DE ELIMINAR (REEMPLAZAR FUNCIÓN GLOBAL EXISTENTE)
    window.deleteUser = function(userId) {
        Swal.fire({
            title: `¡PELIGRO! Eliminar Cuenta`,
            text: `Esta acción ELIMINARÁ permanentemente al usuario ${userId}... y todos sus datos. ¿Estás seguro?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, ELIMINAR'
        }).then((result) => {
            if (result.isConfirmed) {
                const userRef = ref(db, 'usuarios/' + userId);
                remove(userRef)
                .then(() => {
                    Swal.fire('¡Eliminado!', `El usuario ${userId}... ha sido eliminado.`, 'success');
                    loadUsers(); 
                })
                .catch((error) => {
                    Swal.fire('Error', `Fallo al eliminar: ${error.message}`, 'error');
                    resetUserSelect(userId);
                });
            } else {
                resetUserSelect(userId);
            }
        });
    }

// LÓGICA DE TABS (REEMPLAZAR BLOQUE EXISTENTE)
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        const targetElement = document.getElementById(targetId);
        if(targetElement) {
            targetElement.classList.add('active');
        }
        
        // Llamada específica para cargar usuarios al hacer click
        if (targetId === 'tab-usuarios') {
            if (typeof window.loadUsers === 'function') {
                window.loadUsers();
            }
        }
    });
});