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
    stable:    'https://downloader.disk.yandex.ru/preview/3bd289d37478d5b43f17638adbaff61bf7cbdd738c354beec555e9d28eff1212/69a1ec58/y53erwckJBftlTwaQJQ417ZsBFm22eOuL-X-G6yZnun7o3g6IJtZq1P0dUskBcbVnclg40x5xuVga1uBjFdngw%3D%3D?uid=0&filename=stable.PNG&disposition=inline&hash=&limit=0&content_type=image%2Fpng&owner_uid=0&tknv=v3&size=2048x2048',
    unstable:  'https://downloader.disk.yandex.ru/preview/6e79862f19f476e166024adca86cb0dbcb27425a515a10161d8f46d75eb43702/69a1ebad/stJeIhPZqErfUvcuzgqecdcG4UB8X47dvH2sTcWJPfu8MZlDnE7gs5jv-Fep1j0tMH-hmE3nm8S2_hUVGtzk-Q%3D%3D?uid=0&filename=unstable.PNG&disposition=inline&hash=&limit=0&content_type=image%2Fpng&owner_uid=0&tknv=v3&size=2048x2048',
    nonfullwork: 'https://downloader.disk.yandex.ru/preview/9bb7148daba3d6c142d897390571b0ef7aeb79c860c2d7603a7538781cdc06a1/69a1ec1c/3ZPFEXrhuGZYM9HPlwY6G7ZsBFm22eOuL-X-G6yZnumfkePC7Bj6hsQLgWUzneXjVdAdGRTFsSJaNzWzmaWmdw%3D%3D?uid=0&filename=nonfullwork.PNG&disposition=inline&hash=&limit=0&content_type=image%2Fpng&owner_uid=0&tknv=v3&size=1920x911'
};

const LANG = {
    ru: {
        title: 'JBG-Finder PREALPHA',
        detectBtn: '🔍 Найти вопрос и игру',
        searchBtn: '⚡ Найти ответ',
        copyBtn: '📋 Копировать',
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

        /* Основное окно */
        #${OVERLAY_ID} {
            position: fixed;
            top: 32px;
            right: 32px;
            width: 420px;
            max-width: 95vw;
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
            padding: 10px 12px 8px 12px;
            background: #252525;
        }

        /* Блок игры */
        .game-indicator {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 10px;
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
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #555555;
        }

        .indicator-dot.active {
            background: #29b765;
        }

        .game-icon {
            width: 24px;
            height: 24px;
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
        }

        .confidence-badge {
            font-size: 10px;
            color: #a0e7c4;
        }

        /* Вопрос / ответ */
        .question-box,
        .answer-box {
            margin-bottom: 8px;
            padding: 8px 8px;
            border-radius: 4px;
            background: #2b2b2b;
            border: 1px solid #3b3b3b;
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
            font-size: 10px;
            font-weight: 600 !important;
            text-transform: uppercase;
            color: #a0a0a0;
        }

        #question-length,
        #answer-confidence {
            font-size: 10px;
            color: #909090;
        }

        .question-text,
        .answer-text {
            font-size: 12px;
            line-height: 1.5;
            max-height: 120px;
            overflow-y: auto;
            word-break: break-word;
        }

        .answer-box.found {
            border-color: #29b765;
        }

        .answer-box.not-found {
            border-color: #c0392b;
        }

        /* Кнопки действий */
        .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-bottom: 8px;
        }

        .action-btn {
            padding: 6px 8px;
            border-radius: 3px;
            border: 1px solid #3b3b3b;
            background: #323232;
            color: #f0f0f0;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .action-btn:hover {
            background: #3a3a3a;
        }

        .action-btn:disabled {
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
            background: #3a3a3a;
        }

        .copy-btn {
            grid-column: span 2;
        }

        /* Лого игры */
        #game-logo-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 4px;
        }

        #game-logo {
            max-width: 120px;
            max-height: 40px;
            object-fit: contain;
            display: none;
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
    dom.copyBtn = overlayEl.querySelector('#copy-btn');
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
        return;
    }

    const text = q.length > 200 ? q.slice(0, 200) + '...' : q;
    dom.questionText.textContent = text;
    dom.questionLength.textContent = q.length + getText('symbols');
    dom.searchBtn.disabled = q.length < CONFIG.minQuestionLength;

    // Определяем язык вопроса и обновляем визуальные элементы игры
    currentContentLang = detectLangFromText(q);
    updateGameAssets();
}

function detectGame() {
    log('=== DETECT GAME CLICKED ===');
    if (!gameDatabase || typeof gameDatabase.detectGame !== 'function') {
        logError('Database or detectGame function not available!');
        updateStatus('dbError', 'error');
        return null;
    }

    updateStatus('scanning', 'searching');

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
                }
            }, 250);
        } else {
            updateStatus('notDetected', 'warning');
            currentQuestion = '';
            displayQuestion(null);
        }

        return result;
    } catch (e) {
        logError('Error in detectGame:', e);
        updateStatus('dbError', 'error');
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

    try {
        const result = gameDatabase.findAnswer(currentQuestion, currentGame);
        logDebug('findAnswer result:', result);

        displayQuestion(currentQuestion);

        if (result?.answer) {
            dom.answerText.textContent = result.answer;
            dom.answerBox.classList.remove('not-found'); 
            dom.answerBox.classList.add('found');
            dom.answerConfidence.textContent = (result.confidence ?? 0) + '%';
            dom.copyBtn.disabled = false;
            dom.status.textContent = getText('answerFound') + (result.confidence ?? 0) + '%)';
            dom.status.style.color = '#4ecdc4';
        } else {
            dom.answerText.textContent = getText('answerNotFound');
            dom.answerBox.classList.remove('found');
            dom.answerBox.classList.add('not-found');
            dom.answerConfidence.textContent = '';
            dom.copyBtn.disabled = true;
            updateStatus('answerNotFound', 'error');
        }
    } catch (e) {
        logError('Error in searchAnswer:', e);
        updateStatus('dbError', 'error');
    }
}

function updateAllText() {
    if (!overlayEl) return;
    try {
        const t = LANG[currentLang];
        if (dom.titleEl) dom.titleEl.textContent = t.title;
        if (dom.detectBtn) dom.detectBtn.textContent = t.detectBtn;
        if (dom.searchBtn) dom.searchBtn.textContent = t.searchBtn;
        if (dom.copyBtn) dom.copyBtn.textContent = t.copyBtn;
        
        if (dom.qLabelEl) dom.qLabelEl.textContent = t.questionLabel;
        if (dom.aLabelEl) dom.aLabelEl.textContent = t.answerLabel;

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

            <div class="question-box">
                <div class="question-header">
                    <div style="font-weight:700">${getText('questionLabel')}</div>
                    <div id="question-length" style="font-size:11px;color:#5a5a5a;font-weight:600">0 ${getText('symbols')}</div>
                </div>
                <div id="question-text" class="question-text scrollbar-custom">${getText('placeholderQuestion')}</div>
            </div>

            <div class="action-buttons">
                <button id="detect-btn" class="action-btn detect-btn">${getText('detectBtn')}</button>
                <button id="search-btn" class="action-btn search-btn" disabled>${getText('searchBtn')}</button>
                <button id="copy-btn" class="action-btn copy-btn" disabled>${getText('copyBtn')}</button>
            </div>

            <div id="answer-box" class="answer-box">
                <div class="answer-header">
                    <div style="font-weight:700">${getText('answerLabel')}</div>
                    <div id="answer-confidence" style="font-size:11px;color:#5a5a5a;font-weight:600"></div>
                </div>
                <div id="answer-text" class="answer-text">${getText('placeholderAnswer')}</div>
            </div>

            <div id="game-watermark"></div>

            <div id="overlay-status" class="overlay-status">${getText('loadingDB')}</div>
        </div>
    `;
    document.body.appendChild(overlayEl);

    cacheDom();
    updateAllText();

    if (dom.searchBtn) dom.searchBtn.disabled = true;
    if (dom.copyBtn) dom.copyBtn.disabled = true;
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

    if (dom.copyBtn) {
        dom.copyBtn.addEventListener('click', () => {
            try {
                const text = (dom.answerText && dom.answerText.textContent) ? dom.answerText.textContent : '';
                if (!text || text === getText('answerNotFound')) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => updateStatus('copySuccess', 'success')).catch(() => updateStatus('copySuccess', 'success'));
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text; document.body.appendChild(ta); ta.select();
                    document.execCommand('copy'); ta.remove();
                    updateStatus('copySuccess', 'success');
                }
            } catch (e) { logError('Copy failed', e); }
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
