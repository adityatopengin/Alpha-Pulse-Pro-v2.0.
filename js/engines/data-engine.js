/**
 * ============================================================================
 * ALPHA-PULSE PRO v2.0 | DATA ENGINE
 * Orchestrates multi-source data ingestion (OHLCV, Intraday, Sentiment, Macro)
 * ============================================================================
 */

// 1. SWING MODE: Historical Daily Data (Alpha Vantage)
export async function fetchSwingData(ticker, apiKey) {
    let symbol = ticker.toUpperCase().trim();
    if (!symbol.includes('.') && !symbol.startsWith('^')) symbol += '.BSE';

    console.log(`[SYSTEM] Fetching Swing Data (Daily OHLCV) for ${symbol}...`);
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data["Time Series (Daily)"]) {
        throw new Error("Alpha Vantage API limit reached or invalid ticker.");
    }

    // Format into chronological OHLCV array for the Pattern Engine
    const rawData = data["Time Series (Daily)"];
    const dates = Object.keys(rawData).reverse();
    
    const ohlcv = dates.map(date => ({
        date: date,
        open: parseFloat(rawData[date]["1. open"]),
        high: parseFloat(rawData[date]["2. high"]),
        low: parseFloat(rawData[date]["3. low"]),
        close: parseFloat(rawData[date]["4. close"]),
        volume: parseFloat(rawData[date]["5. volume"])
    }));

    console.log(`[SUCCESS] Loaded ${ohlcv.length} days of Swing history.`);
    return ohlcv;
}

// 2. INTRADAY MODE: Live 5-Min Data (Yahoo Finance Proxy Scraper)
export async function fetchIntradayData(ticker) {
    let symbol = ticker.toUpperCase().trim();
    // Translate Alpha Vantage ticker format to Yahoo Finance format
    if (symbol.endsWith('.NSE')) symbol = symbol.replace('.NSE', '.NS');
    if (symbol.endsWith('.BSE')) symbol = symbol.replace('.BSE', '.BO');

    console.log(`[SYSTEM] Initiating Stealth Scraper for 5-Min Intraday ticks: ${symbol}...`);
    
    // Request 5 days of 5-minute interval data
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=5m`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Proxy connection failed.");
        
        const data = await response.json();
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        const ohlcv = [];
        for (let i = 0; i < timestamps.length; i++) {
            // Ignore empty market-closed intervals
            if (quotes.close[i] !== null) { 
                ohlcv.push({
                    date: new Date(timestamps[i] * 1000).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'}),
                    open: parseFloat(quotes.open[i].toFixed(2)),
                    high: parseFloat(quotes.high[i].toFixed(2)),
                    low: parseFloat(quotes.low[i].toFixed(2)),
                    close: parseFloat(quotes.close[i].toFixed(2)),
                    volume: quotes.volume[i]
                });
            }
        }

        console.log(`[SUCCESS] Extracted ${ohlcv.length} live Intraday ticks.`);
        return ohlcv;

    } catch (error) {
        console.error("Intraday Scraper Failed:", error);
        throw new Error("Could not bypass Yahoo API restrictions. Try again in 60 seconds.");
    }
}

// 3. SENTIMENT ENGINE: NLP News Scoring (Alpha Vantage)
export async function fetchNewsSentiment(ticker, apiKey) {
    let baseSymbol = ticker.toUpperCase().trim();
    if (baseSymbol.includes('.')) baseSymbol = baseSymbol.split('.')[0]; 

    console.log(`[SYSTEM] Scanning financial headlines for ${baseSymbol}...`);
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${baseSymbol}&apikey=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        let totalSentiment = 0;
        let articleCount = 0;

        if (data.feed && data.feed.length > 0) {
            data.feed.forEach(article => {
                const tickerData = article.ticker_sentiment.find(t => t.ticker === baseSymbol);
                if (tickerData) {
                    totalSentiment += parseFloat(tickerData.ticker_sentiment_score);
                    articleCount++;
                }
            });
        }
        
        const finalScore = articleCount > 0 ? (totalSentiment / articleCount) : 0.15;
        console.log(`[SUCCESS] Sentiment calculated: ${finalScore.toFixed(2)} based on ${articleCount} articles.`);
        return finalScore;
    } catch (err) {
        console.error("News API failed, defaulting to neutral sentiment.", err);
        return 0.15; // Neutral drift fallback
    }
}

// 4. MACRO ENVIRONMENT: Live Currency Impact (Yahoo Proxy)
export async function fetchMacroEnvironment() {
    console.log(`[SYSTEM] Checking USD/INR Macro Environment...`);
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/INR=X?range=1d&interval=1d`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const price = data.chart.result[0].meta.regularMarketPrice;
        
        console.log(`[SUCCESS] USD/INR pegged at ₹${price.toFixed(2)}`);
        return price;
    } catch (error) {
        console.error("Macro fetch failed. Defaulting to ₹83.00.", error);
        return 83.00;
    }
}

// 5. THE MASTER SYNC: Bundles all data streams based on UI Toggle
export async function getMarketMatrix(ticker, apiKey, isIntraday) {
    try {
        // Run fetches in parallel for maximum speed
        const [ohlcv, sentiment, usdInr] = await Promise.all([
            isIntraday ? fetchIntradayData(ticker) : fetchSwingData(ticker, apiKey),
            fetchNewsSentiment(ticker, apiKey),
            fetchMacroEnvironment()
        ]);

        return {
            mode: isIntraday ? "INTRADAY" : "SWING",
            ohlcv: ohlcv,
            sentiment: sentiment,
            usdInr: usdInr
        };
    } catch (error) {
        throw new Error(`Data Matrix Failure: ${error.message}`);
    }
}

