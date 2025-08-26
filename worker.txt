import * as curveMatcher from 'curve-matcher';
import Dtw from 'dynamic-time-warping';

function resamplePath(path, numPoints) {
    const newPath = path.length > 0 ? [{ ...path[0] }] : [];
    const originalLength = path.length;
    if (originalLength < 2) return path;

    let totalDist = 0;
    for (let i = 1; i < originalLength; i++) {
        totalDist += Math.sqrt(Math.pow(path[i].x - path[i - 1].x, 2) + Math.pow(path[i].y - path[i - 1].y, 2));
    }

    if (totalDist === 0) return path;

    const interval = totalDist / (numPoints - 1);
    let accumulatedDist = 0;
    let currentPointIndex = 1;

    for (let i = 1; i < numPoints - 1; i++) {
        const targetDist = i * interval;
        while (accumulatedDist < targetDist && currentPointIndex < originalLength) {
            accumulatedDist += Math.sqrt(Math.pow(path[currentPointIndex].x - path[currentPointIndex - 1].x, 2) + Math.pow(path[currentPointIndex].y - path[currentPointIndex - 1].y, 2));
            currentPointIndex++;
        }

        const prevPoint = path[currentPointIndex - 2];
        const nextPoint = path[currentPointIndex - 1];
        const segmentDist = Math.sqrt(Math.pow(nextPoint.x - prevPoint.x, 2) + Math.pow(nextPoint.y - prevPoint.y, 2));
        const distOver = accumulatedDist - targetDist;
        const ratio = segmentDist > 0 ? (segmentDist - distOver) / segmentDist : 0;

        const x = prevPoint.x + ratio * (nextPoint.x - prevPoint.x);
        const y = prevPoint.y + ratio * (nextPoint.y - prevPoint.y);
        newPath.push({ x, y });
    }

    newPath.push({ ...path[originalLength - 1] });
    return newPath;
}

self.onmessage = (event) => {
    try {
        const { drawnPathData, fileContents, rootKey, yKey, estimationPoints, canvasHeight, analysisMethod, frechetWeight, dtwWeight } = event.data;

        const results = [];
        const totalFiles = fileContents.length;
        const NUM_POINTS = estimationPoints || 100;

        const userMinX = Math.min(...drawnPathData.map(p => p.x));
        const userMaxX = Math.max(...drawnPathData.map(p => p.x));
        const userXRange = userMaxX - userMinX;
        
        fileContents.forEach((file, index) => {
            try {
                const jsonData = JSON.parse(file.content);
                const dataArray = jsonData[rootKey];

                if (!dataArray || !Array.isArray(dataArray) || dataArray.length < 2) {
                    return;
                }

                const playtracePath = dataArray.map((obj, i) => ({
                    x: i,
                    y: parseFloat(obj[yKey]) || 0
                }));

                if (userXRange <= 0 || canvasHeight <= 0) {
                    return;
                }

                const playtraceYs = playtracePath.map(p => p.y);
                const playtraceMinY = Math.min(...playtraceYs);
                const playtraceMaxY = Math.max(...playtraceYs);
                const playtraceMaxX = playtracePath.length - 1;
                const playtraceYRange = playtraceMaxY - playtraceMinY;

                const transformedUserPath = drawnPathData.map(p => {
                    const normalizedX = (p.x - userMinX) / userXRange;
                    const normalizedY = p.y / canvasHeight;

                    const newX = normalizedX * playtraceMaxX;
                    const newY = (normalizedY * playtraceYRange) + playtraceMinY;
                    return { x: newX, y: newY };
                });

                const referencePath = resamplePath(transformedUserPath, NUM_POINTS);
                const resampledPlaytrace = resamplePath(playtracePath, NUM_POINTS);
                
                let similarityScore;

                if (analysisMethod === 'dtw') {
                    const referenceY_Series = referencePath.map(p => p.y);
                    const playtraceY_Series = resampledPlaytrace.map(p => p.y);
                    const dtw = new Dtw(referenceY_Series, playtraceY_Series, (a, b) => Math.abs(a - b));
                    const distance = dtw.getDistance();
                    
                    const maxPossibleDist = referenceY_Series.reduce((sum, val, i) => sum + Math.abs(val - playtraceY_Series[i]), 0);
                    const normalizedDistance = distance / (maxPossibleDist + 1e-9); 
                    similarityScore = 1 - normalizedDistance;
                    
                } else if (analysisMethod === 'combined') {
                    const frechetScore = curveMatcher.shapeSimilarity(referencePath, resampledPlaytrace, {
                        estimationPoints: NUM_POINTS,
                        checkRotations: false
                    });

                    const referenceY_Series = referencePath.map(p => p.y);
                    const playtraceY_Series = resampledPlaytrace.map(p => p.y);
                    const dtw = new Dtw(referenceY_Series, playtraceY_Series, (a, b) => Math.abs(a - b));
                    const distance = dtw.getDistance();
                    const maxPossibleDist = referenceY_Series.reduce((sum, val, i) => sum + Math.abs(val - playtraceY_Series[i]), 0);
                    const normalizedDistance = distance / (maxPossibleDist + 1e-9); 
                    const dtwScore = 1 - normalizedDistance;

                    const totalWeight = frechetWeight + dtwWeight;
                    if (totalWeight > 0) {
                        similarityScore = (frechetScore * frechetWeight + dtwScore * dtwWeight) / totalWeight;
                    } else {
                        similarityScore = 0;
                    }

                } else { // Default to Fréchet
                    similarityScore = curveMatcher.shapeSimilarity(referencePath, resampledPlaytrace, {
                        estimationPoints: NUM_POINTS,
                        checkRotations: false
                    });
                }

                results.push({
                    filename: file.filename,
                    score: Math.max(0, similarityScore),
                });

            } catch (error) {
                self.postMessage({
                    type: 'error',
                    message: `Failed to process ${file.filename}: ${error.message}`
                });
            }

            self.postMessage({
                type: 'progress',
                progress: (index + 1) / totalFiles
            });
        });

        results.sort((a, b) => b.score - a.score);

        self.postMessage({
            type: 'complete',
            results: results
        });

    } catch (e) {
        self.postMessage({
            type: 'fatal_error',
            message: e.message,
            stack: e.stack
        });
    }
};