// Создаем пункт контекстного меню
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "processText",
    title: "Обработать текст",
    contexts: ["selection"]
  });
});

// Функция для отправки сообщения на вкладку
async function sendMessageToTab(tab, message) {
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.log('Ошибка отправки сообщения:', error);
    // Если content script не загружен, загружаем его
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    // Повторяем отправку сообщения
    await chrome.tabs.sendMessage(tab.id, message);
  }
}

// Функция для получения выделенного текста
async function getSelectedText(tab) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection();
        console.log('Selection object:', selection);
        const text = selection.toString();
        console.log('Selected text:', text);
        return text;
      }
    });
    console.log('Results from executeScript:', results);
    return results[0].result;
  } catch (error) {
    console.error('Error getting selected text:', error);
    return '';
  }
}

// Обработчик клика по пункту меню
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "processText") {
    try {
      console.log('Menu clicked, info:', info);
      console.log('Current tab:', tab);

      // Получаем выделенный текст
      const selectedText = await getSelectedText(tab);
      console.log('Полученный выделенный текст:', selectedText);

      if (!selectedText || selectedText.trim() === '') {
        console.log('Текст не выделен или пустой');
        await sendMessageToTab(tab, {
          action: "showResult",
          result: "Пожалуйста, выделите текст перед использованием расширения."
        });
        return;
      }

      // Получаем сохраненные настройки
      const settings = await chrome.storage.sync.get(['prompt', 'apiKey']);
      
      if (!settings.apiKey) {
        await sendMessageToTab(tab, {
          action: "showResult",
          result: "Пожалуйста, укажите API Key в настройках расширения."
        });
        return;
      }

      const prompt = settings.prompt || "Напиши только ответ. Кратко и понятно. Если это код, то исправь в нем ошибки, если они есть и покажи целиком. Если в коде пропуски, то дополни его.";
      const combinedText = `Инструкция: ${prompt}\n\nЗадача: ${selectedText}`;

      console.log('Отправляемый текст:', combinedText);

      const requestBody = {
        model: "google/gemma-3n-e4b-it",
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

      console.log('Отправляемый запрос:', JSON.stringify(requestBody, null, 2));

      // API запрос с использованием сохраненного токена
      const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Parsed response:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.error('Error parsing response:', e);
        throw new Error(`Ошибка при разборе ответа от API: ${e.message}`);
      }

      // Проверяем успешный статус (200 или 201)
      if (response.status !== 200 && response.status !== 201) {
        const errorMessage = data.error?.message || data.error || 'Неизвестная ошибка';
        console.error('API Error:', errorMessage);
        throw new Error(`API вернул ошибку: ${response.status} - ${errorMessage}`);
      }
      
      // Проверяем структуру ответа
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('Неожиданный формат ответа:', data);
        throw new Error(`Неожиданный формат ответа от API: ${JSON.stringify(data)}`);
      }

      const result = data.choices[0].message?.content;
      if (!result) {
        throw new Error(`Не удалось получить результат из ответа API: ${JSON.stringify(data)}`);
      }

      // Отправляем результат в content script
      await sendMessageToTab(tab, {
        action: "showResult",
        result: result
      });
    } catch (error) {
      console.error('Error:', error);
      // Отправляем сообщение об ошибке
      await sendMessageToTab(tab, {
        action: "showResult",
        result: `Произошла ошибка при обработке запроса: ${error.message}`
      });
    }
  }
}); 