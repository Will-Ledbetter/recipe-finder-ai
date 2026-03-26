// Configuration
const CONFIG = {
    API_ENDPOINT: 'https://y0x3260gi3.execute-api.us-east-1.amazonaws.com/prod/analyze',
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_IMAGES: 2
};

// State
let selectedImages = [];

// Initialize main app (called after authentication)
function initMainApp() {
    // DOM Elements
    const imageInput = document.getElementById('imageInput');
    const uploadArea = document.getElementById('uploadArea');
    const analyzeBtn = document.getElementById('analyzeBtn');

    // Event Listeners
    if (imageInput) imageInput.addEventListener('change', handleImageSelect);
    if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeImages);
    
    // Drag and drop
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#764ba2';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#667eea';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#667eea';
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
                handleFiles(files);
            }
        });
    }
}



function handleImageSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        handleFiles(files);
    }
}

async function handleFiles(files) {
    // Limit to max images
    const remainingSlots = CONFIG.MAX_IMAGES - selectedImages.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    for (const file of filesToAdd) {
        // Check if HEIC/HEIF format
        const isHEIC = file.name.toLowerCase().endsWith('.heic') || 
                       file.name.toLowerCase().endsWith('.heif') ||
                       file.type === 'image/heic' ||
                       file.type === 'image/heif';
        
        try {
            let processedFile = file;
            
            // Convert HEIC to JPEG if needed
            if (isHEIC) {
                if (typeof heic2any === 'undefined') {
                    showError('HEIC conversion library not loaded. Please refresh the page.');
                    return;
                }
                
                showError('Converting HEIC image...');
                const convertedBlob = await heic2any({
                    blob: file,
                    toType: 'image/jpeg',
                    quality: 0.8
                });
                processedFile = new File([convertedBlob], file.name.replace(/\.heic$/i, '.jpg'), {
                    type: 'image/jpeg'
                });
                hideError();
            }
            
            // Validate file type (after conversion)
            if (!processedFile.type.startsWith('image/')) {
                showError(`${file.name} is not a valid image file`);
                continue;
            }

            // Compress and resize image
            compressImage(processedFile, (compressedDataUrl) => {
                selectedImages.push(compressedDataUrl);
                updatePreviews();
                hideError();
            });
        } catch (error) {
            console.error('Error processing file:', error);
            showError(`Failed to process ${file.name}. Please try another image.`);
        }
    }
}

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Resize if too large (max 1200px on longest side)
            const maxSize = 1200;
            if (width > height && width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            } else if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG with 0.7 quality
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(compressedDataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updatePreviews() {
    const imagePreviews = document.getElementById('imagePreviews');
    const uploadArea = document.getElementById('uploadArea');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const imageInput = document.getElementById('imageInput');
    
    if (!imagePreviews) return;
    
    imagePreviews.innerHTML = '';
    
    selectedImages.forEach((imageData, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview-item';
        
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = `Preview ${index + 1}`;
        
        const label = document.createElement('div');
        label.className = 'image-label';
        label.textContent = index === 0 ? '📦 Fridge/Pantry 1' : '📦 Fridge/Pantry 2';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = '✕';
        removeBtn.onclick = () => removeImage(index);
        
        previewDiv.appendChild(img);
        previewDiv.appendChild(label);
        previewDiv.appendChild(removeBtn);
        imagePreviews.appendChild(previewDiv);
    });
    
    // Show/hide upload area
    if (uploadArea) {
        if (selectedImages.length >= CONFIG.MAX_IMAGES) {
            uploadArea.style.display = 'none';
        } else {
            uploadArea.style.display = 'block';
        }
    }
    
    // Enable/disable analyze button
    if (analyzeBtn) {
        analyzeBtn.disabled = selectedImages.length === 0;
    }
    
    // Reset file input
    if (imageInput) {
        imageInput.value = '';
    }
}

function removeImage(index) {
    selectedImages.splice(index, 1);
    updatePreviews();
    const results = document.getElementById('results');
    if (results) {
        results.classList.add('hidden');
    }
}

async function analyzeImages() {
    if (selectedImages.length === 0) return;

    // Get preferences
    const preferences = {
        dietary: document.getElementById('dietary').value,
        cuisine: document.getElementById('cuisine').value,
        cookingTime: document.getElementById('cookingTime').value,
        skillLevel: document.getElementById('skillLevel').value
    };

    // Show loading
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    if (loading) loading.classList.remove('hidden');
    if (results) results.classList.add('hidden');
    if (analyzeBtn) analyzeBtn.disabled = true;
    hideError();

    try {
        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                images: selectedImages,
                preferences: preferences
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        displayResults(data);
        
        // Track usage
        if (typeof trackUsage === 'function') {
            trackUsage();
        }

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to analyze images. Please try again.');
    } finally {
        const loading = document.getElementById('loading');
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (loading) loading.classList.add('hidden');
        if (analyzeBtn) analyzeBtn.disabled = false;
    }
}

function displayResults(data) {
    const ingredientsList = document.getElementById('ingredientsList');
    const recipesList = document.getElementById('recipesList');
    const results = document.getElementById('results');
    
    if (!ingredientsList || !recipesList || !results) return;
    
    // Display ingredients
    ingredientsList.innerHTML = '';
    data.ingredients.forEach(ingredient => {
        const tag = document.createElement('span');
        tag.className = 'ingredient-tag';
        tag.textContent = ingredient;
        ingredientsList.appendChild(tag);
    });

    // Display recipes
    recipesList.innerHTML = '';
    data.recipes.forEach(recipe => {
        const card = createRecipeCard(recipe);
        recipesList.appendChild(card);
    });

    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth' });
}

function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';

    const title = document.createElement('h3');
    title.textContent = recipe.name;

    const meta = document.createElement('div');
    meta.className = 'recipe-meta';
    meta.innerHTML = `
        <span>⏱️ ${recipe.cookingTime} min</span>
        <span>👨‍🍳 ${recipe.difficulty}</span>
    `;

    const description = document.createElement('p');
    description.className = 'recipe-description';
    description.textContent = recipe.description;

    const ingredientsSection = document.createElement('div');
    ingredientsSection.className = 'recipe-ingredients';
    ingredientsSection.innerHTML = '<h4>Ingredients:</h4>';
    
    const ingredientsList = document.createElement('ul');
    recipe.ingredients.forEach(ing => {
        const li = document.createElement('li');
        li.textContent = ing;
        ingredientsList.appendChild(li);
    });
    ingredientsSection.appendChild(ingredientsList);

    // Missing ingredients
    if (recipe.missingIngredients && recipe.missingIngredients.length > 0) {
        const missingSection = document.createElement('div');
        missingSection.className = 'recipe-ingredients';
        missingSection.innerHTML = '<h4>You might need:</h4>';
        
        const missingList = document.createElement('ul');
        missingList.className = 'missing-ingredients';
        recipe.missingIngredients.forEach(ing => {
            const li = document.createElement('li');
            li.textContent = ing;
            missingList.appendChild(li);
        });
        missingSection.appendChild(missingList);
        ingredientsSection.appendChild(missingSection);
    }

    const instructionsSection = document.createElement('div');
    instructionsSection.className = 'recipe-instructions';
    instructionsSection.innerHTML = '<h4>Instructions:</h4>';
    
    const instructionsList = document.createElement('ol');
    recipe.instructions.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step;
        instructionsList.appendChild(li);
    });
    instructionsSection.appendChild(instructionsList);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(description);
    card.appendChild(ingredientsSection);
    card.appendChild(instructionsSection);

    return card;
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

function hideError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
}
