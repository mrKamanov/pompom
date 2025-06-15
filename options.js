/**
 * options.js - Скрипт страницы настроек расширения PomPom
 * 
 * Этот файл отвечает за:
 * 1. Управление настройками расширения через пользовательский интерфейс
 * 2. Сохранение и загрузку настроек в chrome.storage
 * 3. Валидацию введенных данных
 * 4. Отображение статуса сохранения настроек
 * 
 * Основные функции:
 * - Загрузка сохраненных настроек при открытии страницы
 * - Сохранение API ключа и пользовательского промпта
 * - Валидация обязательных полей
 * - Отображение уведомлений о статусе сохранения
 * 
 * @author Сергей Каманов
 * @version 1.0
 */

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['prompt', 'apiKey'], (result) => {
    if (result.prompt) {
      document.getElementById('prompt').value = result.prompt;
    }
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });
});


document.getElementById('saveButton').addEventListener('click', () => {
  const prompt = document.getElementById('prompt').value;
  const apiKey = document.getElementById('apiKey').value;
  const status = document.getElementById('status');

  
  if (!prompt || !apiKey) {
    status.textContent = 'Пожалуйста, заполните все поля';
    status.className = 'status error';
    return;
  }

  
  chrome.storage.sync.set({
    prompt: prompt,
    apiKey: apiKey
  }, () => {
    status.textContent = 'Настройки сохранены';
    status.className = 'status success';
    
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  });
}); 