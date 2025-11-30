import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAVQm_MUEWQaf7NXzna2r4Sgbl5SeGNOyM",
    authDomain: "haitiandiscount.firebaseapp.com",
    databaseURL: "https://haitiandiscount-default-rtdb.firebaseio.com",
    projectId: "haitiandiscount",
    storageBucket: "haitiandiscount.firebasestorage.app",
    messagingSenderId: "521054591260",
    appId: "1:521054591260:web:a6b847b079d58b9e7942d9",
    measurementId: "G-EMVPQGPWTE"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const adminContent = document.getElementById('adminContent');
const vipList = document.getElementById('vipList');
const ordersList = document.getElementById('ordersList');

// 1. AUTH
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginOverlay.style.display = 'none';
        adminContent.style.display = 'block';
        iniciarListeners(); 
    } else {
        loginOverlay.style.display = 'flex';
        adminContent.style.display = 'none';
    }
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => Swal.fire('Error', 'Credenciales incorrectas', 'error'));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

// 2. DATA
function iniciarListeners() {
    
    // --- A. GESTIÓN STEAM ---
    const saldoSteamRef = ref(db, 'presupuesto_steam');
    const estadoSteamRef = ref(db, 'estado_steam');

    // 1. Presupuesto Steam
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

    // 2. Estado Steam
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

    // 1. Presupuesto Eneba
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

    // 2. Estado Eneba
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


    // --- C. CÓDIGOS VIP (COMPARTIDOS) ---
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

            listaOrdenada.forEach(([id, orden]) => {
                const fecha = new Date(orden.fecha).toLocaleString('es-CL');
                const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(orden.precio_pagado);
                
                const estado = orden.estado || 'pendiente';
                const plat = orden.plataforma || 'Steam';
                const platStyle = plat === 'Eneba' ? 'color: #a855f7; font-weight: bold; font-size: 0.8rem;' : 'color: #2563eb; font-weight: bold; font-size: 0.8rem;';
                
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
                        <td style="font-weight:bold;">${monto}</td>
                        
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

// 3. DARK MODE
const btnTheme = document.getElementById('theme-toggle');
const body = document.body;

const iconSun = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>';
const iconMoon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>';

const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
    body.classList.add('dark-mode');
    btnTheme.innerHTML = iconSun;
} else {
    btnTheme.innerHTML = iconMoon;
}

btnTheme.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        btnTheme.innerHTML = iconSun;
    } else {
        localStorage.setItem('theme', 'light');
        btnTheme.innerHTML = iconMoon;
    }
});