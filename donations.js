/**
 * donations.js - Скрипт для управления пожертвованиями
 * 
 * Этот файл отвечает за:
 * 1. Копирование криптовалютных адресов в буфер обмена
 * 2. Отображение уведомлений о успешном копировании
 * 3. Обработку ошибок при копировании
 * 
 * @author Сергей Каманов
 * @version 1.1
 */

// Функция копирования адресов в буфер обмена
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    const button = element.nextElementSibling;
    const originalText = button.textContent;
    button.textContent = '✅ Скопировано!';
    button.classList.add('copied');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  }).catch(err => {
    console.error('Ошибка копирования:', err);
    alert('Не удалось скопировать адрес. Попробуйте скопировать вручную.');
  });
} 