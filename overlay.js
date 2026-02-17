// overlay.js - Оверлей для Jackbox Games (ИСПРАВЛЕННАЯ ВЕРСИЯ)
(function() {
    const existing = document.getElementById('game-finder-overlay');
    if (existing) existing.remove();

    const CONFIG = {
        databaseURL: 'https://getonjbghelp.github.io/jbg-finder/database.js',
        checkInterval: 2000,
        minQuestionLength: 15,
        defaultLang: 'ru'
    };

    const LANG = {
        ru: {
            title: 'JBG-Finder v1.0',
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
            settings: '⚙️',
            langSelect: 'Язык / Language',
            close: 'Закрыть',
            minimize: 'Свернуть'
        },
        en: {
            title: 'JBG-Finder v1.0',
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
            settings: '⚙️',
            langSelect: 'Language / Язык',
            close: 'Close',
            minimize: 'Minimize'
        }
    };

    let currentGame = null;
    let currentQuestion = '';
    let lastQuestion = '';
    let gameDatabase = null;
    let currentLang = CONFIG.defaultLang;
    let settingsOpen = false;

    async function loadDatabase() {
        return new Promise((resolve) => {
            if (window.GameDatabase) {
                gameDatabase = window.GameDatabase;
                updateStatus(getText('dbLoaded'), 'success');
                updateVersionInfo();
                resolve(true);
                return;
            }

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

    function getText(key) {
        return LANG[currentLang][key] || LANG['ru'][key] || key;
    }

    function updateVersionInfo() {
        if (!gameDatabase) return;
        
        const versionInfo = gameDatabase.getVersionInfo();
        const versionEl = document.getElementById('db-version');
        const ageEl = document.getElementById('db-age');
        
        if (versionEl) versionEl.textContent = versionInfo.version;
        
        if (ageEl) {
            const daysText = versionInfo.daysSinceUpdate === 0 ? 
                (currentLang === 'ru' ? 'сегодня' : 'today') : 
                versionInfo.daysSinceUpdate + 'd';
            ageEl.textContent = daysText;
            ageEl.style.color = versionInfo.isOutdated ? '#ff6b6b' : '#4ecdc4';
        }
    }

    function updateStatus(message, type) {
        const statusEl = document.getElementById('overlay-status');
        if (statusEl) {
            const colors = {
                info: '#606060',
                success: '#4ecdc4',
                warning: '#ffd93d',
                error: '#ff6b6b',
                searching: '#ffd93d'
            };
            statusEl.textContent = message;
            statusEl.style.color = colors[type] || colors.info;
        }
    }

    function updateIndicator(detectionResult) {
        const dot = document.getElementById('status-dot');
        const name = document.getElementById('game-name');
        const confidence = document.getElementById('game-confidence');
        const watermark = document.getElementById('game-watermark');
        
        if (detectionResult && detectionResult.gameId && gameDatabase && gameDatabase.gameConfig[detectionResult.gameId]) {
            const config = gameDatabase.gameConfig[detectionResult.gameId];
            dot.className = 'indicator-dot active';
            name.textContent = config.name;
            confidence.textContent = detectionResult.confidence + '/2 ✓';
            confidence.title = 'Found: ' + detectionResult.foundIndicators.join(', ');
            
            if (watermark) {
                watermark.textContent = config.name.toUpperCase();
                watermark.style.color = config.backgroundColor + '15';
            }
            
            currentGame = detectionResult.gameId;
        } else {
            dot.className = 'indicator-dot';
            name.textContent = getText('notDetected');
            confidence.textContent = '';
            
            if (watermark) {
                watermark.textContent = 'Here we go again! Waiting for so long is tiring thing. Not to mess you up.';
                watermark.style.color = 'rgba(255, 255, 255, 0.08)';
            }
            
            currentGame = null;
        }
    }

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'game-finder-overlay';
        overlay.innerHTML = `
            <div class="overlay-background-text" id="game-watermark">Here we go again! Waiting for so long is tiring thing. Not to mess you up.</div>
            
            <div class="overlay-header">
                <div class="header-left">
                    <span class="overlay-title">JBG-Finder v1.0</span>
                    <span class="db-info">
                        <span id="db-version">v0.0</span>
                        <span class="db-separator">•</span>
                        <span id="db-age">--</span>
                    </span>
                </div>
                <div class="overlay-controls">
                    <button class="overlay-btn settings-btn" title="${getText('settings')}">⚙️</button>
                    <button class="overlay-btn minimize-btn" title="${getText('minimize')}">
                        <svg width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="2" fill="#fff"/></svg>
                    </button>
                    <button class="overlay-btn close-btn" title="${getText('close')}">
                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0L10 10M10 0L0 10" stroke="#fff" stroke-width="1.5"/></svg>
                    </button>
                </div>
            </div>
            
            <div class="overlay-content">
                <div class="game-indicator">
                    <span class="indicator-dot" id="status-dot"></span>
                    <span class="game-name" id="game-name">Не определено</span>
                    <span class="game-confidence" id="game-confidence"></span>
                </div>
                
                <div class="question-box">
                    <div class="question-header">
                        <span class="question-label">📝 ВОПРОС</span>
                        <span class="question-length" id="question-length">0 символов</span>
                    </div>
                    <div class="question-text" id="question-text">Нажмите "Определить игру" для сканирования...</div>
                </div>
                
                <div class="answer-box" id="answer-box">
                    <div class="answer-header">
                        <span class="answer-label">💡 ОТВЕТ</span>
                        <span class="answer-confidence" id="answer-confidence"></span>
                    </div>
                    <div class="answer-text" id="answer-text">Нажмите "Найти ответ" для поиска...</div>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn detect-btn" id="detect-btn">🔍 Определить игру</button>
                    <button class="action-btn search-btn" id="search-btn" disabled>⚡ Найти ответ</button>
                    <button class="action-btn copy-btn" id="copy-btn" disabled>📋 Копировать</button>
                </div>
                
                <div class="overlay-status" id="overlay-status">Ожидание...</div>
                
                <div class="settings-panel" id="settings-panel">
                    <div class="settings-header">
                        <span>⚙️ Настройки / Settings</span>
                        <button class="settings-close-btn" id="settings-close-btn">×</button>
                    </div>
                    <div class="settings-content">
                        <div class="setting-item">
                            <span>${getText('langSelect')}</span>
                            <select id="lang-select" class="lang-select">
                                <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>Русский</option>
                                <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        overlay.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            width: 580px !important;
            max-width: 95vw !important;
            background: linear-gradient(145deg, #2b2b2b 0%, #1e1e1e 100%) !important;
            backdrop-filter: blur(15px) !important;
            border: 1px solid #3a3a3a !important;
            border-radius: 0px !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8) !important;
            z-index: 999999 !important;
            font-family: 'Segoe UI', sans-serif !important;
            color: #e0e0e0 !important;
            overflow: hidden !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        `;

        document.body.appendChild(overlay);

        const style = document.createElement('style');
        style.textContent = `
            #game-finder-overlay * {
                box-sizing: border-box !important;
                margin: 0 !important;
                padding: 0 !important;
                user-select: none !important;
                -webkit-user-select: none !important;
            }
            
            .overlay-background-text {
                position: absolute !important;
                top: 50% !important;
                left: 100% !important;
                transform: translateY(-50%) !important;
                font-size: 70px !important;
                font-weight: 900 !important;
                color: rgba(255, 255, 255, 0.05) !important;
                pointer-events: none !important;
                white-space: nowrap !important;
                z-index: 0 !important;
                animation: scrollText 30s linear infinite !important;
            }
            
            @keyframes scrollText {
                0% { left: 100%; }
                100% { left: -200%; }
            }
            
            .overlay-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: stretch !important;
                padding: 0 !important;
                background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%) !important;
                border-bottom: 1px solid #3a3a3a !important;
                cursor: move !important;
                height: 40px !important;
            }
            
            .header-left {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                padding: 0 15px !important;
            }
            
            .overlay-title {
                font-size: 14px !important;
                font-weight: 600 !important;
                color: #ffffff !important;
            }
            
            .db-info {
                font-size: 11px !important;
                color: #808080 !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
            }
            
            .db-separator {
                color: #505050 !important;
            }
            
            .overlay-controls {
                display: flex !important;
                height: 100% !important;
            }
            
            .overlay-btn {
                width: 40px !important;
                height: 40px !important;
                border: none !important;
                border-radius: 0px !important;
                background: transparent !important;
                color: #c0c0c0 !important;
                cursor: pointer !important;
                font-size: 14px !important;
                transition: all 0.15s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            
            .overlay-btn:hover {
                background: rgba(255, 255, 255, 0.1) !important;
                color: #ffffff !important;
            }
            
            .settings-btn:hover {
                background: rgba(78, 205, 196, 0.2) !important;
                color: #4ecdc4 !important;
            }
            
            .minimize-btn:hover {
                background: rgba(255, 255, 255, 0.15) !important;
            }
            
            .close-btn:hover {
                background: #e81123 !important;
                color: #ffffff !important;
            }
            
            .overlay-content {
                padding: 18px !important;
                position: relative !important;
                z-index: 10 !important;
            }
            
            .game-indicator {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                margin-bottom: 15px !important;
                padding: 10px 14px !important;
                background: rgba(45, 45, 45, 0.6) !important;
                border: 1px solid #3a3a3a !important;
            }
            
            .indicator-dot {
                width: 10px !important;
                height: 10px !important;
                border-radius: 0px !important;
                background: #505050 !important;
                transition: all 0.3s ease !important;
            }
            
            .indicator-dot.active {
                background: #4ecdc4 !important;
                box-shadow: 0 0 10px #4ecdc4 !important;
            }
            
            .indicator-dot.searching {
                background: #ffd93d !important;
                box-shadow: 0 0 10px #ffd93d !important;
                animation: pulse 1s infinite !important;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .game-name {
                font-size: 14px !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                flex: 1 !important;
            }
            
            .game-confidence {
                font-size: 10px !important;
                color: #808080 !important;
                padding: 2px 6px !important;
                background: rgba(255, 255, 255, 0.05) !important;
                border: 1px solid #3a3a3a !important;
            }
            
            .question-box, .answer-box {
                margin-bottom: 15px !important;
                padding: 14px !important;
                background: rgba(35, 35, 35, 0.7) !important;
                border: 1px solid #3a3a3a !important;
            }
            
            .question-box {
                border-left: 3px solid #4ecdc4 !important;
            }
            
            .answer-box {
                border-left: 3px solid #505050 !important;
            }
            
            .answer-box.found {
                border-left-color: #4ecdc4 !important;
                background: rgba(78, 205, 196, 0.08) !important;
            }
            
            .answer-box.not-found {
                border-left-color: #ff6b6b !important;
                background: rgba(255, 107, 107, 0.08) !important;
            }
            
            .question-header, .answer-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 8px !important;
            }
            
            .question-label, .answer-label {
                font-size: 10px !important;
                color: #808080 !important;
                font-weight: 600 !important;
                letter-spacing: 1px !important;
                text-transform: uppercase !important;
            }
            
            .question-length, .answer-confidence {
                font-size: 9px !important;
                color: #606060 !important;
                padding: 2px 5px !important;
                background: rgba(255, 255, 255, 0.05) !important;
                border: 1px solid #3a3a3a !important;
            }
            
            .question-text, .answer-text {
                font-size: 13px !important;
                color: #d0d0d0 !important;
                line-height: 1.5 !important;
                max-height: 120px !important;
                overflow-y: auto !important;
                font-weight: 400 !important;
                word-wrap: break-word !important;
            }
            
            .answer-text {
                font-size: 15px !important;
                font-weight: 600 !important;
                color: #ffffff !important;
            }
            
            .answer-box.found .answer-text {
                color: #4ecdc4 !important;
            }
            
            .answer-box.not-found .answer-text {
                color: #ff6b6b !important;
            }
            
            .action-buttons {
                display: flex !important;
                gap: 8px !important;
                margin-bottom: 15px !important;
                flex-wrap: nowrap !important;
            }
            
            .action-btn {
                flex: 1 !important;
                min-width: 0 !important;
                padding: 11px 14px !important;
                border: none !important;
                border-radius: 0px !important;
                cursor: pointer !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                transition: all 0.15s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 5px !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            
            .action-btn.detect-btn {
                background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%) !important;
                color: #ffffff !important;
            }
            
            .action-btn.search-btn {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%) !important;
                color: #ffffff !important;
            }
            
            .action-btn.copy-btn {
                background: #3a3a3a !important;
                color: #c0c0c0 !important;
                border: 1px solid #4a4a4a !important;
            }
            
            .action-btn:hover:not(:disabled) {
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
                filter: brightness(1.1) !important;
            }
            
            .action-btn:disabled {
                opacity: 0.35 !important;
                cursor: not-allowed !important;
                transform: none !important;
                filter: none !important;
            }
            
            .action-btn.search-btn:disabled {
                background: linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%) !important;
            }
            
            .overlay-status {
                font-size: 10px !important;
                color: #606060 !important;
                text-align: center !important;
                padding-top: 10px !important;
                border-top: 1px solid #3a3a3a !important;
                font-family: 'Consolas', monospace !important;
            }
            
            .settings-panel {
                position: absolute !important;
                top: 100% !important;
                right: 0 !important;
                width: 280px !important;
                background: #2b2b2b !important;
                border: 1px solid #3a3a3a !important;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8) !important;
                z-index: 999998 !important;
                display: none !important;
            }
            
            .settings-panel.show {
                display: block !important;
            }
            
            .settings-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 12px 15px !important;
                background: #3a3a3a !important;
                border-bottom: 1px solid #4a4a4a !important;
            }
            
            .settings-header span {
                font-size: 12px !important;
                font-weight: 600 !important;
                color: #ffffff !important;
            }
            
            .settings-close-btn {
                width: 24px !important;
                height: 24px !important;
                border: none !important;
                background: transparent !important;
                color: #c0c0c0 !important;
                cursor: pointer !important;
                font-size: 16px !important;
            }
            
            .settings-close-btn:hover {
                background: #e81123 !important;
                color: #ffffff !important;
            }
            
            .settings-content {
                padding: 15px !important;
            }
            
            .setting-item {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 10px !important;
            }
            
            .setting-item span {
                font-size: 12px !important;
                color: #c0c0c0 !important;
            }
            
            .lang-select {
                padding: 6px 10px !important;
                background: #3a3a3a !important;
                border: 1px solid #4a4a4a !important;
                color: #ffffff !important;
                font-size: 12px !important;
                cursor: pointer !important;
            }
            
            .lang-select:focus {
                outline: none !important;
                border-color: #4ecdc4 !important;
            }
            
            .overlay-minimized {
                height: 40px !important;
                overflow: hidden !important;
            }
            
            .overlay-minimized .overlay-content {
                display: none !important;
            }
            
            .question-text::-webkit-scrollbar,
            .answer-text::-webkit-scrollbar,
            .settings-content::-webkit-scrollbar {
                width: 6px !important;
            }
            
            .question-text::-webkit-scrollbar-track,
            .answer-text::-webkit-scrollbar-track,
            .settings-content::-webkit-scrollbar-track {
                background: #2b2b2b !important;
            }
            
            .question-text::-webkit-scrollbar-thumb,
            .answer-text::-webkit-scrollbar-thumb,
            .settings-content::-webkit-scrollbar-thumb {
                background: #4a4a4a !important;
            }
            
            .question-text::-webkit-scrollbar-thumb:hover,
            .answer-text::-webkit-scrollbar-thumb:hover,
            .settings-content::-webkit-scrollbar-thumb:hover {
                background: #5a5a5a !important;
            }
        `;
        document.head.appendChild(style);

        return overlay;
    }

    function autoCheckQuestion() {
        if (!gameDatabase || !currentGame) return;
        
        const question = gameDatabase.extractQuestion(currentGame);
        
        if (question && question !== lastQuestion && question.length >= CONFIG.minQuestionLength) {
            lastQuestion = question;
            currentQuestion = question;
            
            const questionText = document.getElementById('question-text');
            const questionLength = document.getElementById('question-length');
            
            if (questionText) {
                questionText.textContent = question.length > 200 ? 
                    question.substring(0, 200) + '...' : question;
            }
            
            if (questionLength) {
                questionLength.textContent = question.length + getText('symbols');
            }
            
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) searchBtn.disabled = false;
            
            updateStatus(getText('gameDetected') + gameDatabase.gameConfig[currentGame].name, 'success');
        }
    }

    function detectGame() {
        if (!gameDatabase) {
            updateStatus(getText('dbError'), 'error');
            return false;
        }

        updateStatus(getText('scanning'), 'searching');
        let statusDot = document.getElementById('status-dot');
        if (statusDot) statusDot.className = 'indicator-dot searching';

        setTimeout(() => {
            const detectionResult = gameDatabase.detectGame();
            updateIndicator(detectionResult);
            
            if (detectionResult && detectionResult.gameId) {
                updateStatus(getText('gameDetected') + detectionResult.name + 
                    ' (' + getText('confidence') + detectionResult.confidence + '/2)', 'success');
                const searchBtn = document.getElementById('search-btn');
                if (searchBtn) searchBtn.disabled = false;
                
                const question = gameDatabase.extractQuestion(detectionResult.gameId);
                if (question) {
                    currentQuestion = question;
                    lastQuestion = question;
                    const questionText = document.getElementById('question-text');
                    const questionLength = document.getElementById('question-length');
                    if (questionText) {
                        questionText.textContent = question.length > 200 ? 
                            question.substring(0, 200) + '...' : question;
                    }
                    if (questionLength) {
                        questionLength.textContent = question.length + getText('symbols');
                    }
                }
            } else {
                updateStatus(getText('detectFirst'), 'warning');
                const searchBtn = document.getElementById('search-btn');
                if (searchBtn) searchBtn.disabled = true;
            }
            
            // Используем уже существующую переменную statusDot
            if (statusDot) {
                statusDot.className = detectionResult && detectionResult.gameId ? 
                    'indicator-dot active' : 'indicator-dot';
            }
        }, 500);

        return true;
    }

    function searchAnswer() {
        if (!gameDatabase || !currentGame || !currentQuestion) {
            updateStatus(getText('detectFirst'), 'warning');
            return;
        }
        
        updateStatus(getText('scanning'), 'searching');
        let statusDot = document.getElementById('status-dot');
        if (statusDot) statusDot.className = 'indicator-dot searching';
        
        setTimeout(() => {
            const result = gameDatabase.findAnswer(currentQuestion, currentGame);
            const answerBox = document.getElementById('answer-box');
            const answerText = document.getElementById('answer-text');
            const answerConfidence = document.getElementById('answer-confidence');
            const copyBtn = document.getElementById('copy-btn');
            
            if (result) {
                if (answerText) answerText.textContent = result.answer;
                if (answerBox) answerBox.className = 'answer-box found';
                if (answerConfidence) answerConfidence.textContent = result.confidence + '%';
                updateStatus(getText('answerFound') + result.confidence + '%)', 'success');
                if (copyBtn) copyBtn.disabled = false;
            } else {
                if (answerText) answerText.textContent = getText('answerNotFound');
                if (answerBox) answerBox.className = 'answer-box not-found';
                if (answerConfidence) answerConfidence.textContent = '';
                updateStatus(getText('answerNotFound'), 'error');
                if (copyBtn) copyBtn.disabled = true;
            }
            
            // Используем внешнюю переменную statusDot
            if (statusDot) {
                statusDot.className = currentGame ? 'indicator-dot active' : 'indicator-dot';
            }
        }, 300);
    }

    function copyAnswer() {
        const answerText = document.getElementById('answer-text');
        if (answerText && answerText.textContent && 
            answerText.textContent !== getText('answerNotFound')) {
            navigator.clipboard.writeText(answerText.textContent).then(() => {
                updateStatus(getText('copySuccess'), 'success');
                setTimeout(() => updateStatus(getText('gameDetected') + 
                    (currentGame && gameDatabase ? gameDatabase.gameConfig[currentGame].name : ''), 'info'), 2000);
            });
        }
    }

    function switchLanguage(lang) {
        currentLang = lang;
        
        const elements = {
            '.overlay-title': 'title',
            '#detect-btn': 'detectBtn',
            '#search-btn': 'searchBtn',
            '#copy-btn': 'copyBtn',
            '.question-label': 'questionLabel',
            '.answer-label': 'answerLabel'
        };
        
        for (const [selector, key] of Object.entries(elements)) {
            const el = document.querySelector(selector);
            if (el) el.textContent = getText(key);
        }
        
        const settingsHeader = document.querySelector('.settings-header span');
        if (settingsHeader) {
            settingsHeader.textContent = '⚙️ ' + getText('langSelect');
        }
        
        if (currentGame && gameDatabase) {
            updateStatus(getText('gameDetected') + gameDatabase.gameConfig[currentGame].name, 'success');
        } else {
            updateStatus(getText('notDetected'), 'info');
        }
    }

    async function initOverlay() {
        const overlay = createOverlay();
        updateStatus(getText('loadingDB'), 'info');
        await loadDatabase();

        const detectBtn = document.getElementById('detect-btn');
        const searchBtn = document.getElementById('search-btn');
        const copyBtn = document.getElementById('copy-btn');
        
        if (detectBtn) detectBtn.onclick = detectGame;
        if (searchBtn) searchBtn.onclick = searchAnswer;
        if (copyBtn) copyBtn.onclick = copyAnswer;
        
        const closeBtn = overlay.querySelector('.close-btn');
        const minimizeBtn = overlay.querySelector('.minimize-btn');
        
        if (closeBtn) closeBtn.onclick = () => overlay.remove();
        if (minimizeBtn) minimizeBtn.onclick = () => overlay.classList.toggle('overlay-minimized');
        
        const settingsBtn = overlay.querySelector('.settings-btn');
        const settingsPanel = document.getElementById('settings-panel');
        const settingsCloseBtn = document.getElementById('settings-close-btn');
        const langSelect = document.getElementById('lang-select');
        
        if (settingsBtn && settingsPanel) {
            settingsBtn.onclick = () => {
                settingsOpen = !settingsOpen;
                if (settingsOpen) {
                    settingsPanel.classList.add('show');
                } else {
                    settingsPanel.classList.remove('show');
                }
            };
        }
        
        if (settingsCloseBtn && settingsPanel) {
            settingsCloseBtn.onclick = () => {
                settingsOpen = false;
                settingsPanel.classList.remove('show');
            };
        }
        
        if (langSelect) {
            langSelect.onchange = (e) => {
                switchLanguage(e.target.value);
                settingsOpen = false;
                if (settingsPanel) settingsPanel.classList.remove('show');
            };
        }
        
        document.addEventListener('click', (e) => {
            if (settingsOpen && settingsPanel && 
                !settingsPanel.contains(e.target) && 
                settingsBtn && !settingsBtn.contains(e.target)) {
                settingsOpen = false;
                settingsPanel.classList.remove('show');
            }
        });

        const header = overlay.querySelector('.overlay-header');
        let isDragging = false, startX, startY, initialX, initialY;

        if (header) {
            header.onmousedown = (e) => {
                if (e.target.closest('.overlay-btn')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = overlay.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                e.preventDefault();
            };
        }

        document.onmousemove = (e) => {
            if (!isDragging) return;
            overlay.style.left = (initialX + e.clientX - startX) + 'px';
            overlay.style.top = (initialY + e.clientY - startY) + 'px';
            overlay.style.right = 'auto';
            e.preventDefault();
        };

        document.onmouseup = () => { isDragging = false; };

        setInterval(autoCheckQuestion, CONFIG.checkInterval);

        updateStatus(getText('notDetected'), 'info');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOverlay);
    } else {
        initOverlay();
    }
})();
