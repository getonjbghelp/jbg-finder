(function () {
    const OVERLAY_ID = 'game-finder-overlay';
    const STYLE_ID = 'game-finder-overlay-style';

    // Logging
    const LOG_PREFIX = '[JBG-Finder]';
    const LOG_ENABLED = true;
    function log(...a){ if(LOG_ENABLED) console.log(LOG_PREFIX, ...a); }
    function logError(...a){ if(LOG_ENABLED) console.error(LOG_PREFIX, ...a); }
    function logWarn(...a){ if(LOG_ENABLED) console.warn(LOG_PREFIX, ...a); }
    function logDebug(...a){ if(LOG_ENABLED) console.debug(LOG_PREFIX, ...a); }

    // Remove existing overlay
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();

    const CONFIG = {
        databaseURL: "https://getonjbghelp.github.io/jbg-finder/database.js",
        minQuestionLength: 15,
        defaultLang: 'en',
        loadTimeout: 10000,
        retryAttempts: 3
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
            indicators: 'индикаторов'
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
            indicators: 'indicators'
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

    // --- Styles ---
    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            /* compact styles kept from previous UI */
            #${OVERLAY_ID}{position:fixed;top:20px;right:20px;width:600px;max-width:95vw;background:#1e1e1e;border:1px solid #3a3a3a;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.8);z-index:999999;color:#e0e0e0;font-family:Segoe UI, sans-serif}
            .overlay-header{display:flex;justify-content:space-between;align-items:center;height:45px;padding:0 10px;background:#2a2a2a;border-bottom:1px solid #3a3a3a;cursor:move}
            .overlay-title{font-size:15px;font-weight:600}
            .overlay-content{padding:16px}
            .question-box,.answer-box{margin-bottom:14px;padding:14px;background:rgba(35,35,35,.75);border-radius:6px;border:1px solid #3a3a3a}
            .question-box{border-left:4px solid #4ecdc4}
            .answer-box{border-left:4px solid #505050}
            .answer-box.found{border-left-color:#4ecdc4;background:rgba(78,205,196,.06)}
            .answer-box.not-found{border-left-color:#ff6b6b;background:rgba(255,107,107,.06)}
            .question-text,.answer-text{font-size:14px;color:#d0d0d0;line-height:1.6;max-height:140px;overflow:auto;word-break:break-word}
            .action-buttons{display:flex;gap:10px;margin-bottom:14px}
            .action-btn{flex:1;padding:12px;border-radius:6px;border:none;cursor:pointer;font-weight:600}
            .detect-btn{background:linear-gradient(135deg,#4ecdc4,#44a08d);color:#fff}
            .search-btn{background:linear-gradient(135deg,#ff6b6b,#ee5a5a);color:#fff}
            .copy-btn{background:#3a3a3a;color:#c0c0c0;border:1px solid #4a4a4a}
            .overlay-status{font-size:11px;color:#606060;text-align:center;padding-top:10px;border-top:1px solid #3a3a3a;font-family:Consolas,monospace}
        `;
        document.head.appendChild(style);
    }

    // --- DOM cache ---
    function cacheDom() {
        if (!overlayEl) return;
        dom.status = overlayEl.querySelector('#overlay-status');
        dom.detectBtn = overlayEl.querySelector('#detect-btn');
        dom.searchBtn = overlayEl.querySelector('#search-btn');
        dom.copyBtn = overlayEl.querySelector('#copy-btn');
        dom.questionText = overlayEl.querySelector('#question-text');
        dom.questionLength = overlayEl.querySelector('#question-length');
        dom.answerText = overlayEl.querySelector('#answer-text');
        dom.answerBox = overlayEl.querySelector('#answer-box');
        dom.answerConfidence = overlayEl.querySelector('#answer-confidence');
        dom.statusDot = overlayEl.querySelector('#status-dot');
        dom.gameName = overlayEl.querySelector('#game-name');
        dom.dbVersion = overlayEl.querySelector('#db-version');
        dom.dbAge = overlayEl.querySelector('#db-age');
        dom.dbStatus = overlayEl.querySelector('#db-status');
    }

    function updateStatus(message, type) {
        if (!dom.status) return;
        const colors = { info:'#606060', success:'#4ecdc4', warning:'#ffd93d', error:'#ff6b6b', searching:'#ffd93d' };
        dom.status.textContent = message;
        dom.status.style.color = colors[type] || colors.info;
    }

    function updateDBStatus(loaded) {
        if (!dom.dbStatus) return;
        dom.dbStatus.textContent = loaded ? '✓' : '✗';
        dom.dbStatus.className = 'db-status ' + (loaded ? 'loaded' : 'error');
    }

    // --- Load database script ---
    async function loadDatabase() {
        log('loadDatabase attempt', dbLoadAttempts + 1);
        if (window.GameDatabase) {
            gameDatabase = window.GameDatabase;
            isDatabaseLoaded = true;
            updateStatus(getText('dbLoaded'), 'success');
            updateDBStatus(true);
            try { updateVersionInfo(); } catch (e) {}
            return true;
        }
        dbLoadAttempts++;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = CONFIG.databaseURL + '?t=' + Date.now();
            script.async = true;
            const timeout = setTimeout(() => {
                logError('DB load timeout');
                script.remove();
                updateStatus(getText('dbError') + ' (Timeout)', 'error');
                updateDBStatus(false);
                resolve(false);
            }, CONFIG.loadTimeout);

            script.onload = () => {
                clearTimeout(timeout);
                if (window.GameDatabase) {
                    gameDatabase = window.GameDatabase;
                    isDatabaseLoaded = true;
                    updateStatus(getText('dbLoaded'), 'success');
                    updateDBStatus(true);
                    try { updateVersionInfo(); } catch (e) {}
                    resolve(true);
                } else {
                    logError('GameDatabase not found after load');
                    updateStatus(getText('dbError') + ' (DB not initialized)', 'error');
                    updateDBStatus(false);
                    if (dbLoadAttempts < CONFIG.retryAttempts) {
                        setTimeout(() => loadDatabase().then(resolve), 1000);
                    } else resolve(false);
                }
            };
            script.onerror = (e) => {
                clearTimeout(timeout);
                logError('DB script error', e);
                updateStatus(getText('dbError') + ' (Network)', 'error');
                updateDBStatus(false);
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
                dom.dbAge.textContent = days === 0 ? (currentLang === 'ru' ? 'сегодня' : 'today') : days + 'd';
                dom.dbAge.style.color = info.isOutdated ? '#ff6b6b' : '#4ecdc4';
            }
        } catch (e) {
            logError('updateVersionInfo error', e);
        }
    }

    // Safe local normalization (display only)
    function safeNormalize(text) {
        if (!text || typeof text !== 'string') return '';
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0400-\u04FF\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // createOverlay (UI only)
    function createOverlay() {
        if (overlayEl) return;
        ensureStyle();

        overlayEl = document.createElement('div');
        overlayEl.id = OVERLAY_ID;
        overlayEl.innerHTML = `
            <div class="overlay-header">
                <div class="overlay-title">${getText('title')}</div>
                <div style="display:flex;align-items:center;gap:8px">
                    <div id="db-version" style="font-size:12px">v?</div>
                    <div id="db-age" style="font-size:12px">?</div>
                    <div id="db-status" class="db-status">✗</div>
                </div>
            </div>
            <div class="overlay-content">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                    <div id="status-dot" style="width:12px;height:12px;border-radius:50%;background:#505050"></div>
                    <div style="flex:1">
                        <div id="game-name">${getText('notDetected')}</div>
                        <div id="game-confidence" style="font-size:11px;color:#888"></div>
                    </div>
                </div>

                <div class="question-box">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <div style="font-weight:700">${getText('questionLabel')}</div>
                        <div id="question-length" style="font-size:12px;color:#888">0 ${getText('symbols')}</div>
                    </div>
                    <div id="question-text" class="question-text">${getText('notDetected')}</div>
                </div>

                <div class="action-buttons">
                    <button id="detect-btn" class="action-btn detect-btn">${getText('detectBtn')}</button>
                    <button id="search-btn" class="action-btn search-btn" disabled>${getText('searchBtn')}</button>
                    <button id="copy-btn" class="action-btn copy-btn" disabled>${getText('copyBtn')}</button>
                </div>

                <div id="answer-box" class="answer-box">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <div style="font-weight:700">${getText('answerLabel')}</div>
                        <div id="answer-confidence" style="font-size:12px;color:#888"></div>
                    </div>
                    <div id="answer-text" class="answer-text">${getText('answerNotFound')}</div>
                </div>

                <div id="overlay-status" class="overlay-status">${getText('loadingDB')}</div>
            </div>
        `;
        document.body.appendChild(overlayEl);
        cacheDom();

        // init buttons
        if (dom.searchBtn) dom.searchBtn.disabled = true;
        if (dom.copyBtn) dom.copyBtn.disabled = true;

        if (dom.detectBtn) {
            dom.detectBtn.addEventListener('click', async () => {
                try {
                    dom.detectBtn.disabled = true;
                    updateStatus(getText('scanning'), 'searching');
                    await detectGame();
                } finally {
                    dom.detectBtn.disabled = false;
                }
            });
        }

        if (dom.searchBtn) {
            dom.searchBtn.addEventListener('click', () => {
                dom.searchBtn.disabled = true;
                try { searchAnswer(); }
                finally { setTimeout(()=> { dom.searchBtn.disabled = false; }, 250); }
            });
        }

        if (dom.copyBtn) {
            dom.copyBtn.addEventListener('click', () => {
                try {
                    const text = dom.answerText ? dom.answerText.textContent : '';
                    if (!text) return;
                    if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(text).then(()=> updateStatus(getText('copySuccess'), 'success')).catch(()=> {});
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = text; document.body.appendChild(ta); ta.select();
                        document.execCommand('copy'); ta.remove(); updateStatus(getText('copySuccess'), 'success');
                    }
                } catch (e) { logError('copy failed', e); }
            });
        }

        // simple draggable
        (function makeDraggable(){
            const header = overlayEl.querySelector('.overlay-header');
            if (!header) return;
            let dragging=false, sx=0, sy=0, ox=0, oy=0;
            header.addEventListener('mousedown', (e)=> {
                dragging=true; sx=e.clientX; sy=e.clientY;
                const r = overlayEl.getBoundingClientRect(); ox=r.left; oy=r.top;
                document.body.style.userSelect='none';
            });
            window.addEventListener('mousemove', (e)=> {
                if (!dragging) return;
                const dx=e.clientX-sx, dy=e.clientY-sy;
                overlayEl.style.left=(ox+dx)+'px'; overlayEl.style.top=(oy+dy)+'px';
                overlayEl.style.position='fixed'; overlayEl.style.right='auto';
            });
            window.addEventListener('mouseup', ()=> { dragging=false; document.body.style.userSelect=''; });
        })();

    }

    // detectGame: calls DB.detectGame and extractQuestion (DB responsibility)
    function detectGame() {
        if (!isDatabaseLoaded || !gameDatabase || typeof gameDatabase.detectGame !== 'function') {
            updateStatus(getText('dbError'), 'error');
            return null;
        }

        updateStatus(getText('scanning'), 'searching');

        try {
            const res = gameDatabase.detectGame();
            logDebug('detectGame ->', res);
            if (res && res.gameId && gameDatabase.gameConfig?.[res.gameId]) {
                // update UI indicator
                updateIndicator(res);

                // extract question via DB API (DB should implement extractQuestion)
                setTimeout(()=> {
                    try {
                        let rawQ = null;
                        if (typeof gameDatabase.extractQuestion === 'function') rawQ = gameDatabase.extractQuestion(res.gameId);
                        if (rawQ && typeof rawQ === 'string' && rawQ.length >= CONFIG.minQuestionLength) {
                            currentQuestion = rawQ.trim();
                            displayQuestion(currentQuestion);
                            dom.searchBtn.disabled = false;
                        } else {
                            currentQuestion = '';
                            displayQuestion(null);
                            dom.searchBtn.disabled = true;
                        }
                    } catch (e) {
                        logError('extractQuestion error', e);
                        currentQuestion = '';
                        displayQuestion(null);
                        dom.searchBtn.disabled = true;
                    }
                }, 200);
            } else {
                updateStatus(getText('notDetected'), 'warning');
                currentGame = null;
                currentQuestion = '';
                displayQuestion(null);
                dom.searchBtn.disabled = true;
            }
            // set currentGame
            currentGame = res?.gameId || null;
            return res;
        } catch (e) {
            logError('detectGame error', e);
            updateStatus(getText('dbError') + ': ' + (e.message || e), 'error');
            return null;
        }
    }

    function updateIndicator(result) {
        if (!result || !result.gameId || !gameDatabase?.gameConfig?.[result.gameId]) {
            if (dom.statusDot) dom.statusDot.style.background = '#505050';
            if (dom.gameName) dom.gameName.textContent = getText('notDetected');
            return;
        }
        const cfg = gameDatabase.gameConfig[result.gameId];
        if (dom.statusDot) dom.statusDot.style.background = '#4ecdc4';
        if (dom.gameName) dom.gameName.textContent = cfg.name || result.gameId;
    }

    function displayQuestion(q) {
        if (!dom.questionText || !dom.questionLength) return;
        if (!q) {
            dom.questionText.textContent = getText('notDetected');
            dom.questionLength.textContent = '0 ' + getText('symbols');
            return;
        }
        const trimmed = q.trim();
        dom.questionText.textContent = trimmed.length > 300 ? trimmed.slice(0,300) + '...' : trimmed;
        dom.questionLength.textContent = trimmed.length + getText('symbols');
    }

    // searchAnswer: purely calls DB.findAnswer
    function searchAnswer() {
        if (!isDatabaseLoaded || !gameDatabase) {
            updateStatus(getText('dbError'), 'error');
            return;
        }
        if (!currentGame || !currentQuestion) {
            updateStatus(getText('detectFirst'), 'warning');
            return;
        }
        if (typeof gameDatabase.findAnswer !== 'function') {
            updateStatus(getText('dbError'), 'error');
            logError('GameDatabase.findAnswer is missing');
            return;
        }

        updateStatus(getText('scanning'), 'searching');

        try {
            const res = gameDatabase.findAnswer(currentQuestion, currentGame);
            logDebug('DB.findAnswer ->', res);
            if (res && res.answer) {
                dom.answerText.textContent = res.answer;
                dom.answerBox.classList.remove('not-found');
                dom.answerBox.classList.add('found');
                if (dom.answerConfidence) dom.answerConfidence.textContent = (res.confidence ?? 0) + '%';
                if (dom.copyBtn) dom.copyBtn.disabled = false;
                updateStatus(getText('answerFound') + (res.confidence ?? 0) + '%)', 'success');
            } else {
                dom.answerText.textContent = getText('answerNotFound');
                dom.answerBox.classList.remove('found');
                dom.answerBox.classList.add('not-found');
                if (dom.answerConfidence) dom.answerConfidence.textContent = '';
                if (dom.copyBtn) dom.copyBtn.disabled = true;
                updateStatus(getText('answerNotFound'), 'error');
            }
        } catch (e) {
            logError('searchAnswer error', e);
            updateStatus(getText('dbError') + ': ' + (e.message || e), 'error');
        }
    }

    // init
    async function init() {
        log('Initializing overlay...');
        createOverlay();
        updateStatus(getText('loadingDB'), 'info');

        const loaded = await loadDatabase();
        if (loaded) {
            isDatabaseLoaded = true;
            updateStatus(getText('notDetected'), 'info');
            updateDBStatus(true);
            updateVersionInfo();
            log('DB loaded and ready');
        } else {
            isDatabaseLoaded = false;
            updateDBStatus(false);
            updateStatus(getText('dbError'), 'error');
            logError('Database failed to load');
        }
    }

    // start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // expose nothing global
    log('Overlay loaded');
})();
