// PomPom openrouterapi.js — версия 1.12
// Модуль для работы с OpenRouter API
// https://openrouter.ai/docs

/**
 * Отправляет запрос к OpenRouter API
 * @param {Array<Object>} messages - Массив сообщений для отправки
 * @param {string} apiKey - Ключ API
 * @param {Object} options - Опции, включая модель
 * @returns {Promise<string>} - Ответ AI
 */
async function sendToOpenRouter(messages, apiKey, options) {
    const { model } = options;

    if (!apiKey) {
        throw new Error("OpenRouter API key is not set.");
    }

    if (!model) {
        throw new Error("OpenRouter model is not specified.");
    }

    const body = {
        model: model,
        messages: messages, 
        stream: false, 
    };

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenRouter API error (status ${response.status}): ${errorData.error.message}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error("Error sending request to OpenRouter:", error);
        throw error;
    }
}

export { sendToOpenRouter }; 