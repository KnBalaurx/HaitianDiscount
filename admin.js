import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// CONFIGURACIÓN FIREBASE
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

// ELEMENTOS DOM
const loginOverlay = document.getElementById('login-overlay');
const adminContent = document.getElementById('adminContent');
const budgetDisplay = document.getElementById('budgetDisplay');
const statusDisplay = document.getElementById('statusDisplay');
const vipList = document.getElementById('vipList');

// 1. SISTEMA DE LOGIN
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginOverlay.style.display = 'none';
        adminContent.style.display = 'block';
        iniciarListeners(); // Cargar datos solo si es admin
    } else {
        loginOverlay.style.display = 'flex';
        adminContent.style.display = 'none';
    }
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    signInWithEmailAndPassword(auth, email, pass)
        .catch(err => Swal.fire('Error', 'Credenciales incorrectas', 'error'));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.reload();
    });
});

// 2. FUNCIÓN PRINCIPAL DE DATOS
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
        if(estadoActual === 'abierto') {
            statusDisplay.innerHTML = '<span class="status-badge status-open">ABIERTA ONLINE</span>';
        } else {
            statusDisplay.innerHTML = '<span class="status-badge status-closed">CERRADA TEMPORALMENTE</span>';
        }
    });

    document.getElementById('btnToggleTienda').addEventListener('click', () => {
        const nuevo = estadoActual === 'abierto' ? 'cerrado' : 'abierto';
        set(estadoRef, nuevo);
    });

    // C. CÓDIGOS VIP (Lectura y Escritura)
    const vipRef = ref(db, 'codigos_vip');
    
    // Lectura en tiempo real
    onValue(vipRef, (snap) => {
        vipList.innerHTML = ''; // Limpiar tabla
        const codigos = snap.val();
        
        if(codigos) {
            Object.keys(codigos).forEach(key => {
                const descuento = codigos[key];
                const fila = `
                    <tr>
                        <td><strong>${key}</strong></td>
                        <td>${Math.round(descuento * 100)}%</td>
                        <td>
                            <button class="btn btn-danger btn-sm" onclick="borrarCodigo('${key}')">Eliminar</button>
                        </td>
                    </tr>
                `;
                vipList.innerHTML += fila;
            });
        } else {
            vipList.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">No hay códigos activos</td></tr>';
        }
    });

    // Crear Código VIP
    document.getElementById('btnAddVip').addEventListener('click', () => {
        const codeInput = document.getElementById('vipCodeName');
        const discInput = document.getElementById('vipDiscount');
        
        const code = codeInput.value.trim().toUpperCase();
        const discount = parseFloat(discInput.value);

        if(code && discount > 0 && discount < 1) {
            set(child(vipRef, code), discount)
                .then(() => {
                    Swal.fire({
                        icon: 'success',
                        title: 'Creado',
                        text: `Código ${code} activo con ${Math.round(discount*100)}%`,
                        timer: 1500,
                        showConfirmButton: false
                    });
                    codeInput.value = '';
                    discInput.value = '';
                })
                .catch((err) => Swal.fire('Error', err.message, 'error'));
        } else {
            Swal.fire('Datos inválidos', 'El código no puede estar vacío y el descuento debe ser decimal (Ej: 0.30 para 30%)', 'warning');
        }
    });

    // IMPORTANTE: Exponer función de borrado al contexto global (window)
    // porque el onclick del HTML no ve las funciones dentro del módulo.
    window.borrarCodigo = (key) => {
        Swal.fire({
            title: '¿Eliminar código?',
            text: `Se borrará el cupón "${key}"`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, borrar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                remove(child(vipRef, key));
            }
        });
    };
}