/* ARCHIVO: public/assets/js/storeLogic.js */
import { ref, onValue, runTransaction, get, child, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth, initTheme, initImageZoom, comprimirImagen, configurarValidacionRut, EMAIL_CONFIG, initEmailService } from './config.js';

// Inicializamos cosas visuales globales y el servicio de Email
initTheme();
initImageZoom();
initEmailService();

/* --- FUNCIÓN AUXILIAR: CONFETI --- */
function lanzarConfeti() {
    if (!window.confetti) return;
    var end = Date.now() + (2 * 1000);
    var colors = ['#2563eb', '#a855f7', '#ffffff'];

    (function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

/* --- PORTAPAPELES INTELIGENTE --- */
window.copiarDato = (texto, btnElement) => {
    navigator.clipboard.writeText(texto).then(() => {
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado`;
        btnElement.classList.add('copied');
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => {
            btnElement.innerHTML = originalHTML;
            btnElement.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar:', err);
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Error al copiar', showConfirmButton: false, timer: 2000 });
    });
};

/* --- LÓGICA PRINCIPAL DE LA TIENDA --- */
export function initStorePage(config) {
    const { platformName, budgetRefString, statusRefString } = config;

    const saldoRef = ref(db, budgetRefString);
    const estadoRef = ref(db, statusRefString);
    const SERVICE_ID = EMAIL_CONFIG.SERVICE_ID;
    const TEMPLATE_ID = EMAIL_CONFIG.TEMPLATE_ORDER;

    let presupuestoActual = 0;
    const displayTope = document.getElementById('tope-dinero');
    const inputPrecioFinal = document.getElementById('precioFinalInput');
    const form = document.getElementById('gameForm');
    const btnEnviar = document.getElementById('btnEnviar');
    const btnCalc = document.querySelector('.btn-calc');
    const inputComprobante = document.getElementById('comprobanteInput');
    const inputRut = document.getElementById('rut');
    const inputPrecio = document.getElementById('precioSteam');

    let rutEsValido = false;

    // --- INICIALIZAR EL WIZARD ---
    initWizard();

    // --- LISTENERS BÁSICOS ---
    if(btnCalc) { btnCalc.addEventListener('click', calcularDescuento); }
    if(inputRut) { 
        configurarValidacionRut(inputRut, (estado) => { rutEsValido = estado; });
    }

    // --- NUEVO: FORMATEO DE MONEDA EN TIEMPO REAL ---
    if(inputPrecio) {
        inputPrecio.addEventListener('input', function(e) {
            // 1. Eliminar cualquier caracter que no sea número
            let valorLimpio = this.value.replace(/\D/g, '');

            // 2. Si está vacío, limpiar y salir
            if (valorLimpio === '') {
                this.value = '';
                return;
            }

            // 3. Convertir a número entero
            const numero = parseInt(valorLimpio, 10);

            // 4. Formatear con separadores de miles (CLP)
            // Usamos 'es-CL' para que use puntos como separador
            const valorFormateado = new Intl.NumberFormat('es-CL').format(numero);

            // 5. Asignar de nuevo al input con el signo $
            this.value = '$' + valorFormateado;
        });
    }

    const formatoDinero = (valor) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);

    // --- FIREBASE LISTENERS ---
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

    // --- AUTH ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const emailInput = document.getElementById('email');
            if (emailInput && !emailInput.value) emailInput.value = user.email;
            get(ref(db, 'usuarios/' + user.uid)).then((snapshot) => {
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
                }
            });
        }
    });

    // --- CÁLCULO (ACTUALIZADO PARA LEER FORMATO MONEDA) ---
    function calcularDescuento() {
        if (!tiendaAbierta) return;
        
        // 1. OBTENER VALOR LIMPIO (Quitar $ y puntos)
        const valorRaw = inputPrecio.value.replace(/\D/g, ''); 
        
        const codigoInput = document.getElementById('codigoInvitado').value.trim().toUpperCase(); 
        const inputCodigoElem = document.getElementById('codigoInvitado'); 
        inputCodigoElem.classList.remove('vip-active');

        if (!valorRaw || parseInt(valorRaw) <= 0) {
            Swal.fire('Faltan datos', `Ingresa el precio de ${platformName}.`, 'warning');
            return;
        }

        const precio = parseInt(valorRaw, 10); // Usamos el valor limpio
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

    // --- SUBMIT ---
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

            const precioOriginalStr = document.getElementById('res-original').innerText;
            const costoOriginal = parseInt(precioOriginalStr.replace(/\D/g, '')); 
            const precioClienteStr = document.getElementById('res-final').innerText;
            const costoCliente = parseInt(precioClienteStr.replace(/\D/g, ''));

            Swal.fire({ title: 'Procesando Pedido', html: 'Iniciando sistema...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const updateStatus = (texto) => { if(Swal.getHtmlContainer()) Swal.getHtmlContainer().textContent = texto; };

            try {
                updateStatus('1/4 Optimizando imagen...');
                const comprobanteBase64 = await comprimirImagen(inputComprobante.files[0]);

                updateStatus('2/4 Verificando cupo...');
                runTransaction(saldoRef, (saldoActual) => {
                    const actual = saldoActual || 0;
                    if (actual >= costoOriginal) return actual - costoOriginal; 
                    else return; 
                }).then((result) => {
                    if (result.committed) {
                        updateStatus('3/4 Guardando tu pedido...');
                        const user = auth.currentUser; 
                        const coverImgSrc = document.getElementById('gameCover')?.src || '';

                        const nuevaOrdenRef = push(ref(db, 'ordenes'));
                        set(nuevaOrdenRef, {
                            fecha: new Date().toISOString(),
                            email: form.email.value,
                            rut: form.rut.value, 
                            juego: form.juego.value,
                            precio_pagado: costoCliente,
                            precio_steam: costoOriginal, 
                            estado: 'pendiente',
                            plataforma: platformName, 
                            comprobante_img: comprobanteBase64,
                            imagen_juego: coverImgSrc,
                            uid: user ? user.uid : null 
                        });

                        updateStatus('4/4 Enviando confirmación...');
                        emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form).then(() => {
                            lanzarConfeti();
                            Swal.fire({ icon: 'success', title: '¡Pedido Recibido!', text: 'Hemos recibido tu comprobante y pedido.', confirmButtonText: 'Entendido' });
                            form.reset();
                            rutEsValido = false; 
                            if(inputRut) { inputRut.style.borderColor = "var(--border)"; inputRut.style.boxShadow = "none"; }
                            
                            const previewContainer = document.getElementById('previewContainer');
                            if(previewContainer) previewContainer.style.display = 'none';
                            const previewComp = document.getElementById('previewComprobanteContainer');
                            if(previewComp) previewComp.innerHTML = '';
                            document.getElementById('resultado').style.display = 'none';
                            
                            // Resetear Wizard
                            window.showStep(1);
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

/* --- LÓGICA DEL WIZARD (REUTILIZABLE) --- */
function initWizard() {
    let currentStep = 1;
    window.showStep = (stepNumber) => {
        document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.step-indicator').forEach(el => el.classList.remove('active'));
        
        const stepToShow = document.getElementById(`step-${stepNumber}`);
        if(stepToShow) stepToShow.classList.add('active');

        for(let i = 1; i <= stepNumber; i++) {
            const ind = document.querySelector(`.step-indicator[data-step="${i}"]`);
            if(ind) ind.classList.add('active');
        }
        currentStep = stepNumber;
    };
    window.nextStep = (targetStep) => {
        // Validaciones Paso 1
        if (currentStep === 1 && targetStep === 2) {
            const precio = document.getElementById('res-final').innerText;
            const inputJuego = document.getElementById('juego').value;
            // Verifica si el resultado está visible (calculado)
            if (precio === '$0' || document.getElementById('resultado').style.display === 'none') {
                Swal.fire('¡Espera!', 'Primero debes calcular el precio.', 'warning');
                return;
            }
            if (!inputJuego) {
                Swal.fire('Falta el nombre', 'Ingresa el nombre del juego.', 'warning');
                return;
            }
        }
        // Validaciones Paso 2
        if (currentStep === 2 && targetStep === 3) {
            const email = document.getElementById('email').value;
            const nombre = document.getElementById('nombre').value;
            const rut = document.getElementById('rut').value;
            if (!email || !nombre || !rut) {
                Swal.fire('Faltan datos', 'Completa tus datos personales.', 'warning');
                return;
            }
        }
        window.showStep(targetStep);
    };
    window.prevStep = (targetStep) => {
        window.showStep(targetStep);
    };
    // Preview de Comprobante (Paso 3)
    const fileInput = document.getElementById('comprobanteInput');
    if(fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const container = document.getElementById('previewComprobanteContainer');
            if(container) container.innerHTML = ''; 
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    const img = document.createElement('img');
                    img.src = evt.target.result;
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '150px';
                    img.style.borderRadius = '8px';
                    img.style.border = '1px solid var(--border)';
                    img.style.marginTop = '10px';
                    if(container) container.appendChild(img);
                    
                    const btnEnviar = document.getElementById('btnEnviar');
                    if(btnEnviar) btnEnviar.disabled = false;
                }
                reader.readAsDataURL(file);
            }
        });
    }
}