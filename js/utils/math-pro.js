/**
 * ============================================================================
 * ALPHA-PULSE PRO v2.0 | QUANTITATIVE MATH LIBRARY
 * Calculates advanced technical indicators: EMA, MACD, Bollinger Bands, StdDev
 * ============================================================================
 */

export class MathPro {
    
    /**
     * SIMPLE MOVING AVERAGE (SMA)
     * Calculates the average price over a specific number of periods.
     */
    static calculateSMA(data, period) {
        const sma = new Array(data.length).fill(null);
        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            const sum = slice.reduce((a, b) => a + b, 0);
            sma[i] = sum / period;
        }
        return sma;
    }

    /**
     * EXPONENTIAL MOVING AVERAGE (EMA)
     * Gives more weight to recent prices, making it react faster than SMA.
     */
    static calculateEMA(data, period) {
        const ema = new Array(data.length).fill(null);
        const k = 2 / (period + 1); // Smoothing constant
        
        // The first EMA is just the SMA of the first 'period' days
        let initialSum = 0;
        for (let i = 0; i < period; i++) {
            initialSum += data[i];
        }
        ema[period - 1] = initialSum / period;

        // Calculate the rest using the EMA formula
        for (let i = period; i < data.length; i++) {
            ema[i] = (data[i] * k) + (ema[i - 1] * (1 - k));
        }
        return ema;
    }

    /**
     * STANDARD DEVIATION (StdDev)
     * Measures market volatility. High StdDev = wild swings.
     */
    static calculateStdDev(data, period, smaArray) {
        const stdDev = new Array(data.length).fill(null);
        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            const mean = smaArray[i];
            
            // Calculate variance
            const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
            stdDev[i] = Math.sqrt(variance);
        }
        return stdDev;
    }

    /**
     * BOLLINGER BANDS (Volatility & Mean Reversion)
     * Returns the Upper Band, Middle Band (SMA 20), and Lower Band.
     */
    static calculateBollingerBands(prices, period = 20, multiplier = 2) {
        const sma = this.calculateSMA(prices, period);
        const stdDev = this.calculateStdDev(prices, period, sma);
        
        const upperBand = new Array(prices.length).fill(null);
        const lowerBand = new Array(prices.length).fill(null);

        for (let i = period - 1; i < prices.length; i++) {
            upperBand[i] = sma[i] + (stdDev[i] * multiplier);
            lowerBand[i] = sma[i] - (stdDev[i] * multiplier);
        }

        return { upperBand, middleBand: sma, lowerBand };
    }

    /**
     * MACD (Moving Average Convergence Divergence)
     * The ultimate momentum indicator. Returns the MACD Line, Signal Line, and Histogram.
     */
    static calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const fastEMA = this.calculateEMA(prices, fastPeriod);
        const slowEMA = this.calculateEMA(prices, slowPeriod);
        
        const macdLine = new Array(prices.length).fill(null);
        
        // Calculate MACD Line (Fast EMA - Slow EMA)
        for (let i = slowPeriod - 1; i < prices.length; i++) {
            macdLine[i] = fastEMA[i] - slowEMA[i];
        }

        // Calculate Signal Line (9-EMA of the MACD Line)
        // We have to filter out nulls before calculating EMA of the MACD line
        const validMacd = macdLine.filter(val => val !== null);
        const rawSignal = this.calculateEMA(validMacd, signalPeriod);
        
        const signalLine = new Array(prices.length).fill(null);
        const histogram = new Array(prices.length).fill(null);

        // Re-align the signal line with the original array timeline
        let signalIndex = 0;
        for (let i = slowPeriod - 1 + signalPeriod - 1; i < prices.length; i++) {
            signalLine[i] = rawSignal[signalPeriod - 1 + signalIndex];
            histogram[i] = macdLine[i] - signalLine[i];
            signalIndex++;
        }

        return { macdLine, signalLine, histogram };
    }

    /**
     * SIGNAL GENERATOR
     * Reads the MACD and Bollinger Bands to output a human-readable status for the UI.
     */
    static generateMarketStatus(prices) {
        if (prices.length < 35) return { macdStatus: "Insufficient Data", bbStatus: "Insufficient Data" };

        const macd = this.calculateMACD(prices);
        const bb = this.calculateBollingerBands(prices);

        const lastPrice = prices[prices.length - 1];
        
        // Extract latest valid MACD values
        const lastMacd = macd.macdLine[macd.macdLine.length - 1];
        const lastSignal = macd.signalLine[macd.signalLine.length - 1];
        const prevMacd = macd.macdLine[macd.macdLine.length - 2];
        const prevSignal = macd.signalLine[macd.signalLine.length - 2];

        // MACD Logic: Check for recent crossovers
        let macdStatus = "Neutral";
        if (prevMacd < prevSignal && lastMacd > lastSignal) macdStatus = "Bullish Cross (Buy)";
        else if (prevMacd > prevSignal && lastMacd < lastSignal) macdStatus = "Bearish Cross (Sell)";
        else if (lastMacd > lastSignal) macdStatus = "Bullish Momentum";
        else if (lastMacd < lastSignal) macdStatus = "Bearish Momentum";

        // Bollinger Band Logic: Squeeze or Breakout
        let bbStatus = "In Range";
        const lastUpper = bb.upperBand[bb.upperBand.length - 1];
        const lastLower = bb.lowerBand[bb.lowerBand.length - 1];
        
        if (lastPrice >= lastUpper) bbStatus = "Overbought (Upper Band)";
        else if (lastPrice <= lastLower) bbStatus = "Oversold (Lower Band)";

        return { macdStatus, bbStatus };
    }
}

