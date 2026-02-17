// database.js - База данных для Jackbox Games
// Сохраните этот файл как database.js

const GameDatabase = {
    version: "4.0",
    lastUpdated: "2025-01-15",
    buildDate: new Date("2025-01-15"),
    
    gameConfig: {
        pollposition: {
            name: 'Poll Position',
            requiredIndicators: ['#pollposition-page', '.pollposition-text.question-text'],
            questionSelectors: ['.pollposition-text.question-text', '.pollposition-text.survey-text'],
            backgroundColor: '#2d5a27',
            minConfidence: 2
        },
        fibbage: {
            name: 'Fibbage',
            requiredIndicators: ['#fibbage-page', '#question-text'],
            questionSelectors: ['#question-text', '.fibbage-question'],
            backgroundColor: '#5a4a2d',
            minConfidence: 2
        },
        fibbage3: {
            name: 'Fibbage 3',
            requiredIndicators: ['#fibbage3-page', '#prompt > div > div'],
            questionSelectors: ['#prompt > div > div', '.fibbage3-prompt'],
            backgroundColor: '#5a2d4a',
            minConfidence: 2
        }
    },

    questions: {
        pollposition: [
            { question: "What percentage of people wipe their butts while standing up?", answer: "23" },
            { question: "What percentage of people said they would keep working at their jobs if they won $900 million in a lottery?", answer: "37" },
            { question: "What percentage of people use cotton swabs to clean out their ears pretty much every day?", answer: "33" },
            { question: "What percentage of people believe that they are not average, not just smarter, but MUCH smarter than the average person?", answer: "25" },
            { question: "What percentage of people usually let their gas gauges get to or below E before refilling?", answer: "29" }
        ],
        fibbage: [
            { question: "a kickstarter campaign met its $30,000 goal on april 7, 2012 for its shoes designed for _______.", answer: "atheists" },
            { question: "kevin spacey's older brother is a _______ impersonator.", answer: "Rod Stewart" },
            { question: "andrew wilson, a man from branson, missouri, legally changed his name to simply _______.", answer: "They" },
            { question: "pentheraphobia is the constant fear of your _______.", answer: "mother-in-law" },
            { question: "under peter the great, noblemen had to pay 100 rubles a year for a _______ license.", answer: "beard" }
        ],
        fibbage3: [
            { question: "president warren g. harding was a fan of poker. in one game he ended up gambling away the white house _______.", answer: "china" },
            { question: "when a male bee orgasms, his testicles _______.", answer: "explode" },
            { question: "kackel dackel is a german toy where kids use a pump to help a dachshund _______.", answer: "poop" },
            { question: "schwangerschaftsverhütungsmittel is the german word for _______.", answer: "contraceptive" },
            { question: "snowflame is a supervillain in the dc universe who got his powers from _______.", answer: "cocaine" }
        ]
    },

    detectGame: function() {
        for (const [gameId, config] of Object.entries(this.gameConfig)) {
            let confidence = 0;
            const foundIndicators = [];
            
            for (const selector of config.requiredIndicators) {
                const element = document.querySelector(selector);
                if (element && element.innerText.trim().length > 0) {
                    confidence++;
                    foundIndicators.push(selector);
                }
            }
            
            for (const selector of config.questionSelectors) {
                const element = document.querySelector(selector);
                if (element && element.innerText.trim().length > 20) {
                    confidence++;
                    foundIndicators.push(selector + ' (text)');
                    break;
                }
            }
            
            if (confidence >= config.minConfidence) {
                return { gameId, confidence, foundIndicators, name: config.name };
            }
        }
        return null;
    },

    extractQuestion: function(gameId) {
        const config = this.gameConfig[gameId];
        if (!config) return null;

        for (const selector of config.questionSelectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText.trim().length > 15) {
                return element.innerText.trim();
            }
        }
        return null;
    },

    findAnswer: function(question, gameId) {
        const questions = this.questions[gameId];
        if (!questions || !question) return null;

        const normalizedQuestion = question.toLowerCase().replace(/[^\w\sа-яё]/gi, '').replace(/\s+/g, ' ').trim();

        for (const item of questions) {
            const normalizedDB = item.question.toLowerCase().replace(/[^\w\sа-яё]/gi, '').replace(/\s+/g, ' ').trim();
            
            if (normalizedQuestion === normalizedDB) {
                return { answer: item.answer, confidence: 100 };
            }
            
            if (normalizedQuestion.includes(normalizedDB.substring(0, 50)) ||
                normalizedDB.includes(normalizedQuestion.substring(0, 50))) {
                return { answer: item.answer, confidence: 75 };
            }
        }
        return null;
    },

    getVersionInfo: function() {
        const now = new Date();
        const daysSinceUpdate = Math.floor((now - this.buildDate) / (1000 * 60 * 60 * 24));
        return {
            version: this.version,
            lastUpdated: this.lastUpdated,
            daysSinceUpdate: daysSinceUpdate,
            isOutdated: daysSinceUpdate > 30
        };
    }
};

window.GameDatabase = GameDatabase;