const TextEffects = {
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

    randomOffsetForChar(charIndex, lineIndex, seed, randomOffset) {
        const offsetSeed = seed + charIndex * 1000 + lineIndex * 10000;
        const offsetX = (this.seededRandom(offsetSeed) - 0.5) * 2 * randomOffset;
        const offsetY = (this.seededRandom(offsetSeed + 100) - 0.5) * 2 * randomOffset;
        return { x: offsetX, y: offsetY };
    },

    randomRotationForChar(charIndex, lineIndex, seed) {
        const rotationSeed = seed + charIndex * 2000 + lineIndex * 20000;
        return (this.seededRandom(rotationSeed) - 0.5) * 2.5;
    },

    drawChar(ctx, char, x, y, options) {
        const { charIndex, lineIndex, seed, fontSize, fontFamily, weight, 
                slantAngle, inkColor, inkDensity, randomOffset, strokeNoise } = options;
        
        const offset = this.randomOffsetForChar(charIndex, lineIndex, seed, randomOffset);
        const rotation = this.randomRotationForChar(charIndex, lineIndex, seed);
        const slantRad = (slantAngle + rotation) * Math.PI / 180;
        
        const inkRgb = this.hexToRgb(inkColor);
        const baseAlpha = 0.45 + (inkDensity / 100) * 0.55;
        const noiseLevel = strokeNoise / 100;
        
        ctx.save();
        ctx.translate(x + offset.x, y + offset.y);
        ctx.transform(1, 0, Math.tan(slantRad), 1, 0, 0);
        
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';
        
        ctx.globalCompositeOperation = 'source-over';
        
        for (let layer = 0; layer < 3; layer++) {
            const layerSeed = seed + charIndex * 100 + layer * 50 + lineIndex * 500;
            const layerAlpha = baseAlpha * (0.55 + layer * 0.25);
            const layerOffsetX = (this.seededRandom(layerSeed) - 0.5) * noiseLevel * 2.5;
            const layerOffsetY = (this.seededRandom(layerSeed + 1) - 0.5) * noiseLevel * 2.5;
            const scaleX = 1 + (this.seededRandom(layerSeed + 2) - 0.5) * 0.03;
            const scaleY = 1 + (this.seededRandom(layerSeed + 3) - 0.5) * 0.03;
            
            ctx.save();
            ctx.translate(layerOffsetX, layerOffsetY);
            ctx.scale(scaleX, scaleY);
            
            ctx.fillStyle = `rgba(${inkRgb.r}, ${inkRgb.g}, ${inkRgb.b}, ${layerAlpha})`;
            ctx.fillText(char, 0, 0);
            
            ctx.restore();
        }
        
        if (noiseLevel > 0.15) {
            this.addInkSplatter(ctx, char, charIndex, lineIndex, seed, noiseLevel, inkRgb, fontSize);
        }
        
        if (noiseLevel > 0.25) {
            this.addStrokeTexture(ctx, char, charIndex, lineIndex, seed, noiseLevel, fontSize);
        }
        
        ctx.restore();
    },

    addInkSplatter(ctx, char, charIndex, lineIndex, seed, noiseLevel, inkRgb, fontSize) {
        ctx.save();
        ctx.font = `${fontSize}px serif`;
        const metrics = ctx.measureText(char);
        const width = metrics.width;
        const height = fontSize;
        
        const dotCount = Math.floor(noiseLevel * 25);
        
        for (let i = 0; i < dotCount; i++) {
            const dotSeed = seed + charIndex * 1000 + lineIndex * 5000 + i * 17;
            const dx = this.seededRandom(dotSeed) * (width + height * 0.4) - height * 0.2;
            const dy = this.seededRandom(dotSeed + 1) * (height + height * 0.4) - height * 0.2;
            const size = this.seededRandom(dotSeed + 2) * 1.8 + 0.3;
            const alpha = this.seededRandom(dotSeed + 3) * noiseLevel * 0.35;
            
            ctx.fillStyle = `rgba(${inkRgb.r}, ${inkRgb.g}, ${inkRgb.b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(dx, dy, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    addStrokeTexture(ctx, char, charIndex, lineIndex, seed, noiseLevel, fontSize) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        
        const holeCount = Math.floor(noiseLevel * 40);
        for (let i = 0; i < holeCount; i++) {
            const holeSeed = seed + charIndex * 2000 + lineIndex * 8000 + i * 23;
            const dx = this.seededRandom(holeSeed) * fontSize * 1.5;
            const dy = this.seededRandom(holeSeed + 1) * fontSize * 1.2;
            const size = this.seededRandom(holeSeed + 2) * 1.2 + 0.3;
            
            ctx.fillStyle = `rgba(0, 0, 0, ${this.seededRandom(holeSeed + 3) * 0.15 + 0.05})`;
            ctx.beginPath();
            ctx.arc(dx, dy, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    },

    measureText(ctx, text, fontSize, fontFamily, weight, charSpacing) {
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        let width = 0;
        for (let i = 0; i < text.length; i++) {
            width += ctx.measureText(text[i]).width + charSpacing;
        }
        return width;
    }
};

if (typeof window !== 'undefined') {
    window.TextEffects = TextEffects;
}
