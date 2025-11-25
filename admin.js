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
const budgetDisplay = document.getElementById('budgetDisplay');
const statusDisplay = document.getElementById('statusDisplay');
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
    
    // A. PRESUPUESTO
    const saldoRef = ref(db, 'presupuesto');
    onValue(saldoRef, (snap) => {
        const valor = snap.val() || 0;
        budgetDisplay.innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
    });

    document.getElementById('btnUpdateBudget').addEventListener('click', () => {
        const inputVal = document.getElementById('newBudget').value;
        const nuevoMonto = parseInt(inputVal);
        if(inputVal !== "" && nuevoMonto >= 0) {
            set(saldoRef, nuevoMonto).then(() => Swal.fire('Actualizado', 'Nuevo cupo definido', 'success'));
            document.getElementById('newBudget').value = '';
        }
    });

    // B. ESTADO TIENDA
    const estadoRef = ref(db, 'estado_tienda');
    let estadoActual = '';
    onValue(estadoRef, (snap) => {
        estadoActual = snap.val() || 'abierto';
        statusDisplay.innerHTML = estadoActual === 'abierto' 
            ? '<span class="status-badge status-open">ABIERTA ONLINE</span>' 
            : '<span class="status-badge status-closed">CERRADA TEMPORALMENTE</span>';
    });

    document.getElementById('btnToggleTienda').addEventListener('click', () => {
        const nuevo = estadoActual === 'abierto' ? 'cerrado' : 'abierto';
        set(estadoRef, nuevo);
    });

    // C. CÓDIGOS VIP
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

    // D. HISTORIAL PEDIDOS (CON ESTADOS)
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
                
                // Definir estado actual para el select
                const estado = orden.estado || 'pendiente';
                
                const fila = `
                    <tr>
                        <td style="font-size: 0.8rem; color: #64748b;">${fecha}</td>
                        <td>
                            <div style="font-weight:600;">${orden.email}</div>
                            <div style="font-size:0.75rem; color:#64748b;">RUT: ${orden.rut || 'N/A'}</div>
                        </td>
                        <td style="color: var(--accent); font-weight:500;">${orden.juego}</td>
                        <td style="font-weight:bold;">${monto}</td>
                        
                        <td>
                            <select 
                                onchange="cambiarEstado('${id}', this.value)" 
                                class="status-select status-${estado}"
                            >
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

    // Función para actualizar estado en Firebase
    window.cambiarEstado = (id, nuevoEstado) => {
        const ordenRef = child(ordenesRef, id);
        update(ordenRef, { estado: nuevoEstado })
            .then(() => {
                // Feedback visual sutil (Toast)
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                Toast.fire({ icon: 'success', title: 'Estado actualizado' });
            })
            .catch((error) => {
                Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            });
    };

    window.borrarOrden = (id) => {
        Swal.fire({ title: '¿Borrar registro?', text: "Esto borrará el historial.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, borrar' }).then((r) => {
            if (r.isConfirmed) remove(child(ordenesRef, id));
        });
    };
}