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
            background: { element: null, type: null, data: null },
            character: { element: null, type: null, data: null, x: 0, y: 0, scale: 1, opacity: 1 },
            overlay: { element: null, type: null, data: null }
        };

        this.isPlaying = false;
        this.startTime = 0;
        this.duration = 0;
        this.resolution = { width: 1920, height: 1080 };

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

        // Controls
        const inputs = ['posX', 'posY', 'scale', 'opacity'];
        inputs.forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                const key = id.replace('pos', '').toLowerCase();
                if (key === 'x' || key === 'y') {
                    this.layers.character[key] = parseFloat(e.target.value);
                } else {
                    this.layers.character[key] = parseFloat(e.target.value);
                }
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
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            
            // Convert screen movement to canvas movement
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;

            this.layers.character.x += dx * scaleX;
            this.layers.character.y += dy * scaleY;
            
            document.getElementById('posX').value = this.layers.character.x;
            document.getElementById('posY').value = this.layers.character.y;
            
            lastX = e.clientX;
            lastY = e.clientY;
            this.updateGuide();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    handleUpload(event, layerKey) {
        const file = event.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video') ? 'video' : 'image';

        if (type === 'video') {
            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.load();
            video.onloadedmetadata = () => {
                if (layerKey === 'background') {
                    this.duration = Math.max(this.duration, video.duration);
                }
                this.layers[layerKey].element = video;
                this.layers[layerKey].type = 'video';
            };
        } else {
            const img = new Image();
            img.src = url;
            img.onload = () => {
                this.layers[layerKey].element = img;
                this.layers[layerKey].type = 'image';
            };
        }
    }

    resizeCanvas() {
        this.canvas.width = this.resolution.width;
        this.canvas.height = this.resolution.height;
    }

    updateGuide() {
        const guide = document.getElementById('transform-guide');
        if (!this.layers.character.element) {
            guide.classList.add('hidden');
            return;
        }
        
        guide.classList.remove('hidden');
        // Logic to position the guide box over the canvas...
        // Simplified for now: just relies on visual feedback in the canvas
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

        // 1. Background
        if (this.layers.background.element) {
            this.drawLayer(this.layers.background);
        }

        // 2. Character
        if (this.layers.character.element) {
            const char = this.layers.character;
            this.ctx.save();
            this.ctx.globalAlpha = char.opacity;
            
            const element = char.element;
            const drawW = element.videoWidth || element.width;
            const drawH = element.videoHeight || element.height;
            
            const scaledW = drawW * char.scale;
            const scaledH = drawH * char.scale;

            // Draw centered at x,y
            this.ctx.drawImage(
                element, 
                (width / 2) + char.x - (scaledW / 2), 
                (height / 2) + char.y - (scaledH / 2), 
                scaledW, 
                scaledH
            );
            this.ctx.restore();
        }

        // 3. Overlay
        if (this.layers.overlay.element) {
            this.drawLayer(this.layers.overlay);
        }

        this.updateTimeline();
    }

    drawLayer(layer) {
        this.ctx.drawImage(layer.element, 0, 0, this.canvas.width, this.canvas.height);
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
