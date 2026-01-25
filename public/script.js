document.addEventListener('DOMContentLoaded', () => {
    const loadModelBtn = document.getElementById('loadModelBtn');
    const startWebcamBtn = document.getElementById('startWebcamBtn');
    const stopWebcamBtn = document.getElementById('stopWebcamBtn');
    const errorMessage = document.getElementById('error-message');
    const videoRef = document.getElementById('videoFeed');
    const canvasRef = document.getElementById('detectionCanvas');
    const fpsDisplay = document.getElementById('fpsDisplay');
    const detectionList = document.getElementById('detectionList');
    const placeholderInstructions = document.getElementById('placeholder-instructions');
    const flipCameraBtn = document.getElementById('flipCameraBtn'); // Pindahkan ini ke sini

    let model = null;
    let loading = false;
    let isStreaming = false;
    let streamRef = null;
    let animationFrameRef = null;
    let lastFpsTimeRef = Date.now();
    let fpsCounterRef = 0;
    let fps = 0;
    let currentFacingMode = 'environment'; // Default ke kamera belakang

    const CLASS_NAMES = ['Organik', 'Anorganik'];

    const updateVideoDisplay = () => {
        if (isStreaming) {
            videoRef.style.display = 'block';
            canvasRef.style.display = 'block';
            placeholderInstructions.style.display = 'none';
            flipCameraBtn.style.display = 'block'; // Tampilkan tombol flip saat streaming
        } else {
            videoRef.style.display = 'none';
            canvasRef.style.display = 'none';
            placeholderInstructions.style.display = 'flex'; /* Menggunakan flex untuk menengahkan konten */
            flipCameraBtn.style.display = 'none'; // Sembunyikan tombol flip saat tidak streaming
        }
    };

    // Helper to update button states
    const updateButtonStates = () => {
        loadModelBtn.disabled = loading || !!model;
        startWebcamBtn.disabled = !model || isStreaming;
        stopWebcamBtn.disabled = !isStreaming;
        // flipCameraBtn.disabled = !isStreaming; // Tidak perlu disabled di sini, karena sudah diatur display none/block

        if (model) {
            loadModelBtn.textContent = 'Model Siap ✓';
            loadModelBtn.classList.add('model-loaded');
        } else {
            loadModelBtn.textContent = '1. Muat Model';
            loadModelBtn.classList.remove('model-loaded');
        }

        if (isStreaming) {
            startWebcamBtn.textContent = 'Kamera Siap ✓';
            startWebcamBtn.classList.add('camera-started');
        } else {
            startWebcamBtn.textContent = '2. Mulai Kamera';
            startWebcamBtn.classList.remove('camera-started');
        }
        updateVideoDisplay(); // Panggil setiap kali status tombol diperbarui
    };

    // 1. Load Model
    const loadModel = async () => {
        loading = true;
        errorMessage.textContent = '';
        updateButtonStates();
        try {
            await tf.ready();
            model = await tf.loadGraphModel('/model/best2_web_model/model.json');
            console.log('Model loaded!');
        } catch (err) {
            console.error('Error loading model:', err);
            errorMessage.textContent = 'Gagal memuat model. Pastikan file ada di /public/model/best2_web_model/';
        } finally {
            loading = false;
            updateButtonStates();
        }
    };

    // 2. Post-processing YOLOv8 (Paling Penting)
    const postprocess = (res, inputWidth, inputHeight) => {
        return tf.tidy(() => {
            const output = res.transpose([0, 2, 1]).squeeze();

            const boxes = tf.tidy(() => {
                const xCenter = output.slice([0, 0], [-1, 1]);
                const yCenter = output.slice([0, 1], [-1, 1]);
                const width = output.slice([0, 2], [-1, 1]);
                const height = output.slice([0, 3], [-1, 1]);

                const x1 = tf.sub(xCenter, tf.div(width, 2));
                const y1 = tf.sub(yCenter, tf.div(height, 2));
                const x2 = tf.add(x1, width);
                const y2 = tf.add(y1, height);
                return tf.concat([y1, x1, y2, x2], 1);
            });

            const rawScores = output.slice([0, 4], [-1, 2]);
            const scores = rawScores.max(1);
            const classes = rawScores.argMax(1);

            const nmsIndices = tf.image.nonMaxSuppression(boxes, scores, 5, 0.45, 0.3).dataSync();

            const results = [];
            const boxesData = boxes.gather(nmsIndices).dataSync();
            const scoresData = scores.gather(nmsIndices).dataSync();
            const classesData = classes.gather(nmsIndices).dataSync();

            for (let i = 0; i < nmsIndices.length; i++) {
                results.push({
                    class: CLASS_NAMES[classesData[i]],
                    confidence: scoresData[i],
                    bbox: [
                        boxesData[i * 4 + 1], // x1
                        boxesData[i * 4],     // y1
                        boxesData[i * 4 + 3], // x2
                        boxesData[i * 4 + 2]  // y2
                    ]
                });
            }
            boxes.dispose(); // Clean up intermediate tensor
            return results;
        });
    };

    // 3. Main Logic: Detect Frame
    const detectFrame = async () => {
        if (!model || !videoRef || videoRef.readyState !== 4) {
            animationFrameRef = requestAnimationFrame(detectFrame);
            return;
        }

        fpsCounterRef++;
        const now = Date.now();
        if (now - lastFpsTimeRef >= 1000) {
            fps = fpsCounterRef;
            fpsDisplay.textContent = `FPS: ${fps}`;
            fpsCounterRef = 0;
            lastFpsTimeRef = now;
        }

        const video = videoRef;
        const canvas = canvasRef;
        if (!canvas) return;

        tf.tidy(() => {
            const img = tf.browser.fromPixels(video);
            const input = tf.image.resizeBilinear(img, [512, 512]).div(255.0).expandDims(0);
            const res = model.execute(input);

            const results = postprocess(res, 512, 512);
            displayDetections(results);

            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                results.forEach((det) => {
                    const [x1, y1, x2, y2] = det.bbox;
                    const scaleX = canvas.width / 512;
                    const scaleY = canvas.height / 512;

                    const x = x1 * scaleX;
                    const y = y1 * scaleY;
                    const w = (x2 - x1) * scaleX;
                    const h = (y2 - y1) * scaleY;

                    ctx.strokeStyle = det.class === 'Organik' ? '#22c55e' : '#ef4444';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(x, y, w, h);

                    const label = `${det.class} ${(det.confidence * 100).toFixed(0)}%`;
                    ctx.fillStyle = det.class === 'Organik' ? '#22c55e' : '#ef4444';
                    ctx.font = 'bold 18px Arial';
                    ctx.fillText(label, x, y > 20 ? y - 10 : y + 20);
                });
            }
        });

        animationFrameRef = requestAnimationFrame(detectFrame);
    };

    const displayDetections = (detections) => {
        detectionList.innerHTML = '';
        if (detections.length === 0) {
            detectionList.innerHTML = '<p class="no-detection-message">Belum ada sampah terdeteksi...</p>';
        } else {
            detections.forEach((d, i) => {
                const detectionItem = document.createElement('div');
                detectionItem.className = `detection-item ${d.class.toLowerCase()}`;
                detectionItem.innerHTML = `<span class="font-bold">${d.class}</span> - Keyakinan: ${(d.confidence * 100).toFixed(1)}%`;
                detectionList.appendChild(detectionItem);
            });
        }
    };

    
    const startWebcam = async () => {
        errorMessage.textContent = '';
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: currentFacingMode, width: 640, height: 480 }, // Gunakan currentFacingMode
                audio: false,
            });
            if (videoRef) {
                videoRef.srcObject = stream;
                streamRef = stream;
                isStreaming = true;
                
                videoRef.onloadedmetadata = () => {
                    videoRef.play();
                    
                };
                detectFrame();
            }
        } catch (err) {
            console.error('Error starting webcam:', err);
            errorMessage.textContent = 'Akses kamera ditolak atau tidak tersedia untuk mode ini.';
        } finally {
            updateButtonStates();
        }
    };

    const stopWebcam = () => {
        if (animationFrameRef) cancelAnimationFrame(animationFrameRef);
        if (streamRef) streamRef.getTracks().forEach(t => t.stop());
        isStreaming = false;
        detectionList.innerHTML = '<p class="no-detection-message">Belum ada sampah terdeteksi...</p>';
        fpsDisplay.textContent = 'FPS: 0';
        updateButtonStates();
        // Hapus teks "kamera siap ✓" saat stop
        startWebcamBtn.textContent = '2. Mulai Kamera';
        startWebcamBtn.classList.remove('camera-started');
        
        const ctx = canvasRef.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    };

    const flipCamera = async () => {
        if (!isStreaming) return; // Hanya flip jika sedang streaming

        stopWebcam(); // Hentikan webcam saat ini

        // Balik mode kamera
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        
        // Coba mulai webcam lagi dengan mode baru
        await startWebcam();
    };

    // Event Listeners
    loadModelBtn.addEventListener('click', loadModel);
    startWebcamBtn.addEventListener('click', startWebcam);
    stopWebcamBtn.addEventListener('click', stopWebcam);
    flipCameraBtn.addEventListener('click', flipCamera); // Pindahkan ini ke sini juga

    // Initial state update
    updateButtonStates();
});