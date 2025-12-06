import { ref, onValue, set, update, remove, child, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// IMPORTAMOS TODO DESDE CONFIG.JS
import { db, auth, provider, initTheme } from './config.js';

// INICIAR TEMA
initTheme();

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const adminContent = document.getElementById('adminContent');
const vipList = document.getElementById('vipList');
const ordersList = document.getElementById('ordersList');
const loaderView = document.getElementById('loaderView');
const loginCard = document.getElementById('loginCard');

// 1. AUTH CON VERIFICACIÓN DE ROL EN DB
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Verificar si es admin consultando la DB (Más seguro que hardcoded)
        const adminRef = ref(db, `admins/${user.uid}`);
        
        try {
            const snapshot = await get(adminRef);
            if (snapshot.exists() && snapshot.val() === true) {
                // Es admin verificado
                loginOverlay.style.display = 'none';
                adminContent.style.display = 'block';
                iniciarListeners(); 
            } else {
                throw new Error("No admin");
            }
        } catch (e) {
            // No es admin o error
            Swal.fire({
                icon: 'error',
                title: 'Acceso Denegado',
                text: 'No tienes permisos de administrador.',
                allowOutsideClick: false
            }).then(() => {
                signOut(auth).then(() => window.location.href = "../index.html");
            });
        }
    } else {
        // No hay usuario
        loginOverlay.style.display = 'flex';
        adminContent.style.display = 'none';
        loaderView.style.display = 'none'; 
        loginCard.style.display = 'block'; 
    }
});

// --- LOGIN CON GOOGLE ---
document.getElementById('btnGoogleAdmin').addEventListener('click', () => {
    loginCard.style.display = 'none';
    loaderView.style.display = 'block';
    
    signInWithPopup(auth, provider).catch((error) => {
        loaderView.style.display = 'none';
        loginCard.style.display = 'block';
        Swal.fire('Error', error.message, 'error');
    });
});

// LOGIN CON CORREO
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    loginCard.style.display = 'none';
    loaderView.style.display = 'block';

    signInWithEmailAndPassword(auth, email, pass)
        .catch(err => {
            loaderView.style.display = 'none';
            loginCard.style.display = 'block';
            Swal.fire('Error', 'Credenciales incorrectas', 'error');
        });
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

// 2. DATA LISTENERS
function iniciarListeners() {
    
    // --- A. GESTIÓN STEAM ---
    const saldoSteamRef = ref(db, 'presupuesto_steam');
    const estadoSteamRef = ref(db, 'estado_steam');

    onValue(saldoSteamRef, (snap) => {
        const valor = snap.val() || 0;
        document.getElementById('budgetSteamDisplay').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
    });
    document.getElementById('btnUpdateBudgetSteam').addEventListener('click', () => {
        const inputVal = document.getElementById('newBudgetSteam').value;
        const nuevoMonto = parseInt(inputVal);
        if(inputVal !== "" && nuevoMonto >= 0) {
            set(saldoSteamRef, nuevoMonto).then(() => Swal.fire('Steam', 'Cupo actualizado', 'success'));
            document.getElementById('newBudgetSteam').value = '';
        }
    });

    let estadoActualSteam = '';
    onValue(estadoSteamRef, (snap) => {
        estadoActualSteam = snap.val() || 'abierto';
        document.getElementById('statusSteamDisplay').innerHTML = estadoActualSteam === 'abierto' 
            ? '<span class="status-badge status-open">ABIERTA ONLINE</span>' 
            : '<span class="status-badge status-closed">CERRADA TEMPORALMENTE</span>';
    });
    document.getElementById('btnToggleSteam').addEventListener('click', () => {
        const nuevo = estadoActualSteam === 'abierto' ? 'cerrado' : 'abierto';
        set(estadoSteamRef, nuevo);
    });


    // --- B. GESTIÓN ENEBA ---
    const saldoEnebaRef = ref(db, 'presupuesto_eneba');
    const estadoEnebaRef = ref(db, 'estado_eneba');

    onValue(saldoEnebaRef, (snap) => {
        const valor = snap.val() || 0;
        document.getElementById('budgetEnebaDisplay').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
    });
    document.getElementById('btnUpdateBudgetEneba').addEventListener('click', () => {
        const inputVal = document.getElementById('newBudgetEneba').value;
        const nuevoMonto = parseInt(inputVal);
        if(inputVal !== "" && nuevoMonto >= 0) {
            set(saldoEnebaRef, nuevoMonto).then(() => Swal.fire('Eneba', 'Cupo actualizado', 'success'));
            document.getElementById('newBudgetEneba').value = '';
        }
    });

    let estadoActualEneba = '';
    onValue(estadoEnebaRef, (snap) => {
        estadoActualEneba = snap.val() || 'abierto';
        document.getElementById('statusEnebaDisplay').innerHTML = estadoActualEneba === 'abierto' 
            ? '<span class="status-badge status-open">ABIERTA ONLINE</span>' 
            : '<span class="status-badge status-closed">CERRADA TEMPORALMENTE</span>';
    });
    document.getElementById('btnToggleEneba').addEventListener('click', () => {
        const nuevo = estadoActualEneba === 'abierto' ? 'cerrado' : 'abierto';
        set(estadoEnebaRef, nuevo);
    });


    // --- C. CÓDIGOS VIP ---
    const vipRef = ref(db, 'codigos_vip');
    onValue(vipRef, (snap) => {
        vipList.innerHTML = ''; 
        const codigos = snap.val();
        if(codigos) {
            Object.keys(codigos).forEach(key => {
                const descuento = codigos[key];
                vipList.innerHTML += `
                    <tr>
                        <td><strong>${key}</strong></td>
                        <td>${Math.round(descuento * 100)}%</td>
                        <td><button class="btn btn-danger btn-sm" onclick="borrarCodigo('${key}')">Eliminar</button></td>
                    </tr>`;
            });
        } else {
            vipList.innerHTML = '<tr><td colspan="3" style="text-align:center;">No hay códigos</td></tr>';
        }
    });

    document.getElementById('btnAddVip').addEventListener('click', () => {
        const code = document.getElementById('vipCodeName').value.trim().toUpperCase();
        const discount = parseFloat(document.getElementById('vipDiscount').value);
        if(code && discount > 0 && discount < 1) {
            set(child(vipRef, code), discount).then(() => {
                Swal.fire({ icon: 'success', title: 'Creado', text: `Código ${code}`, timer: 1500, showConfirmButton: false });
                document.getElementById('vipCodeName').value = '';
                document.getElementById('vipDiscount').value = '';
            });
        } else {
            Swal.fire('Error', 'Datos inválidos', 'warning');
        }
    });

    window.borrarCodigo = (key) => {
        Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí' }).then((r) => {
            if (r.isConfirmed) remove(child(vipRef, key));
        });
    };

    // --- D. HISTORIAL PEDIDOS ---
    const ordenesRef = ref(db, 'ordenes');
    onValue(ordenesRef, (snap) => {
        ordersList.innerHTML = '';
        const data = snap.val();
        
        if (data) {
            const listaOrdenada = Object.entries(data).sort((a, b) => {
                return new Date(b[1].fecha) - new Date(a[1].fecha);
            });

            window.imagenesComprobantes = {};

            listaOrdenada.forEach(([id, orden]) => {
                const fecha = new Date(orden.fecha).toLocaleString('es-CL');
                const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(orden.precio_pagado);
                
                const estado = orden.estado || 'pendiente';
                const plat = orden.plataforma || 'Steam';
                const platStyle = plat === 'Eneba' ? 'color: #a855f7; font-weight: bold; font-size: 0.8rem;' : 'color: #2563eb; font-weight: bold; font-size: 0.8rem;';
                
                let btnComprobante = '<span style="color:#ccc; font-size:0.8rem;">Sin foto</span>';
                if(orden.comprobante_img) {
                    window.imagenesComprobantes[id] = orden.comprobante_img;
                    btnComprobante = `<button class="btn btn-sm" style="background:#64748b; color:white;" onclick="verComprobante('${id}')">📷 Ver</button>`;
                }

                const fila = `
                    <tr>
                        <td style="font-size: 0.8rem; color: #64748b;">${fecha}</td>
                        <td>
                            <div style="font-weight:600;">${orden.email}</div>
                            <div style="font-size:0.75rem; color:#64748b;">RUT: ${orden.rut || 'N/A'}</div>
                        </td>
                        <td>
                            <div style="${platStyle}">${plat.toUpperCase()}</div>
                            <div style="font-weight:500;">${orden.juego}</div>
                        </td>
                        <td style="font-weight:bold;">${monto} <br> ${btnComprobante}</td>
                        
                        <td>
                            <select onchange="cambiarEstado('${id}', this.value)" class="status-select status-${estado}">
                                <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                                <option value="completado" ${estado === 'completado' ? 'selected' : ''}>✅ Completado</option>
                                <option value="cancelado" ${estado === 'cancelado' ? 'selected' : ''}>🚫 Cancelado</option>
                            </select>
                        </td>

                        <td>
                            <button class="btn btn-danger btn-sm" onclick="borrarOrden('${id}')">X</button>
                        </td>
                    </tr>
                `;
                ordersList.innerHTML += fila;
            });
        } else {
            ordersList.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay ventas registradas</td></tr>';
        }
    });

    window.verComprobante = (id) => {
        const imgData = window.imagenesComprobantes[id];
        if(imgData) {
            Swal.fire({
                title: 'Comprobante',
                imageUrl: imgData,
                imageAlt: 'Comprobante de pago',
                showCloseButton: true,
                confirmButtonText: 'Cerrar'
            });
        }
    };

    window.cambiarEstado = (id, nuevoEstado) => {
        update(child(ordenesRef, id), { estado: nuevoEstado })
            .then(() => {
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                Toast.fire({ icon: 'success', title: 'Estado actualizado' });
            });
    };

    window.borrarOrden = (id) => {
        Swal.fire({ title: '¿Borrar?', text: "Se perderá el registro.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Borrar' }).then((r) => {
            if (r.isConfirmed) remove(child(ordenesRef, id));
        });
    };
}