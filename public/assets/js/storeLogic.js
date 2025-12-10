/* ARCHIVO: assets/js/storeLogic.js */
import { ref, onValue, runTransaction, get, child, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth, initTheme, initImageZoom, comprimirImagen, configurarValidacionRut } from './config.js';

// Inicializamos cosas visuales globales
initTheme();
initImageZoom();

/* --- FUNCIÓN AUXILIAR: CONFETI --- */
function lanzarConfeti() {
    // Verificamos si la librería cargó correctamente
    if (!window.confetti) return;

    // Duración de la animación: 2 segundos
    var end = Date.now() + (2 * 1000);

    // Colores: Azul (Steam), Morado (Eneba), Blanco
    var colors = ['#2563eb', '#a855f7', '#ffffff'];

    (function frame() {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 }, // Desde la izquierda
            colors: colors
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 }, // Desde la derecha
            colors: colors
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

/* --- LÓGICA PRINCIPAL DE LA TIENDA --- */
export function initStorePage(config) {
    const { 
        platformName,       // "Steam" o "Eneba"
        budgetRefString,    // "presupuesto_steam" o "presupuesto_eneba"
        statusRefString     // "estado_steam" o "estado_eneba"
    } = config;

    const saldoRef = ref(db, budgetRefString);
    const estadoRef = ref(db, statusRefString);

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
    const inputPrecio = document.getElementById('precioSteam'); // Nota: Tu HTML de Eneba usa este mismo ID

    let rutEsValido = false;

    // --- 1. LISTENERS BÁSICOS ---
    if(btnCalc) { btnCalc.addEventListener('click', calcularDescuento); }

    if(inputRut) { 
        configurarValidacionRut(inputRut, (estado) => {
            rutEsValido = estado;
        });
    }

    if(inputPrecio) {
        inputPrecio.addEventListener('input', function() {
            if (this.value.startsWith('0') && this.value.length > 1) this.value = this.value.substring(1);
            if (this.value < 0) this.value = Math.abs(this.value);
        });
    }

    const formatoDinero = (valor) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);

    // --- 2. FIREBASE LISTENERS (PRESUPUESTO Y ESTADO) ---
    onValue(saldoRef, (snapshot) => {
        const data = snapshot.val();
        presupuestoActual = data || 0;
        if(displayTope) displayTope.innerText = formatoDinero(presupuestoActual);
    });

    let tiendaAbierta = true; 
    onValue(estadoRef, (snapshot) => {
        const estado = snapshot.val(); 
        if (estado === 'cerrado') {
            tiendaAbierta = false;
            if(btnEnviar) {
                btnEnviar.disabled = true;
                btnEnviar.innerText = "CERRADO TEMPORALMENTE";
            }
            if(btnCalc) btnCalc.disabled = true;
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `Tienda ${platformName} en Pausa`, showConfirmButton: false, timer: 3000 });
        } else {
            tiendaAbierta = true;
            if(btnEnviar) btnEnviar.innerText = `Enviar Pedido ${platformName}`;
            if(btnCalc) btnCalc.disabled = false;
        }
    });

    // --- 3. LOGICA DE AUTH (AUTOCOMPLETAR) ---
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

    // --- 4. CÁLCULO DE DESCUENTO ---
    function calcularDescuento() {
        if (!tiendaAbierta) return;
        const precioVal = inputPrecio.value;
        const codigoInput = document.getElementById('codigoInvitado').value.trim().toUpperCase(); 
        const inputCodigoElem = document.getElementById('codigoInvitado'); 
        inputCodigoElem.classList.remove('vip-active');

        if (!precioVal || precioVal <= 0) {
            Swal.fire('Faltan datos', `Ingresa el precio de ${platformName}.`, 'warning');
            return;
        }
        const precio = parseFloat(precioVal);
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
        if(inputPrecioFinal) inputPrecioFinal.value = formatoDinero(precioFinal);

        if (esVip) {
            resFinalElem.classList.add('text-vip');
            Swal.fire({ icon: 'success', title: '¡Código VIP!', text: `Descuento: ${Math.round(descuentoValor * 100)}%`, timer: 1500, showConfirmButton: false });
        } else {
            resFinalElem.classList.remove('text-vip');
        }

        const alerta = document.getElementById('alerta-presupuesto');
        if (precioFinal > presupuestoActual) {
            if(alerta) alerta.classList.remove('hidden');
            btnEnviar.disabled = true;
        } else {
            if(alerta) alerta.classList.add('hidden');
            btnEnviar.disabled = false; 
        }
    }

    // --- 5. SUBMIT DEL FORMULARIO ---
    if(form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault(); 
            if (!tiendaAbierta || btnEnviar.disabled) return;

            if (!rutEsValido) {
                Swal.fire('RUT Inválido', 'Por favor ingresa un RUT chileno válido.', 'error');
                if(inputRut) inputRut.focus();
                return;
            }

            if (!inputComprobante.files || inputComprobante.files.length === 0) {
                Swal.fire('Falta el Comprobante', 'Por favor adjunta la captura de la transferencia.', 'warning');
                return;
            }

            // Validar montos de UI para seguridad básica
            const precioOriginalStr = document.getElementById('res-original').innerText;
            const costoOriginal = parseInt(precioOriginalStr.replace(/\D/g, '')); 
            const precioClienteStr = document.getElementById('res-final').innerText;
            const costoCliente = parseInt(precioClienteStr.replace(/\D/g, ''));

            if (costoOriginal <= 100 || costoCliente <= 0) {
                Swal.fire('Error de Datos', 'Los montos no son válidos. Recarga e intenta de nuevo.', 'error');
                return;
            }

            Swal.fire({ 
                title: 'Procesando Pedido', 
                html: 'Iniciando sistema...', 
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading() 
            });

            const updateStatus = (texto) => {
                if(Swal.getHtmlContainer()) Swal.getHtmlContainer().textContent = texto;
            };

            try {
                // 1. IMAGEN
                updateStatus('1/4 Optimizando imagen...');
                const comprobanteBase64 = await comprimirImagen(inputComprobante.files[0]);

                // 2. VERIFICACIÓN CUPO
                updateStatus('2/4 Verificando cupo disponible...');
                
                runTransaction(saldoRef, (saldoActual) => {
                    const actual = saldoActual || 0;
                    if (actual >= costoOriginal) return actual - costoOriginal; 
                    else return; 
                }).then((result) => {
                    if (result.committed) {
                        // 3. GUARDAR DB
                        updateStatus('3/4 Guardando tu pedido...');
                        const user = auth.currentUser; 
                        const coverImgSrc = document.getElementById('gameCover')?.src || ''; // Solo si existe (Steam)

                        const nuevaOrdenRef = push(ref(db, 'ordenes'));
                        set(nuevaOrdenRef, {
                            fecha: new Date().toISOString(),
                            email: form.email.value,
                            rut: form.rut.value, 
                            juego: form.juego.value,
                            precio_pagado: costoCliente,
                            precio_steam: costoOriginal, // Se guarda como precio_steam por compatibilidad legacy
                            estado: 'pendiente',
                            plataforma: platformName, // "Steam" o "Eneba"
                            comprobante_img: comprobanteBase64,
                            imagen_juego: coverImgSrc,
                            uid: user ? user.uid : null 
                        });

                        // 4. EMAIL
                        updateStatus('4/4 Enviando confirmación...');
                        emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form).then(() => {
                            
                            // === ÉXITO: DISPARAR CONFETI Y ALERTA ===
                            lanzarConfeti();

                            Swal.fire({
                                icon: 'success',
                                title: '¡Pedido Recibido!',
                                text: 'Hemos recibido tu comprobante y pedido. Te contactaremos pronto.',
                                confirmButtonText: 'Entendido',
                                confirmButtonColor: platformName === 'Steam' ? '#2563eb' : '#a855f7'
                            });

                            // LIMPIEZA
                            form.reset();
                            rutEsValido = false; 
                            if(inputRut) {
                                inputRut.style.borderColor = "var(--border)";
                                inputRut.style.boxShadow = "none";
                            }
                            
                            const previewContainer = document.getElementById('previewContainer');
                            if(previewContainer) previewContainer.style.display = 'none';
                            
                            document.getElementById('resultado').style.display = 'none';
                            btnEnviar.disabled = true;
                        });
                    } else {
                        Swal.fire('Lo sentimos', `Cupo de ${platformName} agotado en este instante.`, 'error');
                    }
                });
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'Ocurrió un error al procesar la solicitud.', 'error');
            }
        });
    }
}