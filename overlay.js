(function () {
const OVERLAY_ID = 'game-finder-overlay';
const STYLE_ID = 'game-finder-overlay-style';

// === ЛОГГИРОВАНИЕ ===
const LOG_PREFIX = '[JBG-Finder]';
const LOG_ENABLED = true; // Можно отключить для продакшена

function log(...args) {
    if (LOG_ENABLED) {
        console.log(LOG_PREFIX, ...args);
    }
}

function logError(...args) {
    if (LOG_ENABLED) {
        console.error(LOG_PREFIX, ...args);
    }
}

function logDebug(...args) {
    if (LOG_ENABLED) {
        console.debug(LOG_PREFIX, ...args);
    }
}

function logWarn(...args) {
    if (LOG_ENABLED) {
        console.warn(LOG_PREFIX, ...args);
    }
}

// Удаляем существующий оверлей
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
    loadTimeout: 10000, // 10 секунд таймаут для загрузки БД
    retryAttempts: 3 // Количество попыток загрузки БД
};

const LANG = {
    ru: {
        title: 'JBG-Finder BETA',
        detectBtn: '🔍 Найти вопрос и игру',
        searchBtn: '⚡ Найти ответ',
        copyBtn: '📋 Копировать',
        questionLabel: '📝 ВОПРОС',
        answerLabel: '💡 ОТВЕТ',
        notDetected: 'Игра ещё не определена',
        scanning: 'Сканирование...',
        gameDetected: 'Игра (теперь нажмите на "Найти Ответ" для вывода ответа): ',
        answerFound: 'Ответ найден! (',
        answerNotFound: 'Ответ не найден',
        copySuccess: 'Скопировано!',
        detectFirst: 'Сначала определите игру',
        loadingDB: 'Загрузка базы...',
        dbLoaded: 'База загружена ✓',
        dbError: 'Ошибка загрузки базы',
        confidence: 'уверенность: ',
        symbols: ' символов',
        close: 'Закрыть',
        minimize: 'Свернуть',
        notEnoughSymbols: 'Вопрос слишком короткий',
        indicators: 'индикаторов',
        debugMode: 'Режим отладки: ВКЛ'
    },
    en: {
        title: 'JBG-Finder BETA',
        detectBtn: '🔍 Detect Game and Question',
        searchBtn: '⚡ Find Answer',
        copyBtn: '📋 Copy',
        questionLabel: '📝 QUESTION',
        answerLabel: '💡 ANSWER',
        notDetected: 'Not Detected Yet',
        scanning: 'Scanning...',
        gameDetected: 'Game (now click on "Find Answer" to display the answer): ',
        answerFound: 'Answer Found! (',
        answerNotFound: 'Answer Not Found',
        copySuccess: 'Copied!',
        detectFirst: 'Detect game first',
        loadingDB: 'Loading DB...',
        dbLoaded: 'Database Loaded ✓',
        dbError: 'Database Load Error',
        confidence: 'confidence: ',
        symbols: ' symbols',
        close: 'Close',
        minimize: 'Minimize',
        notEnoughSymbols: 'Question too short',
        indicators: 'indicators',
        debugMode: 'Debug Mode: ON'
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
let dragHandlers = null;

function getText(key) {
    return (LANG[currentLang] && LANG[currentLang][key]) || 
           (LANG.ru && LANG.ru[key]) || key;
}

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    
    log('Creating overlay styles...');
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${OVERLAY_ID} * { box-sizing: border-box !important; }
        #${OVERLAY_ID} {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 600px;
            max-width: 95vw;
            background: linear-gradient(145deg, #2b2b2b 0%, #1e1e1e 100%);
            backdrop-filter: blur(15px);
            border: 1px solid #3a3a3a;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            z-index: 999999;
            font-family: 'Segoe UI', sans-serif;
            color: #e0e0e0;
            overflow: hidden;
            user-select: none;
            transition: box-shadow 0.3s ease;
        }
        .overlay-background-text {
            position: absolute;
            top: 50%;
            left: 0;
            transform: translateY(-50%) translateX(100%);
            font-size: 70px;
            font-weight: 900;
            color: rgba(255,255,255,0.06);
            pointer-events: none;
            white-space: nowrap;
            z-index: 0;
            animation: scrollText 28s linear infinite;
        }
        @keyframes scrollText {
            0% { transform: translateY(-50%) translateX(100%); }
            100% { transform: translateY(-50%) translateX(-250%); }
        }
        .overlay-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 45px;
            padding: 0 10px;
            background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
            border-bottom: 1px solid #3a3a3a;
            cursor: move;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .overlay-title {
            font-size: 15px;
            font-weight: 600;
            color: #fff;
        }
        .db-info {
            font-size: 11px;
            color: #808080;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .db-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }
        .db-status.loaded {
            background: #4ecdc4;
            color: #fff;
        }
        .db-status.error {
            background: #ff6b6b;
            color: #fff;
        }
        .overlay-controls {
            display: flex;
            height: 100%;
        }
        .overlay-btn {
            width: 40px;
            height: 40px;
            border: none;
            background: transparent;
            color: #c0c0c0;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            border-radius: 4px;
        }
        .overlay-btn:hover {
            background: rgba(255,255,255,0.08);
            color: #fff;
        }
        .flag-btn { font-size: 20px; }
        .overlay-content {
            padding: 16px;
            position: relative;
            z-index: 10;
        }
        .game-indicator {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 14px;
            padding: 10px 12px;
            background: rgba(45,45,45,0.6);
            border: 1px solid #3a3a3a;
            border-radius: 6px;
        }
        .indicator-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #505050;
            transition: all 0.3s ease;
            box-shadow: 0 0 5px rgba(0,0,0,0.3);
        }
        .indicator-dot.active {
            background: #4ecdc4;
            box-shadow: 0 0 12px #4ecdc4;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 12px #4ecdc4; }
            50% { box-shadow: 0 0 20px #4ecdc4; }
        }
        .question-box, .answer-box {
            margin-bottom: 14px;
            padding: 14px;
            background: rgba(35,35,35,0.75);
            border: 1px solid #3a3a3a;
            border-radius: 6px;
            transition: all 0.3s ease;
        }
        .question-box {
            border-left: 4px solid #4ecdc4;
        }
        .answer-box {
            border-left: 4px solid #505050;
        }
        .answer-box.found {
            border-left-color: #4ecdc4;
            background: rgba(78,205,196,0.08);
        }
        .answer-box.not-found {
            border-left-color: #ff6b6b;
            background: rgba(255,107,107,0.08);
        }
        .question-header, .answer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .question-text, .answer-text {
            font-size: 14px;
            color: #d0d0d0;
            line-height: 1.6;
            max-height: 140px;
            overflow-y: auto;
            word-break: break-word;
        }
        .answer-text {
            font-weight: 600;
            color: #fff;
            font-size: 15px;
        }
        .answer-box.found .answer-text {
            color: #4ecdc4;
        }
        .answer-box.not-found .answer-text {
            color: #ff6b6b;
        }
        .action-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 14px;
        }
        .action-btn {
            flex: 1;
            padding: 12px 14px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s ease;
        }
        .detect-btn {
            background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
            color: #fff;
        }
        .detect-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(78,205,196,0.4);
        }
        .search-btn {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
            color: #fff;
        }
        .search-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(255,107,107,0.4);
        }
        .copy-btn {
            background: #3a3a3a;
            color: #c0c0c0;
            border: 1px solid #4a4a4a;
        }
        .copy-btn:hover:not(:disabled) {
            background: #4a4a4a;
            color: #fff;
        }
        .action-btn:disabled {
            opacity: 0.35;
            cursor: not-allowed;
            transform: none !important;
            box-shadow: none !important;
        }
        .overlay-status {
            font-size: 11px;
            color: #606060;
            text-align: center;
            padding-top: 10px;
            border-top: 1px solid #3a3a3a;
            font-family: 'Consolas', monospace;
        }
        .overlay-minimized {
            height: 45px;
            overflow: hidden;
        }
        .overlay-minimized .overlay-content {
            display: none;
        }
        .indicator-count {
            font-size: 11px;
            color: #808080;
            margin-left: auto;
        }
        .confidence-badge {
            background: rgba(78,205,196,0.2);
            color: #4ecdc4;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
        }
        .scrollbar-custom::-webkit-scrollbar {
            width: 6px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.2);
            border-radius: 3px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
            background: #4a4a4a;
            border-radius: 3px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
            background: #5a5a5a;
        }
    `;
    document.head.appendChild(style);
    log('Styles created successfully');
}

function cacheDom() {
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
    log('DOM elements cached:', Object.keys(dom));
}

function updateStatus(message, type) {
    if (!dom.status) {
        logWarn('Status element not found!');
        return;
    }
    const colors = {
        info: '#606060',
        success: '#4ecdc4',
        warning: '#ffd93d',
        error: '#ff6b6b',
        searching: '#ffd93d'
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
    
    // Проверяем, не загружена ли уже база
    if (window.GameDatabase) {
        log('Database already loaded in window.GameDatabase');
        gameDatabase = window.GameDatabase;
        updateStatus(getText('dbLoaded'), 'success');
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
        
        log('Creating script tag for database...');
        
        script.onload = () => {
            log('Script loaded successfully');
            log('Checking window.GameDatabase...');
            
            if (window.GameDatabase) {
                log('✓ GameDatabase found in window object');
                log('Database version:', window.GameDatabase.version);
                log('Game configs:', Object.keys(window.GameDatabase.gameConfig || {}));
                
                gameDatabase = window.GameDatabase;
                updateStatus(getText('dbLoaded'), 'success');
                updateDBStatus(true);
                updateVersionInfo();
                isDatabaseLoaded = true;
                resolve(true);
            } else {
                logError('✗ GameDatabase NOT found in window object after script load!');
                logError('Window object keys:', Object.keys(window).filter(k => k.toLowerCase().includes('game')));
                updateStatus(getText('dbError') + ' (DB not initialized)', 'error');
                updateDBStatus(false);
                
                if (dbLoadAttempts < CONFIG.retryAttempts) {
                    logWarn('Retrying database load...');
                    setTimeout(() => {
                        loadDatabase().then(resolve);
                    }, 1000);
                } else {
                    resolve(false);
                }
            }
        };
        
        script.onerror = (e) => {
            logError('✗ Script load error:', e);
            updateStatus(getText('dbError') + ' (Network error)', 'error');
            updateDBStatus(false);
            
            if (dbLoadAttempts < CONFIG.retryAttempts) {
                logWarn('Retrying database load after error...');
                setTimeout(() => {
                    loadDatabase().then(resolve);
                }, 1000);
            } else {
                resolve(false);
            }
        };
        
        // Таймаут для загрузки
        const timeout = setTimeout(() => {
            logError('✗ Database load timeout after', CONFIG.loadTimeout, 'ms');
            script.remove();
            updateStatus(getText('dbError') + ' (Timeout)', 'error');
            updateDBStatus(false);
            resolve(false);
        }, CONFIG.loadTimeout);
        
        // Очищаем таймаут при успешной загрузке
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
        if (dom.dbVersion) {
            dom.dbVersion.textContent = info.version || 'v?';
            log('DB Version:', info.version);
        }
        if (dom.dbAge) {
            const days = Number(info.daysSinceUpdate || 0);
            dom.dbAge.textContent = days === 0 ? 
                (currentLang === 'ru' ? 'сегодня' : 'today') : 
                days + 'd';
            dom.dbAge.style.color = info.isOutdated ? '#ff6b6b' : '#4ecdc4';
            log('DB Age:', days, 'days');
        }
    } catch (e) {
        logError('Error updating version info:', e);
    }
}

function updateIndicator(result) {
    log('=== UPDATE INDICATOR ===');
    log('Result:', result);
    
    if (!result || !result.gameId || !gameDatabase?.gameConfig?.[result.gameId]) {
        logWarn('Invalid result or game config not found');
        currentGame = null;
        if (dom.statusDot) dom.statusDot.className = 'indicator-dot';
        if (dom.gameName) dom.gameName.textContent = getText('notDetected');
        if (dom.gameConfidence) dom.gameConfidence.textContent = '';
        if (dom.watermark) dom.watermark.textContent = getText('notDetected').toUpperCase();
        if (dom.indicatorCount) dom.indicatorCount.textContent = '';
        return;
    }

    const config = gameDatabase.gameConfig[result.gameId];
    currentGame = result.gameId;
    
    log('Game detected:', result.gameId);
    log('Config found:', !!config);
    log('Confidence:', result.confidence);
    log('Found indicators:', result.foundIndicators?.length || 0);

    if (dom.statusDot) dom.statusDot.className = 'indicator-dot active';
    if (dom.gameName) {
        dom.gameName.textContent = config.name || getText('notDetected');
        log('Game name set:', config.name);
    }
    if (dom.gameConfidence) {
        dom.gameConfidence.innerHTML = `<span class="confidence-badge">${getText('confidence')} ${result.confidence}</span>`;
        log('Confidence displayed:', result.confidence);
    }
    if (dom.watermark) {
        dom.watermark.textContent = (config.name || '').toUpperCase();
        log('Watermark set');
    }
    if (dom.indicatorCount && result.foundIndicators) {
        dom.indicatorCount.textContent = `${result.foundIndicators.length} ${getText('indicators')}`;
        log('Indicator count:', result.foundIndicators.length);
    }
    
    if (config.backgroundColor && overlayEl) {
        overlayEl.style.boxShadow = `0 10px 40px ${config.backgroundColor}40`;
        log('Box shadow updated');
    }
    
    log('=== UPDATE INDICATOR COMPLETE ===');
}

function displayQuestion(q) {
    log('=== DISPLAY QUESTION ===');
    
    if (!dom.questionText || !dom.questionLength || !dom.searchBtn) {
        logError('Question DOM elements not found!');
        return;
    }
    
    if (!q) {
        dom.questionText.textContent = currentLang === 'ru'
            ? 'Нажмите на "Найти вопрос и игру" когда у вас на экране УЖЕ ЕСТЬ вопрос. В других случаях это вызовет нестабильную работу...'
            : 'Click on "Detect Game and Question" when you ALREADY have a question on the screen. In other cases it will cause unstable work...';
        dom.questionLength.textContent = '0' + getText('symbols');
        dom.searchBtn.disabled = true;
        log('Question cleared, search button disabled');
        return;
    }
    
    const text = q.length > 200 ? q.slice(0, 200) + '...' : q;
    dom.questionText.textContent = text;
    dom.questionLength.textContent = q.length + getText('symbols');
    dom.searchBtn.disabled = q.length < CONFIG.minQuestionLength;
    
    log('Question displayed:', q.length, 'chars');
    log('Search button disabled:', dom.searchBtn.disabled);
}

function detectGame() {
    log('=== DETECT GAME CLICKED ===');
    log('Database loaded:', !!gameDatabase);
    log('Database type:', typeof gameDatabase);
    log('detectGame function exists:', typeof gameDatabase?.detectGame === 'function');
    
    if (!gameDatabase || typeof gameDatabase.detectGame !== 'function') {
        logError('Database or detectGame function not available!');
        updateStatus(getText('dbError'), 'error');
        return null;
    }

    updateStatus(getText('scanning'), 'searching');
    
    try {
        log('Calling gameDatabase.detectGame()...');
        const result = gameDatabase.detectGame();
        log('detectGame result:', result);
        
        updateIndicator(result);
         
        if (result && result.gameId) {
            const gameName = gameDatabase.gameConfig[result.gameId]?.name || getText('notDetected');
            updateStatus(`${getText('gameDetected')} ${gameName}`, 'success');
            log('Game detected successfully:', result.gameId);
            
            // Извлекаем вопрос и отображаем его (без автоматического поиска ответа)
            setTimeout(() => {
                log('Extracting question...');
                const rawQuestion = gameDatabase.extractQuestion(result.gameId);
                log('Raw question:', rawQuestion ? rawQuestion.substring(0, 100) : 'null');
                
                if (rawQuestion && rawQuestion.length >= CONFIG.minQuestionLength) {
                    // Используем сырой текст вопроса для поиска и отображения
                    currentQuestion = rawQuestion;
                    displayQuestion(rawQuestion);
                } else {
                    currentQuestion = '';
                    displayQuestion(null);
                    logWarn('Question too short or not extracted');
                }
            }, 300);
        } else {
            updateStatus(getText('notDetected'), 'warning');
            currentQuestion = '';
            displayQuestion(null);
            logWarn('No game detected');
        }
        
        return result;
    } catch (e) {
        logError('Error in detectGame:', e);
        logError('Stack trace:', e.stack);
        updateStatus(getText('dbError') + ': ' + e.message, 'error');
        return null;
    }
}

function searchAnswer() {
    log('=== SEARCH ANSWER CLICKED ===');
    log('Current game:', currentGame);
    log('Current question:', currentQuestion ? currentQuestion.substring(0, 50) : 'null');
    
    if (!gameDatabase || !currentGame || !currentQuestion || 
        typeof gameDatabase.findAnswer !== 'function') {
        logError('Cannot search - missing dependencies');
        updateStatus(getText('detectFirst'), 'warning');
        return;
    }
    
    updateStatus(getText('scanning'), 'searching');
    
    try {
        log('Calling gameDatabase.findAnswer()...');
        const result = gameDatabase.findAnswer(currentQuestion, currentGame);
        log('findAnswer result:', result);
        
        displayQuestion(currentQuestion);
        
        if (result?.answer) {
            dom.answerText.textContent = result.answer;
            dom.answerBox.classList.remove('not-found');
            dom.answerBox.classList.add('found');
            dom.answerConfidence.textContent = (result.confidence ?? 0) + '%';
            dom.copyBtn.disabled = false;
            updateStatus(`${getText('answerFound')} ${(result.confidence ?? 0)}%)`, 'success');
            log('Answer found:', result.answer);
        } else {
            dom.answerText.textContent = getText('answerNotFound');
            dom.answerBox.classList.remove('found');
            dom.answerBox.classList.add('not-found');
            dom.answerConfidence.textContent = '';
            dom.copyBtn.disabled = true;
            updateStatus(getText('answerNotFound'), 'error');
            logWarn('Answer not found');
        }
    } catch (e) {
        logError('Error in searchAnswer:', e);
        updateStatus(getText('answerNotFound') + ': ' + e.message, 'error');
    }
}

function copyAnswer() {
    const text = dom.answerText?.textContent;
    if (!text || text === getText('answerNotFound')) return;
    
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            updateStatus(getText('copySuccess'), 'success');
            setTimeout(() => updateStatus('', 'info'), 2000);
        });
    }
}

function toggleLanguage() {
    currentLang = currentLang === 'ru' ? 'en' : 'ru';
    updateTexts();
    updateVersionInfo();
}

function updateTexts() {
    overlayEl.querySelector('.overlay-title').textContent = getText('title');
    dom.detectBtn.textContent = getText('detectBtn');
    dom.searchBtn.textContent = getText('searchBtn');
    dom.copyBtn.textContent = getText('copyBtn');
    overlayEl.querySelector('.question-label').textContent = getText('questionLabel');
    overlayEl.querySelector('.answer-label').textContent = getText('answerLabel');
}

function enableDrag() {
    const header = overlayEl.querySelector('.overlay-header');
    let dragActive = false;
    let startX, startY, startLeft, startTop;

    function onMouseDown(e) {
        if (e.target.closest('.overlay-btn')) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = overlayEl.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        startX = e.clientX;
        startY = e.clientY;

        dragActive = true;
        overlayEl.style.userSelect = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        if (!dragActive) return;
        e.preventDefault();
        e.stopPropagation();

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = startLeft + dx;
        let newTop = startTop + dy;

        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const elW = overlayEl.offsetWidth;
        const elH = overlayEl.offsetHeight;

        newLeft = Math.max(0, Math.min(newLeft, winW - elW));
        newTop = Math.max(0, Math.min(newTop, winH - elH));

        overlayEl.style.left = newLeft + 'px';
        overlayEl.style.top = newTop + 'px';
        overlayEl.style.right = 'auto';
    }

    function onMouseUp(e) {
        if (!dragActive) return;
        e.preventDefault();
        e.stopPropagation();

        dragActive = false;
        overlayEl.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    header.addEventListener('mousedown', onMouseDown);

    dragHandlers = { 
        header,
        onMouseDown,
        onMouseMove,
        onMouseUp
    };
}

function disableDrag() {
    if (dragHandlers) {
        dragHandlers.header.removeEventListener('mousedown', dragHandlers.onMouseDown);
        document.removeEventListener('mousemove', dragHandlers.onMouseMove);
        document.removeEventListener('mouseup', dragHandlers.onMouseUp);
        dragHandlers = null;
    }
}

function createOverlay() {
    log('Creating overlay...');
    ensureStyle();
    
    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.innerHTML = `
        <div class="overlay-background-text" id="game-watermark">JACKBOX GAMES FINDER</div>
        <div class="overlay-header">
            <div class="header-left">
                <span class="overlay-title">${getText('title')}</span>
                <span class="db-info">
                    <span id="db-status" class="db-status">✗</span>
                    <span id="db-version">v0.0</span>
                    <span>•</span>
                    <span id="db-age">--</span>
                </span>
            </div>
            <div class="overlay-controls">
                <button class="overlay-btn flag-btn" id="lang-flag-btn">🌏</button>
                <button class="overlay-btn minimize-btn">_</button>
                <button class="overlay-btn close-btn">×</button>
            </div>
        </div>
        <div class="overlay-content">
            <div class="game-indicator">
                <span class="indicator-dot" id="status-dot"></span>
                <span id="game-name">${getText('notDetected')}</span>
                <span id="game-confidence"></span>
                <span class="indicator-count" id="indicator-count"></span>
            </div>
            <div class="question-box">
                <div class="question-header">
                    <span class="question-label">${getText('questionLabel')}</span>
                    <span id="question-length">0${getText('symbols')}</span>
                </div>
                <div class="question-text scrollbar-custom" id="question-text"></div>
            </div>
            <div class="answer-box" id="answer-box">
                <div class="answer-header">
                    <span class="answer-label">${getText('answerLabel')}</span>
                    <span id="answer-confidence"></span>
                </div>
                <div class="answer-text scrollbar-custom" id="answer-text"></div>
            </div>
            <div class="action-buttons">
                <button class="action-btn detect-btn" id="detect-btn">${getText('detectBtn')}</button>
                <button class="action-btn search-btn" id="search-btn" disabled>${getText('searchBtn')}</button>
                <button class="action-btn copy-btn" id="copy-btn" disabled>${getText('copyBtn')}</button>
            </div>
            <div class="overlay-status" id="overlay-status"></div>
        </div>
    `;
    
    document.body.appendChild(overlayEl);
    log('Overlay appended to body');
    
    cacheDom();
    displayQuestion(null);
    
    dom.detectBtn.onclick = detectGame;
    dom.searchBtn.onclick = searchAnswer;
    dom.copyBtn.onclick = copyAnswer;
    dom.flagBtn.onclick = toggleLanguage;
    overlayEl.querySelector('.close-btn').onclick = () => cleanup();
    overlayEl.querySelector('.minimize-btn').onclick = () => 
        overlayEl.classList.toggle('overlay-minimized');
    
    enableDrag();
    log('Overlay created and event listeners attached');
}

function cleanup() {
    disableDrag();
    overlayEl?.remove();
    log('Overlay cleaned up');
}

async function init() {
    log('=== INIT STARTED ===');
    createOverlay();
    updateStatus(getText('loadingDB'), 'info');
    
    const loaded = await loadDatabase();
    log('Database load result:', loaded);
    
    if (loaded) {
        updateStatus(getText('notDetected'), 'info');
        log('Initialization complete');
    } else {
        logError('Initialization failed - database not loaded');
    }
    
    log('=== INIT COMPLETE ===');
}

if (document.readyState === 'loading') {
    log('Document still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', init);
} else {
    log('Document already loaded, starting init...');
    init();
}

log('Overlay script loaded successfully');
})();
