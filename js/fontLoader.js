const FontLoader = {
    _loadedFonts: new Set(),
    _loadingPromises: new Map(),

    chineseFonts: {
        kaishu: {
            name: '楷书',
            displayName: 'KaiTi',
            fontFamily: '"KaiTi", "STKaiti", "楷体", "TW-Kai", serif',
            cdnFonts: [
                {
                    family: 'ZCOOL XiaoWei',
                    url: 'https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&display=swap',
                    weights: ['400']
                }
            ]
        },
        xingshu: {
            name: '行书',
            displayName: 'XingKai',
            fontFamily: '"STXingkai", "华文行楷", "KaiTi", "ZCOOL XiaoWei", cursive',
            cdnFonts: [
                {
                    family: 'Ma Shan Zheng',
                    url: 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap',
                    weights: ['400']
                },
                {
                    family: 'ZCOOL KuaiLe',
                    url: 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap',
                    weights: ['400']
                }
            ]
        },
        caoshu: {
            name: '草书',
            displayName: 'CaoShu',
            fontFamily: '"Long Cang", "STCaiyun", "华文彩云", "Ma Shan Zheng", cursive',
            cdnFonts: [
                {
                    family: 'Long Cang',
                    url: 'https://fonts.googleapis.com/css2?family=Long+Cang&display=swap',
                    weights: ['400']
                },
                {
                    family: 'Liu Jian Mao Cao',
                    url: 'https://fonts.googleapis.com/css2?family=Liu+Jian+Mao+Cao&display=swap',
                    weights: ['400']
                }
            ]
        },
        shoujie: {
            name: '瘦金体',
            displayName: 'ShouJin',
            fontFamily: '"Noto Serif SC", "STShouti", "华文宋体", "SimSun", serif',
            cdnFonts: [
                {
                    family: 'Noto Serif SC',
                    url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;300;400&display=swap',
                    weights: ['200', '300', '400']
                },
                {
                    family: 'ZCOOL XiaoWei',
                    url: 'https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&display=swap',
                    weights: ['400']
                }
            ]
        }
    },

    loadGoogleFont(fontFamily) {
        return new Promise((resolve, reject) => {
            if (this._loadedFonts.has(fontFamily)) {
                resolve(true);
                return;
            }

            if (this._loadingPromises.has(fontFamily)) {
                this._loadingPromises.get(fontFamily).then(resolve).catch(reject);
                return;
            }

            const fontConfig = this.chineseFonts[fontFamily];
            if (!fontConfig || !fontConfig.cdnFonts) {
                this._loadedFonts.add(fontFamily);
                resolve(true);
                return;
            }

            const loadPromises = fontConfig.cdnFonts.map(fontInfo => {
                return new Promise((res, rej) => {
                    const existingLink = document.querySelector(`link[href*="${encodeURIComponent(fontInfo.family)}"]`);
                    if (existingLink) {
                        res(true);
                        return;
                    }

                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = fontInfo.url;
                    link.onload = () => {
                        if (document.fonts && document.fonts.load) {
                            const fontWeights = fontInfo.weights || ['400'];
                            const fontLoadPromises = fontWeights.map(weight => 
                                document.fonts.load(`${weight} 16px "${fontInfo.family}"`)
                            );
                            Promise.all(fontLoadPromises).then(() => res(true)).catch(() => res(true));
                        } else {
                            setTimeout(() => res(true), 500);
                        }
                    };
                    link.onerror = () => res(false);
                    document.head.appendChild(link);
                });
            });

            const promise = Promise.all(loadPromises).then(results => {
                this._loadedFonts.add(fontFamily);
                this._loadingPromises.delete(fontFamily);
                return results.some(r => r);
            }).catch(err => {
                this._loadingPromises.delete(fontFamily);
                return false;
            });

            this._loadingPromises.set(fontFamily, promise);
            promise.then(resolve).catch(reject);
        });
    },

    getFontFamily(styleName) {
        const fontConfig = this.chineseFonts[styleName];
        if (!fontConfig) return 'serif';

        if (this._loadedFonts.has(styleName) && fontConfig.cdnFonts) {
            const cdnFamilies = fontConfig.cdnFonts.map(f => `"${f.family}"`).join(', ');
            return `${cdnFamilies}, ${fontConfig.fontFamily}`;
        }

        return fontConfig.fontFamily;
    },

    async loadAllFonts() {
        const promises = Object.keys(this.chineseFonts).map(name => this.loadGoogleFont(name));
        return Promise.all(promises);
    }
};

if (typeof window !== 'undefined') {
    window.FontLoader = FontLoader;
}
