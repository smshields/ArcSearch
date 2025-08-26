import { fabric } from 'fabric';
import { Chart, registerables } from 'chart.js';

document.addEventListener('DOMContentLoaded', () => {
    Chart.register(...registerables);

    const fileInput = document.getElementById('file-input');
    const rootObjectSelector = document.getElementById('root-object-selector');
    const yValueSelector = document.getElementById('y-value-selector');
    const analyzeBtn = document.getElementById('analyze-btn');
    const clearBtn = document.getElementById('clear-canvas-btn');
    const modal = document.getElementById('chart-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const resultsListContainer = document.getElementById('results-list');
    const modalTitle = document.getElementById('modal-title');
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const sensitivityValue = document.getElementById('sensitivity-value');
    const analysisMethodRadios = document.querySelectorAll('input[name="analysis-method"]');
    const weightsContainer = document.getElementById('weights-container');
    const frechetWeightSlider = document.getElementById('frechet-weight-slider');
    const frechetWeightValue = document.getElementById('frechet-weight-value');
    const dtwWeightSlider = document.getElementById('dtw-weight-slider');
    const dtwWeightValue = document.getElementById('dtw-weight-value');
    const scatterPlotToggle = document.getElementById('scatter-plot-toggle');
    const scatterPlotCanvas = document.getElementById('composite-scatter-plot');
    
    let fullFileList = [];
    let sampleJsonContent = null;
    let fabricCanvas = null;
    let drawnPathData = [];
    let fileContentCache = new Map();
    let comparisonChart = null;
    let compositeChart = null;

    initializeCanvas();
    fileInput.addEventListener('change', handleDirectorySelect);
    rootObjectSelector.addEventListener('change', handleRootObjectSelect);
    yValueSelector.addEventListener('change', handleYValueSelect);
    clearBtn.addEventListener('click', clearCanvas);
    analyzeBtn.addEventListener('click', startAnalysis);
    closeModalBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal();
        }
    });
    resultsListContainer.addEventListener('click', handleResultClick);
    sensitivitySlider.addEventListener('input', (event) => {
        sensitivityValue.textContent = event.target.value;
    });
    frechetWeightSlider.addEventListener('input', (event) => {
        frechetWeightValue.textContent = event.target.value;
    });
    dtwWeightSlider.addEventListener('input', (event) => {
        dtwWeightValue.textContent = event.target.value;
    });
    analysisMethodRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'combined') {
                weightsContainer.classList.remove('hidden');
            } else {
                weightsContainer.classList.add('hidden');
            }
        });
    });
    scatterPlotToggle.addEventListener('change', updateCompositeScatterPlot);


    function initializeCanvas() {
        scatterPlotToggle.disabled = true;
        const canvasEl = document.getElementById('drawing-canvas');
        const canvasContainer = document.querySelector('.canvas-stack');

        const setCanvasSize = () => {
            const width = canvasContainer.clientWidth;
            const height = canvasContainer.clientWidth * .75;
            
            fabricCanvas.setDimensions({ width, height });
            
            scatterPlotCanvas.width = width;
            scatterPlotCanvas.height = height;

            if (compositeChart) {
                compositeChart.resize();
            }

            fabricCanvas.renderAll();
        };

        fabricCanvas = new fabric.Canvas('drawing-canvas');
        setCanvasSize();

        fabricCanvas.isDrawingMode = true;

        fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.color = '#e03131';
        fabricCanvas.freeDrawingBrush.width = 3;

        fabricCanvas.on('path:created', (e) => {
            const userPath = e.path;
            const existingPath = fabricCanvas.getObjects().find(o => o.id === 'user-drawn-path');
            if (existingPath) {
                fabricCanvas.remove(existingPath);
            }
            const sanitizedPoints = sanitizePath(userPath.path);

            if (sanitizedPoints.length > 1) {
                const canvasHeight = fabricCanvas.height;
                drawnPathData = sanitizedPoints.map(p => ({
                    x: p.x,
                    y: canvasHeight - p.y
                }));

                const cleanPath = new fabric.Polyline(sanitizedPoints, {
                    id: 'user-drawn-path',
                    fill: null,
                    stroke: '#e03131',
                    strokeWidth: 3,
                    selectable: false,
                    evented: false,
                });
                fabricCanvas.add(cleanPath);
            } else {
                drawnPathData = [];
            }
            fabricCanvas.remove(userPath);
        });

        window.addEventListener('resize', setCanvasSize);
    }

    function sanitizePath(pathArray) {
        const points = [];
        let lastX = -1;
        pathArray.forEach(command => {
            const x = command[command.length - 2];
            const y = command[command.length - 1];
            if (x > lastX) {
                points.push({ x: x, y: y });
            }
        });
        return points;
    }

    function clearCanvas() {
        const userPath = fabricCanvas.getObjects().find(o => o.id === 'user-drawn-path');
        if (userPath) {
            fabricCanvas.remove(userPath);
        }
        drawnPathData = [];
    }
    
    async function drawCompositeScatterPlot() {
        clearCompositeScatterPlot();
        if (fullFileList.length === 0 || !rootObjectSelector.value || !yValueSelector.value) {
            return;
        }

        const rootKey = rootObjectSelector.value;
        const yKey = yValueSelector.value;
        const jsonFiles = fullFileList.filter(f => f.name.endsWith('.json') && f.webkitRelativePath.includes('/'));

        let allPoints = [];
        
        const fileContents = await Promise.all(jsonFiles.map(readFileAsText));
        
        fileContents.forEach(file => {
            try {
                const jsonData = JSON.parse(file.content);
                const dataArray = jsonData[rootKey];
                if (dataArray && Array.isArray(dataArray)) {
                    const pointsData = dataArray.map((obj, i) => ({
                        x: i,
                        y: parseFloat(obj[yKey]) || 0
                    }));
                    allPoints.push(...pointsData);
                }
            } catch (e) {
                console.error(`Could not parse ${file.filename} for scatter plot: ${e.message}`);
            }
        });

        if (allPoints.length === 0) return;
        
        scatterPlotCanvas.classList.remove('hidden');
        const ctx = scatterPlotCanvas.getContext('2d');
        
        compositeChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    data: allPoints,
                    pointRadius: 10,
                    pointBackgroundColor: 'rgba(54, 162, 235, 0.01)',
                    pointBorderColor: 'transparent'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                events: []
            }
        });
    }
    
    function clearCompositeScatterPlot() {
        if (compositeChart) {
            compositeChart.destroy();
            compositeChart = null;
        }
        scatterPlotCanvas.classList.add('hidden');
    }
    
    function updateCompositeScatterPlot() {
        if (scatterPlotToggle.checked) {
            drawCompositeScatterPlot();
        } else {
            clearCompositeScatterPlot();
        }
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ filename: file.name, content: reader.result });
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    function handleDirectorySelect(event) {
        const files = event.target.files;
        fullFileList = Array.from(files);
        if (fullFileList.length === 0) return;
        resetUI();
        let jsonFileToInspect = fullFileList.find(file => file.name.endsWith('.json') && file.webkitRelativePath.includes('/'));
        if (!jsonFileToInspect) {
            alert('Error: Could not find any .json file in the subdirectories.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                sampleJsonContent = JSON.parse(e.target.result);
                const arrayKeys = findArrayKeys(sampleJsonContent);
                if (arrayKeys.length > 0) {
                    populateSelector(rootObjectSelector, arrayKeys, "Select a root object...");
                    rootObjectSelector.disabled = false;
                } else {
                    alert('No data arrays found in the first JSON file.');
                }
            } catch (error) {
                alert(`Error parsing ${jsonFileToInspect.name}: ${error.message}`);
            }
        };
        reader.readAsText(jsonFileToInspect);
    }

    function handleRootObjectSelect(event) {
        const selectedRootKey = event.target.value;
        yValueSelector.innerHTML = '';
        yValueSelector.disabled = true;
        analyzeBtn.disabled = true;
        scatterPlotToggle.disabled = true;
        updateCompositeScatterPlot();
        if (!selectedRootKey || !sampleJsonContent) return;
        const targetArray = sampleJsonContent[selectedRootKey];
        if (Array.isArray(targetArray) && targetArray.length > 0 && typeof targetArray[0] === 'object') {
            const yValueKeys = Object.keys(targetArray[0]);
            populateSelector(yValueSelector, yValueKeys, "Select a Y-value...");
            yValueSelector.disabled = false;
            analyzeBtn.disabled = false;
        }
    }

    function handleYValueSelect(event) {
        if (event.target.value) {
            scatterPlotToggle.disabled = false;
        } else {
            scatterPlotToggle.disabled = true;
        }
        updateCompositeScatterPlot();
    }

    function resetUI() {
        sampleJsonContent = null;
        rootObjectSelector.innerHTML = '';
        rootObjectSelector.disabled = true;
        yValueSelector.innerHTML = '';
        yValueSelector.disabled = true;
        analyzeBtn.disabled = true;
        scatterPlotToggle.disabled = true;
        scatterPlotToggle.checked = false;
        clearCompositeScatterPlot();
    }

    function findArrayKeys(jsonObj) {
        return Object.keys(jsonObj).filter(key =>
            Array.isArray(jsonObj[key]) &&
            jsonObj[key].length > 0 &&
            typeof jsonObj[key][0] === 'object' &&
            jsonObj[key][0] !== null
        );
    }

    function populateSelector(selectorElement, keys, placeholder) {
        selectorElement.innerHTML = `<option value="">${placeholder}</option>`;
        keys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            selectorElement.appendChild(option);
        });
    }

    async function startAnalysis() {
        if (drawnPathData.length < 2) {
            alert('Please draw a path on the canvas before analyzing.');
            return;
        }
        const jsonFiles = fullFileList.filter(f => f.name.endsWith('.json') && f.webkitRelativePath.includes('/'));
        if (jsonFiles.length === 0) {
            alert('No .json files found in the subdirectories to analyze.');
            return;
        }
        setLoadingState(true);
        resultsListContainer.innerHTML = '';
        fileContentCache.clear();
        try {
            updateProgressBar(0, `Reading ${jsonFiles.length} files...`);
            const fileContents = await Promise.all(jsonFiles.map(readFileAsText));

            fileContents.forEach(file => {
                fileContentCache.set(file.filename, file.content);
            });

            const worker = new Worker(new URL('./worker.js', import.meta.url), {
                type: 'module',
            });
            worker.onmessage = (event) => {
                const { type, progress, results, message, stack } = event.data;
                if (type === 'progress') {
                    const fileCount = Math.round(progress * fileContents.length);
                    updateProgressBar(progress, `Processing data point ${fileCount} of ${fileContents.length}...`);
                } else if (type === 'error') {
                    console.error('Worker Reported Error:', message);
                } else if (type === 'complete') {
                    renderResults(results);
                    setLoadingState(false);
                    worker.terminate();
                } else if (type === 'fatal_error') {
                    const errorMessage = `A fatal error occurred in the analysis worker:\nMessage: ${message}\n\nStack Trace:\n${stack}`;
                    console.error(errorMessage);
                    alert(errorMessage);
                    setLoadingState(false);
                    worker.terminate();
                }
            };
            worker.onerror = (error) => {
                const errorMessage = `An unhandled error occurred in the worker script:\nFile: ${error.filename}\nLine: ${error.lineno}\nMessage: ${error.message}`;
                console.error("Generic Worker Error Event:", error);
                alert(errorMessage);
                setLoadingState(false);
            };

            const analysisMethod = document.querySelector('input[name="analysis-method"]:checked').value;

            worker.postMessage({
                drawnPathData: drawnPathData,
                fileContents: fileContents,
                rootKey: rootObjectSelector.value,
                yKey: yValueSelector.value,
                estimationPoints: parseInt(sensitivitySlider.value, 10),
                canvasHeight: fabricCanvas.height,
                analysisMethod: analysisMethod,
                frechetWeight: parseFloat(frechetWeightSlider.value),
                dtwWeight: parseFloat(dtwWeightSlider.value)
            });
        } catch (error) {
            alert(`Failed to read files: ${error.message}`);
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        const progressBarContainer = document.getElementById('progress-bar-container');
        const radioButtons = document.querySelectorAll('input[name="analysis-method"]');
        fileInput.disabled = isLoading;
        rootObjectSelector.disabled = isLoading;
        yValueSelector.disabled = isLoading;
        analyzeBtn.disabled = isLoading;
        clearBtn.disabled = isLoading;
        sensitivitySlider.disabled = isLoading;
        frechetWeightSlider.disabled = isLoading;
        dtwWeightSlider.disabled = isLoading;
        radioButtons.forEach(radio => radio.disabled = isLoading);
        scatterPlotToggle.disabled = isLoading;
        if (isLoading) {
            progressBarContainer.classList.remove('hidden');
            updateProgressBar(0, 'Starting analysis...');
        } else {
            progressBarContainer.classList.add('hidden');
        }
    }

    function updateProgressBar(progress, text) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const percent = Math.round(progress * 100);
        progressBar.style.width = `${percent}%`;
        progressBar.textContent = `${percent}%`;
        progressText.textContent = text;
    }

    function renderResults(results) {
        resultsListContainer.innerHTML = '';
        if (results.length === 0) {
            resultsListContainer.innerHTML = '<p>No matching results found or all files had errors.</p>';
            return;
        }
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Seed (Filename)</th>
                    <th>Similarity Score</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        results.forEach(result => {
            const row = document.createElement('tr');
            row.dataset.filename = result.filename;
            row.resultData = result;
            const red = Math.round(255 * (1 - result.score));
            const green = Math.round(255 * result.score);
            row.style.backgroundColor = `rgba(${red}, ${green}, 70, 0.6)`;
            row.innerHTML = `
                <td>${result.filename}</td>
                <td>${result.score.toFixed(4)}</td>
            `;
            tbody.appendChild(row);
        });
        resultsListContainer.appendChild(table);
    }

    function handleResultClick(event) {
        const row = event.target.closest('tr');
        if (!row || !row.dataset.filename || !row.resultData) return;
        const filename = row.dataset.filename;
        const resultData = row.resultData;
        const fileContent = fileContentCache.get(filename);
        if (!fileContent) {
            alert('Could not find cached data for the selected result.');
            return;
        }
        createComparisonChart(resultData, fileContent);
        showModal();
    }

    function createComparisonChart(resultData, fileContent) {
        modalTitle.textContent = `Comparison for ${resultData.filename} (Score: ${resultData.score.toFixed(4)})`;

        const jsonData = JSON.parse(fileContent);
        const rootKey = rootObjectSelector.value;
        const yKey = yValueSelector.value;
        const playtraceData = jsonData[rootKey].map((obj, i) => ({
            x: i,
            y: parseFloat(obj[yKey]) || 0
        }));
        const fullDataObjects = jsonData[rootKey];

        const userMinX = Math.min(...drawnPathData.map(p => p.x));
        const userMaxX = Math.max(...drawnPathData.map(p => p.x));
        const userXRange = userMaxX - userMinX;
        
        const playtraceYs = playtraceData.map(p => p.y);
        const playtraceMinY = Math.min(...playtraceYs);
        const playtraceMaxY = Math.max(...playtraceYs);
        const playtraceMaxX = playtraceData.length - 1;
        const playtraceYRange = playtraceMaxY - playtraceMinY;
        const canvasHeight = fabricCanvas.height;

        let transformedUserPath = drawnPathData;
        if (userXRange > 0 && canvasHeight > 0) {
            transformedUserPath = drawnPathData.map(p => {
                const normalizedX = (p.x - userMinX) / userXRange;
                const normalizedY = p.y / canvasHeight;

                const newX = normalizedX * playtraceMaxX;
                const newY = (normalizedY * playtraceYRange) + playtraceMinY;
                return { x: newX, y: newY };
            });
        }
        
        const ctx = document.getElementById('comparison-chart').getContext('2d');
        if (comparisonChart) {
            comparisonChart.destroy();
        }

        comparisonChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'User Drawn Path (Transformed)',
                        data: transformedUserPath,
                        borderColor: 'rgba(224, 49, 49, 1)',
                        backgroundColor: 'rgba(224, 49, 49, 0.6)',
                        showLine: true,
                        pointRadius: 2,
                    },
                    {
                        label: `Playtrace: ${resultData.filename}`,
                        data: playtraceData,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        showLine: true,
                        pointRadius: 2,
                    }
                ]
            },
            options: {
                plugins: {
                    title: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label.startsWith('Playtrace')) {
                                    const dataIndex = context.dataIndex;
                                    const fullObject = fullDataObjects[dataIndex];
                                    let tooltipLines = [
                                        `X-Index: ${fullObject ? dataIndex : 'N/A'}`,
                                        `Selected Y (${yKey}): ${context.parsed.y.toFixed(2)}`,
                                        '---',
                                        'All Y-Values at this point:'
                                    ];
                                    for (const key in fullObject) {
                                        tooltipLines.push(`  ${key}: ${fullObject[key]}`);
                                    }
                                    return tooltipLines;
                                }
                                return `Drawn Point: (${context.parsed.x.toFixed(0)}, ${context.parsed.y.toFixed(0)})`;
                            }
                        }
                    }
                }
            }
        });
    }

    function showModal() {
        modal.classList.remove('hidden');
    }

    function hideModal() {
        modal.classList.add('hidden');
    }
});