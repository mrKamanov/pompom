/**
 * background.js - Фоновый скрипт расширения PomPom
 * 
 * Этот файл отвечает за:
 * 1. Создание контекстного меню для обработки выделенного текста
 * 2. Взаимодействие с AI API для обработки текста
 * 3. Управление настройками расширения
 * 4. Обработку ошибок и валидацию данных
 * 
 * Основные функции:
 * - Инициализация контекстного меню при установке расширения
 * - Получение выделенного текста из активной вкладки
 * - Отправка запросов к AI API с использованием сохраненного ключа
 * - Обработка ответов от API и их форматирование
 * - Управление состоянием расширения через chrome.storage
 * 
 * @author Сергей Каманов
 * @version 1.0
 */

async function createContextMenu() {
  const settings = await chrome.storage.sync.get([
    'prompt1Title', 'prompt2Title', 'prompt3Title'
  ]);
  const title1 = '🟢 ' + (settings.prompt1Title || 'Промпт 1');
  const title2 = '🔵 ' + (settings.prompt2Title || 'Промпт 2');
  const title3 = '🟣 ' + (settings.prompt3Title || 'Промпт 3');
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "processTextRoot",
      title: "Обработать текст",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "processText_prompt1",
      parentId: "processTextRoot",
      title: title1,
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "processText_prompt2",
      parentId: "processTextRoot",
      title: title2,
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "processText_prompt3",
      parentId: "processTextRoot",
      title: title3,
      contexts: ["selection"]
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (
    changes.prompt1Title || changes.prompt2Title || changes.prompt3Title
  )) {
    createContextMenu();
  }
});

async function sendMessageToTab(tab, message) {
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    console.log('Ошибка отправки сообщения:', error);
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    await chrome.tabs.sendMessage(tab.id, message);
  }
}


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


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith("processText_prompt")) {
    try {
      console.log('Menu clicked, info:', info);
      console.log('Current tab:', tab);
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
      const settings = await chrome.storage.sync.get(['prompt1', 'prompt2', 'prompt3', 'apiKey']);
      if (!settings.apiKey) {
        await sendMessageToTab(tab, {
          action: "showResult",
          result: "Пожалуйста, укажите API Key в настройках расширения."
        });
        return;
      }
      let prompt = '';
      if (info.menuItemId === 'processText_prompt1') {
        prompt = settings.prompt1 || '';
      } else if (info.menuItemId === 'processText_prompt2') {
        prompt = settings.prompt2 || '';
      } else if (info.menuItemId === 'processText_prompt3') {
        prompt = settings.prompt3 || '';
      }
      if (!prompt) {
        await sendMessageToTab(tab, {
          action: "showResult",
          result: "Промпт не задан в настройках."
        });
        return;
      }
      const combinedText = `Инструкция: ${prompt}\n\nЗадача: ${selectedText}`;
      console.log('Отправляемый текст:', combinedText);
      const requestBody = {
        model: "google/gemma-3-27b-it",
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
      if (response.status !== 200 && response.status !== 201) {
        const errorMessage = data.error?.message || data.error || 'Неизвестная ошибка';
        console.error('API Error:', errorMessage);
        throw new Error(`API вернул ошибку: ${response.status} - ${errorMessage}`);
      }
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('Неожиданный формат ответа:', data);
        throw new Error(`Неожиданный формат ответа от API: ${JSON.stringify(data)}`);
      }
      const result = data.choices[0].message?.content;
      if (!result) {
        throw new Error(`Не удалось получить результат из ответа API: ${JSON.stringify(data)}`);
      }
      await sendMessageToTab(tab, {
        action: "showResult",
        result: result
      });
    } catch (error) {
      console.error('Error:', error);
      await sendMessageToTab(tab, {
        action: "showResult",
        result: `Произошла ошибка при обработке запроса: ${error.message}`
      });
    }
  }
});


chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'chatMessage') {
        try {
            const settings = await chrome.storage.sync.get(['prompt', 'apiKey']);
            
            if (!settings.apiKey) {
                await sendMessageToTab(sender.tab, {
                    action: "chatResponse",
                    result: "Пожалуйста, укажите API Key в настройках расширения."
                });
                return;
            }

            const prompt = settings.prompt || "Напиши только ответ. Кратко и понятно. Если это код, то исправь в нем ошибки, если они есть и покажи целиком. Если в коде пропуски, то дополни его.";
            
            
            const messages = [
                {
                    role: "system",
                    content: prompt
                },
                ...message.history,
                {
                    role: "user",
                    content: message.message
                }
            ];

            const requestBody = {
                model: "google/gemma-3-27b-it",
                messages: messages,
                temperature: 0.7,
                top_p: 0.7,
                frequency_penalty: 1,
                max_output_tokens: 512,
                top_k: 50
            };

            const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

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

            await sendMessageToTab(sender.tab, {
                action: "chatResponse",
                result: result
            });
        } catch (error) {
            console.error('Error:', error);
            await sendMessageToTab(sender.tab, {
                action: "chatResponse",
                result: `Произошла ошибка при обработке запроса: ${error.message}`
            });
        }
    }
});

async function processSelectedTextWithPrompt(tab, promptIndex) {
  const selectedText = await getSelectedText(tab);
  if (!selectedText || selectedText.trim() === '') {
    await sendMessageToTab(tab, {
      action: "showResult",
      result: "Пожалуйста, выделите текст перед использованием горячей клавиши."
    });
    return;
  }
  const settings = await chrome.storage.sync.get([
    'prompt1', 'prompt2', 'prompt3', 'apiKey'
  ]);
  if (!settings.apiKey) {
    await sendMessageToTab(tab, {
      action: "showResult",
      result: "Пожалуйста, укажите API Key в настройках расширения."
    });
    return;
  }
  let prompt = '';
  if (promptIndex === 1) prompt = settings.prompt1 || '';
  if (promptIndex === 2) prompt = settings.prompt2 || '';
  if (promptIndex === 3) prompt = settings.prompt3 || '';
  if (!prompt) {
    await sendMessageToTab(tab, {
      action: "showResult",
      result: "Промпт не задан в настройках."
    });
    return;
  }
  const combinedText = `Инструкция: ${prompt}\n\nЗадача: ${selectedText}`;
  const requestBody = {
    model: "google/gemma-3-27b-it",
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
  const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    await sendMessageToTab(tab, {
      action: "showResult",
      result: `Ошибка при разборе ответа от API: ${e.message}`
    });
    return;
  }
  if (response.status !== 200 && response.status !== 201) {
    const errorMessage = data.error?.message || data.error || 'Неизвестная ошибка';
    await sendMessageToTab(tab, {
      action: "showResult",
      result: `API вернул ошибку: ${response.status} - ${errorMessage}`
    });
    return;
  }
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    await sendMessageToTab(tab, {
      action: "showResult",
      result: `Неожиданный формат ответа от API: ${JSON.stringify(data)}`
    });
    return;
  }
  const result = data.choices[0].message?.content;
  if (!result) {
    await sendMessageToTab(tab, {
      action: "showResult",
      result: `Не удалось получить результат из ответа API: ${JSON.stringify(data)}`
    });
    return;
  }
  await sendMessageToTab(tab, {
    action: "showResult",
    result: result
  });
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab || !tab.id) return;
  if (command === 'prompt1_shortcut') {
    await processSelectedTextWithPrompt(tab, 1);
  } else if (command === 'prompt2_shortcut') {
    await processSelectedTextWithPrompt(tab, 2);
  } else if (command === 'prompt3_shortcut') {
    await processSelectedTextWithPrompt(tab, 3);
  } else if (command === 'print_shortcut') {
    // Отправляем команду автопечати в content.js
    await chrome.tabs.sendMessage(tab.id, { action: 'startAutoPrint' });
  }
}); 