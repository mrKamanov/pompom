// content.js

// Вспомогательная функция для экранирования HTML-спецсимволов
// Эта функция используется только для обычного текста, не для содержимого, передаваемого в Highlight.js
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Новая функция для форматирования ответа API
function formatApiResponse(rawText) {
    const lines = rawText.split('\n');
    let html = '';
    let inCodeBlock = false;
    let currentCodeBlock = [];
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                // Конец блока кода
                const codeContent = currentCodeBlock.join('\n');
                // Highlight.js сам занимается экранированием, поэтому не нужно вызывать escapeHtml для codeContent.

                // Если есть Highlight.js, используем его
                if (window.hljs) {
                    try {
                        const highlighted = codeLanguage ?
                            window.hljs.highlight(codeContent, { language: codeLanguage }).value :
                            window.hljs.highlightAuto(codeContent).value;
                        html += `<pre><code class="hljs ${codeLanguage}">${highlighted}</code></pre>`;
                    } catch (e) {
                        console.warn('Highlight.js failed, rendering as plain text:', e);
                        html += `<pre><code>${escapeHtml(codeContent)}</code></pre>`; // Fallback, используем escapeHtml здесь
                    }
                } else {
                    html += `<pre><code>${escapeHtml(codeContent)}</code></pre>`; // Если Highlight.js нет, используем escapeHtml
                }
                inCodeBlock = false;
                currentCodeBlock = [];
                codeLanguage = '';
            } else {
                // Начало блока кода
                const parts = line.split('`');
                codeLanguage = parts.length > 3 ? parts[3].trim() : ''; // Get language if specified
                inCodeBlock = true;
            }
        } else if (inCodeBlock) {
            currentCodeBlock.push(line);
        } else {
            // Обычный текст, оборачиваем в параграф и экранируем
            // Разделяем на параграфы, если есть пустые строки
            if (line.trim() === '') {
                html += '<br>'; // Пустые строки как <br>
            } else {
                html += `<p>${escapeHtml(line)}</p>`;
            }
        }
    }

    // Если блок кода не был закрыт (например, обрыв текста)
    if (inCodeBlock) {
        const codeContent = currentCodeBlock.join('\n');
        // Highlight.js сам занимается экранированием, поэтому не нужно вызывать escapeHtml для codeContent.
        if (window.hljs) {
            try {
                const highlighted = codeLanguage ?
                    window.hljs.highlight(codeContent, { language: codeLanguage }).value :
                    window.hljs.highlightAuto(codeContent).value;
                html += `<pre><code class="hljs ${codeLanguage}">${highlighted}</code></pre>`;
            } catch (e) {
                console.warn('Highlight.js failed for unclosed block, rendering as plain text:', e);
                html += `<pre><code>${escapeHtml(codeContent)}</code></pre>`; // Fallback, используем escapeHtml здесь
            }
        } else {
            html += `<pre><code>${escapeHtml(codeContent)}</code></pre>`; // Если Highlight.js нет, используем escapeHtml
        }
    }
    return html;
}


// Новая функция для удаления маркеров блоков кода
function cleanCodeBlockMarkers(text) {
    // Удаляем открывающие маркеры с опциональным языком (например, ```sql)
    // и закрывающие маркеры (```)
    return text.replace(/^```(?:\w+)?\n?/gm, '').replace(/^```\n?/gm, '');
}


// =========================================================
// Функции для создания и управления окном

function createPopup() {
    const popup = document.createElement('div');
    popup.classList.add('pompom-popup-container'); // Новое имя класса

    popup.innerHTML = `
      <div class="pompom-popup-header">
          <h3 class="pompom-popup-title">Результат обработки</h3>
          <div class="pompom-popup-controls">
              <div class="pompom-opacity-control">
                  <input type="range" min="0.1" max="1" step="0.01" value="0.9" class="pompom-opacity-slider" title="Прозрачность">
              </div>
              <button class="pompom-header-button pompom-type-button" title="Напечатать">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <path d="M12 6v6l4-2-4-2z"></path>
                  </svg>
              </button>
              <button class="pompom-header-button pompom-copy-button" title="Копировать">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
              </button>
              <button class="pompom-header-button pompom-popup-close" title="Закрыть">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
              </button>
          </div>
      </div>
      <div class="pompom-popup-content">
          </div>
    `;
    document.body.appendChild(popup);
    return popup;
}

function makeDraggable(element) {
    const header = element.querySelector('.pompom-popup-header'); // Новое имя класса
    if (!header) return;

    let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        /* stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function setupOpacityControl(popup) {
    const slider = popup.querySelector('.pompom-opacity-slider'); // Новое имя класса
    if (slider) {
        // Загружаем сохраненное значение прозрачности
        chrome.storage.sync.get(['pompomOpacity'], (result) => {
            const savedOpacity = result.pompomOpacity;
            if (typeof savedOpacity === 'number') { // Убедимся, что это число
                popup.style.opacity = savedOpacity;
                slider.value = savedOpacity;
            } else {
                // Если нет сохраненного значения, используем значение по умолчанию из HTML (0.9)
                popup.style.opacity = slider.value;
            }
        });

        slider.addEventListener('input', (e) => {
            const newOpacity = parseFloat(e.target.value);
            popup.style.opacity = newOpacity;
            // Сохраняем новое значение прозрачности
            chrome.storage.sync.set({ pompomOpacity: newOpacity });
        });

        // ДОБАВЛЕННЫЙ ОБРАБОТЧИК ДЛЯ ОСТАНОВКИ ВСПЛЫТИЯ СОБЫТИЯ
        slider.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Останавливаем всплытие события mousedown
        });
    }
}

// Внедряем inject.js в контекст страницы
function injectScript(file_path, tag) {
    const node = document.getElementsByTagName(tag)[0];
    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', chrome.runtime.getURL(file_path));
    node.appendChild(script);
}

// Внедряем inject.js при загрузке content.js
injectScript('inject.js', 'body');


// Глобальная переменная для отслеживания состояния печати
// 'idle', 'typing', 'paused', 'completed', 'error_no_input' (от inject.js)
// 'waiting_to_start' (добавлено только для UI content.js)
let currentTypingState = 'idle';
let lastApiResult = ''; // Для хранения последнего полученного текста API

// Функция для обновления состояния кнопки "Напечатать"
function updateTypeButton(buttonElement, state) {
    const playIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><path d="M12 6v6l4-2-4-2z"></path></svg>`;
    const pauseIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    const loadingIcon = `<svg style="animation: spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M12 6V3"/><path d="M12 21v-3"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h3"/><path d="M20 12h3"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>`;
    const doneIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.12"></path><path d="M22 4L12 14.01l-3-3"></path></svg>`;
    const errorIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    // Добавляем стиль для анимации вращения иконки загрузки
    if (!document.getElementById('pompom-spin-style')) {
        const spinStyle = document.createElement('style');
        spinStyle.id = 'pompom-spin-style';
        spinStyle.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(spinStyle);
    }

    currentTypingState = state; // Обновляем глобальное состояние в content.js

    switch (state) {
        case 'idle':
            buttonElement.innerHTML = playIcon;
            buttonElement.title = "Напечатать";
            buttonElement.disabled = false;
            break;
        case 'waiting_to_start':
            buttonElement.innerHTML = loadingIcon;
            buttonElement.title = "Подготовка к печати (5 сек.)... Нажмите еще раз для отмены";
            buttonElement.disabled = false; // Разрешаем отмену кликом
            break;
        case 'typing':
            buttonElement.innerHTML = pauseIcon;
            buttonElement.title = "Пауза";
            buttonElement.disabled = false;
            break;
        case 'paused':
            buttonElement.innerHTML = playIcon;
            buttonElement.title = "Продолжить печать";
            buttonElement.disabled = false;
            break;
        case 'completed':
            buttonElement.innerHTML = doneIcon;
            buttonElement.title = "Напечатано";
            buttonElement.disabled = true;
            break;
        case 'error_no_input':
            buttonElement.innerHTML = errorIcon;
            buttonElement.title = "Ошибка: нет активного поля ввода или оно недействительно.";
            buttonElement.disabled = true;
            break;
    }
}

// Переменная для хранения таймаута
let typingStartTimeout = null;

// Слушаем сообщения от background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showResult") {
        console.log('Получено сообщение showResult:', message);

        // Очищаем результат от маркеров кода для копирования и печати
        lastApiResult = cleanCodeBlockMarkers(message.result);
        currentTypingState = 'idle'; // Сбрасываем состояние печати

        const existingPopup = document.querySelector('.pompom-popup-container');
        if (existingPopup) {
            existingPopup.remove();
            // Также очищаем таймаут, если он был активен при повторном открытии
            if (typingStartTimeout) {
                clearTimeout(typingStartTimeout);
                typingStartTimeout = null;
            }
            window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*'); // Сброс состояния в inject.js
        }

        const popup = createPopup();
        console.log('Создано новое окно:', popup);

        makeDraggable(popup);
        setupOpacityControl(popup); // Вызов здесь, чтобы применить сохраненную прозрачность

        const closeButton = popup.querySelector('.pompom-popup-close');
        closeButton.addEventListener('click', () => {
            popup.remove();
            // Очищаем состояние печати при закрытии окна
            if (typingStartTimeout) {
                clearTimeout(typingStartTimeout);
                typingStartTimeout = null;
            }
            window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*');
        });

        const copyButton = popup.querySelector('.pompom-copy-button');
        const typeButton = popup.querySelector('.pompom-type-button');
        const content = popup.querySelector('.pompom-popup-content');

        // Используем ОРИГИНАЛЬНЫЙ message.result для отображения с подсветкой синтаксиса
        // Это важно, чтобы formatApiResponse мог найти блоки кода.
        content.innerHTML = formatApiResponse(message.result);

        // Инициализируем кнопку печати в состоянии 'idle'
        updateTypeButton(typeButton, 'idle');

        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(lastApiResult); // Здесь используем очищенный lastApiResult
                copyButton.classList.add('copied');
                setTimeout(() => {
                    copyButton.classList.remove('copied');
                }, 1000);
            } catch (err) {
                console.error('Ошибка при копировании:', err);
            }
        });

        // ОБРАБОТЧИК ДЛЯ НОВОЙ КНОПКИ
        typeButton.addEventListener('click', () => {
            if (currentTypingState === 'idle' || currentTypingState === 'paused' || currentTypingState === 'completed') {
                // Если бездействует, на паузе или завершена, готовим к запуску/продолжению
                updateTypeButton(typeButton, 'waiting_to_start'); // Показываем, что ждем таймер
                console.log('Нажат Type-кнопка. Запуск/Возобновление через 5 секунд...');

                // Очищаем предыдущий таймаут, если он был
                if (typingStartTimeout) {
                    clearTimeout(typingStartTimeout);
                }

                typingStartTimeout = setTimeout(() => {
                    // Проверяем, что состояние не изменилось на 'idle' (отмена)
                    if (currentTypingState === 'waiting_to_start') {
                        console.log('Таймер 5 секунд истек. Отправка команды START_TYPING.');
                        window.postMessage({
                            type: 'POMPOM_START_TYPING',
                            text: lastApiResult // Здесь используем очищенный lastApiResult
                        }, '*');
                        typingStartTimeout = null; // Сбрасываем ID таймаута
                    } else {
                        console.log("Typing state changed before timer finished. Aborting command.");
                    }
                }, 5000); // 5 секунд = 5000 миллисекунд
            } else if (currentTypingState === 'typing') {
                // Если печатает, ставим на паузу
                console.log('Нажат Type-кнопка. Отправка команды PAUSE_TYPING.');
                window.postMessage({ type: 'POMPOM_PAUSE_TYPING' }, '*');
                if (typingStartTimeout) { // Отменяем таймер, если он был запущен (для robustness)
                    clearTimeout(typingStartTimeout);
                    typingStartTimeout = null;
                }
            } else if (currentTypingState === 'waiting_to_start') {
                // Если уже ждем таймер, то отменяем ожидание
                console.log('Отмена ожидания старта печати.');
                if (typingStartTimeout) {
                    clearTimeout(typingStartTimeout);
                    typingStartTimeout = null;
                }
                updateTypeButton(typeButton, 'idle'); // Сбрасываем UI кнопки
                // Отправляем RESET, чтобы inject.js также знал, что отмена
                window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*');
            }
        });

        console.log('Окно добавлено на страницу:', document.body.contains(popup));
        console.log('Стили окна:', window.getComputedStyle(popup));
    }
});

// Новый слушатель для получения сообщений о состоянии печати от inject.js
window.addEventListener('message', (event) => {
    if (event.source === window && event.data && event.data.type === 'POMPOM_TYPING_STATE') {
        console.log('Content.js received TYPING_STATE:', event.data.state);
        const typeButton = document.querySelector('.pompom-type-button');
        if (typeButton) {
            // Если мы получили состояние, которое не является 'waiting_to_start',
            // то значит, inject.js уже начал/остановил печать, и нам нужно отменить таймер,
            // если он был активен.
            if (event.data.state !== 'waiting_to_start' && typingStartTimeout) {
                clearTimeout(typingStartTimeout);
                typingStartTimeout = null;
                console.log('Content.js: Таймер ожидания отменен, состояние пришло из inject.js');
            }
            updateTypeButton(typeButton, event.data.state);
        }
    }
});