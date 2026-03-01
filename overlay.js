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

// Общие иконки статуса игры
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
let currentContentLang = CONFIG.defaultLang;

const dom = {};
let popupEl = null;
let popupDocClickHandler = null;
let windowResizeHandler = null;

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
            hidePopup();
        }
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
    if (dom.gameTitleBlock) {
        dom.gameTitleBlock.style.display = logoUrl ? 'none' : '';
    }

    updateIconSize();
}

function updateIconSize() {
    if (!dom.gameIcon) return;
    try {
        let logoHeight = 0;
        if (dom.gameLogo && dom.gameLogo.style.display !== 'none') {
            logoHeight = dom.gameLogo.getBoundingClientRect().height;
        }
        if ((!logoHeight || logoHeight < 6) && dom.gameName) {
            logoHeight = dom.gameName.getBoundingClientRect().height || 18;
        }
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
    const subtitle = (lang === 'ru') ? 'Почему?' : 'Why?';
    popupEl.querySelector('.jf-popup-subtitle').textContent = subtitle;
    popupEl.querySelector('.jf-popup-body').textContent = text || '';
}

function showPopupAt(targetEl) {
    if (!popupEl || !targetEl || !overlayEl) return;
    const rect = targetEl.getBoundingClientRect();
    const overlayRect = overlayEl.getBoundingClientRect();
    const popupRect = popupEl.getBoundingClientRect();
    const spaceAbove = rect.top - overlayRect.top;
    const desiredTop = spaceAbove - popupRect.height - 8;
    const belowTop = rect.bottom - overlayRect.top + 8;

    let top;
    if (desiredTop > 8) top = desiredTop;
    else top = belowTop;

    let left = rect.left - overlayRect.left;
    if (left + popupRect.width > overlayRect.width - 8) {
        left = Math.max(8, overlayRect.width - popupRect.width - 8);
    }
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

function setQuestionLoading(isLoading) {
    if (!dom.questionSpinner) return;
    dom.questionSpinner.classList.toggle('active', !!isLoading);
}

function setAnswerLoading(isLoading) {
    if (!dom.answerSpinner) return;
    dom.answerSpinner.classList.toggle('active', !!isLoading);
}

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    log('Creating overlay styles...');
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${OVERLAY_ID} * {
            box-sizing: border-box !important;
            margin: 0;
            padding: 0;
        }

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
            height: calc(100% - 30px);
            display: flex;
            flex-direction: column;
        }

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

        #${OVERLAY_ID} .overlay-grid {
            display: grid;
            grid-template-columns: 2fr 1fr 2fr;
            gap: 8px;
            align-items: stretch;
            flex: 1;
        }

        #${OVERLAY_ID} .qa-column {
            display: flex;
            flex-direction: column;
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
            to { transform: rotate(360deg); }
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

        #${OVERLAY_ID} .center-column {
            display: flex;
            flex-direction: column;
            gap: 6px;
            justify-content: center;
            min-width: 0;
        }

        #${OVERLAY_ID} .center-btn {
            width: 100%;
            min-height: 42px;
            padding: 8px 6px;
            border-radius: 3px;
            border: 1px solid #3b3b3b;
            background: #323232;
            color: #f0f0f0;
            font-size: 12px;
            cursor: pointer;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1.2;
            text-align: center;
            word-wrap: break-word;
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

        #${OVERLAY_ID} .overlay-status {
            font-size: 11px;
            color: #c0c0c0;
            padding: 6px 10px 8px 10px;
            border-top: 1px solid #3b3b3b;
            background: #292929;
            font-family: "Consolas", "JetBrains Mono", monospace;
        }

        #${OVERLAY_ID}.overlay-minimized {
            height: 30px !important;
            min-height: 30px;
            overflow: hidden;
        }

        #${OVERLAY_ID} .overlay-minimized .overlay-content {
            display: none !important;
        }

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
    if (!dom.status) return;
    const message = LANG[currentLang][messageKey] ? getText(messageKey) : messageKey;
    const colors = { info: '#5a5a5a', success: '#4ecdc4', warning: '#ffd93d', error: '#ff6b6b', searching: '#667eea' };
    dom.status.textContent = message;
    dom.status.style.color = colors[type] || colors.info;
}

function updateDBStatus(loaded) {
    if (!dom.dbStatus) return;
    dom.dbStatus.textContent = loaded ? '✓' : '✗';
    dom.dbStatus.className = 'db-status ' + (loaded ? 'loaded' : 'error');
}

async function loadDatabase() {
    if (window.GameDatabase) {
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
            if (window.GameDatabase) {
                gameDatabase = window.GameDatabase;
                updateStatus('dbLoaded', 'success');
                updateDBStatus(true);
                updateVersionInfo();
                isDatabaseLoaded = true;
                resolve(true);
            } else {
                if (dbLoadAttempts < CONFIG.retryAttempts) {
                    setTimeout(() => loadDatabase().then(resolve), 1000);
                } else resolve(false);
            }
        };

        script.onerror = () => {
            if (dbLoadAttempts < CONFIG.retryAttempts) {
                setTimeout(() => loadDatabase().then(resolve), 1000);
            } else resolve(false);
        };

        document.head.appendChild(script);
    });
}

function updateVersionInfo() {
    if (!gameDatabase || typeof gameDatabase.getVersionInfo !== 'function') return;
    try {
        const info = gameDatabase.getVersionInfo() || {};
        if (dom.dbVersion) dom.dbVersion.textContent = info.version || 'v?';
        if (dom.dbAge) {
            const days = Number(info.daysSinceUpdate || 0);
            const langData = LANG[currentLang];
            dom.dbAge.textContent = days === 0 ? (currentLang === 'ru' ? 'сегодня' : 'today') : days + ' ' + langData.daysAgo;
            dom.dbAge.style.color = info.isOutdated ? '#ff6b6b' : '#4ecdc4';
        }
    } catch (e) { logError(e); }
}

function updateIndicator(result) {
    if (!result || !result.gameId || !gameDatabase?.gameConfig?.[result.gameId]) {
        currentGame = null;
        if (dom.statusDot) dom.statusDot.className = 'indicator-dot';
        if (dom.gameName) dom.gameName.textContent = getText('notDetected');
        if (dom.gameConfidence) dom.gameConfidence.textContent = '';
        if (dom.watermark) dom.watermark.textContent = ''; 
        if (dom.indicatorCount) dom.indicatorCount.textContent = '';
        if (dom.gameIcon) { dom.gameIcon.src = ''; dom.gameIcon.style.display = 'none'; }
        if (dom.gameLogo) { dom.gameLogo.src = ''; dom.gameLogo.style.display = 'none'; }
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

    updateGameAssets();
}

function displayQuestion(q) {
    if (!dom.questionText || !dom.questionLength || !dom.searchBtn) return;

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

    currentContentLang = detectLangFromText(q);
    updateGameAssets();
    if (dom.questionCopyBtn) dom.questionCopyBtn.disabled = false;
    setQuestionLoading(false);
}

function detectGame() {
    if (!gameDatabase || typeof gameDatabase.detectGame !== 'function') return null;
    updateStatus('scanning', 'searching');
    setQuestionLoading(true);

    try { 
        const result = gameDatabase.detectGame();
        updateIndicator(result);

        if (result && result.gameId) {
            const gameName = gameDatabase.gameConfig?.[result.gameId]?.name || getText('notDetected');
            dom.status.textContent = getText('gameDetected') + gameName;
            dom.status.style.color = '#4ecdc4';

            setTimeout(() => {
                try {
                    const rawQuestion = (typeof gameDatabase.extractQuestion === 'function')
                        ? gameDatabase.extractQuestion(result.gameId) : null;

                    if (rawQuestion && rawQuestion.length >= CONFIG.minQuestionLength) {
                        currentQuestion = rawQuestion;
                        displayQuestion(currentQuestion);
                    } else {
                        currentQuestion = '';
                        displayQuestion(null);
                    }
                } catch (e) {
                    currentQuestion = '';
                    displayQuestion(null);
                } finally { setQuestionLoading(false); }
            }, 250);
        } else {
            updateStatus('notDetected', 'warning');
            currentQuestion = '';
            displayQuestion(null);
            setQuestionLoading(false);
        }
        return result;
    } catch (e) {
        setQuestionLoading(false);
        return null;
    }
}

function searchAnswer() {
    if (!gameDatabase || !currentGame || !currentQuestion) {
        updateStatus('detectFirst', 'warning');
        return;
    }
    updateStatus('scanning', 'searching');
    setAnswerLoading(true);

    try {
        const result = gameDatabase.findAnswer(currentQuestion, currentGame);
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
    } catch (e) { logError(e); } finally { setAnswerLoading(false); }
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
    } catch (e) { logError(e); }
}

function createPopup() {
    if (!overlayEl || popupEl) return;
    popupEl = document.createElement('div');
    popupEl.className = 'jf-popup';
    popupEl.innerHTML = `<div class="jf-popup-subtitle"></div><div class="jf-popup-body"></div>`;
    overlayEl.appendChild(popupEl);

    popupDocClickHandler = function (e) {
        if (!popupEl) return;
        if (!overlayEl || !overlayEl.contains) { hidePopup(); return; }
        if (!overlayEl.contains(e.target)) { hidePopup(); }
    };
    document.addEventListener('click', popupDocClickHandler);
}

function attachIconHoverHandlers() {
    if (!dom.gameIcon) return;
    dom.gameIcon.addEventListener('mouseenter', () => {
        if (!popupEl) createPopup();
        showPopupAt(dom.gameIcon);
    });
    dom.gameIcon.addEventListener('mouseleave', (e) => {
        setTimeout(() => {
            if (!popupEl) return;
            const { clientX: x, clientY: y } = e;
            const overPopup = popupEl.getBoundingClientRect();
            if (!(x >= overPopup.left && x <= overPopup.right && y >= overPopup.top && y <= overPopup.bottom)) {
                hidePopup();
            }
        }, 80);
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

    if (dom.detectBtn) {
        dom.detectBtn.addEventListener('click', async () => {
            try {
                dom.detectBtn.disabled = true;
                await detectGame();
            } finally { dom.detectBtn.disabled = false; }
        });
    }

    if (dom.searchBtn) {
        dom.searchBtn.addEventListener('click', () => {
            dom.searchBtn.disabled = true;
            try { searchAnswer(); } finally { setTimeout(() => { dom.searchBtn.disabled = false; }, 250); }
        });
    }

    if (dom.deleteBtn) {
        dom.deleteBtn.addEventListener('click', () => {
            currentQuestion = '';
            displayQuestion(null);
            if (dom.answerText) dom.answerText.textContent = getText('placeholderAnswer');
            if (dom.answerBox) { dom.answerBox.classList.remove('found'); dom.answerBox.classList.remove('not-found'); }
            if (dom.answerConfidence) dom.answerConfidence.textContent = '';
            if (dom.answerCopyBtn) dom.answerCopyBtn.disabled = true;
            if (dom.deleteBtn) dom.deleteBtn.disabled = true;
        });
    }

    const langBtn = overlayEl.querySelector('#lang-flag-btn');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentLang = currentLang === 'ru' ? 'en' : 'ru';
            updateAllText();
        });
    }

    const closeBtn = overlayEl.querySelector('#close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => { if (overlayEl) overlayEl.remove(); });

    const headerEl = overlayEl.querySelector('.overlay-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    function onMouseMove(e) {
        if (!isDragging || !overlayEl) return;
        overlayEl.style.left = (initialX + (e.clientX - startX)) + 'px';
        overlayEl.style.top = (initialY + (e.clientY - startY)) + 'px';
        overlayEl.style.right = 'auto';
        overlayEl.style.bottom = 'auto';
    }

    if (headerEl) {
        headerEl.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = overlayEl.getBoundingClientRect();
            initialX = rect.left; initialY = rect.top;
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', () => { isDragging = false; window.removeEventListener('mousemove', onMouseMove); });
        });
    }

    windowResizeHandler = () => { updateIconSize(); };
    window.addEventListener('resize', windowResizeHandler);
}

async function init() {
    createOverlay();
    const loaded = await loadDatabase();
    if (loaded) updateStatus('notDetected', 'info');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
})();
