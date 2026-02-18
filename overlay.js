(function () {
    const OVERLAY_ID = 'game-finder-overlay';
    const STYLE_ID = 'game-finder-overlay-style';

    // Remove existing overlay if present
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();

    // Configuration - adjustable by settings UI
    const CONFIG = {
        databaseURL: 'https://getonjbghelp.github.io/jbg-finder/database.js',
        checkInterval: 2000, // base check interval (ms)
        minQuestionLength: 15,
        defaultLang: 'ru',
        logMaxEntries: 2000, // ring buffer size for logs
        autoThrottleThresholdPerSec: 8, // if questions change faster than this, throttle
        throttleIncreaseStep: 500, // ms to add when throttling
        throttleMax: 10000 // upper bound for throttle
    };

    const LANG = {
        ru: {
            title: 'JBG-Finder BETA',
            detectBtn: '🔍 Определить игру',
            searchBtn: '⚡ Найти ответ',
            copyBtn: '📋 Копировать',
            questionLabel: '📝 ВОПРОС',
            answerLabel: '💡 ОТВЕТ',
            notDetected: 'Не определено',
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
            notEnoughSymbols: 'Вопрос слишком короткий',
            logsTitle: 'Лог событий',
            clearLogs: 'Очистить',
            pauseLogs: 'Пауза',
            resumeLogs: 'Возобновить',
            exportLogs: 'Экспорт',
            logLevel: 'Уровень логов'
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
            notEnoughSymbols: 'Question too short',
            logsTitle: 'Event Logs',
            clearLogs: 'Clear',
            pauseLogs: 'Pause',
            resumeLogs: 'Resume',
            exportLogs: 'Export',
            logLevel: 'Log Level'
        }
    };

    let currentGame = null;
    let currentQuestion = '';
    let lastQuestion = '';
    let gameDatabase = null;
    let currentLang = CONFIG.defaultLang;
    let autoCheckTimer = null;
    let overlayEl = null;

    // Adaptive throttle state
    let dynamicInterval = CONFIG.checkInterval;
    let changeTimestamps = [];

    // DOM cache
    const dom = {};

    // Lightweight logger with ring buffer and batched UI updates
    const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
    let logLevel = 'debug';
    const logs = new Array(CONFIG.logMaxEntries);
    let logStart = 0;
    let logCount = 0;
    let logPaused = false;
    let logNeedsRender = false;

    function getText(key) {
        return (LANG[currentLang] && LANG[currentLang][key]) || (LANG.ru && LANG.ru[key]) || key;
    }

    function pushLog(level, message, meta) {
        if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(logLevel)) return;
        const entry = {
            ts: Date.now(),
            lvl: level,
            msg: String(message),
            meta: meta || null
        };
        // ring buffer push
        const idx = (logStart + logCount) % logs.length;
        logs[idx] = entry;
        if (logCount < logs.length) logCount++; else logStart = (logStart + 1) % logs.length;
        // request UI update (batched)
        if (!logPaused) {
            logNeedsRender = true;
            requestAnimationFrame(renderLogsIfNeeded);
        }
    }

    function renderLogsIfNeeded() {
        if (!logNeedsRender || !dom.logList) return;
        logNeedsRender = false;
        // Build a slice of recent logs (most recent first) limited for UI
        const items = [];
        for (let i = 0; i < Math.min(logCount, 200); i++) {
            const idx = (logStart + logCount - 1 - i + logs.length) % logs.length;
            const e = logs[idx];
            if (!e) continue;
            const time = new Date(e.ts).toLocaleTimeString();
            items.push(`<div class="log-entry log-${e.lvl}"><span class="log-time">${time}</span> <span class="log-lvl">${e.lvl.toUpperCase()}</span> <span class="log-msg">${escapeHtml(e.msg)}</span>${e.meta ? ' <span class="log-meta">' + escapeHtml(JSON.stringify(e.meta)) + '</span>' : ''}</div>`);
        }
        dom.logList.innerHTML = items.join('');
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID} *{box-sizing:border-box!important}
            #${OVERLAY_ID}{position:fixed;top:20px;right:20px;width:620px;max-width:95vw;background:linear-gradient(145deg,#2b2b2b 0%,#1e1e1e 100%);backdrop-filter:blur(8px);border:1px solid #3a3a3a;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.8);z-index:999999;font-family:'Segoe UI',sans-serif;color:#e0e0e0;overflow:hidden;user-select:none}
            .overlay-background-text{position:absolute;top:50%;left:0;transform:translateY(-50%) translateX(100%);font-size:70px;font-weight:900;color:rgba(255,255,255,.04);pointer-events:none;white-space:nowrap;z-index:0;animation:scrollText 28s linear infinite}
            @keyframes scrollText{0%{transform:translateY(-50%) translateX(100%)}100%{transform:translateY(-50%) translateX(-250%)}}
            .overlay-header{display:flex;justify-content:space-between;align-items:center;height:44px;padding:0 8px;background:linear-gradient(135deg,#3a3a3a 0%,#2a2a2a 100%);border-bottom:1px solid #3a3a3a;cursor:move}
            .header-left{display:flex;align-items:center;gap:10px}
            .overlay-title{font-size:14px;font-weight:600;color:#fff}
            .db-info{font-size:11px;color:#9a9a9a;display:flex;align-items:center;gap:6px}
            .overlay-controls{display:flex;height:100%;gap:4px}
            .overlay-btn{width:40px;height:40px;border:none;background:transparent;color:#c0c0c0;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
            .overlay-btn:hover{background:rgba(255,255,255,.04);color:#fff}
            .flag-btn{font-size:18px}
            .overlay-content{padding:12px;position:relative;z-index:10}
            .game-indicator{display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:8px 10px;background:rgba(45,45,45,.6);border:1px solid #3a3a3a}
            .indicator-dot{width:12px;height:12px;border-radius:50%;background:#505050;transition:all .25s ease}
            .indicator-dot.active{background:#4ecdc4;box-shadow:0 0 8px #4ecdc4}
            .question-box,.answer-box{margin-bottom:10px;padding:10px;background:rgba(35,35,35,.75);border:1px solid #3a3a3a}
            .question-box{border-left:3px solid #4ecdc4}
            .answer-box{border-left:3px solid #505050}
            .answer-box.found{border-left-color:#4ecdc4;background:rgba(78,205,196,.04)}
            .answer-box.not-found{border-left-color:#ff6b6b;background:rgba(255,107,107,.04)}
            .question-header,.answer-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
            .question-text,.answer-text{font-size:13px;color:#d0d0d0;line-height:1.4;max-height:120px;overflow:auto;word-break:break-word}
            .answer-text{font-weight:600;color:#fff}
            .answer-box.found .answer-text{color:#4ecdc4}
            .answer-box.not-found .answer-text{color:#ff6b6b}
            .action-buttons{display:flex;gap:8px;margin-bottom:8px}
            .action-btn{flex:1;padding:9px 10px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center}
            .detect-btn{background:linear-gradient(135deg,#4ecdc4 0%,#44a08d 100%);color:#fff}
            .search-btn{background:linear-gradient(135deg,#ff6b6b 0%,#ee5a5a 100%);color:#fff}
            .copy-btn{background:#3a3a3a;color:#c0c0c0;border:1px solid #4a4a4a}
            .action-btn:disabled{opacity:.35;cursor:not-allowed}
            .overlay-status{font-size:11px;color:#9a9a9a;text-align:center;padding-top:8px;border-top:1px solid #3a3a3a;font-family:'Consolas',monospace}
            .overlay-minimized{height:44px;overflow:hidden}
            .overlay-minimized .overlay-content{display:none}

            /* Logs */
            .log-panel{margin-top:10px;padding:8px;background:rgba(28,28,28,.6);border:1px solid #333;border-radius:6px;max-height:220px;overflow:hidden;display:flex;flex-direction:column}
            .log-controls{display:flex;gap:6px;align-items:center;margin-bottom:6px}
            .log-list{flex:1;overflow:auto;padding:6px;background:rgba(0,0,0,0.06);border-radius:4px}
            .log-entry{font-family:monospace;font-size:12px;padding:4px;border-bottom:1px dashed rgba(255,255,255,0.02)}
            .log-time{color:#8a8a8a;margin-right:6px}
            .log-lvl{font-weight:700;margin-right:6px}
            .log-debug{color:#9aa1ff}
            .log-info{color:#c0c0c0}
            .log-warn{color:#ffd93d}
            .log-error{color:#ff6b6b}
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
        // logs
        dom.logPanel = overlayEl.querySelector('#log-panel');
        dom.logList = overlayEl.querySelector('#log-list');
        dom.logLevelSelect = overlayEl.querySelector('#log-level-select');
        dom.clearLogsBtn = overlayEl.querySelector('#clear-logs-btn');
        dom.pauseLogsBtn = overlayEl.querySelector('#pause-logs-btn');
        dom.exportLogsBtn = overlayEl.querySelector('#export-logs-btn');
    }

    function updateStatus(message, type) {
        if (!dom.status) return;
        const colors = {
            info: '#9a9a9a',
            success: '#4ecdc4',
            warning: '#ffd93d',
            error: '#ff6b6b',
            searching: '#ffd93d'
        };
        dom.status.textContent = message;
        try { dom.status.style.color = colors[type] || colors.info; } catch (e) {}
        pushLog(type === 'error' ? 'error' : (type === 'warning' ? 'warn' : 'info'), message);
    }

    async function loadDatabase() {
        pushLog('info', 'Loading database: ' + CONFIG.databaseURL);
        if (window.GameDatabase) {
            gameDatabase = window.GameDatabase;
            updateStatus(getText('dbLoaded'), 'success');
            updateVersionInfo();
            pushLog('info', 'Database available on window.GameDatabase');
            return true;
        }
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = CONFIG.databaseURL + '?t=' + Date.now();
            script.onload = () => {
                try {
                    if (window.GameDatabase) {
                        gameDatabase = window.GameDatabase;
                        updateStatus(getText('dbLoaded'), 'success');
                        updateVersionInfo();
                        pushLog('info', 'Database script loaded');
                        resolve(true);
                    } else {
                        updateStatus(getText('dbError'), 'error');
                        pushLog('error', 'GameDatabase not found after script load');
                        resolve(false);
                    }
                } catch (err) {
                    updateStatus(getText('dbError'), 'error');
                    pushLog('error', 'Exception in script.onload: ' + err.message, {stack: err.stack});
                    resolve(false);
                }
            };
            script.onerror = (e) => {
                updateStatus(getText('dbError'), 'error');
                pushLog('error', 'Script load error', e);
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
            pushLog('debug', 'Version info updated', info);
        } catch (err) {
            pushLog('error', 'Failed to update version info: ' + err.message);
        }
    }

    function updateIndicator(result) {
        try {
            if (!result || !result.gameId || !gameDatabase?.gameConfig?.[result.gameId]) {
                currentGame = null;
                if (dom.statusDot) dom.statusDot.className = 'indicator-dot';
                if (dom.gameName) dom.gameName.textContent = getText('notDetected');
                if (dom.gameConfidence) dom.gameConfidence.textContent = '';
                if (dom.watermark) dom.watermark.textContent = getText('notDetected');
                return;
            }
            const config = gameDatabase.gameConfig[result.gameId] || {};
            currentGame = result.gameId;
            if (dom.statusDot) dom.statusDot.className = 'indicator-dot active';
            if (dom.gameName) dom.gameName.textContent = config.name || getText('notDetected');
            if (dom.gameConfidence) dom.gameConfidence.textContent = (result.confidence ?? 0) + '%';
            if (dom.watermark) dom.watermark.textContent = (config.name || '').toUpperCase();
            pushLog('info', `Detected game: ${config.name || result.gameId}`, {gameId: result.gameId, confidence: result.confidence});
        } catch (err) {
            pushLog('error', 'updateIndicator failed: ' + err.message);
        }
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
        const text = q.length > 300 ? q.slice(0, 300) + '...' : q;
        dom.questionText.textContent = text;
        dom.questionLength.textContent = q.length + getText('symbols');
        dom.searchBtn.disabled = !(q.length >= CONFIG.minQuestionLength);
    }

    // Avoid overlapping checks
    let isChecking = false;

    async function autoCheckQuestion() {
        if (!gameDatabase || !currentGame || typeof gameDatabase.extractQuestion !== 'function') return;
        if (document.visibilityState !== 'visible') return;
        if (isChecking) return; // skip if previous check is running

        isChecking = true;
        try {
            const q = await safeCall(() => gameDatabase.extractQuestion(currentGame));
            if (q && q !== lastQuestion) {
                // record timestamp for adaptive throttling
                const now = Date.now();
                changeTimestamps.push(now);
                // keep last second's timestamps
                const cutoff = now - 1000;
                changeTimestamps = changeTimestamps.filter(t => t >= cutoff);
                // adaptive throttle: if many changes in last second, increase interval
                if (changeTimestamps.length > CONFIG.autoThrottleThresholdPerSec) {
                    dynamicInterval = Math.min(dynamicInterval + CONFIG.throttleIncreaseStep, CONFIG.throttleMax);
                    pushLog('warn', 'High change rate detected, increasing check interval to ' + dynamicInterval + ' ms');
                    resetAutoCheckTimer(dynamicInterval);
                } else if (dynamicInterval > CONFIG.checkInterval && changeTimestamps.length === 0) {
                    // slow down back to base
                    dynamicInterval = CONFIG.checkInterval;
                    resetAutoCheckTimer(dynamicInterval);
                }

                lastQuestion = q;
                currentQuestion = q;
                displayQuestion(q);
                pushLog('debug', 'Auto-extracted question', {len: q.length});
            }
        } catch (err) {
            pushLog('error', 'autoCheckQuestion failed: ' + err.message, {stack: err.stack});
        } finally {
            isChecking = false;
        }
    }

    function resetAutoCheckTimer(interval) {
        if (autoCheckTimer) clearInterval(autoCheckTimer);
        autoCheckTimer = setInterval(autoCheckQuestion, interval);
    }

    // Generic safeCall wrapper to catch exceptions from external DB
    function safeCall(fn) {
        return new Promise((resolve) => {
            try {
                const r = fn();
                // handle both sync and promise
                if (r && typeof r.then === 'function') {
                    r.then(resolve).catch((e) => { pushLog('error', 'safeCall async error: ' + e?.message || e); resolve(null); });
                } else {
                    resolve(r);
                }
            } catch (e) {
                pushLog('error', 'safeCall sync error: ' + e?.message || e);
                resolve(null);
            }
        });
    }

    async function detectGame() {
        if (!gameDatabase || typeof gameDatabase.detectGame !== 'function') {
            updateStatus(getText('dbError'), 'error');
            pushLog('error', 'detectGame called but no detectGame function');
            return;
        }
        updateStatus(getText('scanning'), 'searching');
        const result = await safeCall(() => gameDatabase.detectGame());
        if (!result) {
            updateStatus(getText('detectFirst'), 'warning');
            displayQuestion(null);
            return;
        }
        try {
            updateIndicator(result);
            if (result?.gameId) {
                const name = gameDatabase.gameConfig?.[result.gameId]?.name || getText('notDetected');
                updateStatus(getText('gameDetected') + name, 'success');
                if (typeof gameDatabase.extractQuestion === 'function') {
                    const q = await safeCall(() => gameDatabase.extractQuestion(result.gameId));
                    if (q) {
                        currentQuestion = q;
                        lastQuestion = q;
                        displayQuestion(q);
                    }
                }
            } else {
                updateStatus(getText('detectFirst'), 'warning');
                displayQuestion(null);
            }
        } catch (err) {
            updateStatus(getText('dbError'), 'error');
            pushLog('error', 'detectGame processing error: ' + err.message);
        }
    }

    async function searchAnswer() {
        if (!gameDatabase || !currentGame || !currentQuestion || typeof gameDatabase.findAnswer !== 'function') {
            updateStatus(getText('detectFirst'), 'warning');
            pushLog('warn', 'searchAnswer called but requirements not met', {currentGame, currentQuestion});
            return;
        }
        updateStatus(getText('scanning'), 'searching');
        const result = await safeCall(() => gameDatabase.findAnswer(currentQuestion, currentGame));
        displayQuestion(currentQuestion);
        try {
            if (result?.answer) {
                dom.answerText.textContent = result.answer;
                dom.answerBox.classList.remove('not-found');
                dom.answerBox.classList.add('found');
                if (dom.answerConfidence) dom.answerConfidence.textContent = (result.confidence ?? 0) + '%';
                dom.copyBtn.disabled = false;
                updateStatus(getText('answerFound') + (result.confidence ?? 0) + '%)', 'success');
                pushLog('info', 'Answer found', {confidence: result.confidence});
            } else {
                dom.answerText.textContent = getText('answerNotFound');
                dom.answerBox.classList.remove('found');
                dom.answerBox.classList.add('not-found');
                if (dom.answerConfidence) dom.answerConfidence.textContent = '';
                dom.copyBtn.disabled = true;
                updateStatus(getText('answerNotFound'), 'error');
                pushLog('info', 'Answer not found for question', {len: currentQuestion.length});
            }
        } catch (err) {
            updateStatus(getText('answerNotFound'), 'error');
            pushLog('error', 'searchAnswer display error: ' + err.message);
        }
    }

    function copyAnswer() {
        const text = dom.answerText?.textContent;
        if (!text || text === getText('answerNotFound')) return;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                updateStatus(getText('copySuccess'), 'success');
                pushLog('info', 'Answer copied to clipboard');
            }).catch((e) => {
                // fallback
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            updateStatus(getText('copySuccess'), 'success');
            pushLog('info', 'Answer copied via fallback');
        } catch (err) {
            pushLog('error', 'Copy failed: ' + err.message);
        }
    }

    function toggleLanguage() {
        currentLang = currentLang === 'ru' ? 'en' : 'ru';
        updateTexts();
        updateVersionInfo();
    }

    function updateTexts() {
        const titleEl = overlayEl.querySelector('.overlay-title');
        if (titleEl) titleEl.textContent = getText('title');
        if (dom.detectBtn) dom.detectBtn.textContent = getText('detectBtn');
        if (dom.searchBtn) dom.searchBtn.textContent = getText('searchBtn');
        if (dom.copyBtn) dom.copyBtn.textContent = getText('copyBtn');
        const qLabel = overlayEl.querySelector('.question-label');
        if (qLabel) qLabel.textContent = getText('questionLabel');
        const aLabel = overlayEl.querySelector('.answer-label');
        if (aLabel) aLabel.textContent = getText('answerLabel');
        if (dom.pauseLogsBtn) dom.pauseLogsBtn.textContent = logPaused ? getText('resumeLogs') : getText('pauseLogs');
    }

    function createOverlay() {
        ensureStyle();
        overlayEl = document.createElement('div');
        overlayEl.id = OVERLAY_ID;
        overlayEl.innerHTML = `
            <div class="overlay-background-text" id="game-watermark">WE GO ON AND ON AND ON AND ON EVERY TIME SINCE WE LIVE.</div>
            <div class="overlay-header">
                <div class="header-left">
                    <span class="overlay-title">${getText('title')}</span>
                    <span class="db-info"><span id="db-version">v0.0</span><span>•</span><span id="db-age">--</span></span>
                </div>
                <div class="overlay-controls">
                    <button class="overlay-btn flag-btn" id="lang-flag-btn">${currentLang === 'ru' ? '🌏' : '🌏'}</button>
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

                <!-- Log panel: batched, lightweight -->
                <div class="log-panel" id="log-panel">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <strong>${getText('logsTitle')}</strong>
                        <div style="display:flex;gap:6px;align-items:center">
                            <select id="log-level-select" title="${getText('logLevel')}">
                                <option value="debug">DEBUG</option>
                                <option value="info">INFO</option>
                                <option value="warn">WARN</option>
                                <option value="error">ERROR</option>
                            </select>
                            <button class="action-btn copy-btn" id="clear-logs-btn" style="padding:6px 8px">${getText('clearLogs')}</button>
                            <button class="action-btn copy-btn" id="pause-logs-btn" style="padding:6px 8px">${getText('pauseLogs')}</button>
                            <button class="action-btn copy-btn" id="export-logs-btn" style="padding:6px 8px">${getText('exportLogs')}</button>
                        </div>
                    </div>
                    <div class="log-list" id="log-list"></div>
                </div>

                <div class="overlay-status" id="overlay-status"></div>
            </div>
        `;
        document.body.appendChild(overlayEl);
        cacheDom();
        displayQuestion(null);

        // wire up events
        dom.detectBtn.onclick = detectGame;
        dom.searchBtn.onclick = searchAnswer;
        dom.copyBtn.onclick = copyAnswer;
        dom.flagBtn.onclick = toggleLanguage;
        overlayEl.querySelector('.close-btn').onclick = () => cleanup();
        overlayEl.querySelector('.minimize-btn').onclick = () => overlayEl.classList.toggle('overlay-minimized');
        enableDrag();

        // logs controls
        if (dom.logLevelSelect) dom.logLevelSelect.onchange = (e) => { logLevel = e.target.value; pushLog('info', 'Log level set to ' + logLevel); };
        if (dom.clearLogsBtn) dom.clearLogsBtn.onclick = () => { logStart = 0; logCount = 0; if (dom.logList) dom.logList.innerHTML = ''; pushLog('info', 'Logs cleared'); };
        if (dom.pauseLogsBtn) dom.pauseLogsBtn.onclick = () => { logPaused = !logPaused; dom.pauseLogsBtn.textContent = logPaused ? getText('resumeLogs') : getText('pauseLogs'); pushLog('info', logPaused ? 'Logs paused' : 'Logs resumed'); };
        if (dom.exportLogsBtn) dom.exportLogsBtn.onclick = exportLogs;
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
        pushLog('info', 'Overlay removed');
    }

    function exportLogs() {
        // export all logs as JSON
        const data = [];
        for (let i = 0; i < logCount; i++) {
            const idx = (logStart + i) % logs.length;
            const e = logs[idx];
            if (e) data.push(e);
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jbg_finder_logs_' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        pushLog('info', 'Logs exported', {count: data.length});
    }

    async function init() {
        createOverlay();
        updateStatus(getText('loadingDB'), 'info');
        const loaded = await loadDatabase();
        if (loaded) {
            autoCheckTimer = setInterval(autoCheckQuestion, dynamicInterval);
            updateStatus(getText('notDetected'), 'info');
            pushLog('info', 'Auto-check started with interval ' + dynamicInterval + ' ms');
        }
    }

    // small helper: render logs on interval if needed (in case requestAnimationFrame misses)
    setInterval(() => { if (logNeedsRender) renderLogsIfNeeded(); }, 800);

    // start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
