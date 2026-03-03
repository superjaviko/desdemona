const video = document.getElementById('video');
const btnSent = document.getElementById('btnSent');
const statusDiv = document.getElementById('status');
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
