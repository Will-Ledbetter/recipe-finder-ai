// Authentication required system
const AUTH_CONFIG = {
    API_ENDPOINT: 'https://y0x3260gi3.execute-api.us-east-1.amazonaws.com/prod/track',
    SESSION_KEY: 'recipe_finder_session'
};

let currentUser = null;
let isAuthenticated = false;

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', initAuth);

function initAuth() {
    // Prevent infinite loops
    if (isAuthenticated) return;
        verifySession(sessionToken);
    } else {
        showLoginForm();
    }
}

async function verifySession(sessionToken) {
    try {
        const response = await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'verify_session',
                session_token: sessionToken
            })
        });

        const data = await response.json();
        
        if (response.ok && data.valid) {
            currentUser = data.user;
            showMainApp();
        } else {
            localStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
            showLoginForm();
        }
    } catch (error) {
        localStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
        showLoginForm();
    }
}

function showLoginForm() {
    document.body.innerHTML = `
        <div class="auth-container">
            <div class="auth-header">
                <h1>🍳 Recipe Finder</h1>
                <p>Please sign in to continue</p>
            </div>
            
            <div class="auth-tabs">
                <button id="loginTab" class="auth-tab active" onclick="switchTab('login')">Sign In</button>
                <button id="registerTab" class="auth-tab" onclick="switchTab('register')">Sign Up</button>
            </div>
            
            <form id="loginForm" class="auth-form">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="loginEmail" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="loginPassword" required>
                </div>
                <button type="submit" class="btn-primary">Sign In</button>
            </form>
            
            <form id="registerForm" class="auth-form hidden">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="registerName" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="registerEmail" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="registerPassword" required minlength="6">
                    <small>Minimum 6 characters</small>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="agreeTerms" required>
                        <span class="checkmark"></span>
                        I agree to provide my email address and name to this site for account creation and service provision. I understand my information will be stored securely and used solely for app functionality.
                    </label>
                </div>
                <div class="disclaimer">
                    <small>
                        <strong>Privacy Notice:</strong> By registering, you consent to providing your name and email address for account management. We do not share your information with third parties. You may request account deletion at any time by contacting the site administrator.
                        <br><br>
                        <a href="privacy.html" target="_blank">View Full Privacy Policy</a>
                    </small>
                </div>
                <button type="submit" class="btn-primary">Sign Up</button>
            </form>
            
            <div id="authError" class="error-message hidden"></div>
            <div id="authLoading" class="loading hidden">
                <div class="spinner"></div>
                <p>Please wait...</p>
            </div>
        </div>
    `;
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
}

function switchTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showAuthLoading();
    
    try {
        const response = await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'login',
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem(AUTH_CONFIG.SESSION_KEY, data.session_token);
            currentUser = data.user;
            showMainApp();
        } else {
            showAuthError(data.error || 'Login failed');
        }
    } catch (error) {
        showAuthError('Network error. Please try again.');
    } finally {
        hideAuthLoading();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    if (!agreeTerms) {
        showAuthError('You must agree to the terms to create an account');
        return;
    }
    
    showAuthLoading();
    
    try {
        const response = await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'register',
                name: name,
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem(AUTH_CONFIG.SESSION_KEY, data.session_token);
            currentUser = data.user;
            showMainApp();
        } else {
            showAuthError(data.error || 'Registration failed');
        }
    } catch (error) {
        showAuthError('Network error. Please try again.');
    } finally {
        hideAuthLoading();
    }
}

function showMainApp() {
    // Show the main recipe finder app
    document.body.innerHTML = `
        <div class="container">
            <header>
                <div class="header-content">
                    <div class="header-left">
                        <h1>🍳 Recipe Finder</h1>
                        <p>Upload photos of your fridge and/or pantry to get recipe suggestions</p>
                    </div>
                    <div class="header-right">
                        <div class="user-info">
                            <span class="user-name">Welcome, ${currentUser.name}!</span>
                            <button onclick="logout()" class="btn-logout">Sign Out</button>
                        </div>
                    </div>
                </div>
            </header>

            <main>
                <!-- Upload Section -->
                <section class="upload-section">
                    <div class="upload-area" id="uploadArea">
                        <input type="file" id="imageInput" accept="image/*,.heic,.heif" multiple>
                        <label for="imageInput">
                            <div class="upload-icon">📸</div>
                            <p>Upload or take photos</p>
                            <span class="upload-hint">Upload 1-2 images • Supports JPG, PNG, HEIC</span>
                        </label>
                    </div>
                    <div id="imagePreviews" class="image-previews"></div>
                </section>

                <!-- Preferences Section -->
                <section class="preferences-section">
                    <h2>Preferences (Optional)</h2>
                    <div class="preferences-grid">
                        <div class="pref-item">
                            <label for="dietary">Dietary Restrictions</label>
                            <select id="dietary">
                                <option value="">None</option>
                                <option value="vegetarian">Vegetarian</option>
                                <option value="vegan">Vegan</option>
                                <option value="gluten-free">Gluten-Free</option>
                                <option value="dairy-free">Dairy-Free</option>
                                <option value="keto">Keto</option>
                            </select>
                        </div>
                        <div class="pref-item">
                            <label for="cuisine">Cuisine Type</label>
                            <select id="cuisine">
                                <option value="">Any</option>
                                <option value="italian">Italian</option>
                                <option value="mexican">Mexican</option>
                                <option value="asian">Asian</option>
                                <option value="mediterranean">Mediterranean</option>
                                <option value="american">American</option>
                            </select>
                        </div>
                        <div class="pref-item">
                            <label for="cookingTime">Max Cooking Time</label>
                            <select id="cookingTime">
                                <option value="">Any</option>
                                <option value="15">15 minutes</option>
                                <option value="30">30 minutes</option>
                                <option value="45">45 minutes</option>
                                <option value="60">1 hour</option>
                            </select>
                        </div>
                        <div class="pref-item">
                            <label for="skillLevel">Skill Level</label>
                            <select id="skillLevel">
                                <option value="">Any</option>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                    </div>
                </section>

                <!-- Action Button -->
                <button id="analyzeBtn" class="btn-primary" disabled>
                    Find Recipes
                </button>

                <!-- Loading State -->
                <div id="loading" class="loading hidden">
                    <div class="spinner"></div>
                    <p>Analyzing your ingredients...</p>
                </div>

                <!-- Results Section -->
                <section id="results" class="results-section hidden">
                    <h2>Detected Ingredients</h2>
                    <div id="ingredientsList" class="ingredients-list"></div>

                    <h2>Recipe Suggestions</h2>
                    <div id="recipesList" class="recipes-list"></div>
                </section>

                <!-- Error Message -->
                <div id="error" class="error-message hidden"></div>
            </main>
        </div>
    `;
    
    // Initialize the main app functionality
    if (typeof initMainApp === 'function') {
        initMainApp();
    }
}

async function trackUsage() {
    const sessionToken = localStorage.getItem(AUTH_CONFIG.SESSION_KEY);
    if (!sessionToken) return;
    
    try {
        const response = await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'track_usage',
                session_token: sessionToken
            })
        });
        
        if (response.ok) {
            console.log('Usage tracked');
        }
    } catch (error) {
        console.error('Tracking error:', error);
    }
}

async function logout() {
    const sessionToken = localStorage.getItem(AUTH_CONFIG.SESSION_KEY);
    
    try {
        await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'logout',
                session_token: sessionToken
            })
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    localStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
    currentUser = null;
    showLoginForm();
}



function showAuthError(message) {
    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

function showAuthLoading() {
    const loading = document.getElementById('authLoading');
    if (loading) loading.classList.remove('hidden');
}

function hideAuthLoading() {
    const loading = document.getElementById('authLoading');
    if (loading) loading.classList.add('hidden');
}



function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
}

function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

