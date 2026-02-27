(function () {
const OVERLAY_ID = 'game-finder-overlay';
const STYLE_ID = 'game-finder-overlay-style';

// === ЛОГГИРОВАНИЕ ===
const LOG_PREFIX = '[JBG-Finder]';
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
    minQuestionLength: 15,
    defaultLang: 'en',
    loadTimeout: 10000,
    retryAttempts: 3
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
        answerNotFound: 'Ответ не найден',
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
        placeholderQuestion: 'Нажмите "Найти вопрос", когда вопрос будет на экране...',
        placeholderAnswer: 'Здесь появится ответ...',
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
        answerNotFound: 'Answer Not Found',
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
        placeholderQuestion: 'Click "Detect" when question is on screen...',
        placeholderAnswer: 'Answer will appear here...',
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

function getText(key) {
    return (LANG[currentLang] && LANG[currentLang][key]) || (LANG.ru && LANG.ru[key]) || key;
}

function detectLangFromText(text) {
    if (!text || typeof text !== 'string') return CONFIG.defaultLang;
    return /[\u0400-\u04FF]/.test(text) ? 'ru' : 'en';
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
        }
        const noteText = notes[currentContentLang] || notes.en || notes.ru || '';
        dom.gameIcon.title = noteText;
    }

    const logoUrls = config.logoUrls || (config.assets && config.assets.logoUrls);
    if (dom.gameLogo) {
        const logoUrl = logoUrls
            ? (logoUrls[currentContentLang] || logoUrls.en || logoUrls.ru)
            : null;
        if (logoUrl) {
            dom.gameLogo.src = logoUrl;
            dom.gameLogo.style.display = 'block';
        } else {
            dom.gameLogo.src = '';
            dom.gameLogo.style.display = 'none';
        }
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
        /* Базовый сброс */
        #${OVERLAY_ID} * {
            box-sizing: border-box !important;
            margin: 0;
            padding: 0;
        }

        /* Основное окно (фиксированный размер под макет 522x338) */
        #${OVERLAY_ID} {
            position: fixed;
            top: 40px;
            right: 40px;
            width: 522px;
            height: 338px;
            max-width: 98vw;
            max-height: 95vh;
            background: #2b2b2b;
            border: 1px solid #3b3b3b;
            border-radius: 6px;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #f0f0f0;
            overflow: hidden;
            user-select: none;
        }

        /* Заголовок в стиле Windows 10 */
        .overlay-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 30px;
            padding: 0 8px;
            background: #323232;
            border-bottom: 1px solid #3f3f3f;
            cursor: move;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        .overlay-title {
            font-size: 13px;
            font-weight: 500;
            color: #f5f5f5;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .db-info {
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

        #db-version,
        #db-age {
            font-size: 10px;
        }

        .db-status {
            font-size: 9px;
            padding: 1px 6px;
            border-radius: 999px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .db-status.loaded {
            background: #2f854f;
            color: #f5f5f5;
        }

        .db-status.error {
            background: #8b3434;
            color: #f5f5f5;
        }

        .overlay-controls {
            display: flex;
            align-items: center;
        }

        .overlay-btn {
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

        .overlay-btn:hover {
            background: #3b3b3b;
            color: #ffffff;
        }

        #close-btn:hover {
            background: #c0392b;
            color: #ffffff;
        }

        .overlay-content {
            padding: 14px 16px 10px 16px;
            background: #252525;
            height: calc(100% - 30px); /* минус заголовок */
            display: flex;
            flex-direction: column;
        }

        /* Верхняя строка с игрой */
        .game-indicator {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            margin-bottom: 10px;
            border-radius: 4px;
            background: #2f2f2f;
            border: 1px solid #3b3b3b;
        }

        .game-indicator-main {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        .indicator-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #555555;
        }

        .indicator-dot.active {
            background: #29b765;
        }

        .game-icon {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #3b3b3b;
            object-fit: cover;
            flex-shrink: 0;
            display: none;
        }

        .game-title-block {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        #game-name {
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        #game-confidence {
            font-size: 11px;
            color: #a0a0a0;
            margin-top: 1px;
        }

        .indicator-count {
            font-size: 10px;
            color: #808080;
            white-space: nowrap;
            text-align: right;
        }

        .confidence-badge {
            font-size: 10px;
            color: #a0e7c4;
        }

        #game-logo-container {
            display: flex;
            justify-content: flex-start;
            margin-bottom: 6px;
        }

        #game-logo {
            max-width: 180px;
            max-height: 40px;
            object-fit: contain;
            display: none;
        }

        /* Основная сетка: ВОПРОС | КНОПКИ | ОТВЕТ */
        .overlay-grid {
            display: grid;
            grid-template-columns: 2fr 1.2fr 2fr;
            gap: 8px;
            align-items: stretch;
            flex: 1; /* занять всё доступное пространство над строкой статуса */
        }

        .qa-column {
            display: flex;
            flex-direction: column;
            background: #2b2b2b;
            border: 1px solid #3b3b3b;
            border-radius: 4px;
            padding: 6px;
        }

        .question-header,
        .answer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        .question-header div[style*="font-weight:700"],
        .answer-header div[style*="font-weight:700"] {
            font-size: 11px;
            font-weight: 600 !important;
            letter-spacing: 0.25em;
            text-transform: uppercase;
            color: #d0d0d0;
        }

        #question-length,
        #answer-confidence {
            font-size: 10px;
            color: #909090;
        }

        .question-text,
        .answer-text {
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

        .answer-box.found {
            border-color: #29b765;
        }

        .answer-box.not-found {
            border-color: #c0392b;
        }

        .qa-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 4px;
        }

        .qa-footer-left {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .qa-spinner {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2px solid #777777;
            border-top-color: #f0f0f0;
            display: none;
        }

        .qa-spinner.active {
            display: inline-block;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        .qa-copy-btn {
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

        .qa-copy-btn:disabled {
            opacity: 0.4;
            cursor: default;
        }

        /* Центральная колонка кнопок */
        .center-column {
            display: flex;
            flex-direction: column;
            gap: 6px;
            justify-content: center;
        }

        .center-btn {
            padding: 10px 8px;
            border-radius: 3px;
            border: 1px solid #3b3b3b;
            background: #323232;
            color: #f0f0f0;
            font-size: 13px;
            cursor: pointer;
        }

        .center-btn:hover:not(:disabled) {
            background: #3a3a3a;
        }

        .center-btn:disabled {
            opacity: 0.5;
            cursor: default;
        }

        .detect-btn {
            background: #2f7ed8;
            border-color: #2f7ed8;
        }

        .detect-btn:hover:not(:disabled) {
            background: #2b6bad;
            border-color: #2b6bad;
        }

        .search-btn {
            background: #2f9b5f;
            border-color: #2f9b5f;
        }

        .delete-btn {
            background: #444444;
            border-color: #444444;
        }

        /* Строка статуса */
        .overlay-status {
            font-size: 11px;
            color: #c0c0c0;
            padding: 6px 10px 8px 10px;
            border-top: 1px solid #3b3b3b;
            background: #292929;
            font-family: "Consolas", "JetBrains Mono", monospace;
        }

        /* Свернутый режим */
        .overlay-minimized {
            height: 30px;
            overflow: hidden;
        }

        .overlay-minimized .overlay-content {
            display: none;
        }

        /* Скроллбар */
        .scrollbar-custom::-webkit-scrollbar {
            width: 6px;
        }

        .scrollbar-custom::-webkit-scrollbar-track {
            background: #252525;
        }

        .scrollbar-custom::-webkit-scrollbar-thumb {
            background: #3f3f3f;
            border-radius: 3px;
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
    const message = LANG[currentLang][messageKey] ? getText(messageKey) : messageKey;
    
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
        return;
    }

    const config = gameDatabase.gameConfig[result.gameId];
    currentGame = result.gameId;

    if (dom.statusDot) dom.statusDot.className = 'indicator-dot active';
    if (dom.gameName) dom.gameName.textContent = config.name || getText('notDetected');
    if (dom.gameConfidence) dom.gameConfidence.innerHTML = `<span class="confidence-badge">${getText('confidence')} ${result.confidence}</span>`;
    if (dom.watermark) dom.watermark.textContent = (config.name || '').toUpperCase();
    if (dom.indicatorCount && result.foundIndicators) dom.indicatorCount.textContent = `${result.foundIndicators.length} ${getText('indicators')}`;

    // Обновляем иконку статуса и логотип с учётом текущего языка контента
    updateGameAssets();
}

function displayQuestion(q) {
    log('=== DISPLAY QUESTION ===');
    if (!dom.questionText || !dom.questionLength || !dom.searchBtn) {
        logError('Question DOM elements not found!');
        return;
    }

    if (!q) {
        dom.questionText.textContent = getText('placeholderQuestion');
        dom.questionLength.textContent = '0' + getText('symbols');
        dom.searchBtn.disabled = true;
        if (dom.questionCopyBtn) dom.questionCopyBtn.disabled = true;
        setQuestionLoading(false);
        return;
    }

    const text = q.length > 200 ? q.slice(0, 200) + '...' : q;
    dom.questionText.textContent = text;
    dom.questionLength.textContent = q.length + getText('symbols');
    dom.searchBtn.disabled = q.length < CONFIG.minQuestionLength;

    // Определяем язык вопроса и обновляем визуальные элементы игры
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
            dom.status.textContent = getText('gameDetected') + gameName;
            dom.status.style.color = '#4ecdc4';

            setTimeout(() => {
                try {
                    const rawQuestion = (typeof gameDatabase.extractQuestion === 'function')
                        ? gameDatabase.extractQuestion(result.gameId)
                        : null;
                    logDebug('Raw question (preview):', rawQuestion ? rawQuestion.substring(0, 120) : null);

                    if (rawQuestion && rawQuestion.length >= CONFIG.minQuestionLength) {
                        currentQuestion = rawQuestion;
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
            dom.answerText.textContent = result.answer;
            dom.answerBox.classList.remove('not-found'); 
            dom.answerBox.classList.add('found');
            dom.answerConfidence.textContent = (result.confidence ?? 0) + '%';
            if (dom.answerCopyBtn) dom.answerCopyBtn.disabled = false;
            if (dom.deleteBtn) dom.deleteBtn.disabled = false;
            dom.status.textContent = getText('answerFound') + (result.confidence ?? 0) + '%)';
            dom.status.style.color = '#4ecdc4';
        } else {
            dom.answerText.textContent = getText('answerNotFound');
            dom.answerBox.classList.remove('found');
            dom.answerBox.classList.add('not-found');
            dom.answerConfidence.textContent = '';
            if (dom.answerCopyBtn) dom.answerCopyBtn.disabled = true;
            updateStatus('answerNotFound', 'error');
        }
    } catch (e) {
        logError('Error in searchAnswer:', e);
        updateStatus('dbError', 'error');
    } finally {
        setAnswerLoading(false);
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

        if (dom.status.textContent === getText('loadingDB', 'en') || dom.status.textContent === getText('loadingDB', 'ru')) {
            updateStatus('loadingDB', 'info');
        } else if (dom.status.textContent.includes(getText('gameDetected', 'en')) || dom.status.textContent.includes(getText('gameDetected', 'ru'))) {
            const gameName = dom.gameName ? dom.gameName.textContent : '';
            if(gameName && gameName !== getText('notDetected')) {
                dom.status.textContent = getText('gameDetected') + gameName + getText('gameDetectedSuffix');
                dom.status.style.color = '#4ecdc4';
            }
        } else if (dom.answerBox.classList.contains('found')) {
            const conf = dom.answerConfidence.textContent;
            dom.status.textContent = getText('answerFound') + conf + ')';
            dom.status.style.color = '#4ecdc4';
        }
        
        if (dom.questionText.textContent === getText('placeholderQuestion', 'en') || dom.questionText.textContent === getText('placeholderQuestion', 'ru')) {
            dom.questionText.textContent = t.placeholderQuestion;
        }
        if (dom.answerText.textContent === getText('placeholderAnswer', 'en') || dom.answerText.textContent === getText('placeholderAnswer', 'ru')) {
            dom.answerText.textContent = t.placeholderAnswer;
        }
        if (dom.answerText.textContent === getText('answerNotFound', 'en') || dom.answerText.textContent === getText('answerNotFound', 'ru')) {
            dom.answerText.textContent = t.answerNotFound;
        }
         
        if (dom.questionLength) {
            const currentLen = dom.questionText.textContent.length;
            if (currentLen < 10) {
                dom.questionLength.textContent = '0' + t.symbols;
            } else {
                dom.questionLength.textContent = currentLen + t.symbols;
            }
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
                <button id="minimize-btn" class="overlay-btn" title="${getText('minimize')}">—</button>
                <button id="close-btn" class="overlay-btn" title="${getText('close')}">×</button>
            </div>
        </div>

        <div class="overlay-content">
            <div class="game-indicator">
                <div class="game-indicator-main">
                    <div id="status-dot" class="indicator-dot"></div>
                    <img id="game-icon" class="game-icon" alt="">
                    <div class="game-title-block">
                        <div id="game-name">${getText('notDetected')}</div>
                        <div id="game-confidence" class="game-confidence-text"></div>
                    </div>
                </div>
                <div id="indicator-count" class="indicator-count"></div>
            </div>

            <div id="game-logo-container">
                <img id="game-logo" alt="">
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
    if (minBtn) minBtn.addEventListener('click', () => overlayEl.classList.toggle('overlay-minimized'));
    if (closeBtn) closeBtn.addEventListener('click', () => { overlayEl.remove(); overlayEl = null; });

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
