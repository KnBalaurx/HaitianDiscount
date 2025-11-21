/* CONFIGURACIÓN INICIAL */
let presupuestoActual = 5000; 

// TUS KEYS DE EMAILJS
const SERVICE_ID = 'service_jke4epd';   
const TEMPLATE_ID = 'template_0l9w69b'; 

// Referencias
const displayTope = document.getElementById('tope-dinero');
const inputPrecioFinal = document.getElementById('precioFinalInput');
const form = document.getElementById('gameForm');
const btnEnviar = document.getElementById('btnEnviar');

// Formatear dinero
const formatoDinero = (valor) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
};

// Cargar presupuesto al inicio
document.addEventListener('DOMContentLoaded', () => {
    displayTope.innerText = formatoDinero(presupuestoActual);
});

// 1. CALCULAR DESCUENTO
function calcularDescuento() {
    const precioInput = document.getElementById('precioSteam').value;
    const resultadoDiv = document.getElementById('resultado');
    const alerta = document.getElementById('alerta-presupuesto');

    // Alerta si no hay precio
    if (!precioInput || precioInput <= 0) {
        Swal.fire({
            icon: 'warning',
            title: '¡Falta el precio!',
            text: 'Por favor ingresa cuánto cuesta el juego en Steam.',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const precio = parseFloat(precioInput);
    const descuento = 0.30; 
    const precioFinal = Math.round(precio * (1 - descuento));

    resultadoDiv.style.display = 'block';
    document.getElementById('res-original').innerText = formatoDinero(precio);
    document.getElementById('res-final').innerText = formatoDinero(precioFinal);
    
    inputPrecioFinal.value = formatoDinero(precioFinal);

    // Validar presupuesto
    if (precioFinal > presupuestoActual) {
        alerta.style.display = 'block';
        btnEnviar.classList.remove('active'); 
        
        // Alerta de presupuesto excedido
        Swal.fire({
            icon: 'error',
            title: 'Presupuesto Excedido',
            text: 'Lo siento, el valor del juego supera mi tope disponible por hoy 😔.',
            confirmButtonText: 'Ok, intentaré otro día'
        });
    } else {
        alerta.style.display = 'none';
        btnEnviar.classList.add('active');
    }
}

// 2. ENVIAR FORMULARIO
form.addEventListener('submit', function(event) {
    event.preventDefault(); 

    // Validación extra
    if (!btnEnviar.classList.contains('active')) {
        Swal.fire({
            icon: 'info',
            title: 'Calcula primero',
            text: 'Debes calcular el descuento antes de enviar el pedido.',
            confirmButtonText: '¡Ah, verdad!'
        });
        return;
    }

    // Mostrar alerta de "Cargando..."
    Swal.fire({
        title: 'Enviando pedido...',
        html: 'Por favor espera un momento.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // Enviar con EmailJS
    emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, this)
        .then(() => {
            // Éxito
            Swal.fire({
                icon: 'success',
                title: '¡Pedido Enviado!',
                text: 'Revisa tu correo (y spam) para la confirmación. Te contactaré pronto.',
                confirmButtonText: '¡Genial!'
            });

            btnEnviar.innerText = '2. Enviar Pedido';
            form.reset(); 
            document.getElementById('resultado').style.display = 'none';
            btnEnviar.classList.remove('active');
        }, (error) => {
            // Error
            Swal.fire({
                icon: 'error',
                title: 'Error al enviar',
                text: 'Algo falló. Por favor contáctame por Instagram.',
                footer: 'Código de error: ' + JSON.stringify(error)
            });
        });
});
