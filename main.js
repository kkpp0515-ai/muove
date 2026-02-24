/**
 * Premium Video Compositor Logic
 * Handles real-time canvas compositing and video export
 */

class VideoCompositor {
    constructor() {
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvas-container');

        // Layers
        this.layers = {
            background: { element: null, type: null, data: null, x: 0, y: 0, scale: 1, opacity: 1 },
            character: { element: null, type: null, data: null, x: 0, y: 0, scale: 1, opacity: 1 },
            overlay: { element: null, type: null, data: null, x: 0, y: 0, scale: 1, opacity: 1 }
        };

        this.isPlaying = false;
        this.startTime = 0;
        this.duration = 0;
        this.resolution = { width: 1920, height: 1080 };

        this.selectedLayer = 'character';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.resizeCanvas();
        this.startRenderLoop();
    }

    setupEventListeners() {
        // File Uploads
        document.getElementById('bg-upload').addEventListener('change', (e) => this.handleUpload(e, 'background'));
        document.getElementById('char-upload').addEventListener('change', (e) => this.handleUpload(e, 'character'));
        document.getElementById('overlay-upload').addEventListener('change', (e) => this.handleUpload(e, 'overlay'));

        // Layer Selection logic
        const layerControls = document.querySelectorAll('.control-group[data-layer]');
        layerControls.forEach(group => {
            group.addEventListener('click', () => {
                layerControls.forEach(g => g.classList.remove('active'));
                group.classList.add('active');
                this.selectedLayer = group.dataset.layer;
                this.syncControls();
            });
        });

        // Shared Controls
        const inputs = ['posX', 'posY', 'scale', 'opacity'];
        inputs.forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                const layer = this.layers[this.selectedLayer];
                const key = id.replace('pos', '').toLowerCase();
                layer[key] = parseFloat(e.target.value);
                this.updateGuide();
            });
        });

        // Resolution
        document.getElementById('resolution').addEventListener('change', (e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            this.resolution = { width: w, height: h };
            this.resizeCanvas();
        });

        // Playback
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlayback());

        // Export
        document.getElementById('export-btn').addEventListener('click', () => this.exportVideo());

        // Dragging on Canvas
        let isDragging = false;
        let lastX, lastY;

        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.layers[this.selectedLayer].element) return;
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;

            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;

            const layer = this.layers[this.selectedLayer];
            layer.x += dx * scaleX;
            layer.y += dy * scaleY;

            document.getElementById('posX').value = layer.x;
            document.getElementById('posY').value = layer.y;

            lastX = e.clientX;
            lastY = e.clientY;
            this.updateGuide();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    syncControls() {
        const layer = this.layers[this.selectedLayer];
        document.getElementById('posX').value = layer.x;
        document.getElementById('posY').value = layer.y;
        document.getElementById('scale').value = layer.scale;
        document.getElementById('opacity').value = layer.opacity;

        // Update labels or UI to show which layer is being edited
        const layerTitle = { 'background': '背景', 'character': 'キャラクター', 'overlay': '前面' };
        document.querySelector('.control-title-active').textContent = `編集中のレイヤー: ${layerTitle[this.selectedLayer]}`;
    }

    handleUpload(event, layerKey) {
        const file = event.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video') ? 'video' : 'image';

        const setupElement = (el) => {
            this.layers[layerKey].element = el;
            this.layers[layerKey].type = type;

            // Auto-scale to fit canvas initially but keep original size if it matches
            const elW = el.videoWidth || el.width;
            // Default x,y is 0 (centered)
            this.layers[layerKey].x = 0;
            this.layers[layerKey].y = 0;
            this.layers[layerKey].scale = 1; // Maintain original scale by default

            if (layerKey === 'background') {
                this.duration = Math.max(this.duration, el.duration || 0);
            }

            // Activate this layer's controls
            this.selectedLayer = layerKey;
            document.querySelectorAll('.control-group[data-layer]').forEach(g => {
                g.classList.remove('active');
                if (g.dataset.layer === layerKey) g.classList.add('active');
            });
            this.syncControls();
            this.updateGuide();
        };

        if (type === 'video') {
            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.load();
            video.onloadedmetadata = () => setupElement(video);
        } else {
            const img = new Image();
            img.src = url;
            img.onload = () => setupElement(img);
        }
    }

    resizeCanvas() {
        this.canvas.width = this.resolution.width;
        this.canvas.height = this.resolution.height;
    }

    updateGuide() {
        const guide = document.getElementById('transform-guide');
        const layer = this.layers[this.selectedLayer];
        if (!layer.element) {
            guide.classList.add('hidden');
            return;
        }

        guide.classList.remove('hidden');
        // Guide logic would go here to show a rect on screen
    }

    togglePlayback() {
        this.isPlaying = !this.isPlaying;
        document.getElementById('play-pause-btn').textContent = this.isPlaying ? '⏸' : '▶';

        const playMethod = this.isPlaying ? 'play' : 'pause';
        Object.values(this.layers).forEach(layer => {
            if (layer.type === 'video' && layer.element) {
                layer.element[playMethod]();
            }
        });
    }

    startRenderLoop() {
        const render = () => {
            this.draw();
            requestAnimationFrame(render);
        };
        render();
    }

    draw() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        // Draw layers in order: Background -> Character -> Overlay
        this.drawLayer('background');
        this.drawLayer('character');
        this.drawLayer('overlay');

        this.updateTimeline();
    }

    drawLayer(key) {
        const layer = this.layers[key];
        if (!layer.element) return;

        const { width, height } = this.canvas;
        const element = layer.element;

        this.ctx.save();
        this.ctx.globalAlpha = layer.opacity;

        const elW = element.videoWidth || element.width;
        const elH = element.videoHeight || element.height;

        const scaledW = elW * layer.scale;
        const scaledH = elH * layer.scale;

        // Render centered + x, y offset
        this.ctx.drawImage(
            element,
            (width / 2) + layer.x - (scaledW / 2),
            (height / 2) + layer.y - (scaledH / 2),
            scaledW,
            scaledH
        );

        this.ctx.restore();
    }

    updateTimeline() {
        if (!this.layers.background.element || this.layers.background.type !== 'video') return;

        const video = this.layers.background.element;
        const progress = (video.currentTime / video.duration) * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        const current = this.formatTime(video.currentTime);
        const total = this.formatTime(video.duration);
        document.getElementById('time-display').textContent = `${current} / ${total}`;
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    async exportVideo() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('hidden');

        const stream = this.canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
        const chunks = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `composite_export_${Date.now()}.webm`;
            a.click();
            overlay.classList.add('hidden');
        };

        // Reset and play
        Object.values(this.layers).forEach(layer => {
            if (layer.type === 'video' && layer.element) {
                layer.element.currentTime = 0;
                layer.element.play();
            }
        });

        recorder.start();

        const duration = (this.layers.background.element?.duration || 5) * 1000;

        // Progress simulation
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 100;
            const prog = Math.min(Math.round((elapsed / duration) * 100), 99);
            document.getElementById('export-progress').textContent = `${prog}%`;
            if (elapsed >= duration) {
                clearInterval(interval);
                recorder.stop();
                Object.values(this.layers).forEach(layer => {
                    if (layer.type === 'video' && layer.element) layer.element.pause();
                });
            }
        }, 100);
    }
}

// Initialize on load
window.addEventListener('load', () => {
    new VideoCompositor();
});
