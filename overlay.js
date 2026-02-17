// overlay.js - Оверлей для Jackbox Games (ИСПРАВЛЕННАЯ ВЕРСИЯ)
(function() {
    // Удаляем существующий оверлей
    const existing = document.getElementById('game-finder-overlay');
    if (existing) existing.remove();

    // === КОНФИГУРАЦИЯ ===
    const CONFIG = {
        databaseURL: 'https://getonjbghelp.github.io/jbg-finder/database.js',
        checkInterval: 2000,
        minQuestionLength: 15,
        defaultLang: 'ru'
    };

    // === ЯЗЫКОВЫЕ НАСТРОЙКИ ===
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

    // === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
    let currentGame = null;
    let currentQuestion = '';
    let lastQuestion = '';
    let gameDatabase = null;
    let currentLang = CONFIG.defaultLang;
    let settingsOpen = false;

    // === ЗАГРУЗКА БАЗЫ ДАННЫХ ===
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

    // === ПОЛУЧЕНИЕ ТЕКСТА ПО ЯЗЫКУ ===
    function getText(key) {
        return LANG[currentLang][key] || LANG['ru'][key] || key;
    }

    // === ОБНОВЛЕНИЕ ИНФОРМАЦИИ О ВЕРСИИ ===
    function updateVersionInfo() {
        if (!gameDatabase) return;
        
        const versionInfo = gameDatabase.getVersionInfo();
        const versionEl = document.getElementById('gfg-db-version');
        const ageEl = document.getElementById('gfg-db-age');
        
        if (versionEl) versionEl.textContent = 'v' + versionInfo.version;
        
        if (ageEl) {
            const daysText = versionInfo.daysSinceUpdate === 0 ? 
                (currentLang === 'ru' ? 'сегодня' : 'today') : 
                versionInfo.daysSinceUpdate + 'd';
            ageEl.textContent = daysText;
            ageEl.style.color = versionInfo.isOutdated ? '#ff6b6b' : '#4ecdc4';
        }
    }

    // === ОБНОВЛЕНИЕ СТАТУСА ===
    function updateStatus(message, type) {
        const statusEl = document.getElementById('gfg-overlay-status');
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

    // === ОБНОВЛЕНИЕ ИНДИКАТОРА ===
    function updateIndicator(detectionResult) {
        const dot = document.getElementById('gfg-status-dot');
        const name = document.getElementById('gfg-game-name');
        const confidence = document.getElementById('gfg-game-confidence');
        const watermark = document.getElementById('gfg-game-watermark');
        
        if (detectionResult && detectionResult.gameId) {
            const config = gameDatabase.gameConfig[detectionResult.gameId];
            dot.className = 'gfg-indicator-dot active';
            name.textContent = config.name;
            confidence.textContent = detectionResult.confidence + '/2 ✓';
            confidence.title = 'Found: ' + detectionResult.foundIndicators.join(', ');
            
            if (watermark) {
                watermark.textContent = config.name.toUpperCase();
                watermark.style.color = config.backgroundColor + '15';
            }
            
            currentGame = detectionResult.gameId;
        } else {
            dot.className = 'gfg-indicator-dot';
            name.textContent = getText('notDetected');
            confidence.textContent = '';
            
            if (watermark) {
                watermark.textContent = 'JBG-Finder v1.0';
                watermark.style.color = 'rgba(255, 255, 255, 0.08)';
            }
            
            currentGame = null;
        }
    }

    // === СОЗДАНИЕ ОВЕРЛЕЯ ===
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'game-finder-overlay';
        overlay.innerHTML = `
            <div class="gfg-background-text" id="gfg-game-watermark">HERE WE GO AGAIN THROUGH THE VALLEY OF SOMETHING IMPORTANT! OR NOT...?</div>
            
            <div class="gfg-header">
                <div class="gfg-header-left">
                    <span class="gfg-overlay-title">JBG-Finder v1.0</span>
                    <span class="gfg-db-info">
                        <span id="gfg-db-version">v0.0</span>
                        <span class="gfg-db-separator">•</span>
                        <span id="gfg-db-age">--</span>
                    </span>
                </div>
                <div class="gfg-overlay-controls">
                    <button class="gfg-overlay-btn gfg-settings-btn" title="${getText('settings')}">⚙️</button>
                    <button class="gfg-overlay-btn gfg-minimize-btn" title="${getText('minimize')}">
                        <svg width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="2" fill="#fff"/></svg>
                    </button>
                    <button class="gfg-overlay-btn gfg-close-btn" title="${getText('close')}">
                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0L10 10M10 0L0 10" stroke="#fff" stroke-width="1.5"/></svg>
                    </button>
                </div>
            </div>
            
            <div class="gfg-content">
                <div class="gfg-game-indicator">
                    <span class="gfg-indicator-dot" id="gfg-status-dot"></span>
                    <span class="gfg-game-name" id="gfg-game-name">Не определено</span>
                    <span class="gfg-game-confidence" id="gfg-game-confidence"></span>
                </div>
                
                <div class="gfg-question-box">
                    <div class="gfg-question-header">
                        <span class="gfg-question-label">📝 ВОПРОС</span>
                        <span class="gfg-question-length" id="gfg-question-length">0 символов</span>
                    </div>
                    <div class="gfg-question-text" id="gfg-question-text">Нажмите "Определить игру" для сканирования...</div>
                </div>
                
                <div class="gfg-answer-box" id="gfg-answer-box">
                    <div class="gfg-answer-header">
                        <span class="gfg-answer-label">💡 ОТВЕТ</span>
                        <span class="gfg-answer-confidence" id="gfg-answer-confidence"></span>
                    </div>
                    <div class="gfg-answer-text" id="gfg-answer-text">Нажмите "Найти ответ" для поиска...</div>
                </div>
                
                <div class="gfg-action-buttons">
                    <button class="gfg-action-btn gfg-detect-btn" id="gfg-detect-btn">🔍 Определить игру</button>
                    <button class="gfg-action-btn gfg-search-btn" id="gfg-search-btn" disabled>⚡ Найти ответ</button>
                    <button class="gfg-action-btn gfg-copy-btn" id="gfg-copy-btn" disabled>📋 Копировать</button>
                </div>
                
                <div class="gfg-overlay-status" id="gfg-overlay-status">Ожидание...</div>
                
                <!-- НАСТРОЙКИ -->
                <div class="gfg-settings-panel" id="gfg-settings-panel">
                    <div class="gfg-settings-header">
                        <span>⚙️ Настройки / Settings</span>
                        <button class="gfg-settings-close-btn" id="gfg-settings-close-btn">×</button>
                    </div>
                    <div class="gfg-settings-content">
                        <div class="gfg-setting-item">
                            <span>${getText('langSelect')}</span>
                            <select id="gfg-lang-select" class="gfg-lang-select">
                                <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>Русский</option>
                                <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Стили оверлея (ИСПРАВЛЕННЫЕ)
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
            overflow: visible !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        `;

        document.body.appendChild(overlay);

        // Добавляем CSS с уникальными префиксами
        const style = document.createElement('style');
        style.textContent = `
            #game-finder-overlay * {
                box-sizing: border-box !important;
                margin: 0 !important;
                padding: 0 !important;
                user-select: none !important;
                -webkit-user-select: none !important;
            }
            
            .gfg-background-text {
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
                animation: gfg-scrollText 30s linear infinite !important;
            }
            
            @keyframes gfg-scrollText {
                0% { left: 100%; }
                100% { left: -200%; }
            }
            
            .gfg-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: stretch !important;
                padding: 0 !important;
                background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%) !important;
                border-bottom: 1px solid #3a3a3a !important;
                cursor: move !important;
                height: 40px !important;
            }
            
            .gfg-header-left {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                padding: 0 15px !important;
            }
            
            .gfg-overlay-title {
                font-size: 14px !important;
                font-weight: 600 !important;
                color: #ffffff !important;
            }
            
            .gfg-db-info {
                font-size: 11px !important;
                color: #808080 !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
            }
            
            .gfg-db-separator {
                color: #505050 !important;
            }
            
            .gfg-overlay-controls {
                display: flex !important;
                height: 100% !important;
            }
            
            .gfg-overlay-btn {
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
            
            .gfg-overlay-btn:hover {
                background: rgba(255, 255, 255, 0.1) !important;
                color: #ffffff !important;
            }
            
            .gfg-settings-btn:hover {
                background: rgba(78, 205, 196, 0.2) !important;
                color: #4ecdc4 !important;
            }
            
            .gfg-minimize-btn:hover {
                background: rgba(255, 255, 255, 0.15) !important;
            }
            
            .gfg-close-btn:hover {
                background: #e81123 !important;
                color: #ffffff !important;
            }
            
            .gfg-content {
                padding: 18px !important;
                position: relative !important;
                z-index: 10 !important;
            }
            
            .gfg-game-indicator {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                margin-bottom: 15px !important;
                padding: 10px 14px !important;
                background: rgba(45, 45, 45, 0.6) !important;
                border: 1px solid #3a3a3a !important;
            }
            
            .gfg-indicator-dot {
                width: 10px !important;
                height: 10px !important;
                border-radius: 0px !important;
                background: #505050 !important;
                transition: all 0.3s ease !important;
            }
            
            .gfg-indicator-dot.active {
                background: #4ecdc4 !important;
                box-shadow: 0 0 10px #4ecdc4 !important;
            }
            
            .gfg-indicator-dot.searching {
                background: #ffd93d !important;
                box-shadow: 0 0 10px #ffd93d !important;
                animation: gfg-pulse 1s infinite !important;
            }
            
            @keyframes gfg-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .gfg-game-name {
                font-size: 14px !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                flex: 1 !important;
            }
            
            .gfg-game-confidence {
                font-size: 10px !important;
                color: #808080 !important;
                padding: 2px 6px !important;
                background: rgba(255, 255, 255, 0.05) !important;
                border: 1px solid #3a3a3a !important;
            }
            
            .gfg-question-box, .gfg-answer-box {
                margin-bottom: 15px !important;
                padding: 14px !important;
                background: rgba(35, 35, 35, 0.7) !important;
                border: 1px solid #3a3a3a !important;
            }
            
            .gfg-question-box {
                border-left: 3px solid #4ecdc4 !important;
            }
            
            .gfg-answer-box {
                border-left: 3px solid #505050 !important;
            }
            
            .gfg-answer-box.found {
                border-left-color: #4ecdc4 !important;
                background: rgba(78, 205, 196, 0.08) !important;
            }
            
            .gfg-answer-box.not-found {
                border-left-color: #ff6b6b !important;
                background: rgba(255, 107, 107, 0.08) !important;
            }
            
            .gfg-question-header, .gfg-answer-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 8px !important;
            }
            
            .gfg-question-label, .gfg-answer-label {
                font-size: 10px !important;
                color: #808080 !important;
                font-weight: 600 !important;
                letter-spacing: 1px !important;
                text-transform: uppercase !important;
            }
            
            .gfg-question-length, .gfg-answer-confidence {
                font-size: 9px !important;
                color: #606060 !important;
                padding: 2px 5px !important;
                background: rgba(255, 255, 255, 0.05) !important;
                border: 1px solid #3a3a3a !important;
            }
            
            .gfg-question-text, .gfg-answer-text {
                font-size: 13px !important;
                color: #d0d0d0 !important;
                line-height: 1.5 !important;
                max-height: 120px !important;
                overflow-y: auto !important;
                font-weight: 400 !important;
                word-wrap: break-word !important;
            }
            
            .gfg-answer-text {
                font-size: 15px !important;
                font-weight: 600 !important;
                color: #ffffff !important;
            }
            
            .gfg-answer-box.found .gfg-answer-text {
                color: #4ecdc4 !important;
            }
            
            .gfg-answer-box.not-found .gfg-answer-text {
                color: #ff6b6b !important;
            }
            
            .gfg-action-buttons {
                display: flex !important;
                gap: 8px !important;
                margin-bottom: 15px !important;
                flex-wrap: nowrap !important;
            }
            
            .gfg-action-btn {
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
            }
            
            .gfg-action-btn.gfg-detect-btn {
                background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%) !important;
                color: #ffffff !important;
            }
            
            .gfg-action-btn.gfg-search-btn {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%) !important;
                color: #ffffff !important;
            }
            
            .gfg-action-btn.gfg-copy-btn {
                background: #3a3a3a !important;
                color: #c0c0c0 !important;
                border: 1px solid #4a4a4a !important;
            }
            
            .gfg-action-btn:hover:not(:disabled) {
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
                filter: brightness(1.1) !important;
            }
            
            .gfg-action-btn:disabled {
                opacity: 0.35 !important;
                cursor: not-allowed !important;
                transform: none !important;
                filter: none !important;
            }
            
            .gfg-action-btn.gfg-search-btn:disabled {
                background: linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%) !important;
            }
            
            .gfg-overlay-status {
                font-size: 10px !important;
                color: #606060 !important;
                text-align: center !important;
                padding-top: 10px !important;
                border-top: 1px solid #3a3a3a !important;
                font-family: 'Consolas', monospace !important;
            }
            
            /* НАСТРОЙКИ - ИСПРАВЛЕНО */
            .gfg-settings-panel {
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
            
            .gfg-settings-panel.gfg-show {
                display: block !important;
            }
            
            .gfg-settings-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 12px 15px !important;
                background: #3a3a3a !important;
                border-bottom: 1px solid #4a4a4a !important;
            }
            
            .gfg-settings-header span {
                font-size: 12px !important;
                font-weight: 600 !important;
                color: #ffffff !important;
            }
            
            .gfg-settings-close-btn {
                width: 24px !important;
                height: 24px !important;
                border: none !important;
                background: transparent !important;
                color: #c0c0c0 !important;
                cursor: pointer !important;
                font-size: 16px !important;
            }
            
            .gfg-settings-close-btn:hover {
                background: #e81123 !important;
                color: #ffffff !important;
            }
            
            .gfg-settings-content {
                padding: 15px !important;
            }
            
            .gfg-setting-item {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 10px !important;
            }
            
            .gfg-setting-item span {
                font-size: 12px !important;
                color: #c0c0c0 !important;
            }
            
            .gfg-lang-select {
                padding: 6px 10px !important;
                background: #3a3a3a !important;
                border: 1px solid #4a4a4a !important;
                color: #ffffff !important;
                font-size: 12px !important;
                cursor: pointer !important;
            }
            
            .gfg-lang-select:focus {
                outline: none !important;
                border-color: #4ecdc4 !important;
            }
            
            .gfg-minimized {
                height: 40px !important;
                overflow: hidden !important;
            }
            
            .gfg-minimized .gfg-content {
                display: none !important;
            }
            
            /* Scrollbar */
            .gfg-question-text::-webkit-scrollbar,
            .gfg-answer-text::-webkit-scrollbar,
            .gfg-settings-content::-webkit-scrollbar {
                width: 6px !important;
            }
            
            .gfg-question-text::-webkit-scrollbar-track,
            .gfg-answer-text::-webkit-scrollbar-track,
            .gfg-settings-content::-webkit-scrollbar-track {
                background: #2b2b2b !important;
            }
            
            .gfg-question-text::-webkit-scrollbar-thumb,
            .gfg-answer-text::-webkit-scrollbar-thumb,
            .gfg-settings-content::-webkit-scrollbar-thumb {
                background: #4a4a4a !important;
            }
            
            .gfg-question-text::-webkit-scrollbar-thumb:hover,
            .gfg-answer-text::-webkit-scrollbar-thumb:hover,
            .gfg-settings-content::-webkit-scrollbar-thumb:hover {
                background: #5a5a5a !important;
            }
        `;
        document.head.appendChild(style);

        return overlay;
    }

    // === АВТО-ОБНОВЛЕНИЕ ВОПРОСА ===
    function autoCheckQuestion() {
        if (!gameDatabase || !currentGame) return;
        
        const question = gameDatabase.extractQuestion(currentGame);
        
        if (question && question !== lastQuestion && question.length >= CONFIG.minQuestionLength) {
            lastQuestion = question;
            currentQuestion = question;
            
            const questionText = document.getElementById('gfg-question-text');
            const questionLength = document.getElementById('gfg-question-length');
            
            if (questionText) {
                questionText.textContent = question.length > 200 ? 
                    question.substring(0, 200) + '...' : question;
            }
            
            if (questionLength) {
                questionLength.textContent = question.length + getText('symbols');
            }
            
            const searchBtn = document.getElementById('gfg-search-btn');
            if (searchBtn) searchBtn.disabled = false;
            
            updateStatus(getText('gameDetected') + gameDatabase.gameConfig[currentGame].name, 'success');
        }
    }

    // === ОПРЕДЕЛЕНИЕ ИГРЫ ===
    function detectGame() {
        if (!gameDatabase) {
            updateStatus(getText('dbError'), 'error');
            return false;
        }

        updateStatus(getText('scanning'), 'searching');
        const statusDot = document.getElementById('gfg-status-dot');
        if (statusDot) statusDot.className = 'gfg-indicator-dot searching';

        setTimeout(() => {
            const detectionResult = gameDatabase.detectGame();
            updateIndicator(detectionResult);
            
            if (detectionResult && detectionResult.gameId) {
                updateStatus(getText('gameDetected') + detectionResult.name + 
                    ' (' + getText('confidence') + detectionResult.confidence + '/2)', 'success');
                const searchBtn = document.getElementById('gfg-search-btn');
                if (searchBtn) searchBtn.disabled = false;
                
                const question = gameDatabase.extractQuestion(detectionResult.gameId);
                if (question) {
                    currentQuestion = question;
                    lastQuestion = question;
                    const questionText = document.getElementById('gfg-question-text');
                    const questionLength = document.getElementById('gfg-question-length');
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
                const searchBtn = document.getElementById('gfg-search-btn');
                if (searchBtn) searchBtn.disabled = true;
            }
            
            const statusDot = document.getElementById('gfg-status-dot');
            if (statusDot) {
                statusDot.className = detectionResult ? 
                    'gfg-indicator-dot active' : 'gfg-indicator-dot';
            }
        }, 500);

        return true;
    }

    // === ПОИСК ОТВЕТА ===
    function searchAnswer() {
        if (!gameDatabase || !currentGame || !currentQuestion) {
            updateStatus(getText('detectFirst'), 'warning');
            return;
        }
        
        updateStatus(getText('scanning'), 'searching');
        const statusDot = document.getElementById('gfg-status-dot');
        if (statusDot) statusDot.className = 'gfg-indicator-dot searching';
        
        setTimeout(() => {
            const result = gameDatabase.findAnswer(currentQuestion, currentGame);
            const answerBox = document.getElementById('gfg-answer-box');
            const answerText = document.getElementById('gfg-answer-text');
            const answerConfidence = document.getElementById('gfg-answer-confidence');
            const copyBtn = document.getElementById('gfg-copy-btn');
            
            if (result) {
                if (answerText) answerText.textContent = result.answer;
                if (answerBox) answerBox.className = 'gfg-answer-box gfg-found';
                if (answerConfidence) answerConfidence.textContent = result.confidence + '%';
                updateStatus(getText('answerFound') + result.confidence + '%)', 'success');
                if (copyBtn) copyBtn.disabled = false;
            } else {
                if (answerText) answerText.textContent = getText('answerNotFound');
                if (answerBox) answerBox.className = 'gfg-answer-box gfg-not-found';
                if (answerConfidence) answerConfidence.textContent = '';
                updateStatus(getText('answerNotFound'), 'error');
                if (copyBtn) copyBtn.disabled = true;
            }
            
            const statusDot = document.getElementById('gfg-status-dot');
            if (statusDot) statusDot.className = 'gfg-indicator-dot active';
        }, 300);
    }

    // === КОПИРОВАНИЕ ОТВЕТА ===
    function copyAnswer() {
        const answerText = document.getElementById('gfg-answer-text');
        if (answerText && answerText.textContent && 
            answerText.textContent !== getText('answerNotFound')) {
            navigator.clipboard.writeText(answerText.textContent).then(() => {
                updateStatus(getText('copySuccess'), 'success');
                setTimeout(() => updateStatus(getText('gameDetected') + 
                    (currentGame ? gameDatabase.gameConfig[currentGame].name : ''), 'info'), 2000);
            });
        }
    }

    // === ПЕРЕКЛЮЧЕНИЕ ЯЗЫКА ===
    function switchLanguage(lang) {
        currentLang = lang;
        
        const elements = {
            '.gfg-overlay-title': 'title',
            '#gfg-detect-btn': 'detectBtn',
            '#gfg-search-btn': 'searchBtn',
            '#gfg-copy-btn': 'copyBtn',
            '.gfg-question-label': 'questionLabel',
            '.gfg-answer-label': 'answerLabel'
        };
        
        for (const [selector, key] of Object.entries(elements)) {
            const el = document.querySelector(selector);
            if (el) el.textContent = getText(key);
        }
        
        const settingsHeader = document.querySelector('.gfg-settings-header span');
        if (settingsHeader) {
            settingsHeader.textContent = '⚙️ ' + getText('langSelect');
        }
        
        if (currentGame && gameDatabase) {
            updateStatus(getText('gameDetected') + gameDatabase.gameConfig[currentGame].name, 'success');
        }
    }

    // === ИНИЦИАЛИЗАЦИЯ ===
    async function initOverlay() {
        const overlay = createOverlay();
        updateStatus(getText('loadingDB'), 'info');
        await loadDatabase();

        // Кнопки действий
        const detectBtn = document.getElementById('gfg-detect-btn');
        const searchBtn = document.getElementById('gfg-search-btn');
        const copyBtn = document.getElementById('gfg-copy-btn');
        
        if (detectBtn) detectBtn.onclick = detectGame;
        if (searchBtn) searchBtn.onclick = searchAnswer;
        if (copyBtn) copyBtn.onclick = copyAnswer;
        
        // Кнопки управления
        const closeBtn = overlay.querySelector('.gfg-close-btn');
        const minimizeBtn = overlay.querySelector('.gfg-minimize-btn');
        
        if (closeBtn) closeBtn.onclick = () => overlay.remove();
        if (minimizeBtn) minimizeBtn.onclick = () => overlay.classList.toggle('gfg-minimized');
        
        // Настройки
        const settingsBtn = overlay.querySelector('.gfg-settings-btn');
        const settingsPanel = document.getElementById('gfg-settings-panel');
        const settingsCloseBtn = document.getElementById('gfg-settings-close-btn');
        const langSelect = document.getElementById('gfg-lang-select');
        
        if (settingsBtn && settingsPanel) {
            settingsBtn.onclick = () => {
                settingsOpen = !settingsOpen;
                if (settingsOpen) {
                    settingsPanel.classList.add('gfg-show');
                } else {
                    settingsPanel.classList.remove('gfg-show');
                }
            };
        }
        
        if (settingsCloseBtn && settingsPanel) {
            settingsCloseBtn.onclick = () => {
                settingsOpen = false;
                settingsPanel.classList.remove('gfg-show');
            };
        }
        
        if (langSelect) {
            langSelect.onchange = (e) => {
                switchLanguage(e.target.value);
                settingsOpen = false;
                if (settingsPanel) settingsPanel.classList.remove('gfg-show');
            };
        }
        
        // Закрытие настроек при клике вне
        document.addEventListener('click', (e) => {
            if (settingsOpen && settingsPanel && 
                !settingsPanel.contains(e.target) && 
                settingsBtn && !settingsBtn.contains(e.target)) {
                settingsOpen = false;
                settingsPanel.classList.remove('gfg-show');
            }
        });

        // Перетаскивание (ИСПРАВЛЕННОЕ)
        const header = overlay.querySelector('.gfg-header');
        let isDragging = false, startX, startY, initialX, initialY;

        if (header) {
            header.onmousedown = (e) => {
                // Игнорируем клики по кнопкам
                if (e.target.closest('.gfg-overlay-btn')) return;
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

        // Авто-проверка вопроса каждые 2 секунды
        setInterval(autoCheckQuestion, CONFIG.checkInterval);

        updateStatus(getText('gameDetected') + getText('notDetected'), 'success');
    }

    // Запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOverlay);
    } else {
        initOverlay();
    }
})();
