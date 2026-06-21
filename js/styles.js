const HandwritingStyles = {
    kaishu: {
        name: '楷书',
        fontKey: 'kaishu',
        fontSize: 32,
        charSpacing: 2,
        lineHeight: 1.8,
        slantAngle: 0,
        inkDensity: 80,
        randomOffset: 2,
        strokeNoise: 20,
        weight: 'normal',
        description: '工整规范，端庄秀丽'
    },
    
    xingshu: {
        name: '行书',
        fontKey: 'xingshu',
        fontSize: 34,
        charSpacing: 0,
        lineHeight: 1.7,
        slantAngle: 3,
        inkDensity: 75,
        randomOffset: 4,
        strokeNoise: 35,
        weight: 'normal',
        description: '行云流水，自然流畅'
    },
    
    caoshu: {
        name: '草书',
        fontKey: 'caoshu',
        fontSize: 36,
        charSpacing: -2,
        lineHeight: 1.6,
        slantAngle: 8,
        inkDensity: 70,
        randomOffset: 6,
        strokeNoise: 50,
        weight: 'normal',
        description: '笔走龙蛇，气势磅礴'
    },
    
    shoujie: {
        name: '瘦金体',
        fontKey: 'shoujie',
        fontSize: 30,
        charSpacing: 4,
        lineHeight: 1.9,
        slantAngle: -2,
        inkDensity: 85,
        randomOffset: 1,
        strokeNoise: 15,
        weight: '300',
        description: '瘦挺爽利，铁画银钩'
    },
    
    custom: {
        name: '自定义',
        fontKey: 'custom',
        fontSize: 32,
        charSpacing: 2,
        lineHeight: 1.8,
        slantAngle: 0,
        inkDensity: 80,
        randomOffset: 3,
        strokeNoise: 30,
        weight: 'normal',
        description: '使用自定义字体'
    }
};

if (typeof window !== 'undefined') {
    window.HandwritingStyles = HandwritingStyles;
}
