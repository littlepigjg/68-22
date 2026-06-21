const PaperEffects = {
    _patternCache: null,
    _patternKey: '',

    createCanvas(width, height) {
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(width, height);
        }
        return document.createElement('canvas');
    },

    seededRandom(seed) {
        const x = Math.sin(seed * 9999) * 10000;
        return x - Math.floor(x);
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    },

    addPaperTexture(ctx, width, height, paperColor, seed) {
        const patternKey = `${paperColor}_${seed}`;
        
        if (this._patternCache && this._patternKey === patternKey) {
            ctx.fillStyle = this._patternCache;
            ctx.fillRect(0, 0, width, height);
            return;
        }
        
        const paperRgb = this.hexToRgb(paperColor);
        const tempCanvas = this.createCanvas(256, 256);
        tempCanvas.width = 256;
        tempCanvas.height = 256;
        const tempCtx = tempCanvas.getContext('2d');
        
        const imageData = tempCtx.createImageData(256, 256);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const idx = i / 4;
            const x = idx % 256;
            const y = Math.floor(idx / 256);
            const noiseSeed = seed + x * 0.1 + y * 0.1;
            const noise = (this.seededRandom(noiseSeed) - 0.5) * 14;
            
            data[i] = Math.max(0, Math.min(255, paperRgb.r + noise));
            data[i + 1] = Math.max(0, Math.min(255, paperRgb.g + noise));
            data[i + 2] = Math.max(0, Math.min(255, paperRgb.b + noise));
            data[i + 3] = 255;
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        const pattern = ctx.createPattern(tempCanvas, 'repeat');
        this._patternCache = pattern;
        this._patternKey = patternKey;
        
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
    },

    addPaperFiberEffect(ctx, width, height, paperColor, seed) {
        const fiberCount = Math.floor(width * height / 20000);
        const paperRgb = this.hexToRgb(paperColor);
        
        ctx.save();
        
        for (let i = 0; i < fiberCount; i++) {
            const fiberSeed = seed + i * 137;
            const x = this.seededRandom(fiberSeed) * width;
            const y = this.seededRandom(fiberSeed + 1) * height;
            const length = this.seededRandom(fiberSeed + 2) * 25 + 8;
            const angle = this.seededRandom(fiberSeed + 3) * Math.PI * 2;
            const alpha = this.seededRandom(fiberSeed + 4) * 0.12 + 0.03;
            const thickness = this.seededRandom(fiberSeed + 5) * 0.8 + 0.3;
            
            const endX = x + Math.cos(angle) * length;
            const endY = y + Math.sin(angle) * length;
            
            const darker = this.seededRandom(fiberSeed + 6) > 0.5;
            const color = darker ? 
                `rgba(${Math.max(0, paperRgb.r - 30)}, ${Math.max(0, paperRgb.g - 30)}, ${Math.max(0, paperRgb.b - 20)}, ${alpha})` :
                `rgba(${Math.min(255, paperRgb.r + 20)}, ${Math.min(255, paperRgb.g + 20)}, ${Math.min(255, paperRgb.b + 15)}, ${alpha})`;
            
            ctx.strokeStyle = color;
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        
        ctx.restore();
    },

    addPaperEdges(ctx, width, height, paperColor) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 30);
        gradient.addColorStop(0, 'rgba(0,0,0,0.1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, 30);
        
        const gradient2 = ctx.createLinearGradient(0, height - 30, 0, height);
        gradient2.addColorStop(0, 'rgba(0,0,0,0)');
        gradient2.addColorStop(1, 'rgba(0,0,0,0.08)');
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, height - 30, width, 30);
    },

    clearCache() {
        this._patternCache = null;
        this._patternKey = '';
    }
};

if (typeof window !== 'undefined') {
    window.PaperEffects = PaperEffects;
}
