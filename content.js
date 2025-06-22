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
    popup.style.right = '20px';
    popup.style.top = '20px';

    popup.innerHTML = `
      <div class="pompom-popup-header">
          <div class="pompom-popup-controls">
              <div class="pompom-opacity-control">
                  <input type="range" min="0" max="1" step="0.01" value="0.9" class="pompom-opacity-slider" title="Прозрачность">
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
          <div class="pompom-chat-history"></div>
      </div>
      <div class="pompom-chat-input-container">
          <textarea class="pompom-chat-input" placeholder="Введите уточняющий вопрос..."></textarea>
          <button class="pompom-send-button" title="Отправить">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
              </svg>
          </button>
      </div>
    `;

    
    const content = popup.querySelector('.pompom-popup-content');
    content.style.background = '#fafdff';
    content.style.position = 'relative';
    content.style.zIndex = '1';

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
        
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function setupOpacityControl(popup) {
    const slider = popup.querySelector('.pompom-opacity-slider');
    if (slider) {
        chrome.storage.sync.get(['pompomOpacity'], (result) => {
            const savedOpacity = (typeof result.pompomOpacity === 'number') ? result.pompomOpacity : 0.9;
            slider.value = savedOpacity;

            popup.style.setProperty('--target-opacity', savedOpacity);

            if (savedOpacity < 0.1) {
                popup.style.animation = 'none';
                popup.style.opacity = savedOpacity;
            } else {
                popup.style.opacity = '0';
            }
        });

        slider.addEventListener('input', (e) => {
            const newOpacity = parseFloat(e.target.value);
            popup.style.opacity = newOpacity;
            popup.style.setProperty('--target-opacity', newOpacity);
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

let chatHistory = [];

function addMessageToChat(message, isUser = false, addToHistory = true) {
    const chatHistoryElement = document.querySelector('.pompom-chat-history');
    const messageElement = document.createElement('div');
    messageElement.classList.add('pompom-message');
    messageElement.classList.add(isUser ? 'user' : 'assistant');
    messageElement.innerHTML = formatApiResponse(message);
    chatHistoryElement.appendChild(messageElement);
    chatHistoryElement.scrollTop = chatHistoryElement.scrollHeight;

    if (addToHistory) {
        chatHistory.push({
            role: isUser ? 'user' : 'assistant',
            content: message
        });
    }
}

function restoreChatHistory() {
    const chatHistoryElement = document.querySelector('.pompom-chat-history');
    console.log('Восстанавливаем историю чата:', {
        elementFound: !!chatHistoryElement,
        historyLength: chatHistory.length,
        history: chatHistory
    });
    
    if (chatHistoryElement && chatHistory.length > 0) {
        chatHistoryElement.innerHTML = '';
        chatHistory.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('pompom-message');
            messageElement.classList.add(msg.role);
            messageElement.innerHTML = formatApiResponse(msg.content);
            chatHistoryElement.appendChild(messageElement);
        });
        chatHistoryElement.scrollTop = chatHistoryElement.scrollHeight;
        console.log('История чата восстановлена');
    }
}

function setupChatInput(popup) {
    const input = popup.querySelector('.pompom-chat-input');
    const sendButton = popup.querySelector('.pompom-send-button');

    function sendMessage() {
        const message = input.value.trim();
        if (!message) return;

        
        addMessageToChat(message, true, true);
        input.value = '';

        chrome.runtime.sendMessage({
            action: 'chatMessage',
            message: message,
            history: chatHistory
        });
    }

    
    sendButton.addEventListener('click', sendMessage);

    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function showResult(result, isNewConversation = false) {
    console.log(`showResult вызван. Новая беседа: ${isNewConversation}`);

    let popup = document.querySelector('.pompom-popup-container');

    if (isNewConversation) {
        console.log("Новая сессия чата, очищаем историю.");
        chatHistory = [];
        if (popup) {
            const chatHistoryElement = popup.querySelector('.pompom-chat-history');
            if (chatHistoryElement) chatHistoryElement.innerHTML = '';
        }
    }
    
    
    currentTypingState = 'idle';
    
    if (popup) {
        console.log('Используем существующее popup окно');
        if (typingStartTimeout) {
            clearTimeout(typingStartTimeout);
            typingStartTimeout = null;
        }
        window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*');
    } else {
        console.log('Создаем новое popup окно');
        popup = createPopup();
        makeDraggable(popup);
        setupOpacityControl(popup);
        setupChatInput(popup);
        
        const closeButton = popup.querySelector('.pompom-popup-close');
        closeButton.addEventListener('click', () => {
            popup.remove();

            window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*');
            
            
            lastApiResult = null;
            currentTypingState = 'idle';
            if(typingStartTimeout) {
                clearTimeout(typingStartTimeout);
                typingStartTimeout = null;
            }

            
            chatHistory = [];
            
            console.log('Popup окно закрыто. Автопечать остановлена, история чата очищена.');
        });

        const copyButton = popup.querySelector('.pompom-copy-button');
        const typeButton = popup.querySelector('.pompom-type-button');
        
        updateTypeButton(typeButton, 'idle');
        setupTypeButton(typeButton);
        
        copyButton.addEventListener('click', async () => {
            try {
                const messageContent = copyButton.closest('.pompom-popup-container').querySelector('.pompom-message.assistant:last-child').innerText;
                await navigator.clipboard.writeText(cleanCodeBlockMarkers(messageContent));
                
                
                lastApiResult = cleanCodeBlockMarkers(messageContent);
                
                copyButton.classList.add('copied');
                setTimeout(() => copyButton.classList.remove('copied'), 1000);
                console.log("Результат скопирован и сохранен как lastApiResult");
            } catch (err) {
                console.error('Ошибка при копировании:', err);
            }
        });
    }
    
    
    addMessageToChat(result, false, false); 
    
    
    if (isNewConversation) {
        chatHistory.push({
            role: 'assistant',
            content: result
        });
        lastApiResult = cleanCodeBlockMarkers(result); 
    }

    console.log('Результат показан. Длина истории:', chatHistory.length);
}

function setupTypeButton(typeButton) {
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
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                        chrome.storage.sync.get(['minTypingDelay', 'maxTypingDelay'], (result) => {
                            window.postMessage({
                                type: 'POMPOM_START_TYPING',
                                text: lastApiResult,
                                minTypingDelay: result.minTypingDelay,
                                maxTypingDelay: result.maxTypingDelay
                            }, '*');
                        });
                    } else {
                        window.postMessage({
                            type: 'POMPOM_START_TYPING',
                            text: lastApiResult
                        }, '*');
                    }
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
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Получено сообщение в content.js:", message);

    if (message.action === "showResult") {
        showResult(message.result, true); 
    } else if (message.action === 'chatResponse') {
        showResult(message.result, false);
    } else if (message.action === 'startAutoPrint') {
        if (lastApiResult) {
            console.log("Запуск автопечати по горячей клавише...");
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get(['minTypingDelay', 'maxTypingDelay'], (result) => {
                    window.postMessage({
                        type: 'POMPOM_START_TYPING',
                        text: lastApiResult,
                        minTypingDelay: result.minTypingDelay,
                        maxTypingDelay: result.maxTypingDelay
                    }, '*');
                });
            } else {
                window.postMessage({
                    type: 'POMPOM_START_TYPING',
                    text: lastApiResult
                }, '*');
            }
        } else {
            console.warn("Нечего печатать для автопечати.");
            alert("Нет текста для автопечати. Сначала получите ответ от AI.");
        }
    } else if (message.action === "startSelection") {
        startScreenshotSelectionMode();
    } else if (message.action === "hideOverlay") {
        if (screenshotOverlay) screenshotOverlay.style.display = 'none';
        if (screenshotSelectionArea) screenshotSelectionArea.style.display = 'none';
    } else if (message.action === "getSelectedText") {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        console.log('Content.js: выделенный текст:', text);
        sendResponse({ text: text });
        return true; 
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


window.addEventListener('beforeunload', () => {
    if (typingStartTimeout) {
        clearTimeout(typingStartTimeout);
        typingStartTimeout = null;
    }
    window.postMessage({ type: 'POMPOM_RESET_TYPING' }, '*');
    
    
    chatHistory = [];
    console.log('Content.js: Страница закрывается, история чата очищена');
    console.log('Content.js: Страница закрывается, состояния очищены');
});


window.addEventListener('pagehide', () => {
    chatHistory = [];
    console.log('Content.js: Переход на другую страницу, история чата очищена');
});




let screenshotIsSelecting = false;
let screenshotStartX, screenshotStartY;
let screenshotCurrentRect = { x: 0, y: 0, width: 0, height: 0 };

let screenshotOverlay = document.getElementById('screenshot-overlay');
let screenshotSelectionArea = document.getElementById('screenshot-selection-area');
let screenshotControls = document.getElementById('screenshot-controls');
let screenshotCaptureBtn, screenshotCancelBtn;


function createScreenshotElements() {
    if (!screenshotOverlay) {
        screenshotOverlay = document.createElement('div');
        screenshotOverlay.id = 'screenshot-overlay';
        document.body.appendChild(screenshotOverlay);

        screenshotSelectionArea = document.createElement('div');
        screenshotSelectionArea.id = 'screenshot-selection-area';
        document.body.appendChild(screenshotSelectionArea);

        
        screenshotControls = document.createElement('div');
        screenshotControls.id = 'screenshot-controls';
        screenshotControls.innerHTML = `
            <button id="screenshot-capture-btn">Сделать скриншот</button>
            <button id="screenshot-recognize-btn">Распознать и обработать</button>
            <button id="screenshot-cancel-btn">Отмена</button>
        `;
        document.body.appendChild(screenshotControls);

        screenshotCaptureBtn = document.getElementById('screenshot-capture-btn');
        screenshotCancelBtn = document.getElementById('screenshot-cancel-btn');
        const recognizeBtn = document.getElementById('screenshot-recognize-btn');

        
        screenshotOverlay.addEventListener('mousedown', handleScreenshotMouseDown);
        screenshotOverlay.addEventListener('mousemove', handleScreenshotMouseMove);
        screenshotOverlay.addEventListener('mouseup', handleScreenshotMouseUp);
        screenshotOverlay.addEventListener('mouseleave', handleScreenshotMouseLeave);

        screenshotCaptureBtn.addEventListener('click', handleScreenshotCapture);
        screenshotCancelBtn.addEventListener('click', handleScreenshotCancel);
        recognizeBtn.addEventListener('click', handleScreenshotRecognize);
    }
}

function startScreenshotSelectionMode() {
    createScreenshotElements();
    screenshotOverlay.style.display = 'block';
    screenshotSelectionArea.style.display = 'none';
    screenshotControls.style.display = 'none';
    document.body.classList.add('screenshot-selecting');
    screenshotIsSelecting = false;
}

function resetScreenshotSelection() {
    screenshotIsSelecting = false;
    screenshotCurrentRect = { x: 0, y: 0, width: 0, height: 0 };
    if (screenshotOverlay) screenshotOverlay.style.display = 'none';
    if (screenshotSelectionArea) screenshotSelectionArea.style.display = 'none';
    if (screenshotControls) screenshotControls.style.display = 'none';
    document.body.classList.remove('screenshot-selecting');
    
    
    const recognizeBtn = document.getElementById('screenshot-recognize-btn');
    if (recognizeBtn) {
        recognizeBtn.textContent = 'Распознать и обработать';
        recognizeBtn.disabled = false;
    }
}

function handleScreenshotMouseDown(e) {
    e.preventDefault();
    screenshotIsSelecting = true;
    screenshotStartX = e.clientX;
    screenshotStartY = e.clientY;

    screenshotSelectionArea.style.left = screenshotStartX + 'px';
    screenshotSelectionArea.style.top = screenshotStartY + 'px';
    screenshotSelectionArea.style.width = '0px';
    screenshotSelectionArea.style.height = '0px';
    screenshotSelectionArea.style.display = 'block';
    screenshotControls.style.display = 'none';
}

function handleScreenshotMouseMove(e) {
    if (!screenshotIsSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - screenshotStartX);
    const height = Math.abs(currentY - screenshotStartY);
    const left = Math.min(screenshotStartX, currentX);
    const top = Math.min(screenshotStartY, currentY);

    screenshotSelectionArea.style.left = left + 'px';
    screenshotSelectionArea.style.top = top + 'px';
    screenshotSelectionArea.style.width = width + 'px';
    screenshotSelectionArea.style.height = height + 'px';

    screenshotCurrentRect = { x: left, y: top, width: width, height: height };
}

function handleScreenshotMouseUp() {
    if (screenshotIsSelecting) {
        screenshotIsSelecting = false;
        if (screenshotCurrentRect.width > 0 && screenshotCurrentRect.height > 0) {
            screenshotControls.style.display = 'block';

            const controlsWidth = screenshotControls.offsetWidth;
            const controlsHeight = screenshotControls.offsetHeight;

            
            let top = screenshotCurrentRect.y + screenshotCurrentRect.height + 10;
            let left = screenshotCurrentRect.x + (screenshotCurrentRect.width / 2) - (controlsWidth / 2);

            
            if (left < 10) {
                left = 10;
            }
            if (left + controlsWidth > window.innerWidth - 10) {
                left = window.innerWidth - 10 - controlsWidth;
            }
            if (top + controlsHeight > window.innerHeight - 10) {
                
                top = screenshotCurrentRect.y - controlsHeight - 10;
            }
            if (top < 10) {
                
                top = 10;
            }

            screenshotControls.style.top = top + 'px';
            screenshotControls.style.left = left + 'px';

        } else {
            screenshotControls.style.display = 'none';
        }
    }
}

function handleScreenshotMouseLeave() {
    if (screenshotIsSelecting) {
        handleScreenshotMouseUp();
    }
}

function handleScreenshotCapture() {
    if (screenshotCurrentRect.width > 0 && screenshotCurrentRect.height > 0) {
        console.log("Отправка координат области для скриншота:", screenshotCurrentRect);
        chrome.runtime.sendMessage({ action: "areaSelected", rect: screenshotCurrentRect }, (response) => {
            console.log("Получен ответ от background.js:", response);
            if (response && response.success) {
                console.log("Скриншот успешно сделан и сохранен.");
            } else {
                console.error("Ошибка при выполнении скриншота:", response ? response.error : "Неизвестная ошибка.");
            }
            resetScreenshotSelection();
        });
    } else {
        console.warn("Область для скриншота не выбрана или слишком мала.");
        resetScreenshotSelection();
    }
}

function handleScreenshotCancel() {
    resetScreenshotSelection();
}

function handleScreenshotRecognize() {
    if (screenshotCurrentRect.width > 0 && screenshotCurrentRect.height > 0) {
        const recognizeBtn = document.getElementById('screenshot-recognize-btn');
        if(recognizeBtn) {
            recognizeBtn.textContent = 'Обработка...';
            recognizeBtn.disabled = true;
        }

        
        chrome.runtime.sendMessage({ 
            action: "recognizeText", 
            rect: screenshotCurrentRect 
        }, async (response) => {
            if (!response || !response.success || !response.dataUrl) {
                alert("Не удалось сделать скриншот области. Ошибка: " + (response ? response.error : "Неизвестная ошибка."));
                resetScreenshotSelection();
                return;
            }
            
            
            try {
                if (typeof window.easyOCRRecognize !== 'function') {
                     throw new Error("Функция распознавания easyOCRRecognize не найдена.");
                }
                const recognizedText = await window.easyOCRRecognize(response.dataUrl);
                
                
                const processResponse = await processRecognizedText(recognizedText);

                if (processResponse && processResponse.success) {
                    showResult(processResponse.result, true); 
                } else {
                    alert("Ошибка обработки текста: " + (processResponse ? processResponse.error : "Неизвестная ошибка"));
                }

            } catch (error) {
                console.error("Ошибка в цепочке распознавания:", error);
                alert("Ошибка: " + error.message);
            } finally {
                resetScreenshotSelection();
            }
        });
    } else {
        console.warn("Область для скриншота не выбрана или слишком мала.");
        resetScreenshotSelection();
    }
}

async function performOCRWithEasyOCR(imageDataUrl) {
    try {
        
        const result = await window.easyOCRRecognize(imageDataUrl, ["en", "ru"]);
        
        if (result && result.data && result.data.length > 0) {
            const recognizedText = window.extractTextFromResult(result);
            
            if (recognizedText.trim()) {
                console.log('Распознанный текст:', recognizedText);
                
                
                await processRecognizedText(recognizedText);
            } else {
                alert("Текст не найден на изображении.");
            }
        } else {
            alert("Не удалось распознать текст.");
        }
    } catch (error) {
        console.error("Ошибка распознавания:", error);
        alert("Не удалось распознать текст. Ошибка: " + error.message);
    } finally {
        resetScreenshotSelection();
    }
}

async function processRecognizedText(recognizedText) {
    if (!recognizedText || recognizedText.trim() === '') {
        alert("Не удалось распознать текст или область пуста.");
        return { success: false, error: "Распознанный текст пуст." };
    }

    console.log("Отправляем распознанный текст в фоновый скрипт для обработки...");

    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({
                action: 'processRecognizedText',
                text: recognizedText
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Ошибка при отправке сообщения:", chrome.runtime.lastError.message);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                
                if (response && response.success) {
                    console.log('Получен успешный ответ от API:', response.result);
                    resolve({ success: true, result: response.result });
                } else {
                    console.error('API вернуло ошибку:', response ? response.error : 'Неизвестная ошибка');
                    resolve({ success: false, error: response ? response.error : 'Неизвестная ошибка' });
                }
            });
        } catch (error) {
            console.error("Критическая ошибка при отправке текста в API:", error);
            resolve({ success: false, error: error.message });
        }
    });
}