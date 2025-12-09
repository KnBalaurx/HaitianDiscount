/* ARCHIVO: assets/js/eneba.js */
import { initStorePage } from './storeLogic.js';

// Inicializamos la página con configuración de Eneba
initStorePage({
    platformName: 'Eneba',
    budgetRefString: 'presupuesto_eneba',
    statusRefString: 'estado_eneba'
});