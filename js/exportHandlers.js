class ExportHandlers {
    constructor(app) {
        this.app = app;
    }

    getExportOptions() {
        const options = { ...this.app.renderer.options };
        options.text = document.getElementById('textInput').value;
        return options;
    }

    async exportCurrentPage() {
        if (this.app.exportManager.isExporting) {
            alert('另一个导出任务正在进行中，请稍候...');
            return;
        }

        try {
            const options = this.getExportOptions();
            options.pageIndex = this.app.renderer.currentPage;

            const result = await this.app.exportManager.exportLongImage(
                options,
                (progress, message) => {
                    this.app.exportManager.updateProgressModal(progress, message);
                }
            );

            this.app.exportManager.downloadImage(
                result.imageData,
                `handwriting_page_${this.app.renderer.currentPage + 1}.png`
            );

        } catch (error) {
            if (error.message !== '用户取消') {
                console.error('导出失败:', error);
                alert('导出失败: ' + error.message);
            }
        } finally {
            this.app.exportManager.hideProgressModal();
        }
    }

    async exportCurrentPageDirect() {
        if (this.app.exportManager.isExporting) {
            alert('另一个导出任务正在进行中，请稍候...');
            return;
        }

        try {
            this.app.exportManager.showProgressModal('正在导出当前页...');
            
            const options = this.getExportOptions();
            options.pageIndex = this.app.renderer.currentPage;

            const result = await this.app.exportManager.exportPage(
                options,
                (progress, message) => {
                    this.app.exportManager.updateProgressModal(progress, message);
                }
            );

            this.app.exportManager.downloadImage(
                result.imageData,
                `handwriting_page_${result.pageIndex + 1}.png`
            );

        } catch (error) {
            if (error.message !== '用户取消') {
                console.error('导出失败:', error);
                alert('导出失败: ' + error.message);
            }
        } finally {
            this.app.exportManager.hideProgressModal();
        }
    }

    async exportAllPages() {
        if (this.app.exportManager.isExporting) {
            alert('另一个导出任务正在进行中，请稍候...');
            return;
        }

        const total = this.app.renderer.getPageCount();
        if (!confirm(`确定要导出 ${total} 页PNG图片吗？`)) return;

        try {
            this.app.exportManager.showProgressModal('正在导出所有页面...');
            
            const options = this.getExportOptions();

            const result = await this.app.exportManager.exportAllPages(
                options,
                (progress, message) => {
                    this.app.exportManager.updateProgressModal(progress, message);
                }
            );

            result.pages.forEach((page, index) => {
                setTimeout(() => {
                    this.app.exportManager.downloadImage(
                        page.imageData,
                        `handwriting_page_${index + 1}.png`
                    );
                }, index * 300);
            });

        } catch (error) {
            if (error.message !== '用户取消') {
                console.error('导出失败:', error);
                alert('导出失败: ' + error.message);
            }
        } finally {
            this.app.exportManager.hideProgressModal();
        }
    }

    async exportLongImage() {
        if (this.app.exportManager.isExporting) {
            alert('另一个导出任务正在进行中，请稍候...');
            return;
        }

        const total = this.app.renderer.getPageCount();

        try {
            this.app.exportManager.showProgressModal(`正在生成 ${total} 页长图...`);
            
            const options = this.getExportOptions();

            const result = await this.app.exportManager.exportLongImage(
                options,
                (progress, message) => {
                    this.app.exportManager.updateProgressModal(progress, message);
                }
            );

            this.app.exportManager.downloadImage(
                result.imageData,
                `handwriting_long_${result.pageCount}页.png`
            );

        } catch (error) {
            if (error.message !== '用户取消') {
                console.error('导出失败:', error);
                alert('导出失败: ' + error.message);
            }
        } finally {
            this.app.exportManager.hideProgressModal();
        }
    }

    async exportViaServer(exportType) {
        const options = this.getExportOptions();
        
        try {
            this.app.exportManager.showProgressModal('正在请求服务端生成...');
            
            const response = await fetch('http://localhost:5000/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: options.text,
                    options: options
                })
            });

            if (!response.ok) {
                throw new Error('服务端响应错误');
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || '生成失败');
            }

            this.app.exportManager.updateProgressModal(100, '完成');
            
            if (exportType === 'long') {
                data.pages.forEach((page, index) => {
                    setTimeout(() => {
                        this.app.exportManager.downloadImage(
                            page.image,
                            `handwriting_page_${index + 1}.png`
                        );
                    }, index * 300);
                });
            } else {
                this.app.exportManager.downloadImage(
                    data.pages[0].image,
                    `handwriting_${exportType}.png`
                );
            }

        } catch (error) {
            console.warn('服务端导出失败，使用本地导出:', error);
            if (exportType === 'all') {
                await this.exportAllPages();
            } else if (exportType === 'long') {
                await this.exportLongImage();
            } else {
                await this.exportCurrentPageDirect();
            }
        } finally {
            this.app.exportManager.hideProgressModal();
        }
    }
}

if (typeof window !== 'undefined') {
    window.ExportHandlers = ExportHandlers;
}
