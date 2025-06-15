// Загружаем сохраненные настройки при открытии страницы
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

// Обработчик сохранения настроек
document.getElementById('saveButton').addEventListener('click', () => {
  const prompt = document.getElementById('prompt').value;
  const apiKey = document.getElementById('apiKey').value;
  const status = document.getElementById('status');

  // Проверяем, что поля не пустые
  if (!prompt || !apiKey) {
    status.textContent = 'Пожалуйста, заполните все поля';
    status.className = 'status error';
    return;
  }

  // Сохраняем настройки
  chrome.storage.sync.set({
    prompt: prompt,
    apiKey: apiKey
  }, () => {
    status.textContent = 'Настройки сохранены';
    status.className = 'status success';
    
    // Скрываем сообщение через 3 секунды
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  });
}); 