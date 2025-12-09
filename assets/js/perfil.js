import { ref, onValue, query, orderByChild, equalTo, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// IMPORTAMOS configurarValidacionRut DESDE CONFIG
import { db, auth, provider, initTheme, configurarValidacionRut } from './config.js';

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

// Inicializar validación usando la función importada
if (profileRut) {
    configurarValidacionRut(profileRut, (esValido) => {
        rutEsValido = esValido;
    });
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

// 4. HISTORIAL Y ESTADÍSTICAS
function cargarHistorial(uid) {
    const ordenesRef = query(ref(db, 'ordenes'), orderByChild('uid'), equalTo(uid));
    
    onValue(ordenesRef, (snapshot) => {
        historyBody.innerHTML = '';
        const data = snapshot.val();

        // Variables para estadísticas
        let totalAhorrado = 0;
        let totalJuegos = 0; // Solo cuentan los completados

        if (!data) {
            noDataMsg.style.display = 'block';
            document.getElementById('statAhorro').innerText = '$0';
            document.getElementById('statJuegos').innerText = '0';
            document.getElementById('statRango').innerText = 'Novato';
            document.getElementById('statRango').style.color = '#94a3b8'; // Gris
            return;
        }
        noDataMsg.style.display = 'none';
        
        const list = Object.values(data).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        list.forEach(orden => {
            // Render Tabla (Código igual al anterior)
            const fecha = new Date(orden.fecha).toLocaleDateString('es-CL');
            const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(orden.precio_pagado);
            const estado = orden.estado || 'pendiente';
            const plat = orden.plataforma || 'Steam';
            const platClass = plat === 'Eneba' ? 'platform-eneba' : 'platform-steam';

            let imgHtml = '<span style="font-size:0.8rem; color:#ccc;">Sin Img</span>';
            if(orden.imagen_juego) {
                imgHtml = `<img src="${orden.imagen_juego}" class="game-thumb-profile" alt="Juego">`;
            }

            const row = `
                <tr>
                    <td>${fecha}</td>
                    <td style="padding: 5px; text-align: center;">${imgHtml}</td> 
                    <td style="font-weight:600;">${orden.juego}</td>
                    <td class="${platClass}">${plat.toUpperCase()}</td>
                    <td>${monto}</td>
                    <td><span class="status-badge st-${estado}">${estado.toUpperCase()}</span></td>
                </tr>
            `;
            historyBody.innerHTML += row;

            // --- CÁLCULO DE ESTADÍSTICAS ---
            if (estado === 'completado') {
                totalJuegos++;
                
                // Calculamos ahorro
                const original = orden.precio_steam || orden.precio_pagado; 
                const pagado = orden.precio_pagado;
                if(original > pagado) {
                    totalAhorrado += (original - pagado);
                }
            }
        });

        // 1. Actualizar números
        document.getElementById('statAhorro').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalAhorrado);
        document.getElementById('statJuegos').innerText = totalJuegos;

        // 2. LÓGICA DE RANGOS (NUEVO)
        const rangoElem = document.getElementById('statRango');
        let nombreRango = "Novato";
        let colorRango = "#94a3b8"; // Gris Slate (Default)

        if (totalJuegos >= 3) {
            nombreRango = "Cazador";
            colorRango = "#10b981"; // Verde Esmeralda
        }
        if (totalJuegos >= 10) {
            nombreRango = "Veterano";
            colorRango = "#3b82f6"; // Azul Steam
        }
        if (totalJuegos >= 20) {
            nombreRango = "Leyenda VIP";
            colorRango = "#f59e0b"; // Dorado
        }

        rangoElem.innerText = nombreRango;
        rangoElem.style.color = colorRango;
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