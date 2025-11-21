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
        // Ojo: btnEnviar sigue disabled hasta que calculen precio, controlamos eso en logic
        if(btnCalc) btnCalc.disabled = false;
    }
});

// ==============================================================
// LÓGICA DE NEGOCIO
// ==============================================================

// --- VALIDACIÓN DE INPUT DE PRECIO (NUEVO) ---
const inputPrecio = document.getElementById('precioSteam');

inputPrecio.addEventListener('input', function() {
    // 1. Si el valor empieza con 0, lo limpiamos
    if (this.value.startsWith('0')) {
        this.value = this.value.substring(1);
    }
    // 2. Si es negativo o tiene caracteres inválidos (e, +, -), limpiamos
    if (this.value < 0) {
        this.value = Math.abs(this.value);
    }
    // 3. Asegurar que no esté vacío para evitar errores visuales
    if (this.value === '') return;
});

// Validar también que no peguen textos o signos raros
inputPrecio.addEventListener('keydown', function(e) {
    // Prevenir signo menos (-) y el punto (.) si solo quieres enteros
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
            inputCodigoElem.classList.add('vip-active'); // Clase CSS dorada
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
    resultadoDiv.style.display = 'block'; // Mostrar bloque
    
    const msjComprobante = document.getElementById('mensaje-comprobante');
    if(msjComprobante) msjComprobante.style.display = 'block';

    document.getElementById('res-original').innerText = formatoDinero(precioOriginal);
    
    const resFinalElem = document.getElementById('res-final');
    resFinalElem.innerText = formatoDinero(precioFinal);
    inputPrecioFinal.value = formatoDinero(precioFinal);

    // Estilo VIP en texto
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
        btnEnviar.disabled = false; // Habilitar botón
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
// ADMIN PANEL (Simplificado para tema claro)
// ==============================================================
document.getElementById('btn-login-admin').addEventListener('click', async (e) => {
    e.preventDefault(); 
    const { value: formValues } = await Swal.fire({
        title: 'Acceso Administrativo',
        html:
            '<input id="swal-email" class="swal2-input" placeholder="Email" type="email">' +
            '<input id="swal-password" class="swal2-input" placeholder="Contraseña" type="password">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Entrar',
        preConfirm: () => {
            return [
                document.getElementById('swal-email').value,
                document.getElementById('swal-password').value
            ]
        }
    });

    if (formValues) {
        const [email, password] = formValues;
        signInWithEmailAndPassword(auth, email, password)
            .then(() => mostrarMenuAdmin())
            .catch((error) => Swal.fire('Error', 'Credenciales incorrectas', 'error'));
    }
});

async function mostrarMenuAdmin() {
    const { isConfirmed, isDenied } = await Swal.fire({
        title: 'Panel de Control',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '💰 Ajustar Saldo',
        denyButtonText: '🏪 Estado Tienda',
        cancelButtonText: 'Salir',
        confirmButtonColor: '#2563eb',
        denyButtonColor: '#475569'
    });

    if (isConfirmed) abrirGestorDeSaldo();
    else if (isDenied) gestionarEstadoTienda();
}

async function abrirGestorDeSaldo() {
    const { value: nuevoMonto } = await Swal.fire({
        title: 'Ajustar Cupo',
        text: `Actual: ${formatoDinero(presupuestoActual)}`,
        input: 'number',
        inputValue: presupuestoActual,
        showCancelButton: true,
        confirmButtonText: 'Guardar'
    });

    if (nuevoMonto) {
        set(saldoRef, parseInt(nuevoMonto))
            .then(() => Swal.fire('Actualizado', 'El cupo ha sido modificado.', 'success'));
    }
}

async function gestionarEstadoTienda() {
    const snap = await get(child(ref(db), 'estado_tienda'));
    const estadoActual = snap.exists() ? snap.val() : 'abierto';
    const nuevoEstado = estadoActual === 'abierto' ? 'cerrado' : 'abierto';

    const { isConfirmed } = await Swal.fire({
        title: `La tienda está ${estadoActual.toUpperCase()}`,
        text: `¿Deseas cambiarla a ${nuevoEstado.toUpperCase()}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cambiar estado'
    });

    if (isConfirmed) {
        await set(ref(db, 'estado_tienda'), nuevoEstado);
        Swal.fire('Listo', `Tienda ${nuevoEstado}`, 'success');
    }
}