class EventHandlers {
    constructor(app) {
        this.app = app;
    }

    bindStyleButtons() {
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const style = e.target.dataset.style;
                await this.applyStyle(style);
                this.app.generatePreview();
            });
        });
    }

    async applyStyle(styleName) {
        this.app.currentStyle = styleName;
        
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-style="${styleName}"]`).classList.add('active');
        
        const style = HandwritingStyles[styleName];
        if (!style) return;
        
        const options = { ...style };
        delete options.name;
        delete options.description;
        delete options.fontKey;
        
        if (style.fontKey && style.fontKey !== 'custom') {
            await FontLoader.loadGoogleFont(style.fontKey);
            options.fontFamily = FontLoader.getFontFamily(style.fontKey);
        } else if (styleName === 'custom' && this.app.customFontFamily) {
            options.fontFamily = this.app.customFontFamily;
        }
        
        this.app.renderer.setOptions(options);
        this.updateUIFromOptions(options);
    }

    bindColorButtons() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.app.renderer.setOptions({ paperColor: e.target.dataset.color });
                this.app.generatePreview();
            });
        });

        document.querySelectorAll('.ink-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.ink-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.app.renderer.setOptions({ inkColor: e.target.dataset.color });
                this.app.generatePreview();
            });
        });
    }

    bindParamSliders() {
        const params = ['fontSize', 'charSpacing', 'lineHeight', 'slantAngle', 'inkDensity', 'randomOffset', 'strokeNoise', 'pageWidth', 'pageHeight', 'padding'];
        
        params.forEach(param => {
            const input = document.getElementById(param);
            const valueDisplay = document.getElementById(param + 'Value');
            
            if (input && valueDisplay) {
                input.addEventListener('input', (e) => {
                    this.updateParamDisplay(param, e.target.value);
                    this.updateRendererOption(param, e.target.value);
                    this.app.debouncedGenerate();
                });
            }
        });
    }

    bindTextInput() {
        document.getElementById('textInput').addEventListener('input', () => {
            this.app.debouncedGenerate();
        });
    }

    bindActionButtons() {
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.app.renderer.seed = Math.random();
            this.app.generatePreview();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.app.exportCurrentPage();
        });

        document.getElementById('exportAllBtn').addEventListener('click', () => {
            this.app.exportAllPages();
        });

        document.getElementById('exportLongBtn').addEventListener('click', () => {
            this.app.exportLongImage();
        });
    }

    bindPageNavigation() {
        document.getElementById('prevPage').addEventListener('click', () => {
            this.app.changePage(-1);
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            this.app.changePage(1);
        });
    }

    bindFontUpload() {
        document.getElementById('fontFile').addEventListener('change', (e) => {
            this.handleFontUpload(e.target.files[0]);
        });
    }

    async handleFontUpload(file) {
        if (!file) return;
        
        const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!isValid) {
            alert('请上传TTF、OTF、WOFF或WOFF2格式的字体文件');
            return;
        }
        
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('字体文件过大（最大50MB），请选择较小的字体文件');
            return;
        }
        
        let useServer = true;
        try {
            const response = await fetch('http://localhost:5000/api/fonts', {
                method: 'HEAD'
            });
            useServer = response.ok;
        } catch (error) {
            useServer = false;
        }
        
        if (useServer && this.app.fontManager) {
            try {
                this.app.exportManager.showProgressModal('正在上传字体...');
                
                const fontInfo = await this.app.fontManager.uploadFont(file, (progress, message) => {
                    this.app.exportManager.updateProgressModal(progress, message);
                });
                
                this.app.exportManager.hideProgressModal();
                
                this.app.customFontFamily = `'${fontInfo.fontFamily}', serif`;
                document.getElementById('fontName').textContent = `✓ ${fontInfo.name} (已保存到服务端)`;
                
                await this.applyStyle('custom');
                this.app.renderer.setOptions({ fontFamily: this.app.customFontFamily });
                this.app.generatePreview();
                
            } catch (error) {
                this.app.exportManager.hideProgressModal();
                console.warn('服务端上传失败，使用浏览器本地上传:', error);
                this.handleFontUploadBrowser(file);
            }
        } else {
            this.handleFontUploadBrowser(file);
        }
    }

    handleFontUploadBrowser(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fontData = e.target.result;
            const fontName = 'CustomHandwritingFont';
            
            const fontFace = new FontFace(fontName, fontData);
            fontFace.load().then((loadedFace) => {
                document.fonts.add(loadedFace);
                
                this.app.customFontFamily = `'${fontName}', serif`;
                
                document.getElementById('fontName').textContent = `✓ ${file.name} (本地临时)`;
                
                this.applyStyle('custom');
                this.app.renderer.setOptions({ fontFamily: this.app.customFontFamily });
                this.app.generatePreview();
            }).catch((err) => {
                console.error('字体加载失败:', err);
                alert('字体加载失败，请检查文件格式');
            });
        };
        reader.readAsArrayBuffer(file);
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.app.renderer.seed = Math.random();
                this.app.generatePreview();
            }
        });
    }

    updateParamDisplay(param, value) {
        const valueDisplay = document.getElementById(param + 'Value');
        if (!valueDisplay) return;
        
        switch (param) {
            case 'fontSize':
            case 'charSpacing':
            case 'randomOffset':
            case 'pageWidth':
            case 'pageHeight':
            case 'padding':
                valueDisplay.textContent = value + 'px';
                break;
            case 'lineHeight':
                valueDisplay.textContent = parseFloat(value).toFixed(1);
                break;
            case 'slantAngle':
                valueDisplay.textContent = value + '°';
                break;
            case 'inkDensity':
            case 'strokeNoise':
                valueDisplay.textContent = value + '%';
                break;
            default:
                valueDisplay.textContent = value;
        }
    }

    updateRendererOption(param, value) {
        const numValue = parseFloat(value);
        this.app.renderer.setOptions({ [param]: numValue });
    }

    updateUIFromOptions(options) {
        const paramMap = {
            fontSize: 'fontSize',
            charSpacing: 'charSpacing',
            lineHeight: 'lineHeight',
            slantAngle: 'slantAngle',
            inkDensity: 'inkDensity',
            randomOffset: 'randomOffset',
            strokeNoise: 'strokeNoise'
        };
        
        for (const [optionKey, inputId] of Object.entries(paramMap)) {
            const input = document.getElementById(inputId);
            if (input && options[optionKey] !== undefined) {
                input.value = options[optionKey];
                this.updateParamDisplay(inputId, options[optionKey]);
            }
        }
    }

    bindAll() {
        this.bindStyleButtons();
        this.bindColorButtons();
        this.bindParamSliders();
        this.bindTextInput();
        this.bindActionButtons();
        this.bindPageNavigation();
        this.bindFontUpload();
        this.bindKeyboardShortcuts();
    }
}

if (typeof window !== 'undefined') {
    window.EventHandlers = EventHandlers;
}
