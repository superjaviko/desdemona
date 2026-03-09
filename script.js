// Esperamos a que todo el HTML esté cargado antes de ejecutar JS
window.addEventListener('DOMContentLoaded', () => {
    
    const video = document.getElementById('video');
    const operatorSelect = document.getElementById('operatorSelect');
    const btnSent = document.getElementById('btnSent');
    const statusDiv = document.getElementById('status');
    const videoContainer = document.querySelector('.video-container') || document.body; // Si no lo encuentra, usa el body para no fallar
    
    let currentEmotions = {}; 

    console.log("Iniciando sistema...");

    // 1. Poblar el selector (Esto aparecerá sí o sí ahora)
    if (operatorSelect) {
        for (let i = 1; i <= 30; i++) {
            let option = document.createElement('option');
            option.value = `Operator ${i}`;
            option.text = `Operator ${i}`;
            operatorSelect.appendChild(option);
        }
    } else {
        console.error("No se encontró el elemento operatorSelect");
    }

    // 2. Cargar los modelos
    if (typeof faceapi !== 'undefined') {
        Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('models'),
            faceapi.nets.faceExpressionNet.loadFromUri('models')
        ]).then(startVideo).catch(err => {
            statusDiv.innerText = "Error cargando modelos de IA.";
            console.error(err);
        });
    } else {
        statusDiv.innerText = "Error: Librería face-api no cargada.";
    }

    function startVideo() {
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(stream => {
                video.srcObject = stream;
                statusDiv.innerText = "Webcam ready. Waiting for a face...";
            })
            .catch(err => {
                statusDiv.innerText = "Error: camera not detected.";
                console.error(err);
            });
    }

    // 3. Detección
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
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

            if (detections.length > 0) {
                currentEmotions = detections[0].expressions;
                if (operatorSelect.value !== "") {
                    btnSent.disabled = false;
                    statusDiv.innerText = "Ready to send.";
                } else {
                    statusDiv.innerText = "Select and operator.";
                }
            } else {
                btnSent.disabled = true;
                statusDiv.innerText = "Looking for a face...";
            }
        }, 100);
    });

    // 4. Envío
    btnSent.addEventListener('click', async () => {
        const selectedOperator = operatorSelect.value;
        statusDiv.innerText = `Enviando datos de ${selectedOperator}...`;
        
        const sorted = Object.entries(currentEmotions).sort((a, b) => b[1] - a[1]);
        const score = (sorted[0][1] * 5).toFixed(3);

        try {
            const response = await fetch('https://desdemona.onrender.com/api/modifyOperatorFeature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "name": selectedOperator,
                    "feature": "ave. rate emotions",
                    "value": score
                })
            });

            if (response.ok) {
                statusDiv.innerText = `✅ Sent: ${score}`;
            } else {
                statusDiv.innerText = `❌ API Error: ${response.status}`;
            }
        } catch (e) {
            statusDiv.innerText = "❌ Connection Error.";
        }
    });
});
