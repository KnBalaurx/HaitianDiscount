// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, runTransaction, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// INICIALIZACIÓN
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); 
const saldoRef = ref(db, 'presupuesto');

// EMAILJS
const SERVICE_ID = 'service_jke4epd';    
const TEMPLATE_ID = 'template_0l9w69b'; 

// DOM Elements
let presupuestoActual = 0; 
const displayTope = document.getElementById('tope-dinero');
const inputPrecioFinal = document.getElementById('precioFinalInput');
const form = document.getElementById('gameForm');
const btnEnviar = document.getElementById('btnEnviar');

// Formateador Dinero
const formatoDinero = (valor) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);

// --- ACTUALIZACIÓN SALDO ---
onValue(saldoRef, (snapshot) => {
    const data = snapshot.val();
    presupuestoActual = data || 0;
    displayTope.innerText = formatoDinero(presupuestoActual);
});

// ==============================================================
// ESTADO TIENDA
// ==============================================================
const estadoRef = ref(db, 'estado_tienda');
let tiendaAbierta = true; 

onValue(estadoRef, (snapshot) => {
    const estado = snapshot.val(); 
    const btnCalc = document.querySelector('.btn-calc');
    
    if (estado === 'cerrado') {
        tiendaAbierta = false;
        btnEnviar.disabled = true;
        btnEnviar.innerText = "CERRADO TEMPORALMENTE";
        
        if(btnCalc) btnCalc.disabled = true;

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Tienda en Pausa',
            showConfirmButton: false,
            timer: 3000
        });
    } else {
        tiendaAbierta = true;
        btnEnviar.innerText = "Enviar Pedido";
        if(btnCalc) btnCalc.disabled = false;
    }
});

// ==============================================================
// LÓGICA DE NEGOCIO
// ==============================================================

// --- VALIDACIÓN DE INPUT DE PRECIO ---
const inputPrecio = document.getElementById('precioSteam');

inputPrecio.addEventListener('input', function() {
    if (this.value.startsWith('0')) {
        this.value = this.value.substring(1);
    }
    if (this.value < 0) {
        this.value = Math.abs(this.value);
    }
    if (this.value === '') return;
});

inputPrecio.addEventListener('keydown', function(e) {
    if (e.key === '-' || e.key === '.' || e.key === ',') {
        e.preventDefault();
    }
});


window.calcularDescuento = function() {
    if (!tiendaAbierta) {
        Swal.fire('Tienda Cerrada', 'Estamos reponiendo stock, vuelve pronto.', 'warning');
        return;
    }

    const precioInput = document.getElementById('precioSteam').value;
    const codigoInput = document.getElementById('codigoInvitado').value.trim(); 
    const inputCodigoElem = document.getElementById('codigoInvitado'); 

    // Reset visual
    inputCodigoElem.classList.remove('vip-active');

    if (!precioInput || precioInput <= 0) {
        Swal.fire('Faltan datos', 'Ingresa el precio del juego en Steam.', 'warning');
        return;
    }

    const precio = parseFloat(precioInput);

    // CASO 1: Sin código
    if (codigoInput === "") {
        const descuento = 0.30; 
        const precioFinal = Math.round(precio * (1 - descuento));
        mostrarResultadosUI(precio, precioFinal, false);
        return; 
    }

    // CASO 2: Con código
    Swal.fire({ title: 'Verificando...', didOpen: () => Swal.showLoading() });

    get(child(ref(db), `codigos_vip/${codigoInput}`)).then((snapshot) => {
        Swal.close();
        let descuento = 0.30;
        let esVip = false;

        if (snapshot.exists()) {
            descuento = snapshot.val(); 
            esVip = true;
            inputCodigoElem.classList.add('vip-active'); 
        } else {
            Swal.fire('Código inválido', 'Se aplicará el descuento estándar.', 'info');
        }

        const precioFinal = Math.round(precio * (1 - descuento));
        mostrarResultadosUI(precio, precioFinal, esVip, descuento);

    }).catch((error) => {
        console.error(error);
        Swal.close();
        Swal.fire('Error', 'No se pudo verificar el código.', 'error');
    });
}

function mostrarResultadosUI(precioOriginal, precioFinal, esVip, descuentoValor = 0.30) {
    const resultadoDiv = document.getElementById('resultado');
    resultadoDiv.style.display = 'block'; 
    
    const msjComprobante = document.getElementById('mensaje-comprobante');
    if(msjComprobante) msjComprobante.style.display = 'block';

    document.getElementById('res-original').innerText = formatoDinero(precioOriginal);
    
    const resFinalElem = document.getElementById('res-final');
    resFinalElem.innerText = formatoDinero(precioFinal);
    inputPrecioFinal.value = formatoDinero(precioFinal);

    if (esVip) {
        resFinalElem.classList.add('text-vip');
        const porcentaje = Math.round(descuentoValor * 100);
        Swal.fire({
            icon: 'success',
            title: '¡Código VIP Aplicado!',
            text: `Descuento mejorado al ${porcentaje}%.`,
            timer: 2000,
            showConfirmButton: false
        });
    } else {
        resFinalElem.classList.remove('text-vip');
    }

    // Validar presupuesto
    const alerta = document.getElementById('alerta-presupuesto');
    if (precioFinal > presupuestoActual) {
        alerta.classList.remove('hidden');
        btnEnviar.disabled = true;
    } else {
        alerta.classList.add('hidden');
        btnEnviar.disabled = false; 
    }
}

// --- ENVIAR PEDIDO ---
form.addEventListener('submit', function(event) {
    event.preventDefault(); 
    if (!tiendaAbierta || btnEnviar.disabled) return;

    const precioStr = document.getElementById('res-final').innerText;
    const costoJuego = parseInt(precioStr.replace(/\D/g, '')); 

    Swal.fire({ title: 'Enviando...', text: 'No cierres esta ventana', didOpen: () => Swal.showLoading() });

    runTransaction(saldoRef, (saldoActual) => {
        const actual = saldoActual || 0;
        if (actual >= costoJuego) return actual - costoJuego; 
        else return; 
    }).then((result) => {
        if (result.committed) {
            emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, this).then(() => {
                Swal.fire('¡Solicitud Enviada!', 'Revisa tu correo para los pasos finales.', 'success');
                form.reset();
                document.getElementById('resultado').style.display = 'none';
                btnEnviar.disabled = true;
            });
        } else {
            Swal.fire('Lo sentimos', 'Justo se acaba de agotar el cupo.', 'error');
        }
    }).catch((err) => {
        console.error(err);
        Swal.fire('Error', 'Problema de conexión.', 'error');
    });
});

// ==============================================================
// MODO OSCURO (LOGICA)
// ==============================================================
const btnTheme = document.getElementById('theme-toggle');
const body = document.body;

// Iconos SVG
const iconSun = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>';
const iconMoon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>';

// Cargar preferencia guardada
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
    body.classList.add('dark-mode');
    btnTheme.innerHTML = iconSun; // Mostrar sol para cambiar a claro
} else {
    btnTheme.innerHTML = iconMoon; // Mostrar luna para cambiar a oscuro
}

// Evento Click
btnTheme.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    
    // Cambiar icono y guardar
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        btnTheme.innerHTML = iconSun;
    } else {
        localStorage.setItem('theme', 'light');
        btnTheme.innerHTML = iconMoon;
    }
});