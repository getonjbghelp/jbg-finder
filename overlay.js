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
    defaultLang: 'ru',
    loadTimeout: 10000,
    retryAttempts: 3
};

const LANG = {
    ru: {
        title: 'JBG-Finder',
        detectBtn: '🔍 Найти вопрос',
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
        title: 'JBG-Finder',
        detectBtn: '🔍 Detect Question',
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

const dom = {};

function getText(key) {
    return (LANG[currentLang] && LANG[currentLang][key]) || (LANG.ru && LANG.ru[key]) || key;
}

// === 🎨 НОВЫЕ СТИЛИ - MODERN GLASSMORPHISM ===
function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    log('Creating overlay styles...');
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        /* === GLOBAL RESET === */
        #${OVERLAY_ID} * { 
            box-sizing: border-box !important; 
            margin: 0; 
            padding: 0; 
        }
        
        /* === MAIN CONTAINER === */
        #${OVERLAY_ID} {
            position: fixed;
            top: 24px;
            right: 24px;
            width: 420px;
            max-width: 95vw;
            background: linear-gradient(135deg, 
                rgba(30, 30, 35, 0.95) 0%, 
                rgba(20, 20, 25, 0.98) 50%,
                rgba(15, 15, 20, 0.95) 100%);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            box-shadow: 
                0 25px 80px rgba(0, 0, 0, 0.6),
                0 0 0 1px rgba(255, 255, 255, 0.05) inset,
                0 0 120px rgba(78, 205, 196, 0.1);
            z-index: 999999;
            font-family: 'SF Pro Display', 'Inter', 'Segoe UI', system-ui, sans-serif;
            color: #e8e8e8;
            overflow: hidden;
            user-select: none;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            animation: overlaySlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @keyframes overlaySlideIn {
            from { 
                opacity: 0; 
                transform: translateY(-20px) scale(0.95); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }
        
        #${OVERLAY_ID}:hover {
            box-shadow: 
                0 30px 100px rgba(0, 0, 0, 0.7),
                0 0 0 1px rgba(255, 255, 255, 0.1) inset,
                0 0 150px rgba(78, 205, 196, 0.15);
        }
        
        /* === HEADER === */
        .overlay-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            height: 56px; 
            padding: 0 16px; 
            background: linear-gradient(180deg, 
                rgba(255, 255, 255, 0.03) 0%, 
                transparent 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            cursor: move; 
            position: relative;
        }
        
        .overlay-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, 
                transparent 0%, 
                rgba(78, 205, 196, 0.5) 50%, 
                transparent 100%);
        }
        
        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .overlay-title { 
            font-size: 16px; 
            font-weight: 700; 
            color: #ffffff;
            letter-spacing: -0.3px;
            background: linear-gradient(135deg, #fff 0%, #a8a8a8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .db-info { 
            display: flex; 
            gap: 8px; 
            align-items: center;
            padding: 4px 10px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        #db-version, #db-age {
            font-size: 10px; 
            color: #6a6a6a;
            font-weight: 500;
        }
        
        .db-status { 
            font-size: 9px; 
            padding: 3px 7px; 
            border-radius: 10px; 
            font-weight: 700;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
        }
        
        .db-status.loaded { 
            background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%); 
            color: #fff;
            box-shadow: 0 0 20px rgba(78, 205, 196, 0.4);
        }
        
        .db-status.error { 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); 
            color: #fff;
            box-shadow: 0 0 20px rgba(255, 107, 107, 0.4);
        }
        
        /* === CONTROLS === */
        .overlay-controls { 
            display: flex; 
            gap: 4px;
        }
        
        .overlay-btn { 
            width: 36px; 
            height: 36px; 
            border: none; 
            background: rgba(255, 255, 255, 0.03);
            color: #8a8a8a; 
            cursor: pointer; 
            font-size: 16px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 10px;
            border: 1px solid transparent;
        }
        
        .overlay-btn:hover { 
            background: rgba(255, 255, 255, 0.08); 
            color: #fff;
            border-color: rgba(255, 255, 255, 0.1);
            transform: translateY(-1px);
        }
        
        .overlay-btn:active {
            transform: translateY(0);
        }
        
        #lang-flag-btn:hover {
            background: linear-gradient(135deg, rgba(78, 205, 196, 0.2) 0%, rgba(68, 160, 141, 0.2) 100%);
            color: #4ecdc4;
        }
        
        #close-btn:hover {
            background: linear-gradient(135deg, rgba(255, 107, 107, 0.2) 0%, rgba(238, 90, 90, 0.2) 100%);
            color: #ff6b6b;
        }
        
        /* === CONTENT === */
        .overlay-content { 
            padding: 20px; 
            position: relative; 
        }
        
        /* === GAME INDICATOR === */
        .game-indicator { 
            display: flex; 
            align-items: center; 
            gap: 14px; 
            margin-bottom: 18px; 
            padding: 16px 18px; 
            background: linear-gradient(135deg, 
                rgba(78, 205, 196, 0.08) 0%, 
                rgba(68, 160, 141, 0.05) 100%);
            border: 1px solid rgba(78, 205, 196, 0.15);
            border-radius: 14px;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }
        
        .game-indicator::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(78, 205, 196, 0.1) 0%, transparent 70%);
            opacity: 0;
            transition: opacity 0.4s ease;
        }
        
        .game-indicator:hover::before {
            opacity: 1;
        }
        
        .indicator-dot { 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            z-index: 1;
        }
        
        .indicator-dot.active { 
            background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
            box-shadow: 
                0 0 20px rgba(78, 205, 196, 0.6),
                0 0 40px rgba(78, 205, 196, 0.3);
            animation: pulse 2s ease-in-out infinite; 
        }
        
        @keyframes pulse { 
            0%, 100% { 
                transform: scale(1);
                box-shadow: 0 0 20px rgba(78, 205, 196, 0.6), 0 0 40px rgba(78, 205, 196, 0.3);
            } 
            50% { 
                transform: scale(1.1);
                box-shadow: 0 0 30px rgba(78, 205, 196, 0.8), 0 0 60px rgba(78, 205, 196, 0.4);
            } 
        }
        
        #game-name {
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            letter-spacing: -0.2px;
        }
        
        #game-confidence {
            font-size: 11px;
            color: #6a6a6a;
            margin-top: 2px;
        }
        
        .indicator-count { 
            font-size: 10px; 
            color: #5a5a5a; 
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .confidence-badge { 
            background: linear-gradient(135deg, rgba(78, 205, 196, 0.15) 0%, rgba(68, 160, 141, 0.1) 100%);
            color: #4ecdc4; 
            padding: 3px 10px; 
            border-radius: 20px; 
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.3px;
            border: 1px solid rgba(78, 205, 196, 0.2);
        }
        
        /* === QUESTION & ANSWER BOXES === */
        .question-box, .answer-box { 
            margin-bottom: 16px; 
            padding: 18px; 
            background: rgba(255, 255, 255, 0.02); 
            border: 1px solid rgba(255, 255, 255, 0.06); 
            border-radius: 14px; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }
        
        .question-box { 
            border-left: 3px solid transparent;
            border-image: linear-gradient(180deg, #4ecdc4 0%, #44a08d 100%) 1;
        }
        
        .question-box:hover {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(78, 205, 196, 0.2);
        }
        
        .answer-box { 
            border-left: 3px solid rgba(80, 80, 80, 0.5);
        }
        
        .answer-box.found { 
            border-left-color: #4ecdc4;
            background: linear-gradient(135deg, 
                rgba(78, 205, 196, 0.08) 0%, 
                rgba(68, 160, 141, 0.04) 100%);
            border-color: rgba(78, 205, 196, 0.3);
            animation: answerFound 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .answer-box.not-found { 
            border-left-color: #ff6b6b;
            background: linear-gradient(135deg, 
                rgba(255, 107, 107, 0.08) 0%, 
                rgba(238, 90, 90, 0.04) 100%);
            border-color: rgba(255, 107, 107, 0.3);
        }
        
        @keyframes answerFound {
            from { 
                transform: scale(0.98);
                opacity: 0.8;
            }
            to { 
                transform: scale(1);
                opacity: 1;
            }
        }
        
        .question-header, .answer-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 12px; 
        }
        
        .question-header div[style*="font-weight:700"],
        .answer-header div[style*="font-weight:700"] {
            font-size: 11px;
            font-weight: 700 !important;
            color: #6a6a6a;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        #question-length, #answer-confidence {
            font-size: 10px;
            color: #4a4a4a;
            font-weight: 600;
        }
        
        .question-text, .answer-text { 
            font-size: 13px; 
            color: #c8c8c8; 
            line-height: 1.7; 
            max-height: 120px; 
            overflow-y: auto; 
            word-break: break-word;
            font-weight: 400;
        }
        
        .answer-text { 
            font-weight: 600; 
            color: #ffffff; 
            font-size: 14px;
            letter-spacing: -0.2px;
        }
        
        /* === ACTION BUTTONS === */
        .action-buttons { 
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px; 
            margin-bottom: 16px; 
        }
        
        .action-btn { 
            padding: 14px 18px; 
            border: none; 
            border-radius: 12px; 
            cursor: pointer; 
            font-size: 13px; 
            font-weight: 600; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            gap: 8px; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            letter-spacing: -0.2px;
        }
        
        .action-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
            transition: left 0.5s ease;
        }
        
        .action-btn:hover::before {
            left: 100%;
        }
        
        .detect-btn { 
            background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%); 
            color: #fff;
            box-shadow: 0 4px 20px rgba(78, 205, 196, 0.3);
        }
        
        .detect-btn:hover { 
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(78, 205, 196, 0.4);
        }
        
        .detect-btn:active {
            transform: translateY(0);
        }
        
        .detect-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        
        .search-btn { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: #fff;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
        }
        
        .search-btn:hover { 
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
        }
        
        .search-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .copy-btn { 
            grid-column: span 2;
            background: rgba(255, 255, 255, 0.05); 
            color: #8a8a8a; 
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .copy-btn:hover { 
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }
        
        .copy-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            transform: none;
        }
        
        /* === STATUS BAR === */
        .overlay-status { 
            font-size: 10px; 
            color: #4a4a4a; 
            text-align: center; 
            padding: 14px 16px; 
            border-top: 1px solid rgba(255, 255, 255, 0.04);
            font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
            font-weight: 500;
            letter-spacing: 0.5px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0 0 16px 16px;
            margin: -20px -20px -20px -20px;
            padding-top: 16px;
            margin-top: 16px;
        }
        
        /* === MINIMIZED STATE === */
        .overlay-minimized { 
            height: 56px; 
            overflow: hidden; 
        }
        
        .overlay-minimized .overlay-content { 
            display: none; 
        }
        
        .overlay-minimized {
            border-radius: 28px;
        }
        
        /* === SCROLLBAR === */
        .scrollbar-custom::-webkit-scrollbar { 
            width: 4px; 
        }
        
        .scrollbar-custom::-webkit-scrollbar-track { 
            background: rgba(0, 0, 0, 0.1); 
            border-radius: 2px; 
        }
        
        .scrollbar-custom::-webkit-scrollbar-thumb { 
            background: linear-gradient(180deg, #4ecdc4 0%, #44a08d 100%); 
            border-radius: 2px; 
        }
        
        .scrollbar-custom::-webkit-scrollbar-thumb:hover { 
            background: linear-gradient(180deg, #5fded5 0%, #55b09d 100%);
        }
        
        /* === WATERMARK === */
        #game-watermark {
            position: absolute;
            bottom: 60px;
            right: 20px;
            font-size: 80px;
            font-weight: 900;
            color: rgba(255, 255, 255, 0.02);
            pointer-events: none;
            letter-spacing: 5px;
            z-index: 1;
        }
        
        /* === RESPONSIVE === */
        @media (max-width: 480px) {
            #${OVERLAY_ID} {
                width: calc(100vw - 32px);
                right: 16px;
                top: 16px;
            }
            
            .action-buttons {
                grid-template-columns: 1fr;
            }
            
            .copy-btn {
                grid-column: span 1;
            }
        }
        
        /* === DARK MODE ENHANCEMENTS === */
        @media (prefers-color-scheme: dark) {
            #${OVERLAY_ID} {
                background: linear-gradient(135deg, 
                    rgba(25, 25, 30, 0.98) 0%, 
                    rgba(15, 15, 20, 0.99) 100%);
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
    dom.dbVersion = overlayEl.querySelector('#db-version');
    dom.dbAge = overlayEl.querySelector('#db-age');
    dom.indicatorCount = overlayEl.querySelector('#indicator-count');
    dom.dbStatus = overlayEl.querySelector('#db-status');
    dom.titleEl = overlayEl.querySelector('.overlay-title');
    dom.qLabelEl = overlayEl.querySelector('.question-header div[style*="font-weight:700"]');
    dom.aLabelEl = overlayEl.querySelector('.answer-header div[style*="font-weight:700"]');
    log('DOM elements cached:', Object.keys(dom));
}

// === ОБНОВЛЕНИЕ СТАТУСА ===
function updateStatus(messageKey, type) {
    if (!dom.status) {
        logWarn('Status element not found!');
        return;
    }
    const message = LANG[currentLang][messageKey] ? getText(messageKey) : messageKey;
    
    const colors = { 
        info: '#4a4a4a', 
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
        return;
    }

    const config = gameDatabase.gameConfig[result.gameId];
    currentGame = result.gameId;

    if (dom.statusDot) dom.statusDot.className = 'indicator-dot active';
    if (dom.gameName) dom.gameName.textContent = config.name || getText('notDetected');
    if (dom.gameConfidence) dom.gameConfidence.innerHTML = `<span class="confidence-badge">${getText('confidence')} ${result.confidence}</span>`;
    if (dom.watermark) dom.watermark.textContent = (config.name || '').toUpperCase();
    if (dom.indicatorCount && result.foundIndicators) dom.indicatorCount.textContent = `${result.foundIndicators.length} ${getText('indicators')}`;

    if (config.backgroundColor && overlayEl) overlayEl.style.boxShadow = `0 25px 80px ${config.backgroundColor}40, 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 120px ${config.backgroundColor}20`;
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
            dom.status.textContent = getText('gameDetected') + gameName + getText('gameDetectedSuffix');
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

// === ПОЛНОЕ ОБНОВЛЕНИЕ ТЕКСТА ИНТЕРФЕЙСА ===
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

// === ПЕРЕТАСКИВАНИЕ (БЕЗ ИЗМЕНЕНИЙ) ===
function makeDraggable(headerEl, rootEl) {
    if (!headerEl || !rootEl) return;
    let isDown = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    headerEl.addEventListener('mousedown', (ev) => {
        isDown = true;
        startX = ev.clientX; startY = ev.clientY;
        const rect = rootEl.getBoundingClientRect();
        origX = rect.left; origY = rect.top;
        document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (ev) => {
        if (!isDown) return;
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        rootEl.style.left = (origX + dx) + 'px';
        rootEl.style.top = (origY + dy) + 'px';
        rootEl.style.right = 'auto'; rootEl.style.bottom = 'auto';
        rootEl.style.position = 'fixed';
    });
    window.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        document.body.style.userSelect = '';
    });
}

// === СОЗДАНИЕ ОВЕРЛЕЯ ===
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
                <div id="status-dot" class="indicator-dot"></div>
                <div style="flex:1">
                    <div id="game-name">${getText('notDetected')}</div>
                    <div id="game-confidence" style="font-size:11px;color:#6a6a6a;margin-top:2px"></div>
                </div>
                <div id="indicator-count" class="indicator-count"></div>
            </div>

            <div class="question-box">
                <div class="question-header">
                    <div style="font-weight:700">${getText('questionLabel')}</div>
                    <div id="question-length" style="font-size:10px;color:#4a4a4a;font-weight:600">0 ${getText('symbols')}</div>
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
                    <div id="answer-confidence" style="font-size:10px;color:#4a4a4a;font-weight:600"></div>
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
    makeDraggable(headerEl, overlayEl);

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
