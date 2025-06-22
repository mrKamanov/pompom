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
let minTypingDelay = 30;
let maxTypingDelay = 120;


let typoPositions = [];
let typoCount = 0;
let typoState = null; 
let typoChar = '';


const keyboardNeighbors = {
    'q': ['w', 'a'], 'w': ['q', 'e', 's'], 'e': ['w', 'r', 'd'], 'r': ['e', 't', 'f'], 't': ['r', 'y', 'g'],
    'y': ['t', 'u', 'h'], 'u': ['y', 'i', 'j'], 'i': ['u', 'o', 'k'], 'o': ['i', 'p', 'l'], 'p': ['o', 'l'],
    'a': ['q', 's', 'z'], 's': ['a', 'd', 'w', 'z', 'x'], 'd': ['s', 'f', 'e', 'x', 'c'], 'f': ['d', 'g', 'r', 'c', 'v'],
    'g': ['f', 'h', 't', 'v', 'b'], 'h': ['g', 'j', 'y', 'b', 'n'], 'j': ['h', 'k', 'u', 'n', 'm'], 'k': ['j', 'l', 'i', 'm'],
    'l': ['k', 'o', 'p'], 'z': ['a', 's', 'x'], 'x': ['z', 's', 'd', 'c'], 'c': ['x', 'd', 'f', 'v'],
    'v': ['c', 'f', 'g', 'b'], 'b': ['v', 'g', 'h', 'n'], 'n': ['b', 'h', 'j', 'm'], 'm': ['n', 'j', 'k'],
    '1': ['2', 'q'], '2': ['1', '3', 'w'], '3': ['2', '4', 'e'], '4': ['3', '5', 'r'], '5': ['4', '6', 't'],
    '6': ['5', '7', 'y'], '7': ['6', '8', 'u'], '8': ['7', '9', 'i'], '9': ['8', '0', 'o'], '0': ['9', 'p']
};

function getNeighborChar(char) {
    const lower = char.toLowerCase();
    if (keyboardNeighbors[lower]) {
        const neighbors = keyboardNeighbors[lower];
        return neighbors[Math.floor(Math.random() * neighbors.length)];
    }
    return null;
}

function pickTypoPositions(text) {
    const positions = [];
    let tries = 0;
    while (positions.length < 3 && tries < 100) {
        const pos = Math.floor(Math.random() * (text.length - 1)) + 1; 
        const char = text[pos];
        if (
            !positions.includes(pos) &&
            /[a-zA-Zа-яА-Я0-9]/.test(char) && 
            char !== ' ' &&
            !'.,!?;:'.includes(char)
        ) {
            positions.push(pos);
        }
        tries++;
    }
    return positions;
}

const TYPING_STATE = {
    IDLE: 'idle',           
    TYPING: 'typing',       
    PAUSED: 'paused',       
    COMPLETED: 'completed', 
    NO_INPUT_ELEMENT: 'error_no_input' 
};


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

    
    if (typoState === 'typo') {
        
        insertChar(typoChar);
        typoState = 'backspace';
        typingTimeoutId = setTimeout(typeCharacter, 120 + Math.random() * 100); 
        return;
    } else if (typoState === 'backspace') {
        
        removeLastChar();
        typoState = 'correction';
        typingTimeoutId = setTimeout(typeCharacter, 120 + Math.random() * 100);
        return;
    } else if (typoState === 'correction') {
        
        insertChar(typingText[currentIndex]);
        typoState = null;
        currentIndex++;
        let delay = Math.random() * (maxTypingDelay - minTypingDelay) + minTypingDelay;
        typingTimeoutId = setTimeout(typeCharacter, delay);
        return;
    }
    
    if (
        typoCount < 3 &&
        typoPositions.includes(currentIndex) &&
        /[a-zA-Zа-яА-Я0-9]/.test(typingText[currentIndex])
    ) {
        const neighbor = getNeighborChar(typingText[currentIndex]);
        if (neighbor) {
            typoChar = neighbor;
            typoState = 'typo';
            typoCount++;
            typeCharacter();
            return;
        }
    }
    
    insertChar(typingText[currentIndex]);
    currentIndex++;
    let delay = Math.random() * (maxTypingDelay - minTypingDelay) + minTypingDelay;
    if (typingText[currentIndex - 1] === '.' || typingText[currentIndex - 1] === '!' || typingText[currentIndex - 1] === '?') {
        delay += PAUSE_AFTER_SENTENCE_MS;
    } else if (typingText[currentIndex - 1] === ',') {
        delay += PAUSE_AFTER_COMMA_MS;
    }
    typingTimeoutId = setTimeout(typeCharacter, delay);
}

function insertChar(char) {
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
}

function removeLastChar() {
    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
        activeElement.value = activeElement.value.slice(0, -1);
    } else if (activeElement.isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.setStart(range.endContainer, Math.max(0, range.endOffset - 1));
            range.deleteContents();
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            activeElement.focus();
            document.execCommand('delete', false, null);
        }
    }
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));
}

function startTyping(text, startIndex = 0, customMinDelay, customMaxDelay) {
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

    if (typeof customMinDelay === 'number' && typeof customMaxDelay === 'number') {
        minTypingDelay = customMinDelay;
        maxTypingDelay = customMaxDelay;
        console.log('[PomPom] minTypingDelay (final):', minTypingDelay, 'maxTypingDelay (final):', maxTypingDelay);
        typingText = text;
        currentIndex = startIndex;
        isTypingRequested = true; 
        isTypingInProgress = true; 
        sendTypingState(TYPING_STATE.TYPING);
        console.log('Inject.js: Начинаем/Возобновляем печать с индекса', startIndex);
        if (typingTimeoutId) {
            clearTimeout(typingTimeoutId);
        }
        
        typoPositions = pickTypoPositions(text);
        typoCount = 0;
        typoState = null;
        typoChar = '';
        typeCharacter(); 
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['minTypingDelay', 'maxTypingDelay'], (result) => {
            minTypingDelay = typeof result.minTypingDelay === 'number' ? result.minTypingDelay : 30;
            maxTypingDelay = typeof result.maxTypingDelay === 'number' ? result.maxTypingDelay : 120;
            console.log('[PomPom] minTypingDelay (from storage):', minTypingDelay, 'maxTypingDelay (from storage):', maxTypingDelay);
            typingText = text;
            currentIndex = startIndex;
            isTypingRequested = true; 
            isTypingInProgress = true; 
            sendTypingState(TYPING_STATE.TYPING);
            console.log('Inject.js: Начинаем/Возобновляем печать с индекса', startIndex);
            if (typingTimeoutId) {
                clearTimeout(typingTimeoutId);
            }
            
            typoPositions = pickTypoPositions(text);
            typoCount = 0;
            typoState = null;
            typoChar = '';
            typeCharacter(); 
        });
    } else {
        minTypingDelay = 30;
        maxTypingDelay = 120;
        console.log('[PomPom] minTypingDelay (default):', minTypingDelay, 'maxTypingDelay (default):', maxTypingDelay);
        typingText = text;
        currentIndex = startIndex;
        isTypingRequested = true; 
        isTypingInProgress = true; 
        sendTypingState(TYPING_STATE.TYPING);
        console.log('Inject.js: Начинаем/Возобновляем печать с индекса', startIndex);
        if (typingTimeoutId) {
            clearTimeout(typingTimeoutId);
        }
        
        typoPositions = pickTypoPositions(text);
        typoCount = 0;
        typoState = null;
        typoChar = '';
        typeCharacter(); 
    }
}


function pauseTyping() {
    console.log('Inject.js: Запрошена пауза печати.');
    if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
        typingTimeoutId = null;
    }
    isTypingInProgress = false; 
    sendTypingState(TYPING_STATE.PAUSED);
}


function resetTyping() {
    console.log('Inject.js: Запрошен полный сброс состояния печати...');

    // 1. Немедленно останавливаем любой запланированный вызов
    if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
        typingTimeoutId = null;
        console.log('Inject.js: Таймер печати остановлен.');
    }

    // 2. Сбрасываем все флаги состояния
    isTypingRequested = false;
    isTypingInProgress = false;
    
    // 3. Сбрасываем текст и счетчики
    typingText = '';
    currentIndex = 0;
    
    // 4. Сбрасываем состояние опечаток
    typoState = null;
    typoCount = 0;
    typoPositions = [];

    // 5. Сообщаем интерфейсу, что все остановлено
    sendTypingState(TYPING_STATE.IDLE);
    console.log('Inject.js: Состояние печати полностью сброшено до IDLE.');
}


document.addEventListener('focusin', (event) => {
    
    if (isInputTarget(event.target)) {
        
        if (activeElement === null || activeElement === event.target) {
            activeElement = event.target;
            
        } else if (isTypingRequested && isTypingInProgress) {
            
            console.log('Inject.js: Фокус перешел на другое поле ввода. Пауза печати.');
            pauseTyping();
        }
    } else if (isTypingRequested && isTypingInProgress) {
        
        console.log('Inject.js: Фокус потерян с элемента ввода на не-ввод. Пауза печати.');
        pauseTyping();
    }
});


document.addEventListener('blur', (event) => {
    
    if (isTypingInProgress && activeElement && (!event.relatedTarget || !isInputTarget(event.relatedTarget))) {
        console.log('Inject.js: Элемент потерял фокус. Пауза печати.');
        pauseTyping();
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
                    if (typeof event.data.minTypingDelay === 'number' && typeof event.data.maxTypingDelay === 'number') {
                        minTypingDelay = event.data.minTypingDelay;
                        maxTypingDelay = event.data.maxTypingDelay;
                        console.log('[PomPom] minTypingDelay (from message):', minTypingDelay, 'maxTypingDelay (from message):', maxTypingDelay);
                        startTyping(event.data.text, currentIndex, minTypingDelay, maxTypingDelay);
                    } else {
                        startTyping(event.data.text, currentIndex);
                    }
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
            pauseTyping();
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