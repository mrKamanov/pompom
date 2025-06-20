// AIMLAPI.com API logic

export async function sendAIMLAPIRequest(tab, prompt, selectedText, apiKey, model) {
  const combinedText = `Инструкция: ${prompt}\n\nЗадача: ${selectedText}`;
  const requestBody = {
    model: model || "google/gemma-3-27b-it",
    messages: [
      {
        role: "user",
        content: combinedText
      }
    ],
    temperature: 0.7,
    top_p: 0.7,
    frequency_penalty: 1,
    max_output_tokens: 512,
    top_k: 50
  };
  try {
    const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Ошибка при разборе ответа от API: ${e.message}`);
    }
    if (response.status !== 200 && response.status !== 201) {
      const errorMessage = data.error?.message || data.error || 'Неизвестная ошибка';
      throw new Error(`API вернул ошибку: ${response.status} - ${errorMessage}`);
    }
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error(`Неожиданный формат ответа от API: ${JSON.stringify(data)}`);
    }
    const result = data.choices[0].message?.content;
    if (!result) {
      throw new Error(`Не удалось получить результат из ответа API: ${JSON.stringify(data)}`);
    }
    return result;
  } catch (error) {
    throw error;
  }
} 