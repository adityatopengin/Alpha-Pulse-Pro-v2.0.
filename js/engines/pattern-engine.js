/**
 * ============================================================================
 * ALPHA-PULSE PRO v2.0 | PATTERN ENGINE
 * Translates raw OHLC market data into psychological candlestick patterns.
 * ============================================================================
 */

export class PatternEngine {
    
    /**
     * Scans the provided OHLCV array and attaches detected patterns.
     * @param {Array} ohlcvData - Array of objects {open, high, low, close, volume}
     * @returns {Object} - The most recent pattern detected and a pattern score.
     */
    static analyze(ohlcvData) {
        if (!ohlcvData || ohlcvData.length < 2) return { name: "Insufficient Data", score: 0 };

        // Grab the two most recent candles for pattern matching
        const current = ohlcvData[ohlcvData.length - 1];
        const previous = ohlcvData[ohlcvData.length - 2];

        // 1. Calculate Core Candle Metrics
        const bodySize = Math.abs(current.open - current.close);
        const totalRange = current.high - current.low || 1; // Prevent division by zero
        const isBullish = current.close > current.open;
        
        const upperWick = isBullish ? (current.high - current.close) : (current.high - current.open);
        const lowerWick = isBullish ? (current.open - current.low) : (current.close - current.low);

        const prevBodySize = Math.abs(previous.open - previous.close);
        const prevIsBullish = previous.close > previous.open;

        // 2. Pattern Detection Rules (Strict Math)
        
        // A. DOJI: Opening and closing prices are virtually identical (indecision)
        if (bodySize <= totalRange * 0.05) {
            return { name: "Doji (Indecision)", score: 0 };
        }

        // B. HAMMER: Small body at the top, long lower wick (Rejection of lower prices)
        if (lowerWick >= bodySize * 2 && upperWick <= bodySize * 0.2) {
            return { name: "Hammer (Bullish)", score: 0.8 };
        }

        // C. SHOOTING STAR: Small body at the bottom, long upper wick (Rejection of higher prices)
        if (upperWick >= bodySize * 2 && lowerWick <= bodySize * 0.2) {
            return { name: "Shooting Star (Bearish)", score: -0.8 };
        }

        // D. BULLISH ENGULFING: Current green body completely swallows previous red body
        if (isBullish && !prevIsBullish && 
            current.close > previous.open && 
            current.open < previous.close) {
            return { name: "Bullish Engulfing", score: 1.0 };
        }

        // E. BEARISH ENGULFING: Current red body completely swallows previous green body
        if (!isBullish && prevIsBullish && 
            current.open > previous.close && 
            current.close < previous.open) {
            return { name: "Bearish Engulfing", score: -1.0 };
        }

        // F. STRONG MOMENTUM: Massive body with almost no wicks (Marubozu)
        if (bodySize >= totalRange * 0.9) {
            return isBullish 
                ? { name: "Strong Bullish Momentum", score: 0.6 }
                : { name: "Strong Bearish Momentum", score: -0.6 };
        }

        // Default: No major psychological pattern detected
        return { name: "Standard Price Action", score: 0 };
    }

    /**
     * Batch process: Adds a 'patternScore' to every day in the historical array
     * so the LSTM Neural Network can train on these mathematical shapes.
     */
    static enrichDataset(ohlcvData) {
        console.log(`[SYSTEM] Pattern Engine analyzing ${ohlcvData.length} candles for structural anomalies...`);
        
        const enrichedData = [];
        for (let i = 0; i < ohlcvData.length; i++) {
            // We need at least 1 previous day to check for Engulfing patterns
            const window = ohlcvData.slice(Math.max(0, i - 1), i + 1);
            const pattern = this.analyze(window);
            
            enrichedData.push({
                ...ohlcvData[i],
                patternName: pattern.name,
                patternScore: pattern.score // A normalized feature (-1 to 1) for the AI
            });
        }
        return enrichedData;
    }
}

