class FontManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:5000/api';
        this.uploadedFonts = new Map();
        this.currentFontId = null;
        this.init();
    }

    init() {
        this.loadSavedFonts();
    }

    async loadSavedFonts() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/fonts`);
            if (response.ok) {
                const data = await response.json();
                if (data.fonts) {
                    data.fonts.forEach(font => {
                        this.uploadedFonts.set(font.id, font);
                    });
                }
            }
        } catch (error) {
            console.warn('无法从服务端加载字体列表:', error);
        }
    }

    async uploadFont(file, onProgress = null) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('请选择字体文件'));
                return;
            }

            const maxSize = 50 * 1024 * 1024;
            if (file.size > maxSize) {
                reject(new Error('字体文件过大（最大50MB），请选择较小的字体文件'));
                return;
            }

            const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
            const fileName = file.name.toLowerCase();
            const isValid = validExtensions.some(ext => fileName.endsWith(ext));
            
            if (!isValid) {
                reject(new Error('不支持的文件格式，请上传TTF、OTF、WOFF或WOFF2格式的字体文件'));
                return;
            }

            const formData = new FormData();
            formData.append('font', file);

            const xhr = new XMLHttpRequest();
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    onProgress(progress, '上传中...');
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            const fontInfo = {
                                id: response.fontId || Date.now().toString(),
                                name: file.name,
                                fontFamily: response.fontFamily || `CustomFont_${Date.now()}`,
                                path: response.fontPath,
                                size: file.size,
                                uploadTime: new Date().toISOString()
                            };
                            
                            this.uploadedFonts.set(fontInfo.id, fontInfo);
                            this.currentFontId = fontInfo.id;
                            
                            this.loadFontInBrowser(response.fontPath, fontInfo.fontFamily)
                                .then(() => resolve(fontInfo))
                                .catch(() => resolve(fontInfo));
                        } else {
                            reject(new Error(response.error || '上传失败'));
                        }
                    } catch (error) {
                        reject(new Error('服务器响应格式错误'));
                    }
                } else {
                    reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error('网络错误，请检查服务端是否启动'));
            };

            xhr.onabort = () => {
                reject(new Error('上传已取消'));
            };

            xhr.open('POST', `${this.apiBaseUrl}/upload-font`);
            xhr.send(formData);
        });
    }

    async loadFontInBrowser(fontPath, fontFamily) {
        try {
            const fontUrl = `http://localhost:5000${fontPath}`;
            const fontFace = new FontFace(fontFamily, `url(${fontUrl})`);
            const loadedFace = await fontFace.load();
            document.fonts.add(loadedFace);
            return true;
        } catch (error) {
            console.warn('无法在浏览器中加载字体:', error);
            return false;
        }
    }

    async deleteFont(fontId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/fonts/${fontId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.uploadedFonts.delete(fontId);
                if (this.currentFontId === fontId) {
                    this.currentFontId = null;
                }
                return true;
            }
            return false;
        } catch (error) {
            console.warn('删除字体失败:', error);
            return false;
        }
    }

    getFontById(fontId) {
        return this.uploadedFonts.get(fontId);
    }

    getCurrentFont() {
        return this.currentFontId ? this.uploadedFonts.get(this.currentFontId) : null;
    }

    setCurrentFont(fontId) {
        if (this.uploadedFonts.has(fontId)) {
            this.currentFontId = fontId;
            return true;
        }
        return false;
    }

    getAllFonts() {
        return Array.from(this.uploadedFonts.values());
    }

    getFontFamily(fontId) {
        const font = this.uploadedFonts.get(fontId);
        if (font) {
            return `'${font.fontFamily}', serif`;
        }
        return 'serif';
    }

    clearAll() {
        this.uploadedFonts.clear();
        this.currentFontId = null;
    }
}

if (typeof window !== 'undefined') {
    window.FontManager = FontManager;
}
