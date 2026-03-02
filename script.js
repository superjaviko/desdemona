const video = document.getElementById('video');
const btnSent = document.getElementById('btnSent');
const statusDiv = document.getElementById('status');
let currentEmotions = {}; // Aquí guardaremos el último resultado

// 1. Cargar los modelos desde tu carpeta local
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(startVideo);

function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            statusDiv.innerText = "Modelos cargados. Detectando...";
        })
        .catch(err => console.error("Error al acceder a la cámara:", err));
}

// 2. Ciclo de detección
video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.querySelector('.container').append(canvas);
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar en pantalla
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

        // Lógica del botón
        if (detections.length > 0) {
            currentEmotions = detections[0].expressions;
            btnSent.disabled = false;
        } else {
            btnSent.disabled = true;
        }
    }, 100);
});

// 3. El POST al servidor
btnSent.addEventListener('click', async () => {
    statusDiv.innerText = "Enviando datos...";
    
    try {
        const response = await fetch('https://tu-servidor.com/api/emotions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                data: currentEmotions
            })
        });
        
        if(response.ok) statusDiv.innerText = "¡Datos enviados con éxito!";
    } catch (error) {
        statusDiv.innerText = "Error al enviar. Revisa la consola.";
        console.error(error);
    }
});
