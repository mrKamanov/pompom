// inject.js
// Этот скрипт внедряется непосредственно в контекст веб-страницы.

let typingText = '';
let currentIndex = 0;
let typingTimeoutId = null;
let activeElement = null; // Текущий активный элемент ввода
let isTypingRequested = false; // Флаг: была ли запрошена печать (пользователем)
let isTypingInProgress = false; // Флаг: идет ли активная печать (символ за символом)

// Константы для состояний
const TYPING_STATE = {
    IDLE: 'idle',           // Ожидает начала печати, ничего не печатает
    TYPING: 'typing',       // Активно печатает
    PAUSED: 'paused',       // Приостановлена (потерей фокуса или вручную)
    COMPLETED: 'completed', // Печать завершена
    NO_INPUT_ELEMENT: 'error_no_input' // Ошибка: не найден активный элемент ввода
};

// ==========================================================
// ПАРАМЕТРЫ ДЛЯ СЛУЧАЙНОЙ СКОРОСТИ ПЕЧАТИ
const MIN_TYPING_DELAY = 30; // Минимальная задержка между символами в мс
const MAX_TYPING_DELAY = 120; // Максимальная задержка между символами в мс
const PAUSE_AFTER_SENTENCE_MS = 200; // Дополнительная пауза после точек, восклицательных/вопросительных знаков
const PAUSE_AFTER_COMMA_MS = 100;    // Дополнительная пауза после запятых

// ==========================================================

// Функция для отправки состояния в content.js
function sendTypingState(state) {
    window.postMessage({ type: 'POMPOM_TYPING_STATE', state: state }, '*');
    // console.log('Inject.js: Отправлено состояние:', state); // Закомментировано для уменьшения логов
}

// Проверяет, является ли элемент ввода текстовым полем
function isInputTarget(element) {
    return (
        element &&
        (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'search' || element.type === 'email' || element.type === 'url' || element.type === 'tel' || element.type === 'password')) ||
        element.tagName === 'TEXTAREA' ||
        (element.tagName === 'DIV' && element.isContentEditable)
    );
}

// Основная функция для имитации ввода текста по одному символу
function typeCharacter() {
    // Если печать не была запрошена (т.е. был reset или отмена),
    // или если нет активного элемента, или текст закончился,
    // или если печать вручную приостановлена (isTypingInProgress = false)
    if (!isTypingRequested || !activeElement || currentIndex >= typingText.length || !isTypingInProgress) {
        if (typingTimeoutId) {
            clearTimeout(typingTimeoutId);
            typingTimeoutId = null;
        }

        if (isTypingRequested && currentIndex >= typingText.length) {
            // Печать успешно завершена
            sendTypingState(TYPING_STATE.COMPLETED);
            isTypingRequested = false; // Сброс флага запроса после завершения
            console.log('Inject.js: Печать завершена.');
        } else if (isTypingRequested) {
            // Если печать была запрошена, но остановлена не завершением и не reset,
            // это должна быть пауза.
            sendTypingState(TYPING_STATE.PAUSED);
            console.log('Inject.js: Печать приостановлена (незавершено, не сброшено).');
        } else {
            // Если печать не была запрошена (т.е. был reset или отмена), то IDLE.
            sendTypingState(TYPING_STATE.IDLE);
            console.log('Inject.js: Печать остановлена/отменена (IDLE).');
        }
        return;
    }

    const char = typingText[currentIndex];

    // Вставляем символ
    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
        activeElement.value += char;
    } else if (activeElement.isContentEditable) {
        // Для contenteditable элементов
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents(); // Удалить выделенное, если есть
            range.insertNode(document.createTextNode(char));
            range.collapse(false); // Переместить курсор в конец вставленного текста
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Это fallback, если вдруг нет выделения
            activeElement.focus(); // Убеждаемся, что элемент в фокусе
            document.execCommand('insertText', false, char);
        }
    }

    // Триггер событий ввода для имитации пользовательского ввода
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));

    currentIndex++;

    let delay = Math.random() * (MAX_TYPING_DELAY - MIN_TYPING_DELAY) + MIN_TYPING_DELAY;

    // Дополнительные паузы для естественности
    if (char === '.' || char === '!' || char === '?') {
        delay += PAUSE_AFTER_SENTENCE_MS;
    } else if (char === ',') {
        delay += PAUSE_AFTER_COMMA_MS;
    }

    // Планируем следующий символ
    typingTimeoutId = setTimeout(typeCharacter, delay);
}

// Функция для начала или возобновления печати
function startTyping(text, startIndex = 0) {
    if (isTypingInProgress && typingTimeoutId) {
        console.log('Inject.js: Печать уже в процессе, игнорируем START.');
        return;
    }

    const currentFocus = document.activeElement; // Получаем текущий активный элемент
    if (!isInputTarget(currentFocus)) {
        console.warn('Inject.js: Активный элемент не является полем ввода. Не могу начать печать.');
        sendTypingState(TYPING_STATE.NO_INPUT_ELEMENT);
        isTypingRequested = false; // Сбрасываем запрос, так как нет элемента для печати
        return;
    }
    activeElement = currentFocus; // Сохраняем ссылку на активный элемент

    typingText = text;
    currentIndex = startIndex;
    isTypingRequested = true; // Печать запрошена пользователем
    isTypingInProgress = true; // Печать активна
    sendTypingState(TYPING_STATE.TYPING);
    console.log('Inject.js: Начинаем/Возобновляем печать с индекса', startIndex);

    // Очищаем предыдущий таймаут, если он был активен (например, при быстром переключении)
    if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
    }
    typeCharacter(); // Начинаем цикл печати
}

// Функция для приостановки печати
function pauseTyping(reasonState = TYPING_STATE.PAUSED) {
    if (typingTimeoutId) {
        clearTimeout(typingTimeoutId);
        typingTimeoutId = null;
    }
    isTypingInProgress = false; // Активная печать остановлена
    // isTypingRequested остается true, если это пауза, а не полный сброс
    sendTypingState(reasonState);
    console.log('Inject.js: Печать приостановлена.');
}

// Функция для полного сброса состояния печати
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

// ==========================================================
// ОБРАБОТЧИКИ СОБЫТИЙ ДЛЯ УПРАВЛЕНИЯ ПАУЗОЙ/ВОЗОБНОВЛЕНИЕМ

// Слушатель для события фокуса (чтобы обновить activeElement и поставить на паузу, если фокус потерян)
document.addEventListener('focusin', (event) => {
    // Если фокус перешел на элемент ввода
    if (isInputTarget(event.target)) {
        // Обновляем activeElement, только если он либо равен старому, либо если старый был null
        // Это важно, чтобы не менять activeElement, когда пользователь просто кликает по странице
        // вне поля ввода, но activeElement все еще корректен
        if (activeElement === null || activeElement === event.target) {
            activeElement = event.target;
            // console.log('Inject.js: Фокус на элементе ввода:', activeElement);
        } else if (isTypingRequested && isTypingInProgress) {
            // Если мы печатали в одно поле, а фокус перешел на другое поле ввода,
            // то текущая печать должна быть приостановлена.
            console.log('Inject.js: Фокус перешел на другое поле ввода. Пауза печати.');
            pauseTyping(TYPING_STATE.PAUSED);
        }
    } else if (isTypingRequested && isTypingInProgress) {
        // Если печать активна, но фокус ушел с элемента ввода на не-элемент ввода,
        // ставим на паузу.
        console.log('Inject.js: Фокус потерян с элемента ввода на не-ввод. Пауза печати.');
        pauseTyping(TYPING_STATE.PAUSED);
    }
});

// Слушатель для события потери фокуса (blur)
// Используем capture phase, чтобы ловить событие раньше
document.addEventListener('blur', (event) => {
    // event.relatedTarget - это элемент, который получает фокус.
    // Если его нет (фокус ушел из окна) или он не является полем ввода,
    // и если мы в данный момент печатаем, то ставим на паузу.
    if (isTypingInProgress && activeElement && (!event.relatedTarget || !isInputTarget(event.relatedTarget))) {
        console.log('Inject.js: Элемент потерял фокус. Пауза печати.');
        pauseTyping(TYPING_STATE.PAUSED);
    }
}, true); // Используем capture phase


// Слушатель для ручного ввода пользователя
document.addEventListener('keydown', (event) => {
    // Если печать активна И пользователь нажимает буквенно-цифровую клавишу,
    // или Enter, или Space, или Backspace (т.е. что-то, что влияет на текст),
    // то мы считаем это ручным вмешательством и сбрасываем автопечать.
    if (isTypingRequested &&
        (event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace' || event.key === ' ')) {
        // Игнорируем модификаторы, чтобы не реагировать на Ctrl+C, Ctrl+V и т.д.
        if (!event.ctrlKey && !event.altKey && !event.metaKey) {
            console.log('Inject.js: Обнаружен ручной ввод, прекращение автопечати.');
            resetTyping();
        }
    }
});


// Слушаем сообщения от content.js
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || !event.data.type) {
        return;
    }

    switch (event.data.type) {
        case 'POMPOM_START_TYPING':
            console.log('Inject.js: Получена команда START_TYPING. Текст:', event.data.text);
            if (event.data.text) {
                // Если пришла команда START, но уже печатаем, игнорируем
                // Это предотвращает повторный запуск, если кнопка была нажата несколько раз быстро
                if (!isTypingInProgress) { // Проверяем, идет ли *активная* печать
                     // Если текст изменился, или это первый запуск, сбрасываем индекс
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

// Отправляем начальное состояние после загрузки для синхронизации UI
sendTypingState(TYPING_STATE.IDLE);