const video = document.getElementById('video');
const operatorSelect = document.getElementById('operatorSelect');
const btnSent = document.getElementById('btnSent');
const statusDiv = document.getElementById('status');
const videoContainer = document.querySelector('.video-container');
let currentEmotions = {}; 

// 1. Poblamos el select con los 30 operadores inmediatamente
for (let i = 1; i <= 30; i++) {
    let option = document.createElement('option');
    option.value = `Operator ${i}`;
    option.text = `Operator ${i}`;
    operatorSelect.appendChild(option);
}

// 2. Cargar los modelos
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('models'),
    faceapi.nets.faceExpressionNet.loadFromUri('models')
]).then(startVideo);

function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            statusDiv.innerText = "Modelos listos. Esperando rostro...";
        })
        .catch(err => {
            console.error("Error cámara:", err);
            statusDiv.innerText = "Error: No se pudo acceder a la cámara.";
        });
}

// 3. Ciclo de detección único y funcional
video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    videoContainer.append(canvas); 

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Limpiar y dibujar
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

        // Guardar emociones actuales si hay detección
        if (detections.length > 0) {
            currentEmotions = detections[0].expressions;
            
            // Habilitar botón solo si hay operador seleccionado
            if (operatorSelect.value !== "") {
                btnSent.disabled = false;
                statusDiv.innerText = "Sistema listo para enviar.";
            } else {
                btnSent.disabled = true;
                statusDiv.innerText = "Seleccione un operador.";
            }
        } else {
            btnSent.disabled = true;
            statusDiv.innerText = "Buscando rostro...";
        }
    }, 100);
});

// 4. El POST al servidor
btnSent.addEventListener('click', async () => {
    const selectedOperator = operatorSelect.value;
    
    if (!currentEmotions || Object.keys(currentEmotions).length === 0) {
        statusDiv.innerText = "Error: No hay datos de emociones.";
        return;
    }

    statusDiv.innerText = `Actualizando ${selectedOperator}...`;
    
    // Obtener la emoción dominante y escalarla a 1-5
    const sortedEmotions = Object.entries(currentEmotions).sort((a, b) => b[1] - a[1]);
    const emotionScore = (sortedEmotions[0][1] * 5).toFixed(3);

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
            statusDiv.innerText = `✅ ${selectedOperator} actualizado (${emotionScore})`;
        } else {
            statusDiv.innerText = `❌ Error del servidor: ${response.status}`;
        }
    } catch (error) {
        statusDiv.innerText = "❌ Error de conexión.";
        console.error(error);
    }
});
