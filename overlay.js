(function () {
    /*
     Final robust overlay optimized for provided GameDatabase structure.
     - Tailored to DB exported in database.js (detectGame(), extractQuestion(gameId), findAnswer(question, gameId), getVersionInfo())
     - Strong defensive checks so overlay won't throw when DB or DOM is unexpected
     - Compact, de-duplicating logs + collapse/expand
     - Adaptive auto-check throttling
    */

    const OVERLAY_ID = 'game-finder-overlay';
    const STYLE_ID = 'game-finder-overlay-style';

    // remove any previous overlay
    const prev = document.getElementById(OVERLAY_ID);
    if (prev) prev.remove();

    const CONFIG = {
        databaseURL: 'https://getonjbghelp.github.io/jbg-finder/database.js',
        baseInterval: 2000,
        minQuestionLength: 15,
        defaultLang: 'ru',
        maxRenderLogs: 200,
        logMaxEntries: 2000,
        throttleThresholdPerSec: 8,
        throttleStepMs: 500,
        throttleMaxMs: 10000
    };

    const LANG = {
        ru: {
            title: 'JBG-Finder', detectBtn: '🔍 Определить игру', searchBtn: '⚡ Найти ответ', copyBtn: '📋 Копировать',
            questionLabel: '📝 ВОПРОС', answerLabel: '💡 ОТВЕТ', notDetected: 'Не определено', scanning: 'Сканирование...',
            gameDetected: 'Игра: ', answerFound: 'Ответ найден! (', answerNotFound: 'Ответ не найден', copySuccess: 'Скопировано!',
            detectFirst: 'Сначала определите игру', loadingDB: 'Загрузка базы...', dbLoaded: 'База загружена ✓', dbError: 'Ошибка загрузки базы',
            symbols: ' символов', logsTitle: 'Логи', clearLogs: 'Очистить', pauseLogs: 'Пауза', resumeLogs: 'Возобновить', exportLogs: 'Экспорт',
            collapseLogs: 'Свернуть логи', expandLogs: 'Развернуть логи'
        },
        en: {
            title: 'JBG-Finder', detectBtn: '🔍 Detect Game', searchBtn: '⚡ Find Answer', copyBtn: '📋 Copy',
            questionLabel: '📝 QUESTION', answerLabel: '💡 ANSWER', notDetected: 'Not detected', scanning: 'Scanning...',
            gameDetected: 'Game: ', answerFound: 'Answer found! (', answerNotFound: 'Answer not found', copySuccess: 'Copied!',
            detectFirst: 'Detect game first', loadingDB: 'Loading DB...', dbLoaded: 'Database loaded ✓', dbError: 'DB load error',
            symbols: ' symbols', logsTitle: 'Logs', clearLogs: 'Clear', pauseLogs: 'Pause', resumeLogs: 'Resume', exportLogs: 'Export',
            collapseLogs: 'Collapse logs', expandLogs: 'Expand logs'
        }
    };

    // state
    let currentLang = CONFIG.defaultLang;
    let overlayEl = null;
    let dom = {};
    let gameDatabase = window.GameDatabase || null;
    let currentGame = null;
    let currentQuestion = null;

    // auto-check state
    let checkTimer = null;
    let dynamicInterval = CONFIG.baseInterval;
    let recentChanges = [];
    let isChecking = false;

    // logger ring buffer
    const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
    let logLevel = 'debug';
    const logs = new Array(CONFIG.logMaxEntries);
    let logStart = 0, logCount = 0;
    let logPaused = false;
    let logCollapsed = false;
    let logNeedsRender = false;

    // dedupe map to compress repeated messages
    const dedupe = new Map();

    // helpers
    function nowTs() { return Date.now(); }
    function fmtTime(ts) { try { return new Date(ts).toLocaleTimeString(); } catch { return String(ts); } }

    function pushLog(level, msg, meta) {
        try {
            if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(logLevel)) return;
            const key = level + '::' + msg;
            const ts = nowTs();
            const prev = dedupe.get(key) || { ts: 0, count: 0 };
            if (ts - prev.ts < 1500) {
                // increment suppressed counter on last stored entry if same as most recent
                if (logCount > 0) {
                    const idx = (logStart + logCount - 1) % logs.length;
                    const last = logs[idx];
                    if (last && last.msg === msg && last.lvl === level) {
                        last.meta = last.meta || {};
                        last.meta.suppressed = (last.meta.suppressed || 0) + 1;
                        last.ts = ts;
                        dedupe.set(key, { ts, count: prev.count + 1 });
                        if (!logPaused && !logCollapsed) { logNeedsRender = true; requestAnimationFrame(renderLogsIfNeeded); }
                        return;
                    }
                }
            } else {
                dedupe.set(key, { ts, count: 0 });
            }

            const entry = { ts, lvl: level, msg: String(msg), meta: meta || null };
            const idx = (logStart + logCount) % logs.length;
            logs[idx] = entry;
            if (logCount < logs.length) logCount++; else logStart = (logStart + 1) % logs.length;
            if (!logPaused && !logCollapsed) { logNeedsRender = true; requestAnimationFrame(renderLogsIfNeeded); }
            else updateLogSummary();
        } catch (e) { console.error('pushLog err', e); }
    }

    function renderLogsIfNeeded() {
        if (!logNeedsRender || !dom.logList) return;
        logNeedsRender = false;
        if (logCollapsed) { updateLogSummary(); return; }
        const items = [];
        const limit = Math.min(logCount, CONFIG.maxRenderLogs);
        for (let i = 0; i < limit; i++) {
            const idx = (logStart + logCount - 1 - i + logs.length) % logs.length;
            const e = logs[idx];
            if (!e) continue;
            const t = fmtTime(e.ts);
            const suppressed = e.meta && e.meta.suppressed ? `<span class="log-suppressed">(x${e.meta.suppressed + 1})</span>` : '';
            const meta = e.meta ? `<span class="log-meta">${escapeHtml(JSON.stringify(e.meta))}</span>` : '';
            items.push(`<div class="log-entry log-${e.lvl}"><span class="log-time">${t}</span> <span class="log-lvl">${e.lvl.toUpperCase()}</span> <span class="log-msg">${escapeHtml(e.msg)}</span>${suppressed}${meta}</div>`);
        }
        dom.logList.innerHTML = items.join('');
        updateLogSummary();
    }

    function updateLogSummary() {
        if (!dom.logSummary) return;
        const paused = logPaused ? ' (paused)' : '';
        dom.logSummary.textContent = `${logCount} ${getText('logsTitle')}${paused}`;
    }

    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

    function getText(k) { return (LANG[currentLang] && LANG[currentLang][k]) || LANG['ru'][k] || k; }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID} *{box-sizing:border-box!important}
            #${OVERLAY_ID}{position:fixed;top:20px;right:20px;width:640px;max-width:95vw;background:linear-gradient(145deg,#2b2b2b,#1e1e1e);border:1px solid #333;border-radius:8px;z-index:999999;font-family:Inter,Segoe UI,Arial;color:#e6e6e6}
            .overlay-header{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#2f2f2f;border-bottom:1px solid #333}
            .overlay-title{font-weight:700}
            .overlay-controls{display:flex;gap:6px}
            .overlay-btn{background:transparent;border:none;color:inherit;cursor:pointer;padding:6px}
            .overlay-content{padding:10px}
            .game-indicator{display:flex;gap:8px;align-items:center;margin-bottom:8px}
            .indicator-dot{width:12px;height:12px;border-radius:50%;background:#666}
            .indicator-dot.active{background:#4ecdc4;box-shadow:0 0 8px #4ecdc4}
            .question-box,.answer-box{padding:8px;margin-bottom:8px;background:#232323;border:1px solid #333;border-radius:6px}
            .question-text,.answer-text{max-height:120px;overflow:auto}
            .action-buttons{display:flex;gap:8px;margin-bottom:8px}
            .action-btn{flex:1;padding:8px;border-radius:6px;border:none;cursor:pointer}
            .detect-btn{background:#4ecdc4;color:#05292b}
            .search-btn{background:#ff6b6b;color:#300}
            .copy-btn{background:#3a3a3a;color:#e6e6e6}

            /* logs */
            .log-panel{margin-top:8px;background:#151515;border:1px solid #2a2a2a;border-radius:6px;padding:8px;max-height:260px;overflow:hidden}
            .log-panel.collapsed{max-height:36px}
            .log-list{overflow:auto;padding:6px;background:rgba(255,255,255,0.02);border-radius:4px;max-height:180px}
            .log-entry{font-family:monospace;font-size:12px;padding:4px;border-bottom:1px dashed rgba(255,255,255,0.02)}
            .log-time{color:#8a8a8a;margin-right:6px}
            .log-lvl{font-weight:700;margin-right:6px}
            .log-debug{color:#9aa1ff}
            .log-info{color:#c0c0c0}
            .log-warn{color:#ffd93d}
            .log-error{color:#ff6b6b}
            .log-suppressed{color:#999;margin-left:6px}
            .log-meta{color:#8a8a8a;margin-left:6px}
            .log-summary{font-size:12px;color:#9a9a9a;margin-left:8px}
        `;
        document.head.appendChild(style);
    }

    function buildDOM() {
        ensureStyle();
        overlayEl = document.createElement('div');
        overlayEl.id = OVERLAY_ID;
        overlayEl.innerHTML = `
            <div class="overlay-header">
                <div><span class="overlay-title">${getText('title')}</span> <small id="db-version">v?</small> <small id="db-age">--</small></div>
                <div class="overlay-controls">
                    <button class="overlay-btn" id="lang-btn">🌏</button>
                    <button class="overlay-btn" id="min-btn">_</button>
                    <button class="overlay-btn" id="close-btn">×</button>
                </div>
            </div>
            <div class="overlay-content">
                <div class="game-indicator">
                    <div id="status-dot" class="indicator-dot"></div>
                    <div id="game-name">${getText('notDetected')}</div>
                    <div id="game-confidence" style="margin-left:auto;color:#9a9a9a"></div>
                </div>
                <div class="question-box">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong>${getText('questionLabel')}</strong><span id="question-length">0${getText('symbols')}</span></div>
                    <div id="question-text" class="question-text"></div>
                </div>
                <div id="answer-box" class="answer-box">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong>${getText('answerLabel')}</strong><span id="answer-confidence"></span></div>
                    <div id="answer-text" class="answer-text"></div>
                </div>
                <div class="action-buttons">
                    <button class="action-btn detect-btn" id="detect-btn">${getText('detectBtn')}</button>
                    <button class="action-btn search-btn" id="search-btn" disabled>${getText('searchBtn')}</button>
                    <button class="action-btn copy-btn" id="copy-btn" disabled>${getText('copyBtn')}</button>
                </div>

                <div id="log-panel" class="log-panel">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                        <strong>${getText('logsTitle')}</strong>
                        <div style="display:flex;gap:6px;align-items:center">
                            <select id="log-level-select" title="Log level"><option value="debug">DEBUG</option><option value="info">INFO</option><option value="warn">WARN</option><option value="error">ERROR</option></select>
                            <button class="action-btn copy-btn" id="clear-logs">${getText('clearLogs')}</button>
                            <button class="action-btn copy-btn" id="pause-logs">${getText('pauseLogs')}</button>
                            <button class="action-btn copy-btn" id="export-logs">${getText('exportLogs')}</button>
                            <button class="action-btn copy-btn" id="log-collapse">▾</button>
                            <span id="log-summary" class="log-summary">0 ${getText('logsTitle')}</span>
                        </div>
                    </div>
                    <div id="log-list" class="log-list"></div>
                </div>
                <div id="overlay-status" style="margin-top:8px;font-family:monospace;color:#9a9a9a"></div>
            </div>
        `;
        document.body.appendChild(overlayEl);
        cacheDOM();
        wireEvents();
    }

    function cacheDOM() {
        dom.status = overlayEl.querySelector('#overlay-status');
        dom.detectBtn = overlayEl.querySelector('#detect-btn');
        dom.searchBtn = overlayEl.querySelector('#search-btn');
        dom.copyBtn = overlayEl.querySelector('#copy-btn');
        dom.langBtn = overlayEl.querySelector('#lang-btn');
        dom.minBtn = overlayEl.querySelector('#min-btn');
        dom.closeBtn = overlayEl.querySelector('#close-btn');
        dom.questionText = overlayEl.querySelector('#question-text');
        dom.questionLength = overlayEl.querySelector('#question-length');
        dom.answerText = overlayEl.querySelector('#answer-text');
        dom.answerBox = overlayEl.querySelector('#answer-box');
        dom.answerConfidence = overlayEl.querySelector('#answer-confidence');
        dom.statusDot = overlayEl.querySelector('#status-dot');
        dom.gameName = overlayEl.querySelector('#game-name');
        dom.gameConfidence = overlayEl.querySelector('#game-confidence');
        dom.dbVersion = overlayEl.querySelector('#db-version');
        dom.dbAge = overlayEl.querySelector('#db-age');
        dom.logPanel = overlayEl.querySelector('#log-panel');
        dom.logList = overlayEl.querySelector('#log-list');
        dom.clearLogsBtn = overlayEl.querySelector('#clear-logs');
        dom.pauseLogsBtn = overlayEl.querySelector('#pause-logs');
        dom.exportLogsBtn = overlayEl.querySelector('#export-logs');
        dom.logLevelSelect = overlayEl.querySelector('#log-level-select');
        dom.logCollapseBtn = overlayEl.querySelector('#log-collapse');
        dom.logSummary = overlayEl.querySelector('#log-summary');
    }

    function wireEvents() {
        dom.detectBtn.onclick = doDetect;
        dom.searchBtn.onclick = doSearch;
        dom.copyBtn.onclick = copyAnswer;
        dom.langBtn.onclick = () => { currentLang = currentLang === 'ru' ? 'en' : 'ru'; refreshTexts(); };
        dom.minBtn.onclick = () => overlayEl.classList.toggle('overlay-minimized');
        dom.closeBtn.onclick = cleanup;
        dom.clearLogsBtn.onclick = () => { logStart = 0; logCount = 0; if (dom.logList) dom.logList.innerHTML = ''; pushLog('info','Logs cleared'); };
        dom.pauseLogsBtn.onclick = () => { logPaused = !logPaused; dom.pauseLogsBtn.textContent = logPaused ? getText('resumeLogs') : getText('pauseLogs'); pushLog('info', logPaused ? 'Logs paused' : 'Logs resumed'); };
        dom.exportLogsBtn.onclick = exportLogs;
        if (dom.logLevelSelect) dom.logLevelSelect.onchange = (e) => { logLevel = e.target.value; pushLog('info', 'Log level set to ' + logLevel); };
        dom.logCollapseBtn.onclick = () => { logCollapsed = !logCollapsed; dom.logPanel.classList.toggle('collapsed', logCollapsed); dom.logCollapseBtn.textContent = logCollapsed ? '▸' : '▾'; if (!logCollapsed) { logNeedsRender = true; requestAnimationFrame(renderLogsIfNeeded); } else { if (dom.logList) dom.logList.innerHTML = ''; updateLogSummary(); } };

        enableDrag();
    }

    function refreshTexts() {
        if (!overlayEl) return;
        overlayEl.querySelector('.overlay-title').textContent = getText('title');
        dom.detectBtn.textContent = getText('detectBtn');
        dom.searchBtn.textContent = getText('searchBtn');
        dom.copyBtn.textContent = getText('copyBtn');
        dom.pauseLogsBtn.textContent = logPaused ? getText('resumeLogs') : getText('pauseLogs');
        dom.logCollapseBtn.title = logCollapsed ? getText('expandLogs') : getText('collapseLogs');
        updateLogSummary();
    }

    function enableDrag() {
        const header = overlayEl.querySelector('.overlay-header');
        let dragging = false, sx = 0, sy = 0, ix = 0, iy = 0;
        const move = (e) => { if (!dragging) return; overlayEl.style.left = ix + e.clientX - sx + 'px'; overlayEl.style.top = iy + e.clientY - sy + 'px'; overlayEl.style.right = 'auto'; };
        const up = () => { dragging = false; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        header.addEventListener('pointerdown', (e) => { if (e.target.closest('.overlay-btn')) return; dragging = true; sx = e.clientX; sy = e.clientY; const r = overlayEl.getBoundingClientRect(); ix = r.left; iy = r.top; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); });
    }

    function cleanup() { if (checkTimer) clearInterval(checkTimer); overlayEl?.remove(); pushLog('info', 'Overlay closed'); }

    // DB-aware wrappers
    function safeCall(fn) {
        return new Promise((resolve) => {
            try {
                const r = fn();
                if (r && typeof r.then === 'function') r.then(resolve).catch((e) => { pushLog('error','safeCall async error: ' + (e?.message || e), {stack: e?.stack}); resolve(null); });
                else resolve(r);
            } catch (e) { pushLog('error','safeCall sync error: ' + (e?.message || e), {stack: e?.stack}); resolve(null); }
        });
    }

    // call DB.method with common fallbacks suitable for this DB structure
    async function callDBMethod(name, ...args) {
        if (!gameDatabase) return null;
        const fn = gameDatabase[name];
        if (typeof fn !== 'function') return null;
        // For our database, prefer exact signatures:
        // detectGame() - no args
        // extractQuestion(gameId) - one arg
        // findAnswer(question, gameId) - two args
        try {
            if (name === 'detectGame') return await safeCall(() => fn.call(gameDatabase));
            if (name === 'extractQuestion') {
                // try with provided gameId only if valid
                const g = args[0];
                if (g && gameDatabase.gameConfig && gameDatabase.gameConfig[g]) return await safeCall(() => fn.call(gameDatabase, g));
                // as fallback try calling without args (some DB variants)
                return await safeCall(() => fn.call(gameDatabase));
            }
            if (name === 'findAnswer') {
                const q = args[0];
                const g = args[1];
                if (!q) return null;
                // primary: question+gameId
                if (g && gameDatabase.gameConfig && gameDatabase.gameConfig[g]) return await safeCall(() => fn.call(gameDatabase, q, g));
                // fallback: question only
                return await safeCall(() => fn.call(gameDatabase, q));
            }
            // generic fallback
            return await safeCall(() => fn.apply(gameDatabase, args));
        } catch (e) { pushLog('error', 'callDBMethod failed: ' + (e?.message || e)); return null; }
    }

    async function doDetect() {
        if (!gameDatabase) { updateStatus(getText('dbError'),'error'); pushLog('error','No GameDatabase present'); return; }
        updateStatus(getText('scanning'),'info');
        const res = await callDBMethod('detectGame');
        if (!res || !res.gameId) {
            currentGame = null; updateIndicator(null); updateStatus(getText('notDetected'),'info'); pushLog('info','No game detected'); return;
        }
        currentGame = res.gameId;
        updateIndicator(res);
        updateStatus(getText('gameDetected') + (res.name || res.gameId),'info');
        // immediately extract question once
        const q = await callDBMethod('extractQuestion', currentGame);
        if (q && typeof q === 'string') { currentQuestion = q; displayQuestion(q); pushLog('debug','Question extracted after detect', {len:q.length}); dom.searchBtn.disabled = !(q.length >= CONFIG.minQuestionLength); }
        else { currentQuestion = null; displayQuestion(null); dom.searchBtn.disabled = true; }

        // ensure auto-check running
        startAutoCheck();
    }

    function updateIndicator(res) {
        if (!res || !res.gameId) {
            dom.statusDot.className = 'indicator-dot'; dom.gameName.textContent = getText('notDetected'); dom.gameConfidence.textContent = ''; dom.watermark && (dom.watermark.textContent = ''); return;
        }
        const cfg = (gameDatabase && gameDatabase.gameConfig && gameDatabase.gameConfig[res.gameId]) || {};
        dom.statusDot.className = 'indicator-dot active'; dom.gameName.textContent = cfg.name || res.gameId; dom.gameConfidence.textContent = (res.confidence ?? '') ? (res.confidence + '%') : '';
    }

    function displayQuestion(q) {
        if (!q) {
            dom.questionText.textContent = getText('detectFirst'); dom.questionLength.textContent = '0' + getText('symbols'); dom.searchBtn.disabled = true; return;
        }
        const text = q.length > 500 ? q.slice(0,500) + '...' : q;
        dom.questionText.textContent = text; dom.questionLength.textContent = q.length + getText('symbols'); dom.searchBtn.disabled = !(q.length >= CONFIG.minQuestionLength);
    }

    async function doSearch() {
        if (!gameDatabase || !currentGame || !currentQuestion) { updateStatus(getText('detectFirst'),'warn'); pushLog('warn','Search invoked without game/question'); return; }
        updateStatus(getText('scanning'),'info');
        const res = await callDBMethod('findAnswer', currentQuestion, currentGame);
        if (res && res.answer) {
            dom.answerText.textContent = res.answer; dom.answerBox.classList.remove('not-found'); dom.answerBox.classList.add('found'); dom.answerConfidence.textContent = (res.confidence ?? '') ? (res.confidence + '%') : '';
            dom.copyBtn.disabled = false; updateStatus(getText('answerFound') + (res.confidence ?? '') + '%)','info'); pushLog('info','Answer found',{confidence:res.confidence});
        } else {
            dom.answerText.textContent = getText('answerNotFound'); dom.answerBox.classList.remove('found'); dom.answerBox.classList.add('not-found'); dom.answerConfidence.textContent = ''; dom.copyBtn.disabled = true; updateStatus(getText('answerNotFound'),'warn'); pushLog('info','Answer not found');
        }
    }

    function copyAnswer() {
        const text = dom.answerText?.textContent;
        if (!text || text === getText('answerNotFound')) return;
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(()=>{ updateStatus(getText('copySuccess'),'info'); pushLog('info','Copied answer'); }).catch(()=>{ fallbackCopy(text); }); else fallbackCopy(text);
    }
    function fallbackCopy(text){ try{ const ta = document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); updateStatus(getText('copySuccess'),'info'); pushLog('info','Copied via fallback'); }catch(e){ pushLog('error','Copy failed: '+(e?.message||e)); } }

    function updateStatus(msg, level){ if (dom.status) dom.status.textContent = msg; pushLog(level==='error'?'error':(level==='warn'?'warn':'info'), msg); }

    function startAutoCheck() { if (checkTimer) clearInterval(checkTimer); dynamicInterval = CONFIG.baseInterval; checkTimer = setInterval(autoCheck, dynamicInterval); pushLog('debug','Auto-check started ' + dynamicInterval + 'ms'); }

    async function autoCheck() {
        // auto-check only if we have a detected game and DB supports extractQuestion
        if (!gameDatabase || !currentGame || typeof gameDatabase.extractQuestion !== 'function') return;
        if (document.visibilityState !== 'visible') return;
        if (isChecking) return; isChecking = true;
        try {
            const q = await callDBMethod('extractQuestion', currentGame);
            if (q && q !== currentQuestion) {
                const ts = nowTs(); recentChanges.push(ts); const cutoff = ts - 1000; recentChanges = recentChanges.filter(t=>t>=cutoff);
                if (recentChanges.length > CONFIG.throttleThresholdPerSec) {
                    dynamicInterval = Math.min(dynamicInterval + CONFIG.throttleStepMs, CONFIG.throttleMaxMs); clearInterval(checkTimer); checkTimer = setInterval(autoCheck, dynamicInterval); pushLog('warn','High change rate; interval increased to ' + dynamicInterval);
                }
                currentQuestion = q; displayQuestion(q); pushLog('debug','Auto-extracted question',{len:q.length});
            }
        } catch (e) { pushLog('error','autoCheck failed: '+(e?.message||e), {stack:e?.stack}); }
        finally { isChecking = false; }
    }

    function exportLogs(){ const data=[]; for(let i=0;i<logCount;i++){ const idx=(logStart+i)%logs.length; const e=logs[idx]; if(e) data.push(e); } const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='jbg_logs_'+Date.now()+'.json'; a.click(); URL.revokeObjectURL(url); pushLog('info','Logs exported',{count:data.length}); }

    // init
    function init() { buildDOM(); if (window.GameDatabase) { gameDatabase = window.GameDatabase; updateVersionInfo(); pushLog('info','GameDatabase present'); } else { // try to load external script
            pushLog('info','Attempting to load DB from ' + CONFIG.databaseURL);
            const s = document.createElement('script'); s.src = CONFIG.databaseURL + '?t=' + Date.now(); s.onload = ()=>{ gameDatabase = window.GameDatabase || null; if (gameDatabase) { updateVersionInfo(); pushLog('info','Database loaded'); } else pushLog('error','Database loaded but GameDatabase not found'); }; s.onerror = (e)=>{ pushLog('error','DB script load error', e); }; document.head.appendChild(s);
        }
        // start light render timer
        setInterval(()=>{ if (logNeedsRender) renderLogsIfNeeded(); }, 1000);
    }

    function updateVersionInfo(){ try{ if (!gameDatabase || typeof gameDatabase.getVersionInfo !== 'function') return; const info = gameDatabase.getVersionInfo() || {}; if (dom.dbVersion) dom.dbVersion.textContent = info.version || 'v?'; if (dom.dbAge) { dom.dbAge.textContent = (info.daysSinceUpdate===0? (currentLang==='ru'?'сегодня':'today') : (info.daysSinceUpdate+'d')); dom.dbAge.style.color = info.isOutdated? '#ff6b6b' : '#4ecdc4'; } pushLog('debug','Version info updated',info); }catch(e){ pushLog('error','updateVersionInfo failed: '+(e?.message||e)); } }

    // start
    init();

})();
