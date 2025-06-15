/**
 * inject.js - Скрипт автоматической печати текста
 * 
 * Этот файл отвечает за:
 * 1. Реализацию функции автоматической печати текста в активное поле ввода
 * 2. Управление состояниями печати (ожидание, печать, пауза, завершение)
 * 3. Обработку пользовательского ввода во время автоматической печати
 * 4. Синхронизацию с основным интерфейсом расширения
 * 
 * Основные компоненты:
 * - Система состояний печати (IDLE, TYPING, PAUSED, COMPLETED)
 * - Управление задержками между символами для реалистичной печати
 * - Обработка различных типов полей ввода (input, textarea, contenteditable)
 * - Система пауз после знаков препинания
 * - Механизм прерывания печати при ручном вводе
 * 
 * @author Сергей Каманов
 * @version 1.0
 */

let typingText = '';
let currentIndex = 0;
let typingTimeoutId = null;
let activeElement = null; 
let isTypingRequested = false; 
let isTypingInProgress = false; 


const TYPING_STATE = {
    IDLE: 'idle',           
    TYPING: 'typing',       
    PAUSED: 'paused',       
    COMPLETED: 'completed', 
    NO_INPUT_ELEMENT: 'error_no_input' 
};


const MIN_TYPING_DELAY = 30; 
const MAX_TYPING_DELAY = 120; 
const PAUSE_AFTER_SENTENCE_MS = 200; 
const PAUSE_AFTER_COMMA_MS = 100;    


function sendTypingState(state) {
    window.postMessage({ type: 'POMPOM_TYPING_STATE', state: state }, '*');
    
}


function isInputTarget(element) {
    return (
        element &&
        (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'search' || element.type === 'email' || element.type === 'url' || element.type === 'tel' || element.type === 'password')) ||
        element.tagName === 'TEXTAREA' ||
        (element.tagName === 'DIV' && element.isContentEditable)
    );
}


function typeCharacter() {
    
    if (!isTypingRequested || !activeElement || currentIndex >= typingText.length || !isTypingInProgress) {
        if (typingTimeoutId) {
            clearTimeout(typingTimeoutId);
            typingTimeoutId = null;
        }

        if (isTypingRequested && currentIndex >= typingText.length) {
            
            sendTypingState(TYPING_STATE.COMPLETED);
            isTypingRequested = false; 
            console.log('Inject.js: Печать завершена.');
        } else if (isTypingRequested) {
            
            sendTypingState(TYPING_STATE.PAUSED);
            console.log('Inject.js: Печать приостановлена (незавершено, не сброшено).');
        } else {
            
            sendTypingState(TYPING_STATE.IDLE);
            console.log('Inject.js: Печать остановлена/отменена (IDLE).');
        }
        return;
    }

    const char = typingText[currentIndex];

    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
        activeElement.value += char;
    } else if (activeElement.isContentEditable) {
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents(); 
            range.insertNode(document.createTextNode(char));
            range.collapse(false); 
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            
            activeElement.focus(); 
            document.execCommand('insertText', false, char);
        }
    }

    
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));

    currentIndex++;

    let delay = Math.random() * (MAX_TYPING_DELAY - MIN_TYPING_DELAY) + MIN_TYPING_DELAY;

    
    if (char === '.' || char === '!' || char === '?') {
        delay += PAUSE_AFTER_SENTENCE_MS;
    } else if (char === ',') {
        delay += PAUSE_AFTER_COMMA_MS;
    }

    
    typingTimeoutId = setTimeout(typeCharacter, delay);
}


function startTyping(text, startIndex = 0) {
    if (isTypingInProgress && typingTimeoutId) {
        console.log('Inject.js: Печать уже в процессе, игнорируем START.');
        return;
    }

    const currentFocus = document.activeElement; 
    if (!isInputTarget(currentFocus)) {
        console.warn('Inject.js: Активный элемент не является полем ввода. Не могу начать печать.');
        sendTypingState(TYPING_STATE.NO_INPUT_ELEMENT);
        isTypingRequested = false; 
        return;
    }
    activeElement = currentFocus; 

    typingText = text;
    currentIndex = startIndex;
    isTypingRequested = true; 
    isTypingInProgress = true; 
    sendTypingState(TYPING_STATE.TYPING);
    console.log('Inject.js: Начинаем/Возобновляем печать с индекса', startIndex);

    
    if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
    }
    typeCharacter(); 
}


function pauseTyping(reasonState = TYPING_STATE.PAUSED) {
    if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
        typingTimeoutId = null;
    }
    isTypingInProgress = false; 
    
    sendTypingState(reasonState);
    console.log('Inject.js: Печать приостановлена.');
}


function resetTyping() {
    if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
        typingTimeoutId = null;
    }
    typingText = '';
    currentIndex = 0;
    activeElement = null;
    isTypingRequested = false;
    isTypingInProgress = false;
    sendTypingState(TYPING_STATE.IDLE);
    console.log('Inject.js: Состояние печати сброшено до IDLE.');
}


document.addEventListener('focusin', (event) => {
    
    if (isInputTarget(event.target)) {
        
        if (activeElement === null || activeElement === event.target) {
            activeElement = event.target;
            
        } else if (isTypingRequested && isTypingInProgress) {
            
            console.log('Inject.js: Фокус перешел на другое поле ввода. Пауза печати.');
            pauseTyping(TYPING_STATE.PAUSED);
        }
    } else if (isTypingRequested && isTypingInProgress) {
        
        console.log('Inject.js: Фокус потерян с элемента ввода на не-ввод. Пауза печати.');
        pauseTyping(TYPING_STATE.PAUSED);
    }
});


document.addEventListener('blur', (event) => {
    
    if (isTypingInProgress && activeElement && (!event.relatedTarget || !isInputTarget(event.relatedTarget))) {
        console.log('Inject.js: Элемент потерял фокус. Пауза печати.');
        pauseTyping(TYPING_STATE.PAUSED);
    }
}, true); 



document.addEventListener('keydown', (event) => {
    
    if (isTypingRequested &&
        (event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace' || event.key === ' ')) {
        
        if (!event.ctrlKey && !event.altKey && !event.metaKey) {
            console.log('Inject.js: Обнаружен ручной ввод, прекращение автопечати.');
            resetTyping();
        }
    }
});



window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || !event.data.type) {
        return;
    }

    switch (event.data.type) {
        case 'POMPOM_START_TYPING':
            console.log('Inject.js: Получена команда START_TYPING. Текст:', event.data.text);
            if (event.data.text) {
                
                if (!isTypingInProgress) { 
                     
                    if (typingText !== event.data.text) {
                        currentIndex = 0;
                    }
                    startTyping(event.data.text, currentIndex);
                } else {
                    console.log('Inject.js: Уже активно печатаем, игнорируем START_TYPING.');
                }
            } else {
                console.warn('Inject.js: Получена команда START_TYPING, но текст отсутствует.');
                sendTypingState(TYPING_STATE.IDLE);
            }
            break;
        case 'POMPOM_PAUSE_TYPING':
            console.log('Inject.js: Получена команда PAUSE_TYPING.');
            pauseTyping(TYPING_STATE.PAUSED);
            break;
        case 'POMPOM_RESET_TYPING':
            console.log('Inject.js: Получена команда RESET_TYPING.');
            resetTyping();
            break;
        default:
            break;
    }
});


sendTypingState(TYPING_STATE.IDLE);