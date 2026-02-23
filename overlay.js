(function () {
    const OVERLAY_ID = 'game-finder-overlay';
    const STYLE_ID = 'game-finder-overlay-style';

    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();

    const CONFIG = {
        databaseURL: 'https://getonjbghelp.github.io/jbg-finder/database.js',
        checkInterval: 2000,
        minQuestionLength: 1,
        defaultLang: 'ru'
    };

    const LANG = {
        ru: {
            title: 'JBG-Finder BETA',
            detectBtn: '🔍 Определить игру',
            searchBtn: '⚡ Найти ответ',
            copyBtn: '📋 Копировать',
            questionLabel: '📝 ВОПРОС',
            answerLabel: '💡 ОТВЕТ',
            notDetected: 'Игра не опеределена!',
            scanning: 'Сканирование...',
            gameDetected: 'Игра: ',
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
            notEnoughSymbols: 'Вопрос слишком короткий'
        },
        en: {
            title: 'JBG-Finder BETA',
            detectBtn: '🔍 Detect Game',
            searchBtn: '⚡ Find Answer',
            copyBtn: '📋 Copy',
            questionLabel: '📝 QUESTION',
            answerLabel: '💡 ANSWER',
            notDetected: 'Not Detected',
            scanning: 'Scanning...',
            gameDetected: 'Game: ',
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
            notEnoughSymbols: 'Question too short'
        }
    };

    let currentGame = null;
    let currentQuestion = '';
    let lastQuestion = '';
    let gameDatabase = null;
    let currentLang = CONFIG.defaultLang;
    let autoCheckTimer = null;
    let overlayEl = null;

    const dom = {};

    function getText(key) {
        return (LANG[currentLang] && LANG[currentLang][key]) || (LANG.ru && LANG.ru[key]) || key;
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID} *{box-sizing:border-box!important}
            #${OVERLAY_ID}{position:fixed;top:20px;right:20px;width:580px;max-width:95vw;background:linear-gradient(145deg,#2b2b2b 0%,#1e1e1e 100%);backdrop-filter:blur(15px);border:1px solid #3a3a3a;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.8);z-index:999999;font-family:'Segoe UI',sans-serif;color:#e0e0e0;overflow:hidden;user-select:none}
            .overlay-background-text{position:absolute;top:50%;left:0;transform:translateY(-50%) translateX(100%);font-size:70px;font-weight:900;color:rgba(255,255,255,.06);pointer-events:none;white-space:nowrap;z-index:0;animation:scrollText 28s linear infinite}
            @keyframes scrollText{0%{transform:translateY(-50%) translateX(100%)}100%{transform:translateY(-50%) translateX(-250%)}}
            .overlay-header{display:flex;justify-content:space-between;align-items:center;height:40px;padding:0 8px;background:linear-gradient(135deg,#3a3a3a 0%,#2a2a2a 100%);border-bottom:1px solid #3a3a3a;cursor:move}
            .header-left{display:flex;align-items:center;gap:10px}
            .overlay-title{font-size:14px;font-weight:600;color:#fff}
            .db-info{font-size:11px;color:#808080;display:flex;align-items:center;gap:6px}
            .overlay-controls{display:flex;height:100%}
            .overlay-btn{width:40px;height:40px;border:none;background:transparent;color:#c0c0c0;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
            .overlay-btn:hover{background:rgba(255,255,255,.06);color:#fff}
            .flag-btn{font-size:20px}
            .overlay-content{padding:14px;position:relative;z-index:10}
            .game-indicator{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:8px 10px;background:rgba(45,45,45,.6);border:1px solid #3a3a3a}
            .indicator-dot{width:12px;height:12px;border-radius:50%;background:#505050;transition:all .25s ease}
            .indicator-dot.active{background:#4ecdc4;box-shadow:0 0 8px #4ecdc4}
            .question-box,.answer-box{margin-bottom:12px;padding:12px;background:rgba(35,35,35,.75);border:1px solid #3a3a3a}
            .question-box{border-left:3px solid #4ecdc4}
            .answer-box{border-left:3px solid #505050}
            .answer-box.found{border-left-color:#4ecdc4;background:rgba(78,205,196,.06)}
            .answer-box.not-found{border-left-color:#ff6b6b;background:rgba(255,107,107,.06)}
            .question-header,.answer-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
            .question-text,.answer-text{font-size:13px;color:#d0d0d0;line-height:1.5;max-height:120px;overflow-y:auto;word-break:break-word}
            .answer-text{font-weight:600;color:#fff}
            .answer-box.found .answer-text{color:#4ecdc4}
            .answer-box.not-found .answer-text{color:#ff6b6b}
            .action-buttons{display:flex;gap:8px;margin-bottom:12px}
            .action-btn{flex:1;padding:10px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center}
            .detect-btn{background:linear-gradient(135deg,#4ecdc4 0%,#44a08d 100%);color:#fff}
            .search-btn{background:linear-gradient(135deg,#ff6b6b 0%,#ee5a5a 100%);color:#fff}
            .copy-btn{background:#3a3a3a;color:#c0c0c0;border:1px solid #4a4a4a}
            .action-btn:disabled{opacity:.35;cursor:not-allowed}
            .overlay-status{font-size:10px;color:#606060;text-align:center;padding-top:8px;border-top:1px solid #3a3a3a;font-family:'Consolas',monospace}
            .overlay-minimized{height:40px;overflow:hidden}
            .overlay-minimized .overlay-content{display:none}
        `;
        document.head.appendChild(style);
    }

    function cacheDom() {
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
    }

    function updateStatus(message, type) {
        if (!dom.status) return;
        const colors = {
            info: '#606060',
            success: '#4ecdc4',
            warning: '#ffd93d',
            error: '#ff6b6b',
            searching: '#ffd93d'
        };
        dom.status.textContent = message;
        dom.status.style.color = colors[type] || colors.info;
    }

    async function loadDatabase() {
        if (window.GameDatabase) {
            gameDatabase = window.GameDatabase;
            updateStatus(getText('dbLoaded'), 'success');
            updateVersionInfo();
            return true;
        }
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = CONFIG.databaseURL + '?t=' + Date.now();
            script.onload = () => {
                if (window.GameDatabase) {
                    gameDatabase = window.GameDatabase;
                    updateStatus(getText('dbLoaded'), 'success');
                    updateVersionInfo();
                    resolve(true);
                } else {
                    updateStatus(getText('dbError'), 'error');
                    resolve(false);
                }
            };
            script.onerror = () => {
                updateStatus(getText('dbError'), 'error');
                resolve(false);
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
                dom.dbAge.textContent = days === 0 ? (currentLang === 'ru' ? 'сегодня' : 'today') : days + 'd';
                dom.dbAge.style.color = info.isOutdated ? '#ff6b6b' : '#4ecdc4';
            }
        } catch (_) {}
    }

	function updateIndicator(result) {
    if (!result || !result.gameId || !gameDatabase?.gameConfig?.[result.gameId]) {
        currentGame = null;

        if (dom.statusDot) dom.statusDot.className = 'indicator-dot';
        if (dom.gameName) dom.gameName.textContent = getText('notDetected');
        if (dom.gameConfidence) dom.gameConfidence.textContent = '';
        if (dom.watermark) dom.watermark.textContent = getText('notDetected');
        return;
    }

    const config = gameDatabase.gameConfig[result.gameId];
    currentGame = result.gameId;

    if (dom.statusDot) dom.statusDot.className = 'indicator-dot active';
    if (dom.gameName) dom.gameName.textContent = config.name || getText('notDetected');
    if (dom.gameConfidence) dom.gameConfidence.textContent = (result.confidence ?? 0) + ' needed matches';
    if (dom.watermark) dom.watermark.textContent = (config.name || '').toUpperCase();
}

    function displayQuestion(q) {
        if (!dom.questionText || !dom.questionLength || !dom.searchBtn) return;
        if (!q) {
            dom.questionText.textContent = currentLang === 'ru'
                ? 'Нажмите "Определить игру" для сканирования...'
                : 'Press "Detect Game" to start scanning...';
            dom.questionLength.textContent = '0' + getText('symbols');
            dom.searchBtn.disabled = true;
            return;
        }
        const text = q.length > 200 ? q.slice(0, 200) + '...' : q;
        dom.questionText.textContent = text;
        dom.questionLength.textContent = q.length + getText('symbols');
        dom.searchBtn.disabled = q.length < CONFIG.minQuestionLength;
    }

    function autoCheckQuestion() {
        if (!gameDatabase || !currentGame || typeof gameDatabase.extractQuestion !== 'function') return;
        if (document.visibilityState !== 'visible') return;
        try {
            const q = gameDatabase.extractQuestion(currentGame);
            if (q && q !== lastQuestion && q.length >= CONFIG.minQuestionLength) {
                lastQuestion = q;
                currentQuestion = q;
                displayQuestion(q);
            }
        } catch (_) {}
    }

	function detectGame() {
    if (!window.GAME_DATABASE) return null;

    const pageText = document.body ? document.body.innerText.toLowerCase() : "";
    const pageHTML = document.documentElement.innerHTML.toLowerCase();
    const pageTitle = (document.title || "").toLowerCase();

    const metaContent = Array.from(document.querySelectorAll("meta"))
        .map(m => (m.content || "").toLowerCase())
        .join(" ");

    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
        .map(h => h.innerText.toLowerCase())
        .join(" ");

    const altAndTitles = Array.from(document.querySelectorAll("[alt],[title],[aria-label]"))
        .map(el =>
            (el.getAttribute("alt") || "") + " " +
            (el.getAttribute("title") || "") + " " +
            (el.getAttribute("aria-label") || "")
        )
        .join(" ")
        .toLowerCase();

    const dataAttributes = Array.from(document.querySelectorAll("*"))
        .map(el =>
            Array.from(el.attributes)
                .filter(attr => attr.name.startsWith("data-"))
                .map(attr => attr.value)
                .join(" ")
        )
        .join(" ")
        .toLowerCase();

    const fullContent = `
        ${pageTitle}
        ${metaContent}
        ${headings}
        ${altAndTitles}
        ${dataAttributes}
        ${pageText}
        ${pageHTML}
    `;

    let bestMatch = null;
    let bestScore = 0;

    for (const game of window.GAME_DATABASE) {
        if (!game.name) continue;

        const gameName = game.name.toLowerCase();
        let score = 0;

        // Полное совпадение названия
        if (pageTitle.includes(gameName)) score += 50;
        if (headings.includes(gameName)) score += 40;
        if (fullContent.includes(gameName)) score += 25;

        // Частичное совпадение слов
        const words = gameName.split(/\s+/);
        for (const word of words) {
            if (word.length < 3) continue;
            if (fullContent.includes(word)) score += 5;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = game;
        }
    }

    // Порог уверенности
    if (bestScore > 20) {
        confidence++;
        return bestMatch;
    }

    confidence = Math.max(0, confidence - 1);
    return null;
}

    function searchAnswer() {
        if (!gameDatabase || !currentGame || !currentQuestion || typeof gameDatabase.findAnswer !== 'function') {
            updateStatus(getText('detectFirst'), 'warning');
            return;
        }
        updateStatus(getText('scanning'), 'searching');
        try {
            const result = gameDatabase.findAnswer(currentQuestion, currentGame);
            displayQuestion(currentQuestion);
            if (result?.answer) {
                dom.answerText.textContent = result.answer;
                dom.answerBox.classList.remove('not-found');
                dom.answerBox.classList.add('found');
                dom.answerConfidence.textContent = (result.confidence ?? 0) + '%';
                dom.copyBtn.disabled = false;
                updateStatus(getText('answerFound') + (result.confidence ?? 0) + '%)', 'success');
            } else {
                dom.answerText.textContent = getText('answerNotFound');
                dom.answerBox.classList.remove('found');
                dom.answerBox.classList.add('not-found');
                dom.answerConfidence.textContent = '';
                dom.copyBtn.disabled = true;
                updateStatus(getText('answerNotFound'), 'error');
            }
        } catch (_) {
            updateStatus(getText('answerNotFound'), 'error');
        }
    }

    function copyAnswer() {
        const text = dom.answerText?.textContent;
        if (!text || text === getText('answerNotFound')) return;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                updateStatus(getText('copySuccess'), 'success');
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

    function createOverlay() {
        ensureStyle();
        overlayEl = document.createElement('div');
        overlayEl.id = OVERLAY_ID;
        overlayEl.innerHTML = `
            <div class="overlay-background-text" id="game-watermark">WE GO ON AND ON AND ON AND ON AND ON AND ON EVERY TIME SINCE WE LIVE. AND WE STILL LOVE JACKBOX GAMES ALL THE TIME. so...</div>
            <div class="overlay-header">
                <div class="header-left">
                    <span class="overlay-title">${getText('title')}</span>
                    <span class="db-info"><span id="db-version">v0.0</span><span>•</span><span id="db-age">--</span></span>
                </div>
                <div class="overlay-controls">
                    <button class="overlay-btn flag-btn" id="lang-flag-btn">${currentLang === 'ru' ? '🌏' : '🌏︎'}</button>
                    <button class="overlay-btn minimize-btn">_</button>
                    <button class="overlay-btn close-btn">×</button>
                </div>
            </div>
            <div class="overlay-content">
                <div class="game-indicator">
                    <span class="indicator-dot" id="status-dot"></span>
                    <span id="game-name">${getText('notDetected')}</span>
                    <span id="game-confidence"></span>
                </div>
                <div class="question-box">
                    <div class="question-header">
                        <span class="question-label">${getText('questionLabel')}</span>
                        <span id="question-length">0${getText('symbols')}</span>
                    </div>
                    <div class="question-text" id="question-text"></div>
                </div>
                <div class="answer-box" id="answer-box">
                    <div class="answer-header">
                        <span class="answer-label">${getText('answerLabel')}</span>
                        <span id="answer-confidence"></span>
                    </div>
                    <div class="answer-text" id="answer-text"></div>
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
        cacheDom();
        displayQuestion(null);
        dom.detectBtn.onclick = detectGame;
        dom.searchBtn.onclick = searchAnswer;
        dom.copyBtn.onclick = copyAnswer;
        dom.flagBtn.onclick = toggleLanguage;
        overlayEl.querySelector('.close-btn').onclick = () => cleanup();
        overlayEl.querySelector('.minimize-btn').onclick = () => overlayEl.classList.toggle('overlay-minimized');
        enableDrag();
    }

    function enableDrag() {
        const header = overlayEl.querySelector('.overlay-header');
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialX = 0;
        let initialY = 0;
        const move = (e) => {
            if (!isDragging) return;
            overlayEl.style.left = initialX + e.clientX - startX + 'px';
            overlayEl.style.top = initialY + e.clientY - startY + 'px';
            overlayEl.style.right = 'auto';
        };
        const up = () => {
            isDragging = false;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        header.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.overlay-btn')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = overlayEl.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
        });
    }

    function cleanup() {
        if (autoCheckTimer) clearInterval(autoCheckTimer);
        overlayEl?.remove();
    }

    async function init() {
        createOverlay();
        updateStatus(getText('loadingDB'), 'info');
        const loaded = await loadDatabase();
        if (loaded) {
            autoCheckTimer = setInterval(autoCheckQuestion, CONFIG.checkInterval);
            updateStatus(getText('notDetected'), 'info');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
