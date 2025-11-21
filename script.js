// 1. IMPORTS (Limpios, solo lo necesario)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, runTransaction, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==============================================================
// TU CONFIGURACIÓN FIREBASE
// ==============================================================
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

// Inicializar Apps
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); 
const saldoRef = ref(db, 'presupuesto');

// EMAILJS
const SERVICE_ID = 'service_jke4epd';    
const TEMPLATE_ID = 'template_0l9w69b'; 

// Variables DOM
let presupuestoActual = 0; 
const displayTope = document.getElementById('tope-dinero');
const inputPrecioFinal = document.getElementById('precioFinalInput');
const form = document.getElementById('gameForm');
const btnEnviar = document.getElementById('btnEnviar');

// Formateador Dinero
const formatoDinero = (valor) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);

// --- ACTUALIZACIÓN SALDO EN TIEMPO REAL ---
onValue(saldoRef, (snapshot) => {
    const data = snapshot.val();
    presupuestoActual = data || 0;
    displayTope.innerText = formatoDinero(presupuestoActual);
    displayTope.style.color = '#fff';
    setTimeout(() => displayTope.style.color = '#00ff88', 300);
});

// ==============================================================
// MODO MANTENIMIENTO (TIENDA ABIERTA/CERRADA)
// ==============================================================
const estadoRef = ref(db, 'estado_tienda');
let tiendaAbierta = true; // Por defecto asumimos abierta

onValue(estadoRef, (snapshot) => {
    const estado = snapshot.val(); // Puede ser "abierto" o "cerrado"
    const btnCalc = document.querySelector('.btn-calc');
    
    if (estado === 'cerrado') {
        tiendaAbierta = false;
        
        // Bloquear botones visualmente
        btnEnviar.disabled = true;
        btnEnviar.innerText = "⛔ TIENDA CERRADA";
        btnEnviar.classList.remove('active');
        
        if(btnCalc) {
            btnCalc.disabled = true;
            btnCalc.style.borderColor = '#555';
            btnCalc.style.color = '#555';
        }
        
        // Mostrar alerta
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'Tienda Cerrada',
            text: 'Vuelve más tarde.',
            showConfirmButton: false,
            background: '#392853',
            color: '#fff'
        });

    } else {
        tiendaAbierta = true;
        
        // Restaurar estado normal
        btnEnviar.disabled = false;
        btnEnviar.innerText = "2. ENVIAR PEDIDO";
        
        if(btnCalc) {
            btnCalc.disabled = false;
            btnCalc.style.borderColor = ''; 
            btnCalc.style.color = '';
        }
    }
});

// ==============================================================
// LÓGICA DEL FORMULARIO
// ==============================================================

// --- LÓGICA INTELIGENTE DE DESCUENTO ---
window.calcularDescuento = function() {
    // Validación de seguridad por Mantenimiento
    if (!tiendaAbierta) {
        Swal.fire('Cerrado', 'La tienda no está recibiendo pedidos ahora.', 'error');
        return;
    }

    // 1. OBTENER VARIABLES
    const precioInput = document.getElementById('precioSteam').value;
    const codigoInput = document.getElementById('codigoInvitado').value.trim(); 
    const inputCodigoElem = document.getElementById('codigoInvitado'); 

    // 2. LIMPIEZA DE ESTILOS
    inputCodigoElem.style.borderColor = ''; 
    inputCodigoElem.style.boxShadow = '';
    inputCodigoElem.style.color = ''; 

    // 3. VALIDAR PRECIO
    if (!precioInput || precioInput <= 0) {
        Swal.fire('¡Atención!', 'Ingresa el precio del juego.', 'warning');
        return;
    }

    const precio = parseFloat(precioInput);

    // CASO 1: No escribió código
    if (codigoInput === "") {
        const descuento = 0.30; 
        const precioFinal = Math.round(precio * (1 - descuento));
        mostrarResultadosUI(precio, precioFinal, false);
        return; 
    }

    // CASO 2: Escribió código
    Swal.fire({
        title: 'Verificando código...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const dbRef = ref(db);

    get(child(dbRef, `codigos_vip/${codigoInput}`)).then((snapshot) => {
        Swal.close();

        let descuento = 0.30;
        let esVip = false;

        if (snapshot.exists()) {
            descuento = snapshot.val(); 
            esVip = true;
            // Visual Dorado
            inputCodigoElem.style.borderColor = '#ffd700'; 
            inputCodigoElem.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
            inputCodigoElem.style.color = '#ffd700';
        } else {
            Swal.fire('Código no válido', 'Se aplicará el descuento normal del 30%', 'info');
            // Visual Rojo
            inputCodigoElem.style.borderColor = '#ff4444';
            inputCodigoElem.style.boxShadow = '0 0 10px rgba(255, 68, 68, 0.5)';
            inputCodigoElem.style.color = '#ff4444';
        }

        const precioFinal = Math.round(precio * (1 - descuento));
        mostrarResultadosUI(precio, precioFinal, esVip, descuento);

    }).catch((error) => {
        console.error(error);
        Swal.close();
        Swal.fire('Error', 'Error de conexión al verificar.', 'error');
    });
}

// --- FUNCIÓN VISUAL CON ANIMACIÓN ---
function mostrarResultadosUI(precioOriginal, precioFinal, esVip, descuentoValor = 0.30) {
    const resultadoDiv = document.getElementById('resultado');
    
    resultadoDiv.style.display = 'flex'; 
    
    const msjComprobante = document.getElementById('mensaje-comprobante');
    if(msjComprobante) msjComprobante.style.display = 'block';

    const animateValue = (id, start, end, duration) => {
        const obj = document.getElementById(id);
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            obj.innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerText = formatoDinero(end);
            }
        };
        window.requestAnimationFrame(step);
    };

    animateValue('res-original', 0, precioOriginal, 1000);
    animateValue('res-final', 0, precioFinal, 1500);

    inputPrecioFinal.value = formatoDinero(precioFinal);
    const resFinalElem = document.getElementById('res-final');

    if (esVip) {
        const porcentaje = Math.round(descuentoValor * 100);
        Swal.fire({
            icon: 'success',
            title: '¡Código VIP Activado! 🌟',
            text: `Descuento mejorado al ${porcentaje}%.`,
            timer: 2000,
            showConfirmButton: false
        });
        resFinalElem.style.color = '#ffd700'; 
        resFinalElem.style.textShadow = '0 0 15px rgba(255, 215, 0, 0.6)';
    } else {
        resFinalElem.style.color = '#00ff88'; 
        resFinalElem.style.textShadow = 'none';
    }

    if (precioFinal > presupuestoActual) {
        document.getElementById('alerta-presupuesto').style.display = 'block';
        btnEnviar.classList.remove('active'); 
        Swal.fire('Sin cupo', `Solo quedan ${formatoDinero(presupuestoActual)}`, 'error');
    } else {
        document.getElementById('alerta-presupuesto').style.display = 'none';
        btnEnviar.classList.add('active');
    }
}

// --- ENVIAR PEDIDO ---
form.addEventListener('submit', function(event) {
    event.preventDefault(); 
    if (!btnEnviar.classList.contains('active')) return;
    if (!tiendaAbierta) return; // Seguridad extra

    const precioStr = document.getElementById('res-final').innerText;
    const costoJuego = parseInt(precioStr.replace(/\D/g, '')); 

    Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

    runTransaction(saldoRef, (saldoActual) => {
        const actual = saldoActual || 0;
        if (actual >= costoJuego) return actual - costoJuego; 
        else return; 
    }).then((result) => {
        if (result.committed) {
            // (Aquí eliminé la parte que guardaba el historial)

            emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, this).then(() => {
                Swal.fire('¡Éxito!', 'Pedido enviado.', 'success');
                form.reset();
                document.getElementById('resultado').style.display = 'none';
                
                const msjComp = document.getElementById('mensaje-comprobante');
                if(msjComp) msjComp.style.display = 'none';
                
                btnEnviar.classList.remove('active');
            });
        } else {
            Swal.fire('Error', 'Se agotó el cupo mientras comprabas.', 'error');
        }
    }).catch((err) => {
        console.error(err);
        Swal.fire('Error', 'Error de conexión.', 'error');
    });
});

// ==============================================================
// PANEL DE ADMINISTRADOR
// ==============================================================
document.getElementById('btn-login-admin').addEventListener('click', async (e) => {
    e.preventDefault(); 
    const { value: formValues } = await Swal.fire({
        title: 'Acceso Administrador',
        html:
            '<label class="swal-custom-label">Usuario (Email)</label>' +
            '<input id="swal-email" class="swal2-input" placeholder="ejemplo@correo.com" type="email">' +
            '<label class="swal-custom-label">Contraseña</label>' +
            '<input id="swal-password" class="swal2-input" placeholder="••••••••" type="password">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Ingresar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return [
                document.getElementById('swal-email').value,
                document.getElementById('swal-password').value
            ]
        }
    });

    if (formValues) {
        const [email, password] = formValues;
        Swal.fire({ title: 'Verificando...', didOpen: () => Swal.showLoading() });

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                mostrarMenuAdmin();
            })
            .catch((error) => {
                Swal.fire('Error', 'Datos incorrectos: ' + error.code, 'error');
            });
    }
});

// Menú Principal Admin (DISEÑO GRID Y SIN EMOJIS)
async function mostrarMenuAdmin() {
    const { isConfirmed, isDenied } = await Swal.fire({
        title: 'Panel de Control',
        text: 'Selecciona una acción',
        showDenyButton: true,
        showCancelButton: true,
        
        // TEXTOS LIMPIOS
        confirmButtonText: 'Gestionar Saldo',
        denyButtonText: 'Estado Tienda',
        cancelButtonText: 'Salir',
        
        confirmButtonColor: '#a044ff',
        denyButtonColor: '#392853',
        allowOutsideClick: false,

        // ESTO ACTIVA EL GRID SOLO AQUÍ
        customClass: {
            popup: 'popup-menu-grid' 
        }
    });

    if (isConfirmed) {
        abrirGestorDeSaldo();
    } else if (isDenied) {
        gestionarEstadoTienda();
    }
}

// Función Saldo (SIN EMOJIS Y CON LABEL BONITO)
async function abrirGestorDeSaldo() {
    const { value: nuevoMonto } = await Swal.fire({
        title: 'Gestión de Caja',
        html: `
            <div style="margin-bottom: 20px">Saldo actual: <span style="color:#00ff88; font-weight:bold">${formatoDinero(presupuestoActual)}</span></div>
            <label class="swal-custom-label">NUEVO MONTO TOPE</label>
            <input id="swal-input1" class="swal2-input" type="number" placeholder="${presupuestoActual}">
        `,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return document.getElementById('swal-input1').value;
        }
    });

    if (nuevoMonto) {
        set(saldoRef, parseInt(nuevoMonto))
            .then(() => Swal.fire('Éxito', 'Saldo actualizado correctamente', 'success'))
            .catch((error) => Swal.fire('Error', 'Fallo de conexión', 'error'));
    }
}

// Interruptor Tienda (SIN EMOJIS Y BOTONES LIMPIOS)
async function gestionarEstadoTienda() {
    try {
        const snap = await get(child(ref(db), 'estado_tienda'));
        const estadoActual = snap.exists() ? snap.val() : 'abierto';

        const { isConfirmed } = await Swal.fire({
            title: 'Estado de la Tienda',
            text: `Estado actual: ${estadoActual.toUpperCase()}`,
            icon: estadoActual === 'abierto' ? 'success' : 'warning',
            
            showCancelButton: true,
            confirmButtonText: estadoActual === 'abierto' ? 'Cerrar Tienda' : 'Abrir Tienda',
            cancelButtonText: 'Cancelar',
            
            confirmButtonColor: estadoActual === 'abierto' ? '#d33' : '#3085d6',
            didOpen: () => Swal.hideLoading() 
        });

        if (isConfirmed) {
            const nuevoEstado = estadoActual === 'abierto' ? 'cerrado' : 'abierto';
            Swal.fire({ title: 'Actualizando...', didOpen: () => Swal.showLoading() });
            await set(ref(db, 'estado_tienda'), nuevoEstado);
            Swal.fire('Actualizado', `Tienda ${nuevoEstado}`, 'success');
        }

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo leer el estado', 'error');
    }
}