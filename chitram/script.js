// Application State
const state = {
    currentFile: null,
    originalImage: null,
    cropper: null,
    watermarkText: '',
    watermarkSettings: { size: 40, color: '#ffffff', x: 50, y: 50 }
};

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Update Nav
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update View
        const target = btn.dataset.target;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        
        if(target !== 'home') {
            // Optional reset logic
        }
    });
});

document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
        const tool = card.dataset.tool;
        document.querySelector(`.nav-btn[data-target="${tool}"]`).click();
    });
});

// Helper: Read File
function handleFileUpload(inputElement, previewContainerId, imageElementId, onImageLoaded = null) {
    inputElement.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        state.currentFile = file;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById(imageElementId);
            img.src = event.target.result;
            state.originalImage = img;

            const uploadBox = inputElement.parentElement;
            uploadBox.style.display = 'none';
            document.getElementById(previewContainerId).classList.add('active');

            if (onImageLoaded) onImageLoaded(img);
        };
        reader.readAsDataURL(file);
    });
}

// Helper: Setup Upload Box Click
function setupUploadBox(boxId, inputId) {
    document.getElementById(boxId).addEventListener('click', () => {
        document.getElementById(inputId).click();
    });

    const box = document.getElementById(boxId);
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.style.borderColor = '#6366f1'; });
    box.addEventListener('dragleave', (e) => { e.preventDefault(); box.style.borderColor = '#27272a'; });
    box.addEventListener('drop', (e) => {
        e.preventDefault();
        box.style.borderColor = '#27272a';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const input = document.getElementById(inputId);
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change'));
        }
    });
}

// ----------------------
// COMPRESS TOOL (UPDATED PRO LOGIC)
// ----------------------
setupUploadBox('compress-upload-box', 'compress-file');
handleFileUpload(document.getElementById('compress-file'), 'compress-preview', 'compress-img');

document.getElementById('compress-quality').addEventListener('input', (e) => {
    document.getElementById('compress-quality-val').textContent = e.target.value + '%';
});

document.getElementById('compress-action').addEventListener('click', async () => {

    const img = document.getElementById('compress-img');
    if (!img.src) return alert('Please upload an image first.');

    const format = document.querySelector('input[name="compress-fmt"]:checked').value;
    const targetKB = parseInt(document.getElementById('compress-size').value) || 0;

    let width = img.naturalWidth;
    let height = img.naturalHeight;
    let quality = 0.9;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let blob;
    let dataUrl;

    async function encode() {
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        dataUrl = canvas.toDataURL(format, quality);
        blob = await (await fetch(dataUrl)).blob();
    }

    await encode();

    let attempts = 0;
    const MAX_ATTEMPTS = 30;

    while (
        targetKB > 0 &&
        blob.size / 1024 > targetKB &&
        attempts < MAX_ATTEMPTS
    ) {
        if (quality > 0.25) {
            quality -= 0.07;
        } else {
            width *= 0.9;
            height *= 0.9;
        }

        await encode();
        attempts++;
    }

    console.log('Final Size KB:', (blob.size / 1024).toFixed(2));
    download(dataUrl, `compressed.${format.split('/')[1]}`);
});

// ----------------------
// CROP TOOL
// ----------------------
setupUploadBox('crop-upload-box', 'crop-file');
handleFileUpload(document.getElementById('crop-file'), 'crop-preview', 'crop-img', (img) => {
    if(state.cropper) state.cropper.destroy();
    state.cropper = new Cropper(img, {
        viewMode: 1,
        autoCropArea: 1,
    });
});

document.getElementById('crop-ratio').addEventListener('change', (e) => {
    if(!state.cropper) return;
    const val = parseFloat(e.target.value);
    state.cropper.setAspectRatio(val);
});

document.getElementById('crop-action').addEventListener('click', () => {
    if (!state.cropper) return;
    const format = document.querySelector('input[name="crop-fmt"]:checked').value;
    const canvas = state.cropper.getCroppedCanvas();
    const dataUrl = canvas.toDataURL(format);
    download(dataUrl, `cropped.${format.split('/')[1]}`);
});

// ----------------------
// RESIZE TOOL
// ----------------------
setupUploadBox('resize-upload-box', 'resize-file');
handleFileUpload(document.getElementById('resize-file'), 'resize-preview', 'resize-img', (img) => {
    document.getElementById('resize-width').value = img.naturalWidth;
    document.getElementById('resize-height').value = img.naturalHeight;
});

const resizeW = document.getElementById('resize-width');
const resizeH = document.getElementById('resize-height');
const resizeLock = document.getElementById('resize-lock');

resizeW.addEventListener('input', () => {
    if(resizeLock.checked && state.currentFile) {
        const aspect = state.originalImage.naturalHeight / state.originalImage.naturalWidth;
        resizeH.value = Math.round(resizeW.value * aspect);
    }
});

resizeH.addEventListener('input', () => {
    if(resizeLock.checked && state.currentFile) {
        const aspect = state.originalImage.naturalWidth / state.originalImage.naturalHeight;
        resizeW.value = Math.round(resizeH.value * aspect);
    }
});

document.getElementById('resize-action').addEventListener('click', () => {
    const img = document.getElementById('resize-img');
    if(!img.src) return;
    const width = parseInt(resizeW.value);
    const height = parseInt(resizeH.value);
    const format = document.getElementById('resize-fmt').value;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    download(canvas.toDataURL(format), `resized.${format.split('/')[1]}`);
});

// ----------------------
// CONVERT TOOL
// ----------------------
setupUploadBox('convert-upload-box', 'convert-file');
handleFileUpload(document.getElementById('convert-file'), 'convert-preview', 'convert-img');

document.getElementById('convert-quality').addEventListener('input', (e) => {
    document.getElementById('convert-quality-val').textContent = e.target.value + '%';
});

document.getElementById('convert-action').addEventListener('click', () => {
    const img = document.getElementById('convert-img');
    if(!img.src) return;
    
    const format = document.getElementById('convert-fmt').value;
    const quality = parseInt(document.getElementById('convert-quality').value) / 100;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    download(canvas.toDataURL(format, quality), `converted.${format.split('/')[1]}`);
});

// ----------------------
// UPSCALE TOOL
// ----------------------
setupUploadBox('upscale-upload-box', 'upscale-file');
handleFileUpload(document.getElementById('upscale-file'), 'upscale-preview', 'upscale-img');

document.getElementById('upscale-action').addEventListener('click', () => {
    const img = document.getElementById('upscale-img');
    if(!img.src) return;
    
    const scale = parseInt(document.getElementById('upscale-factor').value);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    download(canvas.toDataURL('image/png'), `upscaled_x${scale}.png`);
});

// ----------------------
// WATERMARK TOOL
// ----------------------
setupUploadBox('watermark-upload-box', 'watermark-file');

const wmInput = document.getElementById('watermark-file');
wmInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            state.wmImg = img;
            drawWatermarkPreview();
            document.getElementById('watermark-upload-box').style.display = 'none';
            document.getElementById('watermark-preview').classList.add('active');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function drawWatermarkPreview() {
    if(!state.wmImg) return;
    const canvas = document.getElementById('watermark-canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = state.wmImg.naturalWidth;
    canvas.height = state.wmImg.naturalHeight;
    
    ctx.drawImage(state.wmImg, 0, 0);
    
    const text = document.getElementById('wm-text').value;
    const size = parseInt(document.getElementById('wm-size').value);
    const color = document.getElementById('wm-color').value;
    const posX = parseInt(document.getElementById('wm-x').value);
    const posY = parseInt(document.getElementById('wm-y').value);  

    if(text) {
        ctx.font = `bold ${size}px Arial`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        
        const x = (canvas.width * posX) / 100;
        const y = (canvas.height * posY) / 100;
        
        ctx.fillText(text, x, y);
    }
}

['wm-text', 'wm-size', 'wm-color', 'wm-x', 'wm-y'].forEach(id => {
    document.getElementById(id).addEventListener('input', drawWatermarkPreview);
});

document.getElementById('watermark-action').addEventListener('click', () => {
    const canvas = document.getElementById('watermark-canvas');
    if(!state.wmImg) return;
    download(canvas.toDataURL('image/jpeg'), 'watermarked.jpg');
});

// Utility
function download(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // ---- Reset UI After Download ----
    setTimeout(() => {

        // Reset file inputs
        document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');

        // Reset image previews
        document.querySelectorAll('img').forEach(img => img.src = '');

        // Reset canvas previews (watermark etc)
        document.querySelectorAll('canvas').forEach(c => {
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
        });

        // Show upload boxes again
        document.querySelectorAll('[id$="upload-box"]').forEach(box => {
            box.style.display = 'flex';
        });

        // Hide preview containers
        document.querySelectorAll('[id$="preview"]').forEach(pre => {
            pre.classList.remove('active');
        });

        // Reset state
        state.currentFile = null;
        state.originalImage = null;
        state.wmImg = null;

        if(state.cropper) {
            state.cropper.destroy();
            state.cropper = null;
        }

    }, 300);
}
