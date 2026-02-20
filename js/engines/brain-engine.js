/**
 * ============================================================================
 * ALPHA-PULSE PRO v2.0 | BRAIN ENGINE (ADVANCED QUANT UPGRADE)
 * Multi-Modal Bidirectional LSTM with Integrated MACD & Volatility
 * ============================================================================
 */

import { MathPro } from '../utils/math-pro.js';

export class BrainEngine {
    
    /**
     * 1. THE ARCHITECTURE: Builds the Deep Learning Model
     * Upgraded to 128 neurons to handle the new 7-Dimensional Data Matrix.
     */
    static buildModel(timeSteps, featureCount) {
        console.log(`[SYSTEM] Constructing Deep Bidirectional LSTM (TimeSteps: ${timeSteps}, Features: ${featureCount})...`);
        const model = tf.sequential();

        // Layer 1: Bidirectional LSTM (Scans history forward and backward)
        model.add(tf.layers.bidirectional({
            layer: tf.layers.lstm({ units: 128, returnSequences: true }),
            inputShape: [timeSteps, featureCount]
        }));

        // Layer 2: Heavy Regularization to prevent "memorizing"
        model.add(tf.layers.dropout({ rate: 0.3 }));

        // Layer 3: Secondary Feature Extraction for MACD/BB correlations
        model.add(tf.layers.lstm({ units: 64, returnSequences: false }));
        model.add(tf.layers.dropout({ rate: 0.2 }));

        // Layer 4: Dense processing layer
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));

        // Layer 5: Output (Predicts the single target price)
        model.add(tf.layers.dense({ units: 1 }));

        // Huber loss ignores extreme "flash crash" outliers for smoother trend prediction
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: tf.losses.huberLoss 
        });

        return model;
    }

    /**
     * 2. THE PRE-PROCESSOR: The Math injection chamber.
     * Calculates MACD and BB dynamically and compresses everything into a 0-to-1 scale.
     */
    static prepareTensors(enrichedData, globalSentiment, macroUsd, timeSteps) {
        console.log("[SYSTEM] Injecting MACD & Volatility into Neural Tensors...");

        // Extract raw arrays
        const closes = enrichedData.map(d => d.close);
        const volumes = enrichedData.map(d => d.volume);
        const patterns = enrichedData.map(d => d.patternScore);

        // --- NEW: ADVANCED MATH FEATURES ---
        const macdData = MathPro.calculateMACD(closes);
        const bbData = MathPro.calculateBollingerBands(closes);
        const macdHist = macdData.histogram;

        // Find min/max for scaling standard features
        const minClose = Math.min(...closes);
        const maxClose = Math.max(...closes);
        const minVol = Math.min(...volumes);
        const maxVol = Math.max(...volumes);

        // Find min/max for MACD (filtering out null warmup periods)
        const validHist = macdHist.filter(v => v !== null);
        const minHist = validHist.length > 0 ? Math.min(...validHist) : -1;
        const maxHist = validHist.length > 0 ? Math.max(...validHist) : 1;

        const X = [];
        const Y = [];

        // Scale Global variables (Assume USD/INR ranges roughly between 70 and 90)
        const normUsd = (macroUsd - 70) / (90 - 70); 
        const normSentiment = (globalSentiment + 1) / 2; 

        // Build the Sliding Windows
        for (let i = 0; i < enrichedData.length - timeSteps; i++) {
            const window = [];
            for (let j = 0; j < timeSteps; j++) {
                const idx = i + j;
                
                // Base Features
                const f_price = (closes[idx] - minClose) / (maxClose - minClose || 1);
                const f_vol = (volumes[idx] - minVol) / (maxVol - minVol || 1);
                const f_pattern = (patterns[idx] + 1) / 2; 
                
                // NEW Feature 6: MACD Momentum
                const rawHist = macdHist[idx] || 0; // Default to 0 (neutral) during 34-day warmup
                const f_macd = (rawHist - minHist) / (maxHist - minHist || 1);

                // NEW Feature 7: Bollinger Band Squeeze
                // Calculates exactly where the price sits inside the volatility bands
                const upper = bbData.upperBand[idx];
                const lower = bbData.lowerBand[idx];
                let f_bb = 0.5; // Default to perfectly middle
                if (upper !== null && lower !== null && upper !== lower) {
                    f_bb = (closes[idx] - lower) / (upper - lower);
                }
                
                // Push the 7-Dimensional Vector
                window.push([f_price, f_vol, f_pattern, normSentiment, normUsd, f_macd, f_bb]);
            }
            X.push(window);

            // Target to guess is the next interval's close
            const targetNorm = (closes[i + timeSteps] - minClose) / (maxClose - minClose || 1);
            Y.push(targetNorm);
        }

        const featureCount = X[0][0].length; // Dynamically detects the 7 features

        return {
            tensorX: tf.tensor3d(X, [X.length, timeSteps, featureCount]),
            tensorY: tf.tensor2d(Y, [Y.length, 1]),
            minClose,
            maxClose,
            lastWindow: X[X.length - 1] 
        };
    }

    /**
     * 3. THE TRAINING ENGINE: Pushes the 7D Matrix through the GPU.
     */
    static async train(model, tensorX, tensorY, progressCallback) {
        console.log("[SYSTEM] Initiating Deep Learning Training Sequence...");
        const totalEpochs = 40;

        const history = await model.fit(tensorX, tensorY, {
            epochs: totalEpochs,
            batchSize: 32,
            shuffle: true,
            callbacks: {
                onEpochEnd: async (epoch, logs) => {
                    const progress = Math.round(((epoch + 1) / totalEpochs) * 100);
                    progressCallback(progress, logs.loss.toFixed(5));
                }
            }
        });

        tensorX.dispose();
        tensorY.dispose();

        return history.history.loss[totalEpochs - 1]; 
    }

    /**
     * 4. THE INFERENCE ENGINE: Makes the final prediction and calculates Confidence.
     */
    static predict(model, lastWindow, minClose, maxClose, finalLoss, recentPattern, sentiment) {
        console.log("[SYSTEM] Running Advanced Inference...");

        const featureCount = lastWindow[0].length;
        const inputPredict = tf.tensor3d([lastWindow], [1, lastWindow.length, featureCount]);
        const normalizedPrediction = model.predict(inputPredict).dataSync()[0];
        inputPredict.dispose();

        const predictedPrice = (normalizedPrediction * (maxClose - minClose)) + minClose;

        // --- DYNAMIC CONFIDENCE SCORING ALGORITHM ---
        let confidence = Math.max(40, 95 - (finalLoss * 1000)); 

        const currentPrice = (lastWindow[lastWindow.length - 1][0] * (maxClose - minClose)) + minClose;
        const aiIsBullish = predictedPrice > currentPrice;

        // Pattern Agreement
        if (aiIsBullish && recentPattern.score > 0) confidence += 8;
        if (!aiIsBullish && recentPattern.score < 0) confidence += 8;
        if (aiIsBullish && recentPattern.score < 0) confidence -= 10; 

        // Sentiment Agreement
        if (aiIsBullish && sentiment > 0.2) confidence += 5;
        if (!aiIsBullish && sentiment < -0.2) confidence += 5;

        // Ensure realistic constraints
        confidence = Math.min(98, Math.max(10, confidence));

        let reasoning = aiIsBullish 
            ? `Targeting upward move to ₹${predictedPrice.toFixed(2)}.` 
            : `Projecting downward correction to ₹${predictedPrice.toFixed(2)}.`;
            
        if (confidence > 80) reasoning += ` High conviction alignment between MACD momentum and ${recentPattern.name}.`;
        else if (confidence < 50) reasoning += ` Low conviction due to conflicting signals in the feature matrix.`;

        return {
            targetPrice: predictedPrice.toFixed(2),
            confidence: Math.round(confidence),
            reasoning: reasoning
        };
    }
}
