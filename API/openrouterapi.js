// PomPom openrouterapi.js — версия 1.12
// Модуль для работы с OpenRouter API
// https://openrouter.ai/docs

/**
 * Отправка запроса к OpenRouter API
 * @param {string} prompt - Текст запроса
 * @param {string} apiKey - Ключ OpenRouter API
 * @param {object} options - Дополнительные параметры (например, model)
 * @returns {Promise<string>} - Ответ AI
 */
async function sendToOpenRouter(prompt, apiKey, options = {}) {
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    const model = options.model || 'google/gemma-3-27b-it:free';

    if (typeof prompt !== 'string') {
        throw new Error('Prompt должен быть строкой!');
    }
    const requestBody = {
        model,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ]
    };
    const body = JSON.stringify(requestBody);
    console.log('[OpenRouter] Итоговый requestBody:', requestBody);

    console.log('[OpenRouter] Endpoint:', endpoint);
    console.log('[OpenRouter] Request headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    });
    console.log('[OpenRouter] Request body:', body);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body
    });

    const responseText = await response.text();
    console.log('[OpenRouter] Response status:', response.status);
    console.log('[OpenRouter] Response text:', responseText);
    if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        throw new Error(`Ошибка при разборе ответа от OpenRouter: ${e.message}`);
    }
    
    return data.choices?.[0]?.message?.content || '';
}


export { sendToOpenRouter }; 