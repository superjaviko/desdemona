const video = document.getElementById('video');
const operatorSelect = document.getElementById('operatorSelect');
const btnSent = document.getElementById('btnSent');
const statusDiv = document.getElementById('status');
const videoContainer = document.querySelector('.video-container'); // Cambiado para el nuevo CSS
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
    const canvas = faceapi.createCanvasFromMedia(video);
    // IMPORTANTE: Añadirlo al contenedor, no al body
    videoContainer.append(canvas); 

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

        // Lógica del botón SENT
        if (detections.length > 0 && operatorSelect.value !== "") {
            btnSent.disabled = false;
        } else {
            btnSent.disabled = true;
        }
    }, 100);
});

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
        const selectedOperator = operatorSelect.value; 

        if (detections.length > 0 && selectedOperator !== "") {
            btnSent.disabled = false;
            btnSent.style.opacity = "1"; // Para que se vea activo
            btnSent.style.cursor = "pointer";
        } else {
            btnSent.disabled = true;
            btnSent.style.opacity = "0.5";
            btnSent.style.cursor = "not-allowed";
        }
    }, 100);
});
// 3. El POST al servidor
const operatorSelect = document.getElementById('operatorSelect');

// 1. Poblamos el select con los 30 operadores al cargar la página
for (let i = 1; i <= 30; i++) {
    let option = document.createElement('option');
    option.value = `Operator ${i}`;
    option.text = `Operator ${i}`;
    operatorSelect.appendChild(option);
}

btnSent.addEventListener('click', async () => {
    const selectedOperator = operatorSelect.value;
    statusDiv.innerText = `Actualizando ${selectedOperator}...`;
    
    // Obtenemos la emoción dominante (0.0 - 5.0 para escalar con tus otros datos)
    const sortedEmotions = Object.entries(currentEmotions).sort((a, b) => b[1] - a[1]);
    // Escalamos el valor de 0.1-1.0 a un rango de 1-5 para que coincida con tu escala
    const emotionScore = (sortedEmotions[0][1] * 5).toFixed(3);

    // Estructura para modifyOperatorFeature
    const payload = {
        "name": selectedOperator,
        "feature": "ave. rate emotions",
        "value": emotionScore
    };

    try {
        const response = await fetch('https://desdemona.onrender.com/api/modifyOperatorFeature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            statusDiv.innerText = `¡Feature actualizado para ${selectedOperator}!`;
        } else {
            const errorData = await response.json();
            statusDiv.innerText = `Error: ${errorData.message || response.status}`;
        }
    } catch (error) {
        statusDiv.innerText = "Error de conexión con la API.";
        console.error(error);
    }
});
