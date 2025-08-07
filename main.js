document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const fileInput = document.getElementById('file-input');
    const rootObjectSelector = document.getElementById('root-object-selector');
    const yValueSelector = document.getElementById('y-value-selector');
    const analyzeBtn = document.getElementById('analyze-btn');
    const clearBtn = document.getElementById('clear-canvas-btn');

    // --- State ---
    let fullFileList = [];
    let sampleJsonContent = null;
    let fabricCanvas = null;
    let drawnPathData = []; // This will hold our sanitized {x, y} points

    // --- Initialization ---
    initializeCanvas();

    // --- Event Listeners ---
    fileInput.addEventListener('change', handleDirectorySelect);
    rootObjectSelector.addEventListener('change', handleRootObjectSelect);
    clearBtn.addEventListener('click', clearCanvas);

    // =================================================================
    // FILE & DATA SELECTION LOGIC
    // =================================================================

    function handleDirectorySelect(event) {
        const files = event.target.files;
        fullFileList = Array.from(files);
        if (fullFileList.length === 0) return;

        resetUI();
        let jsonFileToInspect = fullFileList.find(file => 
            file.name.endsWith('.json') && file.webkitRelativePath.includes('/')
        );

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

        if (!selectedRootKey || !sampleJsonContent) return;

        const targetArray = sampleJsonContent[selectedRootKey];
        if (Array.isArray(targetArray) && targetArray.length > 0 && typeof targetArray[0] === 'object') {
            const yValueKeys = Object.keys(targetArray[0]);
            populateSelector(yValueSelector, yValueKeys, "Select a Y-value...");
            yValueSelector.disabled = false;
            analyzeBtn.disabled = false;
        }
    }
    
    function resetUI() {
        sampleJsonContent = null;
        rootObjectSelector.innerHTML = '';
        rootObjectSelector.disabled = true;
        yValueSelector.innerHTML = '';
        yValueSelector.disabled = true;
        analyzeBtn.disabled = true;
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

    // =================================================================
    // CANVAS LOGIC (SIMPLIFIED)
    // =================================================================
    
    function initializeCanvas() {
        fabricCanvas = new fabric.Canvas('drawing-canvas');
        fabricCanvas.isDrawingMode = true; // Always in drawing mode

        fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.color = '#e03131';
        fabricCanvas.freeDrawingBrush.width = 3;

        // When a user finishes drawing a new path
        fabricCanvas.on('path:created', (e) => {
            const userPath = e.path;
            // Enforce our single-line rule. Clear any existing path.
            clearCanvas(); 

            const sanitizedPoints = sanitizePath(userPath.path);
            
            if (sanitizedPoints.length > 1) {
                // Store the clean data for analysis
                drawnPathData = sanitizedPoints;
                
                // Create a new, clean path object from the sanitized points
                const cleanPath = new fabric.Polyline(sanitizedPoints, {
                    fill: null,
                    stroke: '#e03131',
                    strokeWidth: 3,
                    selectable: false,
                    evented: false, // Can be false again, as no eraser interaction is needed
                });

                fabricCanvas.add(cleanPath);
            } else {
                drawnPathData = [];
            }
            // The original free-hand path is temporary and should be removed
            fabricCanvas.remove(userPath);
        });
    }

    function sanitizePath(pathArray) {
        const points = [];
        let lastX = -1;

        pathArray.forEach(command => {
            // command is like ['M', 10, 20] or ['Q', 10, 20, 30, 40]
            const x = command[command.length - 2];
            const y = command[command.length - 1];

            if (x > lastX) {
                points.push({ x: x, y: y });
                lastX = x;
            }
        });
        return points;
    }

    function clearCanvas() {
        fabricCanvas.clear();
        drawnPathData = [];
    }
});