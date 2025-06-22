/**
 * PomPom background.js — версия 1.12
 * 
 * background.js - Фоновый скрипт расширения PomPom
 * 
 * Этот файл отвечает за:
 * 1. Создание контекстного меню для обработки выделенного текста
 * 2. Взаимодействие с AI API для обработки текста
 * 3. Управление настройками расширения
 * 4. Обработку ошибок и валидацию данных
 * 5. Функционал создания скриншотов выбранной области
 * 
 * Основные функции:
 * - Инициализация контекстного меню при установке расширения
 * - Получение выделенного текста из активной вкладки
 * - Отправка запросов к AI API с использованием сохраненного ключа
 * - Обработка ответов от API и их форматирование
 * - Управление состоянием расширения через chrome.storage
 * - Захват и обработка скриншотов выбранной области
 * 
 * @author Сергей Каманов
 * @version 1.12
 */

import { sendAIMLAPIRequest } from './API/aimlapi.js';
import { sendToOpenRouter } from './API/openrouterapi.js';

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
    
    
    chrome.contextMenus.create({
      id: "captureSelectedArea",
      title: "Скриншот выбранной области",
      contexts: ["page"] 
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
    
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: "getSelectedText" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting selected text:', chrome.runtime.lastError);
          
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const selection = window.getSelection();
              console.log('Selection object:', selection);
              const text = selection.toString();
              console.log('Selected text:', text);
              return text;
            }
          }, (results) => {
            if (chrome.runtime.lastError) {
              console.error('Fallback error getting selected text:', chrome.runtime.lastError);
              resolve('');
            } else {
              console.log('Results from executeScript:', results);
              resolve(results[0].result);
            }
          });
        } else {
          console.log('Selected text from content script:', response);
          resolve(response.text || '');
        }
      });
    });
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
      console.log('Selection text from info:', info.selectionText);
      
      
      let selectedText = info.selectionText || '';
      console.log('Text from info.selectionText:', selectedText);
      
      
      if (!selectedText || selectedText.trim() === '') {
        console.log('Getting text via getSelectedText function...');
        selectedText = await getSelectedText(tab);
        console.log('Text from getSelectedText:', selectedText);
      }
      
      console.log('Final selected text:', selectedText);
      if (!selectedText || selectedText.trim() === '') {
        await sendMessageToTab(tab, {
          action: "showResult",
          result: "Пожалуйста, выделите текст перед использованием расширения."
        });
        return;
      }
      const settings = await chrome.storage.sync.get([
        'prompt1', 'prompt2', 'prompt3', 'apiKey', 'aimlapi_model', 'api_provider', 'openrouter_apiKey', 'openrouter_model']);
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
      let result = '';
      if (settings.api_provider === 'openrouter') {
        result = await sendToOpenRouter(selectedText, settings.openrouter_apiKey, { model: settings.openrouter_model });
      } else {
        result = await sendAIMLAPIRequest(tab, prompt, selectedText, settings.apiKey, settings.aimlapi_model);
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
  } else if (info.menuItemId === "captureSelectedArea") {
    
    try {
      
      await chrome.tabs.sendMessage(tab.id, { action: "startSelection" });
    } catch (error) {
      console.error('Ошибка при запуске выбора области:', error);
    }
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "areaSelected") {
        handleAreaSelected(message, sender, sendResponse);
        return true;
    }
    if (message.action === 'chatMessage') {
        handleChatMessage(message, sender, sendResponse);
        return true;
    }
    if (message.action === 'recognizeText') {
        handleRecognizeText(message, sender, sendResponse);
        return true;
    }
    if (message.action === 'processRecognizedText') {
        handleProcessRecognizedText(message, sender, sendResponse);
        return true;
    }
    if (message.action === "screenshot") {
        handleScreenshot(message, sender, sendResponse);
        return true;
    }
});

async function handleAreaSelected(message, sender, sendResponse) {
    console.log("Получено сообщение areaSelected:", message);
    const { x, y, width, height } = message.rect;
    const tabId = sender.tab.id;

    
    chrome.tabs.sendMessage(tabId, { action: "hideOverlay" });

    
    setTimeout(() => {
        
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, async (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error("Ошибка захвата вкладки:", chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }

            console.log("Скриншот вкладки успешно захвачен, размер dataUrl:", dataUrl ? dataUrl.length : 0);

            try {
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const imageBitmap = await createImageBitmap(blob);
                
                console.log("Изображение загружено, размеры:", imageBitmap.width, "x", imageBitmap.height);
                
                const canvas = new OffscreenCanvas(width, height);
                const ctx = canvas.getContext('2d');
                
                const scale = imageBitmap.width / sender.tab.width;
                console.log("Масштаб:", scale, "Ширина вкладки:", sender.tab.width);
                
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                console.log("Размеры canvas для обрезки:", scaledWidth, "x", scaledHeight);
                
                ctx.drawImage(imageBitmap, x * scale, y * scale, scaledWidth, scaledHeight, 0, 0, width, height);
                
                const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
                const croppedDataUrl = await blobToDataURL(croppedBlob);
                
                console.log("Обрезанное изображение создано");
                
                chrome.downloads.download({
                    url: croppedDataUrl,
                    filename: `screenshot_area_${Date.now()}.png`,
                    saveAs: true
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        console.error("Ошибка загрузки файла:", chrome.runtime.lastError.message);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log("Скриншот успешно сохранен, ID загрузки:", downloadId);
                        sendResponse({ success: true });
                    }
                });
                
            } catch (error) {
                console.error("Ошибка обработки изображения:", error);
                sendResponse({ success: false, error: "Ошибка обработки изображения: " + error.message });
            }
        });
    }, 100);
}


function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function handleRecognizeText(message, sender, sendResponse) {
    console.log("Получено сообщение recognizeText:", message);
    
    
    if (!message.rect || !message.rect.width || !message.rect.height) {
        sendResponse({ success: false, error: "Координаты области не указаны" });
        return;
    }
    
    const { x, y, width, height } = message.rect;
    const tabId = sender.tab.id;

    
    chrome.tabs.sendMessage(tabId, { action: "hideOverlay" });

    setTimeout(() => {
        
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, async (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error("Ошибка захвата вкладки:", chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }

            console.log("Скриншот вкладки успешно захвачен, размер dataUrl:", dataUrl ? dataUrl.length : 0);

            try {
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const imageBitmap = await createImageBitmap(blob);
                
                console.log("Изображение загружено, размеры:", imageBitmap.width, "x", imageBitmap.height);
                
                const canvas = new OffscreenCanvas(width, height);
                const ctx = canvas.getContext('2d');
                
                const scale = imageBitmap.width / sender.tab.width;
                console.log("Масштаб:", scale, "Ширина вкладки:", sender.tab.width);
                
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                console.log("Размеры canvas для обрезки:", scaledWidth, "x", scaledHeight);
                
                ctx.drawImage(imageBitmap, x * scale, y * scale, scaledWidth, scaledHeight, 0, 0, width, height);
                
                const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
                const croppedDataUrl = await blobToDataURL(croppedBlob);
                
                console.log("Обрезанное изображение создано для распознавания");
                
                
                sendResponse({ success: true, dataUrl: croppedDataUrl });
                
            } catch (error) {
                console.error("Ошибка обработки изображения:", error);
                sendResponse({ success: false, error: "Ошибка обработки изображения: " + error.message });
            }
        });
    }, 100);
}

async function handleScreenshot(message, sender, sendResponse) {
    
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
        }
        
        sendResponse({ success: true, dataUrl: dataUrl });
    });
}

async function handleProcessRecognizedText(message, sender, sendResponse) {
    try {
        console.log("Получен распознанный текст для обработки:", message.text);
        
        const settings = await chrome.storage.sync.get([
            'prompt', 'apiKey', 'aimlapi_model', 'api_provider', 
            'openrouter_apiKey', 'openrouter_model'
        ]);
        
        if (!settings.apiKey) {
            sendResponse({ 
                success: false, 
                error: 'API Key не установлен в настройках расширения' 
            });
            return;
        }
        
        const prompt = settings.prompt || "Напиши только ответ. Кратко и понятно. Если это код, то исправь в нем ошибки, если они есть и покажи целиком. Если в коде пропуски, то дополни его.";
        
        console.log('Отправляем распознанный текст в API с промптом:', prompt);
        
        let result = '';
        if (settings.api_provider === 'openrouter') {
            result = await sendToOpenRouter(message.text, settings.openrouter_apiKey, { 
                model: settings.openrouter_model,
                prompt: prompt
            });
        } else {
            result = await sendAIMLAPIRequest(sender.tab, prompt, message.text, settings.apiKey, settings.aimlapi_model);
        }
        
        console.log('Получен ответ от API:', result);
        sendResponse({ success: true, result: result });
        
    } catch (error) {
        console.error('Ошибка обработки распознанного текста:', error);
        sendResponse({ 
            success: false, 
            error: `Ошибка обработки: ${error.message}` 
        });
    }
}

async function handleChatMessage(message, sender, sendResponse) {
    try {
        const settings = await chrome.storage.sync.get(['prompt', 'apiKey', 'aimlapi_model', 'api_provider', 'openrouter_apiKey', 'openrouter_model']);
        
        if (!settings.apiKey) {
            await sendMessageToTab(sender.tab, { action: "chatResponse", result: "Пожалуйста, укажите API Key." });
            sendResponse({ success: false, error: 'API Key not set' });
            return;
        }

        const system_prompt = settings.prompt || "Ты — полезный ассистент по работе с кодом. Следуй инструкциям пользователя.";
        
        
        const history = message.history || [];

        const messages_to_send = [
            { role: "system", content: system_prompt },
            ...history
            
        ];

        console.log("Сообщения, отправляемые в API:", messages_to_send);

        let result = '';
        if (settings.api_provider === 'openrouter') {
            result = await sendToOpenRouter(messages_to_send, settings.openrouter_apiKey, { model: settings.openrouter_model });
        } else {
            const last_user_message = history.find(m => m.role === 'user').content || '';
            const initial_context = history.find(m => m.role === 'assistant').content || '';
            const full_prompt = initial_context + "\n\n" + last_user_message;
            result = await sendAIMLAPIRequest(sender.tab, system_prompt, full_prompt, settings.apiKey, settings.aimlapi_model);
        }

        await sendMessageToTab(sender.tab, { action: "chatResponse", result: result });
        sendResponse({ success: true });
    } catch (error) {
        console.error('Error in handleChatMessage:', error);
        await sendMessageToTab(sender.tab, { action: "chatResponse", result: `Произошла ошибка: ${error.message}`});
        sendResponse({ success: false, error: error.message });
    }
}


chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('Вкладка закрыта, tabId:', tabId);
    
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        console.log('Вкладка обновляется, tabId:', tabId);
        
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
    'prompt1', 'prompt2', 'prompt3', 'apiKey', 'aimlapi_model', 'api_provider', 'openrouter_apiKey', 'openrouter_model'
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
  else if (promptIndex === 2) prompt = settings.prompt2 || '';
  else if (promptIndex === 3) prompt = settings.prompt3 || '';
  
  if (!prompt) {
    await sendMessageToTab(tab, {
      action: "showResult",
      result: "Промпт не задан в настройках."
    });
    return;
  }
  
  try {
    let result = '';
    if (settings.api_provider === 'openrouter') {
      
      const messages = [{ role: "system", content: prompt }, { role: "user", content: selectedText }];
      result = await sendToOpenRouter(messages, settings.openrouter_apiKey, { model: settings.openrouter_model });
    } else {
      result = await sendAIMLAPIRequest(tab, prompt, selectedText, settings.apiKey, settings.aimlapi_model);
    }
    await sendMessageToTab(tab, {
      action: "showResult",
      result: result
    });
  } catch (error) {
    await sendMessageToTab(tab, {
      action: "showResult",
      result: `Произошла ошибка при обработке запроса: ${error.message}`
    });
  }
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab || !tab.id) return;
  
  console.log(`Получена команда горячей клавиши: ${command}`);

  if (command.startsWith('prompt')) {
      const promptIndex = parseInt(command.replace('prompt', ''));
      await processSelectedTextWithPrompt(tab, promptIndex);
  } else if (command === 'print_shortcut') {
    await sendMessageToTab(tab, { action: 'startAutoPrint' });
  }
});