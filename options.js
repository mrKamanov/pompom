/**
 * options.js - Скрипт страницы настроек расширения PomPom
 * 
 * Этот файл отвечает за:
 * 1. Управление настройками расширения через пользовательский интерфейс
 * 2. Сохранение и загрузку настроек в chrome.storage
 * 3. Валидацию введенных данных
 * 4. Отображение статуса сохранения настроек
 * 5. Маскировку API ключа с возможностью показа/скрытия
 * 
 * Основные функции:
 * - Загрузка сохраненных настроек при открытии страницы
 * - Сохранение API ключа и пользовательского промпта
 * - Валидация обязательных полей
 * - Отображение уведомлений о статусе сохранения
 * - Переключение видимости API ключа
 * 
 * @author Сергей Каманов
 * @version 1.1
 */

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get([
    'prompt1', 'prompt2', 'prompt3',
    'prompt1Title', 'prompt2Title', 'prompt3Title',
    'apiKey', 'minTypingDelay', 'maxTypingDelay'], (result) => {
    if (result.prompt1Title) document.getElementById('prompt1Title').value = result.prompt1Title;
    if (result.prompt2Title) document.getElementById('prompt2Title').value = result.prompt2Title;
    if (result.prompt3Title) document.getElementById('prompt3Title').value = result.prompt3Title;
    if (result.prompt1) document.getElementById('prompt1').value = result.prompt1;
    if (result.prompt2) document.getElementById('prompt2').value = result.prompt2;
    if (result.prompt3) document.getElementById('prompt3').value = result.prompt3;
    if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
    if (result.minTypingDelay !== undefined) document.getElementById('minTypingDelay').value = result.minTypingDelay;
    if (result.maxTypingDelay !== undefined) document.getElementById('maxTypingDelay').value = result.maxTypingDelay;
  });

  
  setupApiKeyToggle();
});


function setupApiKeyToggle() {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleButton = document.getElementById('togglePassword');
  
  if (!apiKeyInput || !toggleButton) return;

  toggleButton.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    
    
    apiKeyInput.type = isPassword ? 'text' : 'password';
    
    
    if (isPassword) {
      
      toggleButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
      toggleButton.title = 'Скрыть API ключ';
    } else {
      
      toggleButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
      toggleButton.title = 'Показать API ключ';
    }
  });
}

document.getElementById('saveButton').addEventListener('click', () => {
  const prompt1Title = document.getElementById('prompt1Title').value;
  const prompt2Title = document.getElementById('prompt2Title').value;
  const prompt3Title = document.getElementById('prompt3Title').value;
  const prompt1 = document.getElementById('prompt1').value;
  const prompt2 = document.getElementById('prompt2').value;
  const prompt3 = document.getElementById('prompt3').value;
  const apiKey = document.getElementById('apiKey').value;
  const minTypingDelay = parseInt(document.getElementById('minTypingDelay').value, 10);
  const maxTypingDelay = parseInt(document.getElementById('maxTypingDelay').value, 10);
  const status = document.getElementById('status');

  if (!prompt1 || !prompt2 || !prompt3 || !apiKey) {
    status.textContent = 'Пожалуйста, заполните все поля';
    status.className = 'status error';
    return;
  }
  if (isNaN(minTypingDelay) || isNaN(maxTypingDelay) || minTypingDelay < 1 || maxTypingDelay < 1 || minTypingDelay > maxTypingDelay) {
    status.textContent = 'Проверьте интервалы печати: минимальный должен быть ≥ 1, максимальный ≥ минимального';
    status.className = 'status error';
    return;
  }

  chrome.storage.sync.set({
    prompt1Title, prompt2Title, prompt3Title,
    prompt1, prompt2, prompt3,
    apiKey,
    minTypingDelay,
    maxTypingDelay
  }, () => {
    status.textContent = 'Настройки сохранены';
    status.className = 'status success';
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  });
}); 