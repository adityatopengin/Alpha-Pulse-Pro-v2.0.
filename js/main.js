/**
 * ============================================================================
 * ALPHA-PULSE PRO v2.0 | MASTER ORCHESTRATOR
 * Connects the UI Terminal to the Data, Pattern, Math, and Brain Engines.
 * ============================================================================
 */

import { getMarketMatrix } from './engines/data-engine.js';
import { PatternEngine } from './engines/pattern-engine.js';
import { BrainEngine } from './engines/brain-engine.js';
import { MathPro } from './utils/math-pro.js'; // <-- NEW: Imported Quant Library

// --- SYSTEM CONFIGURATION ---
const TIME_STEPS = 10;      // How many past intervals the AI looks at to guess the next
const FEATURE_COUNT = 7;    // Price, Volume, PatternScore, Sentiment, Macro
let activeChart = null;     // Holds the Chart.js instance

// --- DOM ELEMENTS ---
const elements = {
    apiKey: document.getElementById('api-key'),
    ticker: document.getElementById('ticker'),
    toggle: document.getElementById('timeframe-toggle'),
    btn: document.getElementById('predict-btn'),
    
    // Brain UI
    target: document.getElementById('ai-target'),
    confPct: document.getElementById('confidence-pct'),
    confFill: document.getElementById('confidence-fill'),
    reasoning: document.getElementById('ai-reasoning'),
    
    // Technical & Macro UI
    rsi: document.getElementById('ind-rsi'),
    macd: document.getElementById('ind-macd'),
    vol: document.getElementById('ind-vol'),
    pattern: document.getElementById('ind-pattern'),
    news: document.getElementById('env-news'),
    usd: document.getElementById('env-usd'),
    
    // Status
    status: document.getElementById('data-status')
};

// --- CORE EXECUTION SEQUENCE ---
elements.btn.addEventListener('click', async () => {
    const apiKey = elements.apiKey.value.trim();
    const ticker = elements.ticker.value.trim();
    const isIntraday = elements.toggle.checked;

    if (!apiKey && !isIntraday) return console.error("Swing mode requires Alpha Vantage API Key.");
    if (!ticker) return console.error("Missing Ticker Symbol.");

    try {
        // 1. SYSTEM LOCK & UI RESET
        elements.btn.disabled = true;
        elements.btn.innerText = "PROCESSING MATRIX...";
        elements.target.innerText = "CALCULATING";
        elements.confFill.style.width = '0%';
        elements.status.className = "badge badge-neutral";
        elements.status.innerText = "Ingesting Data";

        console.log(`\n[SYSTEM] --- INITIATING ${isIntraday ? "INTRADAY" : "SWING"} PROTOCOL FOR ${ticker} ---`);

        // 2. DATA INGESTION (Multi-Modal)
        const matrix = await getMarketMatrix(ticker, apiKey, isIntraday);
        
        // 3. PATTERN RECOGNITION (Math Eyes)
        console.log("[SYSTEM] Passing OHLCV to Pattern Engine...");
        const enrichedData = PatternEngine.enrichDataset(matrix.ohlcv);
        const latestData = enrichedData[enrichedData.length - 1];

        // --- UPDATE DASHBOARD INDICATORS ---
        elements.pattern.innerText = latestData.patternName;
        elements.pattern.className = `card-value ${latestData.patternScore > 0 ? 'text-success' : (latestData.patternScore < 0 ? 'text-danger' : 'text-warning')}`;
        
        elements.news.innerText = matrix.sentiment > 0.2 ? "Bullish" : (matrix.sentiment < -0.2 ? "Bearish" : "Neutral");
        elements.usd.innerText = `₹${matrix.usdInr.toFixed(2)}`;
        elements.vol.innerText = latestData.volume ? Number(latestData.volume).toLocaleString('en-IN') : "N/A";
        
        // --- NEW: ADVANCED MATH INTEGRATION ---
        // We need the entire history of closing prices to calculate accurate EMAs and MACD
        const allPrices = enrichedData.map(d => d.close);
        
        // Generate MACD & Bollinger Band Status
        const marketStatus = MathPro.generateMarketStatus(allPrices);
        elements.macd.innerText = marketStatus.macdStatus;
        
        // Color-code the MACD UI dynamically based on the math
        if (marketStatus.macdStatus.includes("Bullish")) {
            elements.macd.className = "card-value text-success";
        } else if (marketStatus.macdStatus.includes("Bearish")) {
            elements.macd.className = "card-value text-danger";
        } else {
            elements.macd.className = "card-value text-warning";
        }

        // Basic RSI calculation for the UI display (using last 15 days)
        elements.rsi.innerText = calculateBasicRSI(allPrices.slice(-15));

        // 4. NEURAL NETWORK PROCESSING
        elements.status.innerText = "Training Neural Cortex";
        elements.status.style.backgroundColor = "var(--accent-blue)";
        elements.reasoning.innerText = "Compiling Bidirectional LSTM Layers...";

        const prep = BrainEngine.prepareTensors(enrichedData, matrix.sentiment, matrix.usdInr, TIME_STEPS);
        const model = BrainEngine.buildModel(TIME_STEPS, FEATURE_COUNT);

        const finalLoss = await BrainEngine.train(model, prep.tensorX, prep.tensorY, (progress, loss) => {
            elements.confFill.style.width = `${progress}%`;
            elements.reasoning.innerText = `Training AI... Epoch: ${progress}% | Huber Loss: ${loss}`;
        });

        // 5. INFERENCE & CONFIDENCE SCORING
        elements.status.innerText = "Running Inference";
        const prediction = BrainEngine.predict(
            model, 
            prep.lastWindow, 
            prep.minClose, 
            prep.maxClose, 
            finalLoss, 
            { name: latestData.patternName, score: latestData.patternScore },
            matrix.sentiment
        );

        // --- FINAL UI RENDER ---
        elements.target.innerText = `₹${prediction.targetPrice}`;
        elements.confPct.innerText = `${prediction.confidence}%`;
        elements.confFill.style.width = `${prediction.confidence}%`;
        
        // Color code the confidence bar
        elements.confFill.style.backgroundColor = prediction.confidence > 75 ? "var(--accent-green)" : (prediction.confidence > 50 ? "var(--accent-warning)" : "var(--accent-red)");
        
        // Inject the Bollinger Band status into the AI's reasoning for extra context
        elements.reasoning.innerText = `${prediction.reasoning} Market is currently ${marketStatus.bbStatus}.`;
        
        elements.status.innerText = "Analysis Complete";
        elements.status.style.backgroundColor = "var(--accent-green)";
        elements.btn.innerText = "INITIALIZE AI";

        // Draw the visual chart
        renderChart(enrichedData, prediction.targetPrice, ticker, isIntraday);

        console.log(`[SUCCESS] Sequence Complete. AI Target: ₹${prediction.targetPrice} (${prediction.confidence}% Confidence).`);

    } catch (error) {
        elements.status.innerText = "System Failure";
        elements.status.style.backgroundColor = "var(--accent-red)";
        elements.reasoning.innerText = "Halted: Check Terminal for error logs.";
        console.error(error.message);
    } finally {
        elements.btn.disabled = false;
        elements.btn.innerText = "INITIALIZE AI";
    }
});

// --- HELPER: BASIC RSI CALCULATION ---
function calculateBasicRSI(prices) {
    if (prices.length < 15) return "--";
    let gains = 0, losses = 0;
    for (let i = 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const rs = (gains / 14) / (Math.abs(losses) / 14 || 1);
    return (100 - (100 / (1 + rs))).toFixed(1);
}

// --- VISUALIZER: CHART.JS RENDERER ---
function renderChart(data, targetPrice, ticker, isIntraday) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (activeChart) activeChart.destroy();

    const labels = data.map(d => d.date);
    const prices = data.map(d => d.close);

    // Add tomorrow's projection
    labels.push(isIntraday ? "Next 5-Min" : "Next Day");
    const projectionData = Array(prices.length - 1).fill(null);
    projectionData.push(prices[prices.length - 1]); // Connect last real price
    projectionData.push(targetPrice);               // To predicted price

    activeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${ticker.toUpperCase()} History`,
                    data: prices,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'AI Probabilistic Target',
                    data: projectionData,
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981',
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#a1a1aa', font: { family: 'Inter' } } }
            },
            scales: {
                x: { ticks: { color: '#a1a1aa', maxTicksLimit: 8 }, grid: { color: '#27272a' } },
                y: { ticks: { color: '#a1a1aa' }, grid: { color: '#27272a' } }
            }
        }
    });
}
 
