/**
 * content.js - Основной скрипт расширения PomPom
 * 
 * Этот файл отвечает за:
 * 1. Создание и управление всплывающим окном с результатами обработки текста
 * 2. Форматирование ответа от API с поддержкой подсветки синтаксиса кода
 * 3. Управление прозрачностью и перетаскиванием окна
 * 4. Обработку копирования текста в буфер обмена
 * 5. Управление функцией автоматической печати текста
 * 
 * Основные компоненты:
 * - Всплывающее окно с заголовком, контролами и областью контента
 * - Слайдер прозрачности
 * - Кнопки копирования, печати и закрытия
 * - Интеграция с highlight.js для подсветки кода
 * - Система состояний для функции печати
 * 
 * @author Сергей Каманов
 * @version 1.0
 */

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


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
               
                const codeContent = currentCodeBlock.join('\n');
                
                if (window.hljs) {
                    try {
                        const highlighted = codeLanguage ?
                            window.hljs.highlight(codeContent, { language: codeLanguage }).value :
                            window.hljs.highlightAuto(codeContent).value;
                        html += `<pre><code class="hljs ${codeLanguage}">${highlighted}</code></pre>`;
                    } catch (e) {
                        console.warn('Highlight.js failed, rendering as plain text:', e);
                        html += `<pre><code>${escapeHtml(codeContent)}</code></pre>`; 
                    }
                } else {
                    html += `<pre><code>${escapeHtml(codeContent)}</code></pre>`; 
                }
                inCodeBlock = false;
                currentCodeBlock = [];
                codeLanguage = '';
            } else {
                
                const parts = line.split('`');
                codeLanguage = parts.length > 3 ? parts[3].trim() : ''; 
                inCodeBlock = true;
            }
        } else if (inCodeBlock) {
            currentCodeBlock.push(line);
        } else {
            
            if (line.trim() === '') {
                html += '<br>'; 
            } else {
                html += `<p>${escapeHtml(line)}</p>`;
            }
        }
    }

    
    if (inCodeBlock) {
        const codeContent = currentCodeBlock.join('\n');
        
        if (window.hljs) {
            try {
                const highlighted = codeLanguage ?
                    window.hljs.highlight(codeContent, { language: codeLanguage }).value :
                    window.hljs.highlightAuto(codeContent).value;
                html += `<pre><code class="hljs ${codeLanguage}">${highlighted}</code></pre>`;
            } catch (e) {
                console.warn('Highlight.js failed for unclosed block, rendering as plain text:', e);
                html += `<pre><code>${escapeHtml(codeContent)}</code></pre>`; 
            }
        } else {
            html += `<pre><code>${escapeHtml(codeContent)}</code></pre>`; 
        }
    }
    return html;
}



function cleanCodeBlockMarkers(text) {
    
    return text.replace(/^```(?:\w+)?\n?/gm, '').replace(/^```\n?/gm, '');
}




function createPopup() {
    const popup = document.createElement('div');
    popup.classList.add('pompom-popup-container'); 

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
    const header = element.querySelector('.pompom-popup-header'); 
    if (!header) return;

    let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
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
    const slider = popup.querySelector('.pompom-opacity-slider'); 
    if (slider) {
        
        chrome.storage.sync.get(['pompomOpacity'], (result) => {
            const savedOpacity = result.pompomOpacity;
            if (typeof savedOpacity === 'number') { 
                popup.style.opacity = savedOpacity;
                slider.value = savedOpacity;
            } else {
                
                popup.style.opacity = slider.value;
            }
        });

        slider.addEventListener('input', (e) => {
            const newOpacity = parseFloat(e.target.value);
            popup.style.opacity = newOpacity;
            
            chrome.storage.sync.set({ pompomOpacity: newOpacity });
        });

        
        slider.addEventListener('mousedown', (e) => {
            e.stopPropagation(); 
        });
    }
}


function injectScript(file_path, tag) {
    const node = document.getElementsByTagName(tag)[0];
    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', chrome.runtime.getURL(file_path));
    node.appendChild(script);
}


injectScript('inject.js', 'body');



let currentTypingState = 'idle';
let lastApiResult = ''; 


function updateTypeButton(buttonElement, state) {
    const playIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><path d="M12 6v6l4-2-4-2z"></path></svg>`;
    const pauseIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    const loadingIcon = `<svg style="animation: spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M12 6V3"/><path d="M12 21v-3"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h3"/><path d="M20 12h3"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>`;
    const doneIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.12"></path><path d="M22 4L12 14.01l-3-3"></path></svg>`;
    const errorIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    
    if (!document.getElementById('pompom-spin-style')) {
        const spinStyle = document.createElement('style');
        spinStyle.id = 'pompom-spin-style';
        spinStyle.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(spinStyle);
    }

    currentTypingState = state; 

    switch (state) {
        case 'idle':
            buttonElement.innerHTML = playIcon;
            buttonElement.title = "Напечатать";
            buttonElement.disabled = false;
            break;
        case 'waiting_to_start':
            buttonElement.innerHTML = loadingIcon;
            buttonElement.title = "Подготовка к печати (5 сек.)... Нажмите еще раз для отмены";
            buttonElement.disabled = false;
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


let typingStartTimeout = null;


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showResult") {
        console.log('Получено сообщение showResult:', message);

        
        lastApiResult = cleanCodeBlockMarkers(message.result);
        currentTypingState = 'idle'; 

        const existingPopup = document.querySelector('.pompom-popup-container');
        if (existingPopup) {
            existingPopup.remove();
            
            if (typingStartTimeout) {
                clearTimeout(typingStartTimeout);
                typingStartTimeout = null;
            }
            window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*'); 
        }

        const popup = createPopup();
        console.log('Создано новое окно:', popup);

        makeDraggable(popup);
        setupOpacityControl(popup); 

        const closeButton = popup.querySelector('.pompom-popup-close');
        closeButton.addEventListener('click', () => {
            popup.remove();
            
            if (typingStartTimeout) {
                clearTimeout(typingStartTimeout);
                typingStartTimeout = null;
            }
            window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*');
        });

        const copyButton = popup.querySelector('.pompom-copy-button');
        const typeButton = popup.querySelector('.pompom-type-button');
        const content = popup.querySelector('.pompom-popup-content');

        
        content.innerHTML = formatApiResponse(message.result);

        
        updateTypeButton(typeButton, 'idle');

        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(lastApiResult); 
                copyButton.classList.add('copied');
                setTimeout(() => {
                    copyButton.classList.remove('copied');
                }, 1000);
            } catch (err) {
                console.error('Ошибка при копировании:', err);
            }
        });

        
        typeButton.addEventListener('click', () => {
            if (currentTypingState === 'idle' || currentTypingState === 'paused' || currentTypingState === 'completed') {
                
                updateTypeButton(typeButton, 'waiting_to_start'); 
                console.log('Нажат Type-кнопка. Запуск/Возобновление через 5 секунд...');

                
                if (typingStartTimeout) {
                    clearTimeout(typingStartTimeout);
                }

                typingStartTimeout = setTimeout(() => {
                    
                    if (currentTypingState === 'waiting_to_start') {
                        console.log('Таймер 5 секунд истек. Отправка команды START_TYPING.');
                        window.postMessage({
                            type: 'POMPOM_START_TYPING',
                            text: lastApiResult 
                        }, '*');
                        typingStartTimeout = null; 
                    } else {
                        console.log("Typing state changed before timer finished. Aborting command.");
                    }
                }, 5000); 
            } else if (currentTypingState === 'typing') {
                
                console.log('Нажат Type-кнопка. Отправка команды PAUSE_TYPING.');
                window.postMessage({ type: 'POMPOM_PAUSE_TYPING' }, '*');
                if (typingStartTimeout) { 
                    clearTimeout(typingStartTimeout);
                    typingStartTimeout = null;
                }
            } else if (currentTypingState === 'waiting_to_start') {
                
                console.log('Отмена ожидания старта печати.');
                if (typingStartTimeout) {
                    clearTimeout(typingStartTimeout);
                    typingStartTimeout = null;
                }
                updateTypeButton(typeButton, 'idle'); 
                
                window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*');
            }
        });

        console.log('Окно добавлено на страницу:', document.body.contains(popup));
        console.log('Стили окна:', window.getComputedStyle(popup));
    }
});


window.addEventListener('message', (event) => {
    if (event.source === window && event.data && event.data.type === 'POMPOM_TYPING_STATE') {
        console.log('Content.js received TYPING_STATE:', event.data.state);
        const typeButton = document.querySelector('.pompom-type-button');
        if (typeButton) {
            
            if (event.data.state !== 'waiting_to_start' && typingStartTimeout) {
                clearTimeout(typingStartTimeout);
                typingStartTimeout = null;
                console.log('Content.js: Таймер ожидания отменен, состояние пришло из inject.js');
            }
            updateTypeButton(typeButton, event.data.state);
        }
    }
});