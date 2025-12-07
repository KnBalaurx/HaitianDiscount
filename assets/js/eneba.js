import { ref, onValue, runTransaction, get, child, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// IMPORTAMOS TODO DESDE CONFIG
import { db, auth, initTheme, initImageZoom } from './config.js';

// Iniciar Tema y Zoom
initTheme();
initImageZoom();

const saldoRef = ref(db, 'presupuesto_eneba');
const estadoRef = ref(db, 'estado_eneba');

const SERVICE_ID = 'service_jke4epd';    
const TEMPLATE_ID = 'template_0l9w69b'; 

let presupuestoActual = 0; 
const displayTope = document.getElementById('tope-dinero');
const inputPrecioFinal = document.getElementById('precioFinalInput');
const form = document.getElementById('gameForm');
const btnEnviar = document.getElementById('btnEnviar');
const btnCalc = document.querySelector('.btn-calc'); 
const inputComprobante = document.getElementById('comprobanteInput');
const inputRut = document.getElementById('rut');

let rutEsValido = false;

if(btnCalc) { btnCalc.addEventListener('click', calcularDescuento); }
if(inputRut) { configurarValidacionRut(inputRut); }

const formatoDinero = (valor) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);

onValue(saldoRef, (snapshot) => {
    const data = snapshot.val();
    presupuestoActual = data || 0;
    displayTope.innerText = formatoDinero(presupuestoActual);
});

let tiendaAbierta = true; 
onValue(estadoRef, (snap) => {
    const estado = snap.val(); 
    if (estado === 'cerrado') {
        tiendaAbierta = false;
        btnEnviar.disabled = true;
        btnEnviar.innerText = "CERRADO TEMPORALMENTE";
        if(btnCalc) btnCalc.disabled = true;
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Tienda Eneba en Pausa', showConfirmButton: false, timer: 3000 });
    } else {
        tiendaAbierta = true;
        btnEnviar.innerText = "Enviar Pedido Eneba";
        if(btnCalc) btnCalc.disabled = false;
    }
});

const inputPrecio = document.getElementById('precioSteam');
if(inputPrecio) {
    inputPrecio.addEventListener('input', function() {
        if (this.value.startsWith('0') && this.value.length > 1) this.value = this.value.substring(1);
        if (this.value < 0) this.value = Math.abs(this.value);
    });
}

function calcularDescuento() {
    if (!tiendaAbierta) return;
    const precioInput = document.getElementById('precioSteam').value;
    const codigoInput = document.getElementById('codigoInvitado').value.trim().toUpperCase(); 
    const inputCodigoElem = document.getElementById('codigoInvitado'); 
    inputCodigoElem.classList.remove('vip-active');

    if (!precioInput || precioInput <= 0) {
        Swal.fire('Faltan datos', 'Ingresa el precio de Eneba.', 'warning');
        return;
    }
    const precio = parseFloat(precioInput);
    const DESCUENTO_BASE = 0.30; 

    if (codigoInput === "") {
        const precioFinal = Math.round(precio * (1 - DESCUENTO_BASE));
        mostrarResultadosUI(precio, precioFinal, false);
        return; 
    }
    Swal.fire({ title: 'Verificando...', didOpen: () => Swal.showLoading() });
    get(child(ref(db), `codigos_vip/${codigoInput}`)).then((snapshot) => {
        Swal.close();
        let descuento = DESCUENTO_BASE;
        let esVip = false;
        if (snapshot.exists()) {
            descuento = snapshot.val(); 
            esVip = true;
            inputCodigoElem.classList.add('vip-active'); 
        } else {
            Swal.fire('Código inválido', 'Se aplicará dcto estándar.', 'info');
        }
        const precioFinal = Math.round(precio * (1 - descuento));
        mostrarResultadosUI(precio, precioFinal, esVip, descuento);
    }).catch(() => {
        Swal.close();
        Swal.fire('Error', 'No se pudo verificar código.', 'error');
    });
}

function mostrarResultadosUI(precioOriginal, precioFinal, esVip, descuentoValor = 0.30) {
    const resultadoDiv = document.getElementById('resultado');
    resultadoDiv.style.display = 'block'; 
    const msjComprobante = document.getElementById('mensaje-comprobante');
    if(msjComprobante) msjComprobante.style.display = 'none';

    document.getElementById('res-original').innerText = formatoDinero(precioOriginal);
    const ahorro = precioOriginal - precioFinal;
    document.getElementById('res-ahorro').innerText = formatoDinero(ahorro);

    const resFinalElem = document.getElementById('res-final');
    resFinalElem.innerText = formatoDinero(precioFinal);
    inputPrecioFinal.value = formatoDinero(precioFinal);

    if (esVip) {
        resFinalElem.classList.add('text-vip');
        Swal.fire({ icon: 'success', title: '¡Código VIP!', text: `Descuento: ${Math.round(descuentoValor * 100)}%`, timer: 1500, showConfirmButton: false });
    } else {
        resFinalElem.classList.remove('text-vip');
    }

    const alerta = document.getElementById('alerta-presupuesto');
    if (precioFinal > presupuestoActual) {
        alerta.classList.remove('hidden');
        btnEnviar.disabled = true;
    } else {
        alerta.classList.add('hidden');
        btnEnviar.disabled = false; 
    }
}

function comprimirImagen(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 800; 
                const scaleSize = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6); 
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

function configurarValidacionRut(rutInput) {
    rutInput.addEventListener('input', function(e) {
        let valor = e.target.value.replace(/[^0-9kK]/g, '');
        if (valor.length > 1) {
            const cuerpo = valor.slice(0, -1);
            const dv = valor.slice(-1).toUpperCase();
            let rutFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            e.target.value = `${rutFormateado}-${dv}`;
            if(validarRut(cuerpo, dv)) {
                rutEsValido = true;
                e.target.style.borderColor = "var(--success)";
                e.target.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.2)";
            } else {
                rutEsValido = false;
                e.target.style.borderColor = "var(--danger)";
                e.target.style.boxShadow = "0 0 0 2px rgba(239, 68, 68, 0.2)";
            }
        } else {
            rutEsValido = false;
            e.target.style.borderColor = "var(--border)";
            e.target.style.boxShadow = "none";
        }
    });
}

function validarRut(cuerpo, dv) {
    if(cuerpo.length < 6) return false;
    let suma = 0;
    let multiplo = 2;
    for(let i = 1; i <= cuerpo.length; i++) {
        const index = multiplo * valorAt(cuerpo.length - i);
        suma = suma + index;
        if(multiplo < 7) { multiplo = multiplo + 1; } else { multiplo = 2; }
    }
    const dvEsperado = 11 - (suma % 11);
    const dvCalc = (dvEsperado == 11) ? "0" : ((dvEsperado == 10) ? "K" : dvEsperado.toString());
    return dvCalc === dv;
    function valorAt(pos) { return parseInt(cuerpo.charAt(pos)); }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        const emailInput = document.getElementById('email');
        if (emailInput && !emailInput.value) emailInput.value = user.email;

        const userRef = ref(db, 'usuarios/' + user.uid);
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                const nombreInput = document.getElementById('nombre');
                if (nombreInput && data.nombre) nombreInput.value = data.nombre;

                const rutInput = document.getElementById('rut');
                if (rutInput && data.rut) {
                    rutInput.value = data.rut;
                    rutInput.dispatchEvent(new Event('input')); 
                }

                const steamInput = document.getElementById('steam_user');
                if (steamInput && data.steam_user) steamInput.value = data.steam_user;
                
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                Toast.fire({ icon: 'info', title: 'Datos cargados de tu perfil' });
            }
        });
    }
});

form.addEventListener('submit', async function(event) {
    event.preventDefault(); 
    if (!tiendaAbierta || btnEnviar.disabled) return;

    if (!rutEsValido) {
        Swal.fire('RUT Inválido', 'Por favor ingresa un RUT chileno válido.', 'error');
        inputRut.focus();
        return;
    }

    if (!inputComprobante.files || inputComprobante.files.length === 0) {
        Swal.fire('Falta el Comprobante', 'Por favor adjunta la captura de la transferencia.', 'warning');
        return;
    }

    // --- SEGURIDAD AGREGADA: VERIFICACIÓN FINAL DE MONTOS ---
    const precioOriginalStr = document.getElementById('res-original').innerText;
    const costoOriginal = parseInt(precioOriginalStr.replace(/\D/g, '')); 
    const precioClienteStr = document.getElementById('res-final').innerText;
    const costoCliente = parseInt(precioClienteStr.replace(/\D/g, ''));

    // Validación anti-hack simple
    if (costoOriginal <= 100 || costoCliente <= 0) {
        Swal.fire('Error de Datos', 'Los montos no son válidos. Recarga e intenta de nuevo.', 'error');
        return;
    }
    // --------------------------------------------------------

    Swal.fire({ title: 'Procesando...', text: 'Subiendo comprobante...', didOpen: () => Swal.showLoading() });

    try {
        const comprobanteBase64 = await comprimirImagen(inputComprobante.files[0]);

        runTransaction(saldoRef, (saldoActual) => {
            const actual = saldoActual || 0;
            if (actual >= costoOriginal) return actual - costoOriginal; 
            else return; 
        }).then((result) => {
            if (result.committed) {
                const user = auth.currentUser; 

                const nuevaOrdenRef = push(ref(db, 'ordenes'));
                set(nuevaOrdenRef, {
                    fecha: new Date().toISOString(),
                    email: form.email.value,
                    rut: form.rut.value, 
                    juego: form.juego.value,
                    precio_pagado: costoCliente,
                    precio_steam: costoOriginal, 
                    estado: 'pendiente',
                    plataforma: 'Eneba',
                    comprobante_img: comprobanteBase64,
                    uid: user ? user.uid : null 
                });

                emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form).then(() => {
                    Swal.fire('¡Pedido Eneba Recibido!', 'Hemos recibido tu comprobante y pedido.', 'success');
                    form.reset();
                    rutEsValido = false; 
                    inputRut.style.borderColor = "var(--border)";
                    inputRut.style.boxShadow = "none";

                    document.getElementById('resultado').style.display = 'none';
                    btnEnviar.disabled = true;
                });
            } else {
                Swal.fire('Lo sentimos', 'Cupo de Eneba agotado.', 'error');
            }
        });
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Error al procesar la imagen o el pedido.', 'error');
    }
});