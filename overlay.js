(function () {
const OVERLAY_ID = 'game-finder-overlay';
const STYLE_ID = 'game-finder-overlay-style';

// === ЛОГГИРОВАНИЕ ===
const LOG_PREFIX = '[JBG-Finder-PREALPHA]';
const LOG_ENABLED = true;
function log(...args) { if (LOG_ENABLED) console.log(LOG_PREFIX, ...args); }
function logError(...args) { if (LOG_ENABLED) console.error(LOG_PREFIX, ...args); }
function logDebug(...args) { if (LOG_ENABLED) console.debug(LOG_PREFIX, ...args); }
function logWarn(...args) { if (LOG_ENABLED) console.warn(LOG_PREFIX, ...args); }

const existing = document.getElementById(OVERLAY_ID);
if (existing) {
    log('Removing existing overlay...');
    existing.remove();
}

log('Initializing JBG-Finder overlay...');

const CONFIG = {
    databaseURL: "https://getonjbghelp.github.io/jbg-finder/database.js",
    // URL для каждой CDN-библиотеки. По умолчанию — unpkg (работает с любого сайта).
    // Можно заменить на локальный путь при локальной разработке.
    cdn: {
        fuse:      "https://getonjbghelp.github.io/jbg-finder/CDNlibs/fuse.min.js",
        fuzzysort: "https://getonjbghelp.github.io/jbg-finder/CDNlibs/fuzzysort.js"
    },
    minQuestionLength: 2,
    defaultLang: 'en',
    loadTimeout: 10000,
    retryAttempts: 3,
    debug: false
};

// Общие иконки статуса игры (маленький круг рядом с названием)
// Задай здесь реальные URL-ы PNG под свой хостинг.
const GAME_STATUS_ICONS = {
    stable:    'https://getonjbghelp.github.io/jbg-finder/pngs/status/adapted/stable.png',
    unstable:  'https://getonjbghelp.github.io/jbg-finder/pngs/status/adapted/unstable.png',
    nonfullwork: 'https://getonjbghelp.github.io/jbg-finder/pngs/status/adapted/nonfullwork.png'
};

const LANG = {
    ru: {
        title: 'JBG-Finder PREALPHA',
        detectBtn: '🔍 Найти вопрос и игру',
        searchBtn: '⚡ Найти ответ',
        copyBtn: '📋 Копировать',
        clearBtn: '🗑 Удалить результаты',
        questionLabel: '📝 ВОПРОС',
        answerLabel: '💡 ОТВЕТ',
        notDetected: 'Игра не определена',
        scanning: 'Сканирование...',
        gameDetected: 'Игра: ',
        gameDetectedSuffix: '',
        answerFound: 'Ответ найден! (',
        answerNotFound: 'Ответ не найден, скорее всего произошла ошибка или этого вопроса нет в нашей базе данных!',
        copySuccess: 'Скопировано!',
        detectFirst: 'Сначала определите игру',
        loadingDB: 'Загрузка базы...',
        dbLoaded: 'База загружена',
        dbError: 'Ошибка базы',
        confidence: 'уверенность: ',
        symbols: ' символов',
        close: 'Закрыть',
        minimize: 'Свернуть',
        notEnoughSymbols: 'Вопрос слишком короткий',
        indicators: 'индикаторов',
        debugMode: 'Режим отладки: ВКЛ',
        placeholderQuestion: 'Нажмите "Найти вопрос и игру", когда вопрос УЖЕ будет на экране... В других случаях это вызовет нестабильную работу...',
        placeholderAnswer: 'Здесь появится ответ когда вы нажмёте на кнопку "Найти Ответ"...',
        version: 'Версия',
        daysAgo: 'дн. назад'
    },
    en: {
        title: 'JBG-Finder PREALPHA',
        detectBtn: '🔍 Detect Question and Game',
        searchBtn: '⚡ Find Answer',
        copyBtn: '📋 Copy',
        clearBtn: '🗑 Delete Results',
        questionLabel: '📝 QUESTION',
        answerLabel: '💡 ANSWER',
        notDetected: 'Game Not Detected',
        scanning: 'Scanning...',
        gameDetected: 'Game: ',
        gameDetectedSuffix: '',
        answerFound: 'Answer Found! (',
        answerNotFound: 'The answer was not found, most likely there was an error or this question is not in our database!',
        copySuccess: 'Copied!',
        detectFirst: 'Detect game first',
        loadingDB: 'Loading DB...',
        dbLoaded: 'Database Loaded',
        dbError: 'Database Error',
        confidence: 'confidence: ',
        symbols: ' symbols',
        close: 'Close',
        minimize: 'Minimize',
        notEnoughSymbols: 'Question too short',
        indicators: 'indicators',
        debugMode: 'Debug Mode: ON',
        placeholderQuestion: 'Click "Detect question and game" when the question is ALREADY on the screen... In other cases, it will cause unstable work...',
        placeholderAnswer: 'The answer will appear here when you click on the "Find Answer" button...',
        version: 'Ver',
        daysAgo: 'days ago'
    }
};

let currentGame = null;
let currentQuestion = '';
let gameDatabase = null;
let currentLang = CONFIG.defaultLang;
let overlayEl = null;
let dbLoadAttempts = 0;
let isDatabaseLoaded = false;
let currentContentLang = CONFIG.defaultLang; // язык текущего вопроса (ru/en)

const dom = {};
let popupEl = null;
// переменные для хранения обработчиков, чтобы можно было их снять при удалении оверлея
let popupDocClickHandler = null;
let windowResizeHandler = null;

function getText(key, lang) {
    const l = (lang && LANG[lang]) ? LANG[lang] : (LANG[currentLang] || LANG.ru);
    return (l && l[key]) || key;
}

function detectLangFromText(text) {
    if (!text || typeof text !== 'string') return CONFIG.defaultLang;
    return /[\u0400-\u04FF]/.test(text) ? 'ru' : 'en';
}

function normalizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Очистка сырого текста вопроса: префиксы, таймеры, подсказки. Возвращает null если < 2 символов. */
function cleanQuestionText(str) {
    if (!str || typeof str !== 'string') return null;
    let text = str.trim();
    if (!text) return null;
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/^(Вопрос:?|Question:?|№\s*\d+:?|\d+\.)\s*/i, '');
    text = text.replace(/\s*(\(?\d{1,2}:\d{2}\)?)\s*$/, '');
    text = text.replace(/\s*\(hint:.*\)$/i, '');
    text = text.trim();
    if (text.length < 2) return null;
    return text;
}

function updateGameAssets() {
    if (!currentGame || !gameDatabase || !gameDatabase.gameConfig) return;
    const config = gameDatabase.gameConfig[currentGame];
    if (!config) return;

    const status = config.status || {};
    const notes = status.notes || {};
    const statusIconUrl = status.level ? GAME_STATUS_ICONS[status.level] : null;

    if (dom.gameIcon) {
        if (statusIconUrl) {
            dom.gameIcon.src = statusIconUrl;
            dom.gameIcon.style.display = 'block';
        } else {
            dom.gameIcon.src = '';
            dom.gameIcon.style.display = 'none';
            hidePopup();
        }
        // убираем системный тултип
        dom.gameIcon.removeAttribute('title');
    }

    const logoUrls = config.logoUrls || (config.assets && config.assets.logoUrls);
    const logoUrl = logoUrls
        ? (logoUrls[currentContentLang] || logoUrls.en || logoUrls.ru)
        : null;

    if (dom.gameLogo) {
        if (logoUrl) {
            dom.gameLogo.src = logoUrl;
            dom.gameLogo.style.display = 'block';
        } else {
            dom.gameLogo.src = '';
            dom.gameLogo.style.display = 'none';
        }
    }
    /* Название игры показываем только если логотип не указан */
    if (dom.gameTitleBlock) {
        dom.gameTitleBlock.style.display = logoUrl ? 'none' : '';
    }

    // notes для попапа
    const noteText = notes[currentContentLang] || notes.en || notes.ru || '';
    setPopupContent(noteText, currentContentLang);

    // Подстроим размер иконки под высоту логотипа (или названия)
    updateIconSize();
}

function updateIconSize() {
    if (!dom.gameIcon) return;
    try {
        // Получаем реальную высоту логотипа (если есть)
        let logoHeight = 0;
        if (dom.gameLogo && dom.gameLogo.style.display !== 'none') {
            logoHeight = dom.gameLogo.getBoundingClientRect().height;
        }
        // Если логотипа нет — используем высоту названия игры (game-name)
        if ((!logoHeight || logoHeight < 6) && dom.gameName) {
            logoHeight = dom.gameName.getBoundingClientRect().height || 18;
        }
        // Ограничим минимальную/максимальную высоту для иконки
        const minH = 14;
        const maxH = 48;
        const finalH = Math.max(minH, Math.min(maxH, Math.round(logoHeight)));
        dom.gameIcon.style.height = finalH + 'px';
        dom.gameIcon.style.width = 'auto';
        dom.gameIcon.style.objectFit = 'contain';
    } catch (e) {
        logWarn('updateIconSize error', e);
    }
}

function setPopupContent(text, lang) {
    if (!popupEl) return;
    const sub = popupEl.querySelector('.jf-popup-subtitle');
    const body = popupEl.querySelector('.jf-popup-body');
    if (sub) sub.textContent = (lang === 'ru') ? 'Почему?' : 'Why?';
    if (body) body.textContent = text || '';
}

function showPopupAt(targetEl) {
    if (!popupEl || !targetEl || !overlayEl) return;
    const rect = targetEl.getBoundingClientRect();
    const overlayRect = overlayEl.getBoundingClientRect();

    // позиционируем попап относительно overlay (absolute внутри overlay)
    const popupRect = popupEl.getBoundingClientRect();
    const spaceAbove = rect.top - overlayRect.top;
    const desiredTop = spaceAbove - popupRect.height - 8; // above with margin
    const belowTop = rect.bottom - overlayRect.top + 8; // below with margin

    let top;
    if (desiredTop > 8) top = desiredTop;
    else top = belowTop;

    // Поправим по горизонтали — чтобы не вылезать за правую/левую границы overlay
    let left = rect.left - overlayRect.left;
    // если элемент шире попапа, немного сдвигаем попап влево
    if (left + popupRect.width > overlayRect.width - 8) {
        left = Math.max(8, overlayRect.width - popupRect.width - 8);
    }
    // минимальный отступ
    if (left < 8) left = 8;

    popupEl.style.top = top + 'px';
    popupEl.style.left = left + 'px';
    popupEl.style.opacity = '1';
    popupEl.style.pointerEvents = 'auto';
}

function hidePopup() {
    if (!popupEl) return;
    popupEl.style.opacity = '0';
    popupEl.style.pointerEvents = 'none';
}

/** Сброс инлайн-стилей высоты кнопок — возврат к размерам по CSS (вызывать при resize). */
function resetCenterButtonsHeight() {
    if (!dom.detectBtn && !dom.searchBtn && !dom.deleteBtn) return;
    [dom.detectBtn, dom.searchBtn, dom.deleteBtn].forEach(btn => {
        if (!btn) return;
        btn.style.height = '';
        btn.style.paddingTop = '';
        btn.style.paddingBottom = '';
        btn.style.lineHeight = '';
        btn.style.display = '';
        btn.style.boxSizing = '';
    });
}

/** Адаптация высоты центральных кнопок только когда обе колонки высокие; не уменьшаем ниже 44px, чтобы текст не обрезался. */
function adaptCenterButtonsHeight() {
    if (!overlayEl) return;
    try {
        setTimeout(() => {
            if (!dom.questionText || !dom.answerText || !dom.detectBtn || !dom.searchBtn || !dom.deleteBtn) return;
            const leftH = dom.questionText.getBoundingClientRect().height || 0;
            const rightH = dom.answerText.getBoundingClientRect().height || 0;
            if (leftH < 80 || rightH < 80) return;
            const base = Math.floor(Math.min(leftH, rightH));
            const gapTotal = 12;
            const btnH = Math.max(44, Math.floor((base - gapTotal) / 3));
            [dom.detectBtn, dom.searchBtn, dom.deleteBtn].forEach(btn => {
                if (!btn) return;
                btn.style.height = btnH + 'px';
                btn.style.paddingTop = '4px';
                btn.style.paddingBottom = '4px';
                btn.style.lineHeight = (btnH - 10) + 'px';
                btn.style.display = 'flex';
                btn.style.boxSizing = 'border-box';
            });
        }, 120);
    } catch (e) {
        logWarn('adaptCenterButtonsHeight error', e);
    }
}

function setQuestionLoading(isLoading) {
    if (!dom.questionSpinner) return;
    dom.questionSpinner.classList.toggle('active', !!isLoading);
}

function setAnswerLoading(isLoading) {
    if (!dom.answerSpinner) return;
    dom.answerSpinner.classList.toggle('active', !!isLoading);
}

// === Минималистичный интерфейс в стиле Windows 10 ===
function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    log('Creating overlay styles...');
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        /* Базовый сброс только внутри оверлея */
        #${OVERLAY_ID} * {
            box-sizing: border-box !important;
            margin: 0;
            padding: 0;
        }

        /* Основное окно: минимальный размер, при длинном контенте — скролл внутри */
        #${OVERLAY_ID} {
            position: fixed;
            top: 40px;
            right: 40px;
            width: 522px;
            min-height: 280px;
            max-height: 90vh;
            height: 338px;
            max-width: 98vw;
            background: #2b2b2b;
            border: 1px solid #3b3b3b;
            border-radius: 6px;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #f0f0f0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            user-select: none;
        }

        /* Заголовок в стиле Windows 10 */
        #${OVERLAY_ID} .overlay-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 30px;
            padding: 0 8px;
            background: #323232;
            border-bottom: 1px solid #3f3f3f;
            cursor: move;
        }

        #${OVERLAY_ID} .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        #${OVERLAY_ID} .overlay-title {
            font-size: 13px;
            font-weight: 500;
            color: #f5f5f5;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        #${OVERLAY_ID} .db-info {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 2px 6px;
            border-radius: 4px;
            background: #2b2b2b;
            border: 1px solid #3b3b3b;
            font-size: 10px;
            color: #a0a0a0;
        }

        #${OVERLAY_ID} #db-version,
        #${OVERLAY_ID} #db-age {
            font-size: 10px;
        }

        #${OVERLAY_ID} .db-status {
            font-size: 9px;
            padding: 1px 6px;
            border-radius: 999px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        #${OVERLAY_ID} .db-status.loaded {
            background: #2f854f;
            color: #f5f5f5;
        }

        #${OVERLAY_ID} .db-status.error {
            background: #8b3434;
            color: #f5f5f5;
        }

        #${OVERLAY_ID} .overlay-controls {
            display: flex;
            align-items: center;
        }

        #${OVERLAY_ID} .overlay-btn {
            width: 30px;
            height: 22px;
            border: none;
            background: transparent;
            color: #c0c0c0;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #${OVERLAY_ID} .overlay-btn:hover {
            background: #3b3b3b;
            color: #ffffff;
        }

        #${OVERLAY_ID} #close-btn:hover {
            background: #c0392b;
            color: #ffffff;
        }

        #${OVERLAY_ID} .overlay-content {
            padding: 14px 16px 10px 16px;
            background: #252525;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }

        /* Верхняя строка с игрой */
        #${OVERLAY_ID} .game-indicator {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            margin-bottom: 10px;
            border-radius: 4px;
            background: #2f2f2f;
            border: 1px solid #3b3b3b;
        }

        #${OVERLAY_ID} .game-indicator-main {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        #${OVERLAY_ID} .indicator-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #555555;
        }

        #${OVERLAY_ID} .indicator-dot.active {
            background: #29b765;
        }

        #${OVERLAY_ID} .game-icon {
            height: auto;
            width: auto;
            border-radius: 4px;
            background: #3b3b3b;
            object-fit: contain;
            flex-shrink: 0;
            display: none;
        }

        #${OVERLAY_ID} #game-name {
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        #${OVERLAY_ID} #game-confidence {
            font-size: 11px;
            color: #a0a0a0;
            margin-top: 1px;
        }

        #${OVERLAY_ID} .indicator-count {
            font-size: 10px;
            color: #808080;
            white-space: nowrap;
            text-align: right;
        }

        #${OVERLAY_ID} .confidence-badge {
            font-size: 10px;
            color: #a0e7c4;
        }

        /* Логотип игры наверху (в блоке игры); если нет URL — показывается название */
        #${OVERLAY_ID} .game-branding {
            display: flex;
            align-items: center;
            min-width: 0;
            flex: 1;
        }

        #${OVERLAY_ID} #game-logo {
            max-width: 160px;
            max-height: 36px;
            object-fit: contain;
            display: none;
        }

        #${OVERLAY_ID} .game-title-block {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        /* Основная сетка: ВОПРОС | КНОПКИ | ОТВЕТ; при длинном тексте — скролл в колонках */
        #${OVERLAY_ID} .overlay-grid {
            display: grid;
            grid-template-columns: 2fr minmax(160px, 1fr) 2fr;
            gap: 8px;
            align-items: stretch;
            flex: 1;
            min-height: 140px;
        }

        #${OVERLAY_ID} .qa-column {
            display: flex;
            flex-direction: column;
            min-height: 0;
            background: #2b2b2b;
            border: 1px solid #3b3b3b;
            border-radius: 4px;
            padding: 6px;
        }

        #${OVERLAY_ID} .question-header,
        #${OVERLAY_ID} .answer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        #${OVERLAY_ID} .question-header div[style*="font-weight:700"],
        #${OVERLAY_ID} .answer-header div[style*="font-weight:700"] {
            font-size: 11px;
            font-weight: 600 !important;
            letter-spacing: 0.25em;
            text-transform: uppercase;
            color: #d0d0d0;
        }

        #${OVERLAY_ID} #question-length,
        #${OVERLAY_ID} #answer-confidence {
            font-size: 10px;
            color: #909090;
        }

        #${OVERLAY_ID} .question-text,
        #${OVERLAY_ID} .answer-text {
            font-size: 13px;
            line-height: 1.5;
            flex: 1;
            overflow-y: auto;
            word-break: break-word;
            background: #7f7f7f;
            color: #f5f5f5;
            padding: 6px;
            border-radius: 2px;
        }

        #${OVERLAY_ID} .answer-box.found {
            border-color: #29b765;
        }

        #${OVERLAY_ID} .answer-box.not-found {
            border-color: #c0392b;
        }

        #${OVERLAY_ID} .qa-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 4px;
        }

        #${OVERLAY_ID} .qa-footer-left {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        #${OVERLAY_ID} .qa-spinner {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2px solid #777777;
            border-top-color: #f0f0f0;
            display: none;
        }

        #${OVERLAY_ID} .qa-spinner.active {
            display: inline-block;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        #${OVERLAY_ID} .qa-copy-btn {
            width: 20px;
            height: 20px;
            border-radius: 2px;
            border: 1px solid #3b3b3b;
            background: #323232;
            color: #f0f0f0;
            font-size: 11px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #${OVERLAY_ID} .qa-copy-btn:disabled {
            opacity: 0.4;
            cursor: default;
        }

        /* Центральная колонка кнопок — нормальная ширина, текст переносится без поломки */
        #${OVERLAY_ID} .center-column {
            display: flex;
            flex-direction: column;
            gap: 8px;
            justify-content: flex-start;
            min-width: 160px;
            flex-shrink: 0;
            min-height: 0;
        }

        #${OVERLAY_ID} .center-btn {
            width: 100%;
            min-height: 44px;
            padding: 8px 10px;
            border-radius: 3px;
            border: 1px solid #3b3b3b;
            background: #323232;
            color: #f0f0f0;
            font-size: 12px;
            line-height: 1.3;
            cursor: pointer;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        #${OVERLAY_ID} .center-btn:hover:not(:disabled) {
            background: #3a3a3a;
        }

        #${OVERLAY_ID} .center-btn:disabled {
            opacity: 0.5;
            cursor: default;
        }

        #${OVERLAY_ID} .detect-btn {
            background: #2f7ed8;
            border-color: #2f7ed8;
        }

        #${OVERLAY_ID} .detect-btn:hover:not(:disabled) {
            background: #2b6bad;
            border-color: #2b6bad;
        }

        #${OVERLAY_ID} .search-btn {
            background: #2f9b5f;
            border-color: #2f9b5f;
        }

        #${OVERLAY_ID} .delete-btn {
            background: #444444;
            border-color: #444444;
        }

        /* Строка статуса */
        #${OVERLAY_ID} .overlay-status {
            font-size: 11px;
            color: #c0c0c0;
            padding: 6px 10px 8px 10px;
            border-top: 1px solid #3b3b3b;
            background: #292929;
            font-family: "Consolas", "JetBrains Mono", monospace;
        }

        /* Свернутый режим — окно реально уменьшается до заголовка */
        #${OVERLAY_ID}.overlay-minimized {
            height: 30px !important;
            min-height: 30px;
            overflow: hidden;
        }

        #${OVERLAY_ID} .overlay-minimized .overlay-content {
            display: none !important;
        }

        /* Скроллбар (ограничен классом внутри оверлея) */
        #${OVERLAY_ID} .scrollbar-custom::-webkit-scrollbar {
            width: 6px;
        }

        #${OVERLAY_ID} .scrollbar-custom::-webkit-scrollbar-track {
            background: #252525;
        }

        #${OVERLAY_ID} .scrollbar-custom::-webkit-scrollbar-thumb {
            background: #3f3f3f;
            border-radius: 3px;
        }

        /* Попап подсказки для иконки */
        #${OVERLAY_ID} .jf-popup {
            position: absolute;
            z-index: 1000000;
            min-width: 160px;
            max-width: 320px;
            background: #2b2b2b;
            border: 1px solid #3b3b3b;
            border-radius: 6px;
            padding: 8px 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.55);
            transition: opacity 0.12s ease;
            opacity: 0;
            pointer-events: none;
            color: #f0f0f0;
            font-size: 12px;
        }

        #${OVERLAY_ID} .jf-popup .jf-popup-subtitle {
            display: block;
            font-weight: 700;
            margin-bottom: 6px;
            color: #d8d8d8;
        }
        #${OVERLAY_ID} .jf-popup .jf-popup-body {
            display: block;
            font-size: 12px;
            color: #cfcfcf;
            white-space: pre-wrap;
        }

        @media (max-width: 540px) {
            #${OVERLAY_ID} {
                width: calc(100vw - 20px);
                right: 10px;
                top: 10px;
            }
        }
    `;
    document.head.appendChild(style);
    log('Styles created successfully');
}

function cacheDom() {
    if (!overlayEl) return;
    log('Caching DOM elements...');
    dom.status = overlayEl.querySelector('#overlay-status');
    dom.detectBtn = overlayEl.querySelector('#detect-btn');
    dom.searchBtn = overlayEl.querySelector('#search-btn');
    dom.flagBtn = overlayEl.querySelector('#lang-flag-btn');
    dom.questionText = overlayEl.querySelector('#question-text');
    dom.questionLength = overlayEl.querySelector('#question-length');
    dom.answerText = overlayEl.querySelector('#answer-text');
    dom.answerBox = overlayEl.querySelector('#answer-box');
    dom.answerConfidence = overlayEl.querySelector('#answer-confidence');
    dom.statusDot = overlayEl.querySelector('#status-dot');
    dom.gameName = overlayEl.querySelector('#game-name');
    dom.gameConfidence = overlayEl.querySelector('#game-confidence');
    dom.watermark = overlayEl.querySelector('#game-watermark');
    dom.gameIcon = overlayEl.querySelector('#game-icon');
    dom.gameLogo = overlayEl.querySelector('#game-logo');
    dom.gameTitleBlock = overlayEl.querySelector('.game-title-block');
    dom.dbVersion = overlayEl.querySelector('#db-version');
    dom.dbAge = overlayEl.querySelector('#db-age');
    dom.indicatorCount = overlayEl.querySelector('#indicator-count');
    dom.dbStatus = overlayEl.querySelector('#db-status');
    dom.titleEl = overlayEl.querySelector('.overlay-title');
    dom.qLabelEl = overlayEl.querySelector('.question-header div[style*="font-weight:700"]');
    dom.aLabelEl = overlayEl.querySelector('.answer-header div[style*="font-weight:700"]');
    dom.questionSpinner = overlayEl.querySelector('#question-spinner');
    dom.answerSpinner = overlayEl.querySelector('#answer-spinner');
    dom.questionCopyBtn = overlayEl.querySelector('#question-copy-btn');
    dom.answerCopyBtn = overlayEl.querySelector('#answer-copy-btn');
    dom.deleteBtn = overlayEl.querySelector('#delete-btn');
    log('DOM elements cached:', Object.keys(dom));
}

function updateStatus(messageKey, type) {
    if (!dom.status) {
        logWarn('Status element not found!');
        return;
    }
    const langObj = LANG[currentLang] || LANG.ru;
    const message = (langObj && langObj[messageKey]) ? getText(messageKey) : messageKey;
    
    const colors = { 
        info: '#5a5a5a', 
        success: '#4ecdc4', 
        warning: '#ffd93d', 
        error: '#ff6b6b', 
        searching: '#667eea' 
    };
    dom.status.textContent = message;
    dom.status.style.color = colors[type] || colors.info;
    logDebug('Status updated:', message, type);
}

function updateDBStatus(loaded) {
    if (!dom.dbStatus) return;
    dom.dbStatus.textContent = loaded ? '✓' : '✗';
    dom.dbStatus.className = 'db-status ' + (loaded ? 'loaded' : 'error');
    logDebug('DB status updated:', loaded);
}

/** Загружает один JS-файл по URL; resolve(true/false) — успех/провал. */
function loadScript(url, label) {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => { log('CDNlib loaded:', label); resolve(true); };
        script.onerror = () => { logWarn('CDNlib FAILED:', label, url); resolve(false); };
        document.head.appendChild(script);
    });
}

/** Загружает все CDN-библиотеки параллельно. Каждая — по своей ссылке из CONFIG.cdn. */
async function loadCdnLibs() {
    const tasks = [];

    if (!window.__jbgFuseLoaded) {
        tasks.push(
            loadScript(CONFIG.cdn.fuse, 'Fuse.js').then(ok => { if (ok) window.__jbgFuseLoaded = true; })
        );
    }

    if (!window.__jbgFuzzysortLoaded) {
        tasks.push(
            loadScript(CONFIG.cdn.fuzzysort, 'fuzzysort').then(ok => { if (ok) window.__jbgFuzzysortLoaded = true; })
        );
    }

    await Promise.all(tasks);
    log('CDNlibs ready — Fuse:', !!window.__jbgFuseLoaded, '| fuzzysort:', !!window.__jbgFuzzysortLoaded);
}

async function loadDatabase() {
    log('=== DATABASE LOAD STARTED ===');
    log('Database URL:', CONFIG.databaseURL);
    log('Attempt:', dbLoadAttempts + 1);

    if (window.GameDatabase) {
        log('Database already loaded in window.GameDatabase');
        gameDatabase = window.GameDatabase;
        updateStatus('dbLoaded', 'success');
        updateDBStatus(true);
        updateVersionInfo();
        isDatabaseLoaded = true;
        return true;
    }

    dbLoadAttempts++;
    await loadCdnLibs();

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = CONFIG.databaseURL + '?t=' + Date.now();
        script.async = true;

        script.onload = () => {
            log('Script loaded successfully');
            if (window.GameDatabase) {
                gameDatabase = window.GameDatabase;
                updateStatus('dbLoaded', 'success');
                updateDBStatus(true);
                updateVersionInfo();
                isDatabaseLoaded = true;
                resolve(true);
            } else {
                logError('✗ GameDatabase NOT found after script load');
                updateStatus('dbError', 'error');
                updateDBStatus(false);
                if (dbLoadAttempts < CONFIG.retryAttempts) {
                    setTimeout(() => loadDatabase().then(resolve), 1000);
                } else resolve(false);
            }
        };

        script.onerror = (e) => {
            logError('✗ Script load error:', e);
            updateStatus('dbError', 'error');
            updateDBStatus(false);
            if (dbLoadAttempts < CONFIG.retryAttempts) {
                setTimeout(() => loadDatabase().then(resolve), 1000);
            } else resolve(false);
        };

        const timeout = setTimeout(() => {
            logError('✗ Database load timeout after', CONFIG.loadTimeout, 'ms');
            script.remove();
            updateStatus('dbError', 'error');
            updateDBStatus(false);
            resolve(false);
        }, CONFIG.loadTimeout);

        script.addEventListener('load', () => clearTimeout(timeout));
        script.addEventListener('error', () => clearTimeout(timeout));

        document.head.appendChild(script);
        log('Script tag appended to document head');
    });
}

function updateVersionInfo() {
    if (!gameDatabase || typeof gameDatabase.getVersionInfo !== 'function') {
        logWarn('getVersionInfo not available');
        return;
    }
    try {
        const info = gameDatabase.getVersionInfo() || {};
        if (dom.dbVersion) dom.dbVersion.textContent = info.version || 'v?';
        if (dom.dbAge) {
            const days = Number(info.daysSinceUpdate || 0);
            const langData = LANG[currentLang];
            dom.dbAge.textContent = days === 0 
                ? (currentLang === 'ru' ? 'сегодня' : 'today') 
                : days + ' ' + langData.daysAgo;
            dom.dbAge.style.color = info.isOutdated ? '#ff6b6b' : '#4ecdc4';
        }
    } catch (e) {
        logError('Error updating version info:', e);
    }
}

function updateIndicator(result) {
    log('=== UPDATE INDICATOR ===');
    log('Result:', result);

    if (!result || !result.gameId || !gameDatabase?.gameConfig?.[result.gameId]) {
        currentGame = null;
        if (dom.statusDot) dom.statusDot.className = 'indicator-dot';
        if (dom.gameName) dom.gameName.textContent = getText('notDetected');
        if (dom.gameConfidence) dom.gameConfidence.textContent = '';
        if (dom.watermark) dom.watermark.textContent = ''; 
        if (dom.indicatorCount) dom.indicatorCount.textContent = '';
        if (dom.gameIcon) {
            dom.gameIcon.src = '';
            dom.gameIcon.style.display = 'none';
        }
        if (dom.gameLogo) {
            dom.gameLogo.src = '';
            dom.gameLogo.style.display = 'none';
        }
        if (dom.gameTitleBlock) dom.gameTitleBlock.style.display = '';
        return;
    }

    const config = gameDatabase.gameConfig[result.gameId];
    currentGame = result.gameId;

    if (dom.statusDot) dom.statusDot.className = 'indicator-dot active';
    if (dom.gameName) dom.gameName.textContent = config.name || getText('notDetected');
    if (dom.gameConfidence) dom.gameConfidence.innerHTML = `<span class="confidence-badge">${getText('confidence')} ${result.confidence}</span>`;
    if (dom.watermark) dom.watermark.textContent = (config.name || '').toUpperCase();
    if (dom.indicatorCount && result.foundIndicators) dom.indicatorCount.textContent = `${result.foundIndicators.length} ${getText('indicators')}`;

    // До извлечения вопроса держим язык UI, чтобы не подменять EN на RU из двуязычного имени игры.
    if (!currentQuestion) currentContentLang = currentLang || CONFIG.defaultLang;
    updateGameAssets();
}

function displayQuestion(q) {
    log('=== DISPLAY QUESTION ===');
    resetCenterButtonsHeight();
    if (!dom.questionText || !dom.questionLength || !dom.searchBtn) {
        logError('Question DOM elements not found!');
        return;
    }

    if (!q) {
        dom.questionText.textContent = getText('placeholderQuestion');
        dom.questionLength.textContent = '0 ' + getText('symbols');
        dom.searchBtn.disabled = true;
        if (dom.questionCopyBtn) dom.questionCopyBtn.disabled = true;
        setQuestionLoading(false);
        if (currentGame) {
            currentContentLang = currentLang || CONFIG.defaultLang;
            updateGameAssets();
        }
        return;
    }

    dom.questionText.textContent = q;
    dom.questionLength.textContent = q.length + ' ' + getText('symbols');
    const minLen = Math.max(2, CONFIG.minQuestionLength || 2);
    dom.searchBtn.disabled = q.length < minLen;

    currentContentLang = detectLangFromText(q);
    updateGameAssets();
    if (dom.questionCopyBtn) dom.questionCopyBtn.disabled = false;
    setQuestionLoading(false);
}

function detectGame() {
    log('=== DETECT GAME CLICKED ===');
    if (!gameDatabase || typeof gameDatabase.detectGame !== 'function') {
        logError('Database or detectGame function not available!');
        updateStatus('dbError', 'error');
        return null;
    }

    updateStatus('scanning', 'searching');
    setQuestionLoading(true);

    try { 
        const result = gameDatabase.detectGame();
        logDebug('detectGame result:', result);
        updateIndicator(result);

        if (result && result.gameId) {
            const gameName = gameDatabase.gameConfig?.[result.gameId]?.name || getText('notDetected');
            if (dom.status) {
                dom.status.textContent = getText('gameDetected') + gameName;
                dom.status.style.color = '#4ecdc4';
            }

            setTimeout(() => {
                try {
                    const rawQuestion = (typeof gameDatabase.extractQuestion === 'function')
                        ? gameDatabase.extractQuestion(result.gameId)
                        : null;
                    const cleaned = rawQuestion ? cleanQuestionText(rawQuestion) : null;
                    logDebug('Raw question (preview):', rawQuestion ? rawQuestion.substring(0, 120) : null);
                    logDebug('Cleaned question:', cleaned ? cleaned.substring(0, 120) : null);

                    const minLen = Math.max(2, CONFIG.minQuestionLength || 2);
                    if (cleaned && cleaned.length >= minLen) {
                        currentQuestion = cleaned;
                        displayQuestion(currentQuestion);
                    } else {
                        currentQuestion = '';
                        displayQuestion(null);
                    }
                } catch (e) {
                    logError('Error extracting question:', e);
                    currentQuestion = '';
                    displayQuestion(null);
                } finally {
                    setQuestionLoading(false);
                }
            }, 250);
        } else {
            updateStatus('notDetected', 'warning');
            currentQuestion = '';
            displayQuestion(null);
            setQuestionLoading(false);
        }

        return result;
    } catch (e) {
        logError('Error in detectGame:', e);
        updateStatus('dbError', 'error');
        setQuestionLoading(false);
        return null;
    }
}

function searchAnswer() {
    log('=== SEARCH ANSWER CLICKED ===');
    if (!gameDatabase || !currentGame || !currentQuestion) {
        logError('Cannot search - missing dependencies');
        updateStatus('detectFirst', 'warning');
        return;
    }
    if (typeof gameDatabase.findAnswer !== 'function') {
        logError('GameDatabase.findAnswer is not a function');
        updateStatus('dbError', 'error');
        return;
    }

    updateStatus('scanning', 'searching');
    setAnswerLoading(true);

    try {
        const result = gameDatabase.findAnswer(currentQuestion, currentGame);
        logDebug('findAnswer result:', result);

        displayQuestion(currentQuestion);

        if (result?.answer) {
            if (dom.answerText) dom.answerText.textContent = result.answer;
            if (dom.answerBox) { dom.answerBox.classList.remove('not-found'); dom.answerBox.classList.add('found'); }
            const confStr = (result.confidence ?? 0) + '%';
            if (dom.answerConfidence) dom.answerConfidence.textContent = CONFIG.debug && result.method ? confStr + ' [' + result.method + ']' : confStr;
            if (dom.answerCopyBtn) dom.answerCopyBtn.disabled = false;
            if (dom.deleteBtn) dom.deleteBtn.disabled = false;
            if (dom.status) dom.status.textContent = getText('answerFound') + (result.confidence ?? 0) + '%)';
            if (dom.status) dom.status.style.color = '#4ecdc4';
        } else {
            if (dom.answerText) dom.answerText.textContent = getText('answerNotFound');
            if (dom.answerBox) { dom.answerBox.classList.remove('found'); dom.answerBox.classList.add('not-found'); }
            if (dom.answerConfidence) dom.answerConfidence.textContent = '';
            if (dom.answerCopyBtn) dom.answerCopyBtn.disabled = true;
            updateStatus('answerNotFound', 'error');
        }
    } catch (e) {
        logError('Error in searchAnswer:', e);
        updateStatus('dbError', 'error');
    } finally {
        setAnswerLoading(false);
        resetCenterButtonsHeight();
    }
}

function updateAllText() {
    if (!overlayEl) return;
    try {
        const t = LANG[currentLang];
        if (dom.titleEl) dom.titleEl.textContent = t.title;
        if (dom.detectBtn) dom.detectBtn.textContent = t.detectBtn;
        if (dom.searchBtn) dom.searchBtn.textContent = t.searchBtn;
        if (dom.deleteBtn) dom.deleteBtn.textContent = t.clearBtn;
        
        if (dom.qLabelEl) dom.qLabelEl.textContent = t.questionLabel;
        if (dom.aLabelEl) dom.aLabelEl.textContent = t.answerLabel;
        if (dom.questionCopyBtn) dom.questionCopyBtn.title = t.copyBtn;
        if (dom.answerCopyBtn) dom.answerCopyBtn.title = t.copyBtn;

        const minBtn = document.getElementById('minimize-btn');
        const closeBtn = document.getElementById('close-btn');
        if (minBtn) minBtn.title = t.minimize;
        if (closeBtn) closeBtn.title = t.close;

        if (dom.status) {
            if (dom.status.textContent === getText('loadingDB', 'en') || dom.status.textContent === getText('loadingDB', 'ru')) {
                updateStatus('loadingDB', 'info');
            } else if (dom.status.textContent.includes(getText('gameDetected', 'en')) || dom.status.textContent.includes(getText('gameDetected', 'ru'))) {
                const gameName = dom.gameName ? dom.gameName.textContent : '';
                if (gameName && gameName !== getText('notDetected')) {
                    dom.status.textContent = getText('gameDetected') + gameName + getText('gameDetectedSuffix');
                    dom.status.style.color = '#4ecdc4';
                }
            } else if (dom.answerBox && dom.answerBox.classList.contains('found') && dom.answerConfidence) {
                const conf = dom.answerConfidence.textContent;
                dom.status.textContent = getText('answerFound') + conf + ')';
                dom.status.style.color = '#4ecdc4';
            }
        }

        if (dom.questionText && (dom.questionText.textContent === getText('placeholderQuestion', 'en') || dom.questionText.textContent === getText('placeholderQuestion', 'ru'))) {
            dom.questionText.textContent = t.placeholderQuestion;
        }
        if (dom.answerText) {
            if (dom.answerText.textContent === getText('placeholderAnswer', 'en') || dom.answerText.textContent === getText('placeholderAnswer', 'ru')) {
                dom.answerText.textContent = t.placeholderAnswer;
            } else if (dom.answerText.textContent === getText('answerNotFound', 'en') || dom.answerText.textContent === getText('answerNotFound', 'ru')) {
                dom.answerText.textContent = t.answerNotFound;
            }
        }

        if (dom.questionLength && dom.questionText) {
            const currentLen = dom.questionText.textContent.length;
            dom.questionLength.textContent = currentLen + t.symbols;
        }
        if (dom.indicatorCount && currentGame) {
            const count = dom.indicatorCount.textContent.match(/\d+/);
            if(count) dom.indicatorCount.textContent = `${count[0]} ${t.indicators}`;
        }
        if (dom.gameConfidence && currentGame) {
            const conf = dom.gameConfidence.textContent.match(/\d+/);
            if(conf) dom.gameConfidence.innerHTML = `<span class="confidence-badge">${t.confidence} ${conf[0]}</span>`;
        }

        logDebug('UI Text updated for lang:', currentLang);
    } catch (e) {
        logError('updateAllText error', e);
    }
}

function createPopup() {
    if (!overlayEl || popupEl) return;
    popupEl = document.createElement('div');
    popupEl.className = 'jf-popup';
    popupEl.innerHTML = `<div class="jf-popup-subtitle"></div><div class="jf-popup-body"></div>`;
    // скрыт по умолчанию; добавляем в overlay
    overlayEl.appendChild(popupEl);

    // скроем при клике вне - но внимательно: проверяем overlayEl перед contains
    popupDocClickHandler = function (e) {
        if (!popupEl) return;
        // если overlay уже удалён, считаем что нужно скрыть/очистить попап и выйти
        if (!overlayEl || !overlayEl.contains) {
            hidePopup();
            return;
        }
        if (!overlayEl.contains(e.target)) {
            hidePopup();
        }
    };
    document.addEventListener('click', popupDocClickHandler);

    // скроем при клике вне (добавлено), остальные слушатели - в attachIconHoverHandlers
}

function attachIconHoverHandlers() {
    if (!dom.gameIcon) return;
    dom.gameIcon.addEventListener('mouseenter', (e) => {
        // показываем попап (если есть текст)
        if (!popupEl) createPopup();
        // определяем язык для заголовка
        setPopupContent(popupEl?.querySelector('.jf-popup-body')?.textContent ?? '', currentContentLang);
        // если нет контента — всё равно покажем "Почему?" и пустое тело
        showPopupAt(dom.gameIcon);
    });
    dom.gameIcon.addEventListener('mouseleave', (e) => {
        // скрываем с небольшим таймаутом (чтобы курсор мог попасть на попап, если нужно)
        setTimeout(() => {
            // если курсор не над попапом — скрываем
            if (!popupEl) return;
            // проверим куда ушёл курсор
            const { clientX: x, clientY: y } = e;
            const overPopup = popupEl.getBoundingClientRect();
            if (!(x >= overPopup.left && x <= overPopup.right && y >= overPopup.top && y <= overPopup.bottom)) {
                hidePopup();
            }
        }, 80);
    });
    // если курсор над попапом — не скрываем
    overlayEl && overlayEl.addEventListener('mousemove', (ev) => {
        if (!popupEl || popupEl.style.opacity === '0') return;
        const r = popupEl.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            // оставляем видимым
            popupEl.style.pointerEvents = 'auto';
        }
    });
}

function createOverlay() {
    if (overlayEl) return;
    ensureStyle();

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.innerHTML = `
        <div class="overlay-header">
            <div class="header-left">
                <div class="overlay-title">${getText('title')}</div>
                <div class="db-info">
                    <div id="db-version">v?</div>
                    <div id="db-age">?</div>
                    <div id="db-status" class="db-status">✗</div>
                </div>
            </div>
            <div class="overlay-controls">
                <button id="lang-flag-btn" class="overlay-btn flag-btn" title="Toggle language">🌐</button>
                <button id="minimize-btn" class="overlay-btn" title="${getText('minimize')}">-</button>
                <button id="close-btn" class="overlay-btn" title="${getText('close')}">×</button>
            </div>
        </div>

        <div class="overlay-content">
            <div class="game-indicator">
                <div class="game-indicator-main">
                    <div id="status-dot" class="indicator-dot"></div>
                    <img id="game-icon" class="game-icon" alt="">
                    <div class="game-branding">
                        <img id="game-logo" alt="">
                        <div class="game-title-block">
                            <div id="game-name">${getText('notDetected')}</div>
                            <div id="game-confidence" class="game-confidence-text"></div>
                        </div>
                    </div>
                </div>
                <div id="indicator-count" class="indicator-count"></div>
            </div>

            <div class="overlay-grid">
                <div class="qa-column question-column">
                    <div class="question-header">
                        <div style="font-weight:700">${getText('questionLabel')}</div>
                        <div id="question-length">0 ${getText('symbols')}</div>
                    </div>
                    <div id="question-text" class="question-text scrollbar-custom">${getText('placeholderQuestion')}</div>
                    <div class="qa-footer">
                        <div class="qa-footer-left">
                            <div id="question-spinner" class="qa-spinner"></div>
                            <button id="question-copy-btn" class="qa-copy-btn" title="${getText('copyBtn')}" disabled>📋</button>
                        </div>
                    </div>
                </div>

                <div class="center-column">
                    <button id="detect-btn" class="center-btn detect-btn">${getText('detectBtn')}</button>
                    <button id="search-btn" class="center-btn search-btn" disabled>${getText('searchBtn')}</button>
                    <button id="delete-btn" class="center-btn delete-btn" disabled>${getText('clearBtn')}</button>
                </div>

                <div id="answer-box" class="qa-column answer-box answer-column">
                    <div class="answer-header">
                        <div style="font-weight:700">${getText('answerLabel')}</div>
                        <div id="answer-confidence"></div>
                    </div>
                    <div id="answer-text" class="answer-text scrollbar-custom">${getText('placeholderAnswer')}</div>
                    <div class="qa-footer">
                        <div class="qa-footer-left">
                            <div id="answer-spinner" class="qa-spinner"></div>
                            <button id="answer-copy-btn" class="qa-copy-btn" title="${getText('copyBtn')}" disabled>📋</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="overlay-status" class="overlay-status">${getText('loadingDB')}</div>
        </div>
    `;
    document.body.appendChild(overlayEl);

    cacheDom();
    createPopup();
    attachIconHoverHandlers();
    updateAllText();

    if (dom.searchBtn) dom.searchBtn.disabled = true;
    if (dom.questionCopyBtn) dom.questionCopyBtn.disabled = true;
    if (dom.answerCopyBtn) dom.answerCopyBtn.disabled = true;
    if (dom.deleteBtn) dom.deleteBtn.disabled = true;
    if (dom.dbStatus) dom.dbStatus.className = 'db-status error';

    if (dom.detectBtn) {
        dom.detectBtn.addEventListener('click', async () => {
            try {
                dom.detectBtn.disabled = true;
                updateStatus('scanning', 'searching');
                await detectGame();
            } finally {
                dom.detectBtn.disabled = false;
            }
        });
    }

    if (dom.searchBtn) {
        dom.searchBtn.addEventListener('click', () => {
            dom.searchBtn.disabled = true;
            try { searchAnswer(); } finally { setTimeout(() => { dom.searchBtn.disabled = false; }, 250); }
        });
    }

    function copyTextToClipboard(text) {
        try {
            if (!text) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => updateStatus('copySuccess', 'success'))
                    .catch(() => updateStatus('copySuccess', 'success'));
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                updateStatus('copySuccess', 'success');
            }
        } catch (e) {
            logError('Copy failed', e);
        }
    }

    if (dom.questionCopyBtn) {
        dom.questionCopyBtn.addEventListener('click', () => {
            const text = currentQuestion || (dom.questionText && dom.questionText.textContent) || '';
            if (!text || text === getText('placeholderQuestion')) return;
            copyTextToClipboard(text);
        });
    }

    if (dom.answerCopyBtn) {
        dom.answerCopyBtn.addEventListener('click', () => {
            const text = (dom.answerText && dom.answerText.textContent) ? dom.answerText.textContent : '';
            if (!text || text === getText('answerNotFound')) return;
            copyTextToClipboard(text);
        });
    }

    if (dom.deleteBtn) {
        dom.deleteBtn.addEventListener('click', () => {
            currentQuestion = '';
            displayQuestion(null);
            if (dom.answerText) dom.answerText.textContent = getText('placeholderAnswer');
            if (dom.answerBox) {
                dom.answerBox.classList.remove('found');
                dom.answerBox.classList.remove('not-found');
            }
            if (dom.answerConfidence) dom.answerConfidence.textContent = '';
            if (dom.answerCopyBtn) dom.answerCopyBtn.disabled = true;
            if (dom.deleteBtn) dom.deleteBtn.disabled = true;
            setQuestionLoading(false);
            setAnswerLoading(false);
            resetCenterButtonsHeight();
        });
    }

    const langBtn = overlayEl.querySelector('#lang-flag-btn');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentLang = currentLang === 'ru' ? 'en' : 'ru';
            updateAllText();
            if(isDatabaseLoaded) updateStatus('dbLoaded', 'success');
            log('Language switched to:', currentLang);
        });
    }

    const minBtn = overlayEl.querySelector('#minimize-btn');
    const closeBtn = overlayEl.querySelector('#close-btn');

    // Функция очистки - снимает глобальные обработчики и удаляет попап/стили
    function cleanupOverlay() {
        try {
            if (popupDocClickHandler) {
                document.removeEventListener('click', popupDocClickHandler);
                popupDocClickHandler = null;
            }
            if (windowResizeHandler) {
                window.removeEventListener('resize', windowResizeHandler);
                windowResizeHandler = null;
            }
            hidePopup();
            if (popupEl && popupEl.parentNode) {
                popupEl.parentNode.removeChild(popupEl);
            }
            popupEl = null;
            // опционально убираем стили оверлея, чтобы не оставлять "следов"
            const s = document.getElementById(STYLE_ID);
            if (s) s.remove();
        } catch (e) {
            logError('cleanup error', e);
        }
    }

    if (minBtn) minBtn.addEventListener('click', () => overlayEl.classList.toggle('overlay-minimized'));
    if (closeBtn) closeBtn.addEventListener('click', () => {
        cleanupOverlay();
        if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
        overlayEl = null;
    });

    const headerEl = overlayEl.querySelector('.overlay-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    function onMouseMove(e) {
        if (!isDragging || !overlayEl) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let nextLeft = initialX + dx;
        let nextTop = initialY + dy;

        const rect = overlayEl.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;

        nextLeft = Math.max(0, Math.min(maxLeft, nextLeft));
        nextTop = Math.max(0, Math.min(maxTop, nextTop));

        overlayEl.style.left = nextLeft + 'px';
        overlayEl.style.top = nextTop + 'px';
        overlayEl.style.right = 'auto';
        overlayEl.style.bottom = 'auto';
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', endDrag);
    }

    if (headerEl) {
        headerEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = overlayEl.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            document.body.style.userSelect = 'none';
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', endDrag);
        });
    }

    // Resize: сбрасываем инлайн-высоту кнопок (чтобы не слетал текст при перетаскивании окна), подстраиваем иконку
    windowResizeHandler = () => {
        resetCenterButtonsHeight();
        updateIconSize();
    };
    window.addEventListener('resize', windowResizeHandler);

    log('Overlay created and initialized');
}

async function init() {
    log('=== INIT STARTED ===');
    createOverlay();
    updateStatus('loadingDB', 'info');

    const loaded = await loadDatabase();
    log('Database load result:', loaded);

    if (loaded) {
        updateStatus('notDetected', 'info');
        log('Initialization complete (DB loaded)');
    } else {
        logError('Initialization failed - database not loaded');
    }

    log('=== INIT COMPLETE ===');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

log('Overlay script loaded successfully');
})();
