const video = document.getElementById('video');
const btnSent = document.getElementById('btnSent');
const statusDiv = document.getElementById('status');
const operatorNameInput = document.getElementById('operatorName');
let currentEmotions = {}; // Aquí guardaremos el último resultado

// 1. Cargar los modelos desde tu carpeta local
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('models'),
    faceapi.nets.faceExpressionNet.loadFromUri('models')
]).then(startVideo);

function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            statusDiv.innerText = "Modelos cargados. Detectando...";
        })
        .catch(err => console.error("Error al acceder a la cámara:", err));
}

// 2. Ciclo de detección actualizado
video.addEventListener('play', () => {
    // Creamos el canvas
    const canvas = faceapi.createCanvasFromMedia(video);
    document.querySelector('.container').append(canvas);

    // Función para ajustar dimensiones dinámicamente
    const updateDimensions = () => {
        // Usamos offsetWidth/Height para obtener el tamaño REAL en el navegador (CSS)
        const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
        faceapi.matchDimensions(canvas, displaySize);
        return displaySize;
    };

    // Ajuste inicial
    let displaySize = updateDimensions();

    // Si el usuario cambia el tamaño de la ventana, re-calculamos
    window.addEventListener('resize', () => {
        displaySize = updateDimensions();
    });

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        // RE-CALCULAR: Ajustamos los resultados al tamaño visual actual
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Limpiamos y dibujamos
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

        // Lógica del botón corregida
        if (detections && detections.length > 0) {
            currentEmotions = detections[0].expressions;
            btnSent.disabled = false;
        } else {
            btnSent.disabled = true;
        }
    }, 100);
});
// 3. El POST al servidor
btnSent.addEventListener('click', async () => {
    const nameValue = operatorNameInput.value.trim();
    statusDiv.innerText = "Enviando a Desdemona...";
    
    // Calculamos un valor representativo para el 'average emotions rate'
    // En este caso, tomaremos la emoción con el puntaje más alto.
    const sortedEmotions = Object.entries(currentEmotions).sort((a, b) => b[1] - a[1]);
    const dominantEmotionValue = sortedEmotions[0][1]; // El valor (0.0 a 1.0)

    // Validación: No permitir envío sin nombre
    if (!nameValue) {
        alert("Por favor, introduce el nombre del operario antes de enviar.");
        operatorNameInput.style.borderColor = "red";
        return;
    }

    statusDiv.innerText = "Enviando a Desdemona...";
    
    const payload = {
        "operator": {
            "name": nameValue, // Nombre dinámico según emoción
            "features": {
                "average emotions rate": parseFloat(dominantEmotionValue.toFixed(2)),
                "Memory": 4.0,           // Valores por defecto o capturados de otros inputs
                "Lev. Profes Train": 3.5,
                "Manual Dex.": 4.0
            }
        }
    };

    try {
        const response = await fetch('https://desdemona.onrender.com/api/addOperator', { // Ajustado a la ruta común de creación
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            statusDiv.innerText = `¡Operario "${nameValue}" creado con éxito!`;
            operatorNameInput.value = ""; // Limpiar campo tras éxito
            operatorNameInput.style.borderColor = "#ccc";
        } else {
            statusDiv.innerText = `Error: ${response.status}. Revisa la URL o el servidor.`;
        }
    } catch (error) {
        statusDiv.innerText = "Error de conexión. Revisa la consola.";
        console.error(error);
    }
});
