class ExportManager {
    constructor() {
        this.worker = null;
        this.isExporting = false;
        this.currentTask = null;
        this.progressCallback = null;
    }

    initWorker() {
        if (this.worker) {
            this.worker.terminate();
        }
        
        try {
            this.worker = new Worker('js/render.worker.js');
            
            this.worker.onmessage = (e) => {
                this.handleWorkerMessage(e);
            };
            
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                this.handleError(error.message);
            };
            
            return true;
        } catch (error) {
            console.warn('Web Worker not supported, falling back to main thread:', error);
            return false;
        }
    }

    handleWorkerMessage(e) {
        const { type, data } = e.data;
        
        switch (type) {
            case 'progress':
                if (this.progressCallback) {
                    this.progressCallback(data.progress, data.message);
                }
                break;
            case 'result':
                this.handleResult(data);
                break;
            case 'error':
                this.handleError(data.error);
                break;
        }
    }

    handleResult(data) {
        this.isExporting = false;
        
        if (this.currentTask && this.currentTask.resolve) {
            if (data.imageData instanceof ArrayBuffer) {
                data.imageData = this.arrayBufferToDataUrl(data.imageData);
            }
            
            if (data.pages) {
                data.pages = data.pages.map(page => ({
                    ...page,
                    imageData: this.arrayBufferToDataUrl(page.imageData)
                }));
            }
            
            this.currentTask.resolve(data);
        }
        
        this.cleanup();
    }

    handleError(error) {
        this.isExporting = false;
        
        if (this.currentTask && this.currentTask.reject) {
            this.currentTask.reject(new Error(error));
        }
        
        this.cleanup();
    }

    cleanup() {
        this.currentTask = null;
        this.progressCallback = null;
    }

    arrayBufferToDataUrl(buffer) {
        const uint8Array = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        return `data:image/png;base64,${base64}`;
    }

    async exportPage(options, progressCallback = null) {
        if (this.isExporting) {
            throw new Error('另一个导出任务正在进行中');
        }
        
        this.isExporting = true;
        this.progressCallback = progressCallback;
        
        const useWorker = this.initWorker();
        
        return new Promise((resolve, reject) => {
            this.currentTask = { resolve, reject, type: 'page' };
            
            if (useWorker) {
                this.worker.postMessage({
                    type: 'renderPage',
                    data: { ...options, seed: Math.random() }
                });
            } else {
                this.exportPageFallback(options, resolve, reject);
            }
        });
    }

    async exportAllPages(options, progressCallback = null) {
        if (this.isExporting) {
            throw new Error('另一个导出任务正在进行中');
        }
        
        this.isExporting = true;
        this.progressCallback = progressCallback;
        
        const useWorker = this.initWorker();
        
        return new Promise((resolve, reject) => {
            this.currentTask = { resolve, reject, type: 'allPages' };
            
            if (useWorker) {
                this.worker.postMessage({
                    type: 'renderAllPages',
                    data: { ...options, seed: Math.random() }
                });
            } else {
                this.exportAllPagesFallback(options, resolve, reject);
            }
        });
    }

    async exportLongImage(options, progressCallback = null) {
        if (this.isExporting) {
            throw new Error('另一个导出任务正在进行中');
        }
        
        this.isExporting = true;
        this.progressCallback = progressCallback;
        
        const useWorker = this.initWorker();
        
        return new Promise((resolve, reject) => {
            this.currentTask = { resolve, reject, type: 'longImage' };
            
            if (useWorker) {
                this.worker.postMessage({
                    type: 'renderLongImage',
                    data: { ...options, seed: Math.random() }
                });
            } else {
                this.exportLongImageFallback(options, resolve, reject);
            }
        });
    }

    async exportPageFallback(options, resolve, reject) {
        try {
            const renderer = new HandwritingRenderer(document.createElement('canvas'));
            renderer.setOptions(options);
            renderer.seed = Math.random();
            
            if (this.progressCallback) {
                this.progressCallback(50, '正在渲染...');
            }
            
            const dataUrl = renderer.exportPageAsPNG(options.pageIndex || 0);
            
            if (this.progressCallback) {
                this.progressCallback(100, '完成');
            }
            
            this.isExporting = false;
            resolve({
                type: 'page',
                pageCount: renderer.getPageCount(),
                imageData: dataUrl
            });
            this.cleanup();
        } catch (error) {
            reject(error);
        }
    }

    async exportAllPagesFallback(options, resolve, reject) {
        try {
            const renderer = new HandwritingRenderer(document.createElement('canvas'));
            renderer.setOptions(options);
            renderer.seed = Math.random();
            
            const pageCount = renderer.getPageCount();
            const pages = [];
            
            for (let i = 0; i < pageCount; i++) {
                if (this.progressCallback) {
                    this.progressCallback(Math.round(((i + 1) / pageCount) * 100), `正在渲染第 ${i + 1}/${pageCount} 页...`);
                }
                
                const dataUrl = renderer.exportPageAsPNG(i);
                pages.push({
                    pageIndex: i,
                    imageData: dataUrl
                });
                
                await new Promise(r => setTimeout(r, 10));
            }
            
            if (this.progressCallback) {
                this.progressCallback(100, '完成');
            }
            
            this.isExporting = false;
            resolve({
                type: 'allPages',
                pageCount,
                pages
            });
            this.cleanup();
        } catch (error) {
            reject(error);
        }
    }

    async exportLongImageFallback(options, resolve, reject) {
        try {
            const renderer = new HandwritingRenderer(document.createElement('canvas'));
            renderer.setOptions(options);
            renderer.seed = Math.random();
            
            if (this.progressCallback) {
                this.progressCallback(50, '正在生成长图...');
            }
            
            const dataUrl = renderer.exportLongImage();
            
            if (this.progressCallback) {
                this.progressCallback(100, '完成');
            }
            
            this.isExporting = false;
            resolve({
                type: 'longImage',
                pageCount: renderer.getPageCount(),
                imageData: dataUrl
            });
            this.cleanup();
        } catch (error) {
            reject(error);
        }
    }

    cancel() {
        if (this.worker) {
            this.worker.postMessage({ type: 'cancel' });
            this.worker.terminate();
            this.worker = null;
        }
        
        if (this.currentTask && this.currentTask.reject) {
            this.currentTask.reject(new Error('用户取消'));
        }
        
        this.isExporting = false;
        this.cleanup();
    }

    downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showProgressModal(initialMessage = '正在处理...') {
        const modal = document.createElement('div');
        modal.id = 'exportProgressModal';
        modal.innerHTML = `
            <div class="progress-content">
                <h3 id="progressTitle">${initialMessage}</h3>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="progressBar" style="width: 0%"></div>
                </div>
                <p id="progressText">0%</p>
                <button id="cancelExportBtn" class="btn-cancel">取消</button>
            </div>
        `;
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .progress-content {
                background: white;
                padding: 30px 40px;
                border-radius: 12px;
                text-align: center;
                min-width: 300px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            }
            .progress-content h3 {
                margin: 0 0 20px 0;
                color: #333;
                font-size: 18px;
            }
            .progress-bar-container {
                width: 100%;
                height: 8px;
                background: #e0e0e0;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 10px;
            }
            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                border-radius: 4px;
                transition: width 0.3s ease;
            }
            .progress-content p {
                margin: 0 0 15px 0;
                color: #666;
                font-size: 14px;
            }
            .btn-cancel {
                padding: 8px 24px;
                border: none;
                background: #f0f0f0;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                color: #666;
                transition: all 0.3s;
            }
            .btn-cancel:hover {
                background: #e0e0e0;
            }
        `;
        
        modal.appendChild(style);
        document.body.appendChild(modal);
        
        document.getElementById('cancelExportBtn').addEventListener('click', () => {
            this.cancel();
            this.hideProgressModal();
        });
        
        return modal;
    }

    updateProgressModal(progress, message) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const progressTitle = document.getElementById('progressTitle');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
        if (progressTitle && message) {
            progressTitle.textContent = message;
        }
    }

    hideProgressModal() {
        const modal = document.getElementById('exportProgressModal');
        if (modal) {
            modal.remove();
        }
    }
}

if (typeof window !== 'undefined') {
    window.ExportManager = ExportManager;
}
