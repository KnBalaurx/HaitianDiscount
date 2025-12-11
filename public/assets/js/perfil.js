/* ARCHIVO: assets/js/perfil.js */
import { ref, onValue, query, orderByChild, equalTo, get, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth, provider, initTheme, configurarValidacionRut } from './config.js';

initTheme();
// --- DOM Elements ---
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

let rutEsValido = false;

if (profileRut) {
    configurarValidacionRut(profileRut, (esValido) => {
        rutEsValido = esValido;
    });
}

// --- 1. AUTHENTICATION ---
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
        
        document.getElementById('userName').innerText = user.displayName || 'Usuario';
        document.getElementById('userEmail').innerText = user.email;
        
        const avatarImg = document.getElementById('userAvatar');
        if(user.photoURL && avatarImg) {
            avatarImg.src = user.photoURL;
        }

        const adminCheckRef = ref(db, `admins/${user.uid}`);
        get(adminCheckRef).then((snapshot) => {
            if (snapshot.exists() && snapshot.val() === true) {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }).catch((error) => {
            console.error("Error verificando admin:", error);
            adminBtn.classList.add('hidden');
        });

        cargarHistorial(user.uid);
        cargarDatosUsuario(user.uid);
        cargarWishlist(user.uid);
        btnSaveData.onclick = () => guardarDatosUsuario(user.uid);

    } else {
        loginView.classList.remove('hidden');
        userView.classList.add('hidden');
    }
});

// --- 2. GESTIÓN DATOS USUARIO ---
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

// --- 3. HISTORIAL (PRO STYLE & GROUPING) ---
function cargarHistorial(uid) {
    const ordenesRef = query(ref(db, 'ordenes'), orderByChild('uid'), equalTo(uid));
    onValue(ordenesRef, (snapshot) => {
        historyBody.innerHTML = '';
        const data = snapshot.val();

        let totalAhorrado = 0;
        let totalJuegos = 0;

        const avatarContainer = document.querySelector('.profile-avatar-container');
        if(avatarContainer) {
            avatarContainer.classList.remove('avatar-novato', 'avatar-cazador', 'avatar-veterano', 'avatar-leyenda');
        }

        if (!data) {
            noDataMsg.style.display = 'block';
            actualizarUIStats(0, 0, 'Novato', '#94a3b8', 'avatar-novato', 3);
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

            let imgHtml = '<span style="font-size:0.8rem; color:#ccc;">Sin Img</span>';
            if(orden.imagen_juego) {
                imgHtml = `<img src="${orden.imagen_juego}" class="game-thumb-profile" alt="Juego">`;
            }

            const showKey = (plat === 'Eneba' && estado === 'completado' && orden.game_key);
            // Esta clase es clave para quitar el borde de separación interna
            const rowClass = showKey ? 'has-key-below' : '';

            // Fila Principal
            const row = `
                <tr class="${rowClass}">
                    <td>${fecha}</td>
                    <td style="padding: 5px; text-align: center;">${imgHtml}</td> 
                    <td style="font-weight:600;">${orden.juego}</td>
                    <td class="${platClass}">${plat.toUpperCase()}</td>
                    <td>${monto}</td>
                    <td><span class="status-badge st-${estado}">${estado.toUpperCase()}</span></td>
                </tr>
            `;
            historyBody.innerHTML += row;

            // --- SECCIÓN KEY ENEBA ---
            if (showKey) {
                const keyRow = `
                    <tr class="key-row-container">
                        <td colspan="6">
                            <div class="key-box">
                                <span class="key-label">Licencia:</span>
                                <div class="key-code" id="key-${orden.id}">${orden.game_key}</div>
                                <button class="btn-copy" onclick="copiarKey('${orden.game_key}')">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    Copiar
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                historyBody.innerHTML += keyRow;
            }

            if (estado === 'completado') {
                totalJuegos++;
                const original = orden.precio_steam || orden.precio_pagado; 
                const pagado = orden.precio_pagado;
                if(original > pagado) {
                    totalAhorrado += (original - pagado);
                }
            }
        });

        // RANGOS
        let nombreRango = "Novato";
        let colorRango = "#94a3b8"; 
        let claseAvatar = "avatar-novato";
        let nextGoal = 3;

        if (totalJuegos < 3) {
            nombreRango = "Novato";
            colorRango = "#94a3b8";
            claseAvatar = "avatar-novato";
            nextGoal = 3;
        } else if (totalJuegos < 10) {
            nombreRango = "Cazador";
            colorRango = "#10b981";
            claseAvatar = "avatar-cazador";
            nextGoal = 10;
        } else if (totalJuegos < 20) {
            nombreRango = "Veterano";
            colorRango = "#3b82f6";
            claseAvatar = "avatar-veterano";
            nextGoal = 20;
        } else {
            nombreRango = "Leyenda VIP";
            colorRango = "#f59e0b";
            claseAvatar = "avatar-leyenda";
            nextGoal = 0;
        }

        actualizarUIStats(totalAhorrado, totalJuegos, nombreRango, colorRango, claseAvatar, nextGoal);
    });
}

function actualizarUIStats(ahorro, juegos, rangoTxt, rangoColor, avatarClass, nextGoal) {
    document.getElementById('statAhorro').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(ahorro);
    document.getElementById('statJuegos').innerText = juegos;
    const rangoElem = document.getElementById('statRango');
    if(rangoElem) {
        rangoElem.innerText = rangoTxt;
        rangoElem.style.color = rangoColor;
    }
    const avatarContainer = document.querySelector('.profile-avatar-container');
    if(avatarContainer) {
        avatarContainer.className = 'profile-avatar-container ' + avatarClass;
    }
    const barElem = document.getElementById('rankProgressBar');
    const textElem = document.getElementById('rankProgressText');
    if (nextGoal > 0) {
        let porcentaje = Math.min((juegos / nextGoal) * 100, 100);
        let faltantes = nextGoal - juegos;
        if(barElem) {
            barElem.style.width = `${porcentaje}%`;
            barElem.style.background = rangoColor; 
        }
        if(textElem) {
            textElem.innerText = `Faltan ${faltantes} compras para subir`;
        }
    } else {
        if(barElem) {
            barElem.style.width = '100%';
            barElem.style.background = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
        }
        if(textElem) {
            textElem.innerText = '¡Has alcanzado el rango máximo!';
        }
    }
}

// --- TABS & GLOBAL FUNCTIONS ---
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

function cargarWishlist(uid) {
    const wishRef = ref(db, `usuarios/${uid}/wishlist`);
    onValue(wishRef, (snapshot) => {
        const wishlistBody = document.getElementById('wishlistBody');
        const noWishMsg = document.getElementById('noWishlistMsg');
        if(!wishlistBody) return; 
        wishlistBody.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            noWishMsg.style.display = 'block';
            return;
        }
        noWishMsg.style.display = 'none';
        Object.entries(data).forEach(([gameId, item]) => {
            const row = `
                <tr>
                    <td style="text-align:center;">
                         <img src="${item.imagen}" class="game-thumb-profile" alt="Cover">
                    </td>
                    <td>
                        <div style="font-weight:700; color:var(--primary);">${item.nombre}</div>
                        <a href="${item.url}" target="_blank" style="font-size:0.8rem; color:var(--text-light); text-decoration: underline;">Ver en Steam</a>
                    </td>
                    <td>
                        <button onclick="irAComprar('${item.url}')" class="btn btn-primary btn-sm" style="margin-right:5px; background-color: var(--accent); border: none;">Comprar Ahora</button>
                        <button onclick="borrarDeseado('${uid}', '${gameId}')" class="btn btn-secondary btn-sm" style="color:var(--danger); border-color:var(--danger);">X</button>
                    </td>
                </tr>
            `;
            wishlistBody.innerHTML += row;
        });
    });
}

window.irAComprar = (url) => {
    if(url.includes('eneba')) {
        window.location.href = `../eneba.html?auto=${encodeURIComponent(url)}`;
    } else {
        window.location.href = `../index.html?auto=${encodeURIComponent(url)}`;
    }
};

window.borrarDeseado = (uid, gameId) => {
    Swal.fire({
        title: '¿Eliminar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No'
    }).then((result) => {
         if (result.isConfirmed) {
            remove(ref(db, `usuarios/${uid}/wishlist/${gameId}`));
        }
    });
};

window.copiarKey = (key) => {
    navigator.clipboard.writeText(key).then(() => {
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        Toast.fire({ icon: 'success', title: '¡Key Copiada!' });
    });
};