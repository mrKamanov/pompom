/**
 * OCR API для распознавания текста с изображений.
 * Использует OCR.Space API: https://api.ocr.space/parse/image
 * Ключ API: K81724188988957 (бесплатный)
 */

/**
 * Распознает текст с изображения, используя OCR.Space API.
 * @param {string} base64Image - Изображение в формате data:image/png;base64,...
 * @returns {Promise<string>} - Распознанный текст.
 */
async function ocrSpaceRecognize(base64Image) {
    
    if (!base64Image || !base64Image.startsWith('data:image/')) {
        throw new Error('Некорректный формат base64-изображения.');
    }

    const formData = new FormData();
    formData.append('apikey', 'K81724188988957'); 
    formData.append('language', 'rus'); 
    formData.append('isOverlayRequired', 'false');
    formData.append('base64Image', base64Image);

    try {
        console.log("Отправка запроса на OCR.Space...");
        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        console.log("OCR.Space результат:", result);

        if (result.IsErroredOnProcessing) {
            throw new Error(`Ошибка на стороне OCR.Space: ${result.ErrorMessage.join(', ')}`);
        }
        
        if (!result.ParsedResults || result.ParsedResults.length === 0 || !result.ParsedResults[0].ParsedText) {
            throw new Error('Текст не найден или не распознан OCR.Space.');
        }

        
        const recognizedText = result.ParsedResults[0].ParsedText;
        console.log("Распознанный текст:", recognizedText);
        return recognizedText;

    } catch (error) {
        console.error('Критическая ошибка при обращении к OCR.Space:', error);
        throw error; 
    }
}


console.log('easyOCR.js: Модуль распознавания загружен.');
window.easyOCRRecognize = ocrSpaceRecognize;