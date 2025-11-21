// 1. IMPORTS
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

// --- LÓGICA INTELIGENTE DE DESCUENTO (CORREGIDA) ---
window.calcularDescuento = function() {
    const precioInput = document.getElementById('precioSteam').value;
    const codigoInput = document.getElementById('codigoInvitado').value.trim(); 

    if (!precioInput || precioInput <= 0) {
        Swal.fire('¡Atención!', 'Ingresa el precio del juego.', 'warning');
        return;
    }

    const precio = parseFloat(precioInput);

    // === CORRECCIÓN AQUÍ ===
    // Si NO escribió ningún código, calculamos normal y salimos.
    if (codigoInput === "") {
        const descuento = 0.30; 
        const precioFinal = Math.round(precio * (1 - descuento));
        
        // Mostrar resultados
        mostrarResultadosUI(precio, precioFinal, false); // false = no es VIP
        return; // Detenemos la función aquí para no molestar a Firebase
    }

    // Si SÍ escribió algo, verificamos en la base de datos
    Swal.fire({
        title: 'Verificando código...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const dbRef = ref(db);

    // Buscamos el código específico
    get(child(dbRef, `codigos_vip/${codigoInput}`)).then((snapshot) => {
        Swal.close();

        let descuento = 0.30;
        let esVip = false;

        if (snapshot.exists()) {
            descuento = snapshot.val(); // Toma el valor real (ej: 0.35)
            esVip = true;
        } else {
            Swal.fire('Código no válido', 'Se aplicará el descuento normal del 30%', 'info');
        }

        const precioFinal = Math.round(precio * (1 - descuento));
        
        // Mostrar resultados y alerta VIP si corresponde
        mostrarResultadosUI(precio, precioFinal, esVip, descuento);

    }).catch((error) => {
        console.error(error);
        Swal.close();
        Swal.fire('Error', 'Error de conexión al verificar.', 'error');
    });
}

// Función auxiliar para no repetir código visual
function mostrarResultadosUI(precioOriginal, precioFinal, esVip, descuentoValor = 0.30) {
    document.getElementById('resultado').style.display = 'block';
    document.getElementById('res-original').innerText = formatoDinero(precioOriginal);
    document.getElementById('res-final').innerText = formatoDinero(precioFinal);
    inputPrecioFinal.value = formatoDinero(precioFinal);

    if (esVip) {
        const porcentaje = Math.round(descuentoValor * 100);
        Swal.fire({
            icon: 'success',
            title: '¡Código Amigo Encontrado!',
            text: `Se ha aplicado un ${porcentaje}% de descuento.`,
            timer: 2000,
            showConfirmButton: false
        });
        document.getElementById('res-final').style.color = '#ffd700'; // Dorado
    } else {
        document.getElementById('res-final').style.color = '#00ff88'; // Verde normal
    }

    // Validar presupuesto
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

    const precioStr = document.getElementById('res-final').innerText;
    const costoJuego = parseInt(precioStr.replace(/\D/g, '')); 

    Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

    runTransaction(saldoRef, (saldoActual) => {
        const actual = saldoActual || 0;
        if (actual >= costoJuego) return actual - costoJuego; 
        else return; 
    }).then((result) => {
        if (result.committed) {
            emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, this).then(() => {
                Swal.fire('¡Éxito!', 'Pedido enviado.', 'success');
                form.reset();
                document.getElementById('resultado').style.display = 'none';
                btnEnviar.classList.remove('active');
            });
        } else {
            Swal.fire('Error', 'Se agotó el cupo mientras comprabas.', 'error');
        }
    }).catch((err) => {
        Swal.fire('Error', 'Error de conexión.', 'error');
    });
});

// --- ADMIN (MODALES) ---
document.getElementById('btn-login-admin').addEventListener('click', async (e) => {
    e.preventDefault(); 
    const { value: formValues } = await Swal.fire({
        title: 'Acceso Administrador',
        html:
            '<input id="swal-email" class="swal2-input" placeholder="Correo electrónico">' +
            '<input id="swal-password" type="password" class="swal2-input" placeholder="Contraseña">',
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
                abrirGestorDeSaldo();
            })
            .catch((error) => {
                Swal.fire('Error', 'Datos incorrectos: ' + error.code, 'error');
            });
    }
});

async function abrirGestorDeSaldo() {
    const { value: nuevoMonto } = await Swal.fire({
        title: 'Gestión de Caja',
        html: `Saldo actual disponible: <br> <h2 style="color:#00ff88">${formatoDinero(presupuestoActual)}</h2>`,
        input: 'number',
        inputLabel: 'Ingresa el nuevo monto tope:',
        inputValue: presupuestoActual,
        showCancelButton: true,
        confirmButtonText: 'Actualizar Saldo'
    });

    if (nuevoMonto) {
        set(saldoRef, parseInt(nuevoMonto))
            .then(() => {
                Swal.fire({ icon: 'success', title: 'Actualizado', text: `Nuevo saldo: ${formatoDinero(nuevoMonto)}` });
            })
            .catch((error) => {
                Swal.fire('Error', 'No tienes permisos o falló la conexión', 'error');
            });
    }
}