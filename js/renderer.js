class HandwritingRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            text: '',
            fontFamily: '"KaiTi", "STKaiti", "楷体", serif',
            fontSize: 32,
            charSpacing: 2,
            lineHeight: 1.8,
            slantAngle: 0,
            inkDensity: 80,
            randomOffset: 3,
            strokeNoise: 30,
            pageWidth: 800,
            pageHeight: 1150,
            padding: 60,
            paperColor: '#faf8f0',
            inkColor: '#2c2c2c',
            weight: 'normal'
        };
        this.pages = [];
        this.currentPage = 0;
        this.seed = Math.random();
        this._textLinesCache = null;
        this._cacheKey = '';
    }

    setOptions(options) {
        Object.assign(this.options, options);
        this.seed = Math.random();
        this._textLinesCache = null;
        this._cacheKey = '';
        PaperEffects.clearCache();
    }

    seededRandom(seed) {
        return TextEffects.seededRandom(seed);
    }

    hexToRgb(hex) {
        return TextEffects.hexToRgb(hex);
    }

    splitTextIntoLines(text, maxWidth, ctx) {
        const cacheKey = `${text}_${maxWidth}_${this.options.fontFamily}_${this.options.fontSize}_${this.options.charSpacing}_${this.options.weight}`;
        
        if (this._textLinesCache && this._cacheKey === cacheKey) {
            return this._textLinesCache;
        }
        
        const paragraphs = text.split('\n');
        const lines = [];
        
        ctx.font = `${this.options.weight} ${this.options.fontSize}px ${this.options.fontFamily}`;
        
        for (const paragraph of paragraphs) {
            if (paragraph === '') {
                lines.push('');
                continue;
            }
            
            let currentLine = '';
            let currentWidth = 0;
            
            for (let i = 0; i < paragraph.length; i++) {
                const char = paragraph[i];
                const charWidth = ctx.measureText(char).width + this.options.charSpacing;
                
                if (currentWidth + charWidth > maxWidth && currentLine !== '') {
                    lines.push(currentLine);
                    currentLine = char;
                    currentWidth = charWidth;
                } else {
                    currentLine += char;
                    currentWidth += charWidth;
                }
            }
            
            if (currentLine !== '') {
                lines.push(currentLine);
            }
        }
        
        this._textLinesCache = lines;
        this._cacheKey = cacheKey;
        
        return lines;
    }

    calculatePages() {
        const { pageWidth, pageHeight, padding, lineHeight, fontSize } = this.options;
        const contentWidth = pageWidth - padding * 2;
        const contentHeight = pageHeight - padding * 2;
        const lineHeightPx = fontSize * lineHeight;
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        const lines = this.splitTextIntoLines(this.options.text, contentWidth, tempCtx);
        const linesPerPage = Math.floor(contentHeight / lineHeightPx);
        
        const pages = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }
        
        if (pages.length === 0) {
            pages.push([]);
        }
        
        return pages;
    }

    renderPage(pageIndex) {
        const { pageWidth, pageHeight, padding, fontSize, lineHeight, charSpacing,
                paperColor, inkColor, fontFamily, weight, slantAngle, inkDensity,
                randomOffset, strokeNoise } = this.options;
        
        this.canvas.width = pageWidth;
        this.canvas.height = pageHeight;
        
        const ctx = this.ctx;
        
        PaperEffects.addPaperTexture(ctx, pageWidth, pageHeight, paperColor, this.seed);
        PaperEffects.addPaperFiberEffect(ctx, pageWidth, pageHeight, paperColor, this.seed);
        
        const pages = this.calculatePages();
        this.pages = pages;
        
        if (pageIndex >= pages.length) {
            pageIndex = pages.length - 1;
        }
        this.currentPage = pageIndex;
        
        const pageLines = pages[pageIndex];
        const lineHeightPx = fontSize * lineHeight;
        const startY = padding;
        
        let charIndexOffset = 0;
        for (let i = 0; i < pageIndex; i++) {
            charIndexOffset += pages[i].reduce((sum, line) => sum + line.length, 0);
        }
        
        let charCount = 0;
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        
        for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
            const line = pageLines[lineIndex];
            const y = startY + lineIndex * lineHeightPx;
            let x = padding;
            
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                const globalCharIndex = charIndexOffset + charCount;
                
                TextEffects.drawChar(ctx, char, x, y, {
                    charIndex: globalCharIndex,
                    lineIndex,
                    seed: this.seed,
                    fontSize,
                    fontFamily,
                    weight,
                    slantAngle,
                    inkColor,
                    inkDensity,
                    randomOffset,
                    strokeNoise
                });
                
                const charWidth = ctx.measureText(char).width + charSpacing;
                x += charWidth;
                charCount++;
            }
        }
        
        return pages.length;
    }

    generateAllPages() {
        const pages = this.calculatePages();
        const canvases = [];
        
        const originalCanvas = this.canvas;
        const originalCtx = this.ctx;
        
        for (let i = 0; i < pages.length; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = this.options.pageWidth;
            canvas.height = this.options.pageHeight;
            
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            
            this.renderPage(i);
            
            canvases.push(canvas);
        }
        
        this.canvas = originalCanvas;
        this.ctx = originalCtx;
        
        return canvases;
    }

    exportPageAsPNG(pageIndex = this.currentPage) {
        this.renderPage(pageIndex);
        return this.canvas.toDataURL('image/png');
    }

    exportAllPagesAsPNG() {
        const canvases = this.generateAllPages();
        return canvases.map(canvas => canvas.toDataURL('image/png'));
    }

    async exportAllPagesAsync(progressCallback = null) {
        const pages = this.calculatePages();
        const results = [];
        
        for (let i = 0; i < pages.length; i++) {
            if (progressCallback) {
                progressCallback(Math.round(((i + 1) / pages.length) * 100), `正在渲染第 ${i + 1}/${pages.length} 页...`);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = this.options.pageWidth;
            canvas.height = this.options.pageHeight;
            
            const originalCanvas = this.canvas;
            const originalCtx = this.ctx;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            
            this.renderPage(i);
            
            this.canvas = originalCanvas;
            this.ctx = originalCtx;
            
            results.push(canvas.toDataURL('image/png'));
            
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        return results;
    }

    exportLongImage() {
        const canvases = this.generateAllPages();
        const width = this.options.pageWidth;
        const totalHeight = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
        
        const longCanvas = document.createElement('canvas');
        longCanvas.width = width;
        longCanvas.height = totalHeight;
        
        const ctx = longCanvas.getContext('2d');
        
        let y = 0;
        for (const canvas of canvases) {
            ctx.drawImage(canvas, 0, y);
            y += canvas.height;
        }
        
        return longCanvas.toDataURL('image/png');
    }

    async exportLongImageAsync(progressCallback = null) {
        const pages = this.calculatePages();
        const canvases = [];
        
        for (let i = 0; i < pages.length; i++) {
            if (progressCallback) {
                progressCallback(Math.round(((i + 1) / pages.length) * 80), `正在渲染第 ${i + 1}/${pages.length} 页...`);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = this.options.pageWidth;
            canvas.height = this.options.pageHeight;
            
            const originalCanvas = this.canvas;
            const originalCtx = this.ctx;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            
            this.renderPage(i);
            
            this.canvas = originalCanvas;
            this.ctx = originalCtx;
            
            canvases.push(canvas);
            
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        if (progressCallback) {
            progressCallback(85, '正在拼接长图...');
        }
        
        const width = this.options.pageWidth;
        const totalHeight = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
        
        const longCanvas = document.createElement('canvas');
        longCanvas.width = width;
        longCanvas.height = totalHeight;
        
        const ctx = longCanvas.getContext('2d');
        
        let y = 0;
        for (const canvas of canvases) {
            ctx.drawImage(canvas, 0, y);
            y += canvas.height;
        }
        
        if (progressCallback) {
            progressCallback(100, '完成');
        }
        
        return longCanvas.toDataURL('image/png');
    }

    getPageCount() {
        return this.calculatePages().length;
    }
}

if (typeof window !== 'undefined') {
    window.HandwritingRenderer = HandwritingRenderer;
}
