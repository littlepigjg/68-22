importScripts('paperEffects.js', 'textEffects.js');

class RenderWorker {
    constructor() {
        self.onmessage = this.handleMessage.bind(this);
        this._textLinesCache = null;
        this._cacheKey = '';
    }

    handleMessage(e) {
        const { type, data } = e.data;
        
        switch (type) {
            case 'renderPage':
                this.renderPage(data);
                break;
            case 'renderAllPages':
                this.renderAllPages(data);
                break;
            case 'renderLongImage':
                this.renderLongImage(data);
                break;
            case 'cancel':
                this.cancel();
                break;
        }
    }

    postProgress(progress, message) {
        self.postMessage({
            type: 'progress',
            data: { progress, message }
        });
    }

    postResult(type, data) {
        self.postMessage({
            type: 'result',
            data: { type, ...data }
        });
    }

    postError(error) {
        self.postMessage({
            type: 'error',
            data: { error }
        });
    }

    splitTextIntoLines(text, maxWidth, options) {
        const { fontSize, fontFamily, weight, charSpacing, seed } = options;
        const cacheKey = `${text}_${maxWidth}_${fontFamily}_${fontSize}_${charSpacing}_${weight}_${seed}`;
        
        if (this._textLinesCache && this._cacheKey === cacheKey) {
            return this._textLinesCache;
        }
        
        const canvas = new OffscreenCanvas(100, 100);
        const ctx = canvas.getContext('2d');
        
        const paragraphs = text.split('\n');
        const lines = [];
        
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        
        for (const paragraph of paragraphs) {
            if (paragraph === '') {
                lines.push('');
                continue;
            }
            
            let currentLine = '';
            let currentWidth = 0;
            
            for (let i = 0; i < paragraph.length; i++) {
                const char = paragraph[i];
                const charWidth = ctx.measureText(char).width + charSpacing;
                
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

    calculatePages(text, options) {
        const { pageWidth, pageHeight, padding, lineHeight, fontSize } = options;
        const contentWidth = pageWidth - padding * 2;
        const contentHeight = pageHeight - padding * 2;
        const lineHeightPx = fontSize * lineHeight;
        
        const lines = this.splitTextIntoLines(text, contentWidth, options);
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

    renderPageToCanvas(pageLines, pageIndex, options) {
        const { pageWidth, pageHeight, padding, fontSize, lineHeight, charSpacing,
                paperColor, inkColor, fontFamily, weight, slantAngle, inkDensity,
                randomOffset, strokeNoise, seed } = options;
        
        const canvas = new OffscreenCanvas(pageWidth, pageHeight);
        const ctx = canvas.getContext('2d');
        
        PaperEffects.addPaperTexture(ctx, pageWidth, pageHeight, paperColor, seed);
        PaperEffects.addPaperFiberEffect(ctx, pageWidth, pageHeight, paperColor, seed);
        
        const lineHeightPx = fontSize * lineHeight;
        const startY = padding;
        
        let charIndexOffset = 0;
        
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        
        for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
            const line = pageLines[lineIndex];
            const y = startY + lineIndex * lineHeightPx;
            let x = padding;
            
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                const globalCharIndex = charIndexOffset + charIndex;
                
                TextEffects.drawChar(ctx, char, x, y, {
                    charIndex: globalCharIndex,
                    lineIndex,
                    seed,
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
            }
            
            charIndexOffset += line.length;
        }
        
        return canvas;
    }

    async renderPage(options) {
        try {
            const { text, pageIndex, seed } = options;
            const pages = this.calculatePages(text, options);
            
            const actualPageIndex = Math.min(pageIndex, pages.length - 1);
            const pageLines = pages[actualPageIndex];
            
            this.postProgress(10, '准备渲染...');
            
            const canvas = this.renderPageToCanvas(pageLines, actualPageIndex, options);
            
            this.postProgress(90, '转换为图片...');
            
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            const arrayBuffer = await blob.arrayBuffer();
            
            this.postProgress(100, '完成');
            
            this.postResult('page', {
                pageIndex: actualPageIndex,
                pageCount: pages.length,
                imageData: arrayBuffer,
                width: canvas.width,
                height: canvas.height
            });
            
        } catch (error) {
            this.postError(error.message);
        }
    }

    async renderAllPages(options) {
        try {
            const { text, seed } = options;
            const pages = this.calculatePages(text, options);
            const results = [];
            
            for (let i = 0; i < pages.length; i++) {
                const progress = Math.round(((i + 1) / pages.length) * 100);
                this.postProgress(progress, `正在渲染第 ${i + 1}/${pages.length} 页...`);
                
                const canvas = this.renderPageToCanvas(pages[i], i, options);
                const blob = await canvas.convertToBlob({ type: 'image/png' });
                const arrayBuffer = await blob.arrayBuffer();
                
                results.push({
                    pageIndex: i,
                    imageData: arrayBuffer,
                    width: canvas.width,
                    height: canvas.height
                });
                
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            this.postProgress(100, '完成');
            
            this.postResult('allPages', {
                pageCount: pages.length,
                pages: results
            });
            
        } catch (error) {
            this.postError(error.message);
        }
    }

    async renderLongImage(options) {
        try {
            const { text, seed, pageWidth } = options;
            const pages = this.calculatePages(text, options);
            const canvases = [];
            
            for (let i = 0; i < pages.length; i++) {
                const progress = Math.round(((i + 1) / pages.length) * 80);
                this.postProgress(progress, `正在渲染第 ${i + 1}/${pages.length} 页...`);
                
                const canvas = this.renderPageToCanvas(pages[i], i, options);
                canvases.push(canvas);
                
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            this.postProgress(85, '正在拼接长图...');
            
            const totalHeight = canvases.reduce((sum, c) => sum + c.height, 0);
            const longCanvas = new OffscreenCanvas(pageWidth, totalHeight);
            const ctx = longCanvas.getContext('2d');
            
            let y = 0;
            for (const canvas of canvases) {
                ctx.drawImage(canvas, 0, y);
                y += canvas.height;
            }
            
            this.postProgress(95, '转换为图片...');
            
            const blob = await longCanvas.convertToBlob({ type: 'image/png' });
            const arrayBuffer = await blob.arrayBuffer();
            
            this.postProgress(100, '完成');
            
            this.postResult('longImage', {
                pageCount: pages.length,
                imageData: arrayBuffer,
                width: longCanvas.width,
                height: longCanvas.height
            });
            
        } catch (error) {
            this.postError(error.message);
        }
    }

    cancel() {
        this._textLinesCache = null;
        this._cacheKey = '';
    }
}

new RenderWorker();
