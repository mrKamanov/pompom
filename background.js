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
 * 
 * Основные функции:
 * - Инициализация контекстного меню при установке расширения
 * - Получение выделенного текста из активной вкладки
 * - Отправка запросов к AI API с использованием сохраненного ключа
 * - Обработка ответов от API и их форматирование
 * - Управление состоянием расширения через chrome.storage
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
  }
});


chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'chatMessage') {
        try {
            const settings = await chrome.storage.sync.get(['prompt', 'apiKey', 'aimlapi_model', 'api_provider', 'openrouter_apiKey', 'openrouter_model']);
            
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

            let result = '';
            if (settings.api_provider === 'openrouter') {
              result = await sendToOpenRouter(message.message, settings.openrouter_apiKey, { model: settings.openrouter_model, messages: message.history });
            } else {
              result = await sendAIMLAPIRequest(sender.tab, prompt, message.message, settings.apiKey, settings.aimlapi_model);
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
  if (promptIndex === 2) prompt = settings.prompt2 || '';
  if (promptIndex === 3) prompt = settings.prompt3 || '';
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
      result = await sendToOpenRouter(selectedText, settings.openrouter_apiKey, { model: settings.openrouter_model });
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
  if (command === 'prompt1_shortcut') {
    await processSelectedTextWithPrompt(tab, 1);
  } else if (command === 'prompt2_shortcut') {
    await processSelectedTextWithPrompt(tab, 2);
  } else if (command === 'prompt3_shortcut') {
    await processSelectedTextWithPrompt(tab, 3);
  } else if (command === 'print_shortcut') {
    await chrome.tabs.sendMessage(tab.id, { action: 'startAutoPrint' });
  }
});