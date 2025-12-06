import { ref, onValue, query, orderByChild, equalTo, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// IMPORTAR CONFIGURACIÓN Y TEMA DESDE CONFIG.JS
import { db, auth, provider, initTheme } from './config.js';

// 1. INICIAR TEMA (Desde config.js)
initTheme();

// DOM Elements
const loginView = document.getElementById('loginView');
const userView = document.getElementById('userView');
const historyBody = document.getElementById('historyBody');
const noDataMsg = document.getElementById('noDataMsg');
const adminBtn = document.getElementById('adminBtn');

// Inputs Perfil
const profileNombre = document.getElementById('profileNombre');
const profileRut = document.getElementById('profileRut');
const profileSteam = document.getElementById('profileSteam');
const btnSaveData = document.getElementById('btnSaveData');

// Estado Validación RUT
let rutEsValido = false;

// Inicializar validación en el input si existe
if (profileRut) {
    configurarValidacionRut(profileRut);
}

// ADMINS
const ADMIN_UIDS = [
    'y7wKykEchQON3tS22mRhJURsHOv1', 
    'DEKH3yxMy6hCTkdbvwZl4dkFlnc2' 
];

// 2. AUTH
document.getElementById('btnGoogleLogin').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => Swal.fire('Error', err.message, 'error'));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginView.classList.add('hidden');
        userView.classList.remove('hidden');
        document.getElementById('userName').innerText = `Hola, ${user.displayName}`;
        document.getElementById('userEmail').innerText = user.email;
        
        if (ADMIN_UIDS.includes(user.uid)) {
            adminBtn.classList.remove('hidden');
        } else {
            adminBtn.classList.add('hidden');
        }

        // CARGAR DATOS
        cargarHistorial(user.uid);
        cargarDatosUsuario(user.uid);

        btnSaveData.onclick = () => guardarDatosUsuario(user.uid);

    } else {
        loginView.classList.remove('hidden');
        userView.classList.add('hidden');
    }
});

// 3. GESTIÓN DATOS
function cargarDatosUsuario(uid) {
    const userRef = ref(db, 'usuarios/' + uid);
    get(userRef).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if(profileNombre) profileNombre.value = data.nombre || '';
            
            if(profileRut) {
                profileRut.value = data.rut || '';
                // Si hay RUT guardado, disparamos validación visual
                if(profileRut.value) profileRut.dispatchEvent(new Event('input'));
            }
            
            if(profileSteam) profileSteam.value = data.steam_user || '';
        }
    });
}

function guardarDatosUsuario(uid) {
    const nombre = profileNombre.value.trim();
    const rut = profileRut.value.trim();
    const steam = profileSteam.value.trim();

    // VALIDACIÓN ANTES DE GUARDAR
    if (rut.length > 0 && !rutEsValido) {
        Swal.fire('Error', 'El RUT ingresado no es válido.', 'error');
        profileRut.focus();
        return;
    }

    set(ref(db, 'usuarios/' + uid), {
        nombre: nombre,
        rut: rut,
        steam_user: steam
    }).then(() => {
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        Toast.fire({ icon: 'success', title: 'Datos guardados correctamente' });
    }).catch(err => {
        Swal.fire('Error', 'No se pudieron guardar los datos.', 'error');
    });
}

// 4. HISTORIAL
function cargarHistorial(uid) {
    const ordenesRef = query(ref(db, 'ordenes'), orderByChild('uid'), equalTo(uid));
    
    onValue(ordenesRef, (snapshot) => {
        historyBody.innerHTML = '';
        const data = snapshot.val();

        if (!data) {
            noDataMsg.style.display = 'block';
            return;
        }
        noDataMsg.style.display = 'none';
        
        const list = Object.values(data).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        list.forEach(orden => {
            const fecha = new Date(orden.fecha).toLocaleDateString('es-CL');
            const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(orden.precio_pagado);
            const estado = orden.estado || 'pendiente';
            const plat = orden.plataforma || 'Steam';
            const platClass = plat === 'Eneba' ? 'platform-eneba' : 'platform-steam';

            const row = `
                <tr>
                    <td>${fecha}</td>
                    <td style="font-weight:600;">${orden.juego}</td>
                    <td class="${platClass}">${plat.toUpperCase()}</td>
                    <td>${monto}</td>
                    <td><span class="status-badge st-${estado}">${estado.toUpperCase()}</span></td>
                </tr>
            `;
            historyBody.innerHTML += row;
        });
    });
}

// 5. PESTAÑAS
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// 6. VALIDACIÓN RUT (Lógica Compartida)
function configurarValidacionRut(rutInput) {
    rutInput.addEventListener('input', function(e) {
        let valor = e.target.value.replace(/[^0-9kK]/g, '');
        if (valor.length > 1) {
            const cuerpo = valor.slice(0, -1);
            const dv = valor.slice(-1).toUpperCase();
            
            // Formatear
            let rutFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            e.target.value = `${rutFormateado}-${dv}`;
            
            // Validar
            if(validarRut(cuerpo, dv)) {
                rutEsValido = true;
                e.target.style.borderColor = "var(--success)"; // Verde
                e.target.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.2)";
            } else {
                rutEsValido = false;
                e.target.style.borderColor = "var(--danger)"; // Rojo
                e.target.style.boxShadow = "0 0 0 2px rgba(239, 68, 68, 0.2)";
            }
        } else {
            rutEsValido = false;
            e.target.style.borderColor = "var(--border)"; // Normal
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