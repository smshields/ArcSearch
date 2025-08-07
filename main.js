document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const fileInput = document.getElementById('file-input');
    const rootObjectSelector = document.getElementById('root-object-selector');
    const yValueSelector = document.getElementById('y-value-selector');
    const analyzeBtn = document.getElementById('analyze-btn');

    // --- State ---
    let fullFileList = [];
    let sampleJsonContent = null; // Store the parsed JSON from the first file

    // --- Event Listeners ---
    fileInput.addEventListener('change', handleDirectorySelect);
    rootObjectSelector.addEventListener('change', handleRootObjectSelect);

    /**
     * Handles the user selecting a directory.
     * Finds the first .json file and populates the root object selector.
     */
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

    /**
     * Handles the user selecting a root object key.
     * Populates the Y-value selector based on the chosen root object.
     */
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
            analyzeBtn.disabled = false; // Enable analyze once a Y-value can be selected
        }
    }
    
    /**
     * Resets the interactive UI elements to their initial state.
     */
    function resetUI() {
        sampleJsonContent = null;
        rootObjectSelector.innerHTML = '';
        rootObjectSelector.disabled = true;
        yValueSelector.innerHTML = '';
        yValueSelector.disabled = true;
        analyzeBtn.disabled = true;
    }
    
    /**
     * Finds all keys in a JSON object that point to a non-empty array of objects.
     * @param {object} jsonObj - The JSON object to inspect.
     * @returns {string[]} An array of keys.
     */
    function findArrayKeys(jsonObj) {
        return Object.keys(jsonObj).filter(key => 
            Array.isArray(jsonObj[key]) && 
            jsonObj[key].length > 0 && 
            typeof jsonObj[key][0] === 'object' &&
            jsonObj[key][0] !== null
        );
    }

    /**
     * Clears and populates a <select> dropdown with a list of keys.
     * @param {HTMLSelectElement} selectorElement - The dropdown element to populate.
     * @param {string[]} keys - An array of strings to use as options.
     * @param {string} placeholder - The initial placeholder text.
     */
    function populateSelector(selectorElement, keys, placeholder) {
        selectorElement.innerHTML = `<option value="">${placeholder}</option>`;
        keys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            selectorElement.appendChild(option);
        });
    }
});