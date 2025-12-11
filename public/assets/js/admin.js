/* ARCHIVO: assets/js/admin.js */
import { ref, onValue, set, update, remove, child, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// IMPORTAMOS LA CONFIGURACIÓN CENTRALIZADA
import { db, auth, provider, initTheme, EMAIL_CONFIG, initEmailService } from './config.js';

initTheme();
// INICIALIZAR EMAILJS
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

// --- FUNCIÓN DE ENVÍO DE CORREO (EMAILJS + LINKS DINÁMICOS) ---
async function sendSurveyEmail(orderId, customerEmail, gameTitle) {
    if (typeof emailjs === 'undefined') {
        Swal.fire('Error', 'EmailJS no está cargado.', 'error');
        return false;
    }

    // 1. DETECCIÓN AUTOMÁTICA DE DOMINIO
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const productionHost = "https://haitiandiscount.web.app";
    const baseUrl = isLocal 
        ? `http://${window.location.host}/public/pages/encuesta.html` 
        : `${productionHost}/pages/encuesta.html`;
        
    console.log("Generando links de encuesta para:", baseUrl);

    // 2. CONSTRUCCIÓN DE PARÁMETROS PARA LA PLANTILLA
    const templateParams = {
        to_email: customerEmail,       // Destinatario
        game_title: gameTitle,         // {{game_title}}
        order_id: orderId,             // {{order_id}}
        current_year: new Date().getFullYear(), // {{current_year}}
        
        // 3. GENERACIÓN DE LINKS DE ESTRELLAS
        link_rating_5: `${baseUrl}?order=${orderId}&rating=5`, // {{link_rating_5}}
        link_rating_3: `${baseUrl}?order=${orderId}&rating=3`, // {{link_rating_3}}
        link_rating_1: `${baseUrl}?order=${orderId}&rating=1`  // {{link_rating_1}}
    };

    try {
        // USAMOS CONFIG CENTRALIZADA
        const response = await emailjs.send(
            EMAIL_CONFIG.SERVICE_ID, 
            EMAIL_CONFIG.TEMPLATE_SURVEY, 
            templateParams
        );

        if (response.status === 200) {
            Swal.fire('¡Enviado!', `Correo de finalización enviado a ${customerEmail}.`, 'success');
            return true;
        } else {
            Swal.fire('Error', `Estado de envío: ${response.status}`, 'error');
            return false;
        }
    } catch (error) {
        console.error("Fallo EmailJS:", error);
        Swal.fire('Error de API', 'No se pudo enviar el correo. Revisa la consola.', 'error');
        return false;
    }
}


// 2. DATA LISTENERS
function iniciarListeners() {
    
    // --- GESTIÓN TIENDA (STEAM/ENEBA) ---
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

    // --- PEDIDOS (TABLA Y GRÁFICOS) ---
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
            
            let btnComprobante = '<span style="color:#ccc; font-size:0.7rem;">Sin foto</span>';
            if(orden.comprobante_img) {
                window.imagenesComprobantes[orden.id] = orden.comprobante_img;
                btnComprobante = `<button class="btn btn-sm" style="background:transparent; border:1px solid #64748b; color:#64748b; padding:2px 6px; font-size:0.7rem; margin-top:4px;" onclick="verComprobante('${orden.id}')">📷 Ver Foto</button>`;
            }

            const fila = `
                <tr>
                    <td style="font-size: 0.8rem; color: #64748b;">${fecha}</td>
                    <td>
                        <div style="font-weight:600; font-size:0.9rem;">${orden.email}</div>
                        <div style="font-size:0.75rem; color:#64748b;">RUT: ${orden.rut || 'N/A'}</div>
                    </td>
                    <td>
                        <div style="${platStyle} font-weight: bold; font-size: 0.75rem; margin-bottom:2px;">${plat.toUpperCase()}</div>
                        <div style="font-weight:500; font-size:0.9rem;">${orden.juego}</div>
                    </td>
                    <td><div style="font-weight:bold; font-size:0.95rem;">${monto}</div>${btnComprobante}</td>
                    <td>
                        <select onchange="cambiarEstado('${orden.id}', this.value)" class="status-select status-${estado}">
                            <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="completado" ${estado === 'completado' ? 'selected' : ''}>✅ Completado</option>
                            <option value="cancelado" ${estado === 'cancelado' ? 'selected' : ''}>🚫 Cancelado</option>
                        </select>
                    </td>
                    <td><button class="btn btn-danger btn-sm" onclick="borrarOrden('${orden.id}')">X</button></td>
                </tr>`;
            ordersList.innerHTML += fila;
        });
    }

    searchInput.addEventListener('input', renderizarTabla);
    filterStatus.addEventListener('change', renderizarTabla);

    // --- LÓGICA DE GRÁFICOS Y KPIs ---
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
        // 1. Gráfico Ventas Semanales
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
                data: {
                    labels: etiquetasDias,
                    datasets: [{
                        label: 'Ventas (CLP)',
                        data: ventasPorDia,
                        backgroundColor: '#2563eb',
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        // 2. Gráfico Plataformas
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
                data: {
                    labels: ['Steam', 'Eneba'],
                    datasets: [{
                        data: [steamCount, enebaCount],
                        backgroundColor: ['#2563eb', '#a855f7'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }
    
    // Funciones Globales
    window.verComprobante = (id) => {
        Swal.fire({ title: 'Comprobante', imageUrl: window.imagenesComprobantes[id], imageAlt: 'Comprobante', showCloseButton: true });
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
            // --- LÓGICA DE REEMBOLSO ---
            if (nuevoEstado === 'cancelado' && estadoOriginal !== 'cancelado') {
                let presupuestoRefStr = plataforma === 'Steam' ? 'presupuesto_steam' : 'presupuesto_eneba';
                if (costoOriginal > 0) {
                    const budgetRef = ref(db, presupuestoRefStr);
                    await runTransaction(budgetRef, (cupo) => (cupo || 0) + costoOriginal);
                    Swal.fire({ icon: 'info', title: 'Cupo Reembolsado', text: `$${costoOriginal} a ${plataforma}`, timer: 1500, showConfirmButton: false });
                }
            }
            
            // --- LÓGICA DE COMPLETADO + EMAIL ---
            if (nuevoEstado === 'completado' && estadoOriginal !== 'completado') {
                const result = await Swal.fire({
                    title: 'Confirmar Pedido',
                    text: `El pedido pasará a COMPLETADO y se enviará la encuesta a ${orden.email}. ¿Continuar?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, Completar y Enviar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#10b981'
                });
                if (result.isConfirmed) {
                    Swal.fire({ title: 'Enviando correo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    // Intentar enviar el correo
                    const emailSent = await sendSurveyEmail(id, orden.email, orden.juego);
                    if (emailSent) {
                        // Si se envió bien, actualizar DB
                        await update(ordenRef, { 
                            estado: nuevoEstado, 
                            fecha_completado: new Date().toISOString() 
                        });
                        Toast.fire({ icon: 'success', title: 'Pedido completado y correo enviado' });
                    } else {
                        // Si falló el correo, revertir visualmente y avisar
                        document.querySelector(`[onchange="cambiarEstado('${id}', this.value)"]`).value = estadoOriginal;
                        Swal.fire('Error', 'No se pudo enviar el correo. El estado NO se ha cambiado en la base de datos.', 'error');
                        return;
                    }
                } else {
                    // Cancelado por el usuario en el modal
                    document.querySelector(`[onchange="cambiarEstado('${id}', this.value)"]`).value = estadoOriginal;
                    return;
                }
            } else {
                // Otros cambios de estado (ej: a Pendiente o Cancelado)
                await update(ordenRef, { 
                    estado: nuevoEstado, 
                    fecha_completado: (nuevoEstado === 'completado' ? orden.fecha_completado || null : null) 
                });
                Toast.fire({ icon: 'success', title: 'Estado actualizado' });
            }

        } catch (error) { 
            console.error(error);
            Toast.fire({ icon: 'error', title: 'Error interno' });
        }
    };
    window.borrarOrden = (id) => {
        Swal.fire({ title: '¿Borrar?', text: "Se perderá el registro.", icon: 'warning', showCancelButton: true }).then((r) => { if (r.isConfirmed) remove(child(ordenesRef, id)); });
    };
}

// TABS LOGIC
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });
});