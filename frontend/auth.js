// Authentication Configuration
const AUTH_CONFIG = {
    API_ENDPOINT: 'https://y0x3260gi3.execute-api.us-east-1.amazonaws.com/prod/auth',
    SESSION_KEY: 'recipe_finder_session'
};

// Authentication State
let currentUser = null;

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', initAuth);

function initAuth() {
    const sessionToken = localStorage.getItem(AUTH_CONFIG.SESSION_KEY);
    if (sessionToken) {
        verifySession(sessionToken);
    } else {
        showLoginForm();
    }
}

async function verifySession(sessionToken) {
    try {
        const response = await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'verify_session',
                session_token: sessionToken
            })
        });

        const data = await response.json();
        
        if (response.ok && data.valid) {
            currentUser = data.user;
            showMainApp();
            updateUserInfo();
        } else {
            localStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
            showLoginForm();
        }
    } catch (error) {
        console.error('Session verification failed:', error);
        localStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
        showLoginForm();
    }
}

function showLoginForm() {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <div class="auth-container">
            <div class="auth-header">
                <h1>🍳 Recipe Finder</h1>
                <p>Sign in to save your recipes and preferences</p>
            </div>
            
            <div class="auth-tabs">
                <button id="loginTab" class="auth-tab active" onclick="switchTab('login')">Sign In</button>
                <button id="registerTab" class="auth-tab" onclick="switchTab('register')">Sign Up</button>
            </div>
            
            <!-- Login Form -->
            <form id="loginForm" class="auth-form">
                <div class="form-group">
                    <label for="loginEmail">Email</label>
                    <input type="email" id="loginEmail" required>
                </div>
                <div class="form-group">
                    <label for="loginPassword">Password</label>
                    <input type="password" id="loginPassword" required>
                </div>
                <button type="submit" class="btn-primary">Sign In</button>
            </form>
            
            <!-- Register Form -->
            <form id="registerForm" class="auth-form hidden">
                <div class="form-group">
                    <label for="registerName">Full Name</label>
                    <input type="text" id="registerName" required>
                </div>
                <div class="form-group">
                    <label for="registerEmail">Email</label>
                    <input type="email" id="registerEmail" required>
                </div>
                <div class="form-group">
                    <label for="registerPassword">Password</label>
                    <input type="password" id="registerPassword" required minlength="6">
                    <small>Minimum 6 characters</small>
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input type="password" id="confirmPassword" required>
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
    
    // Add event listeners
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
    
    hideAuthError();
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showAuthLoading();
    hideAuthError();
    
    try {
        const response = await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
            updateUserInfo();
        } else {
            showAuthError(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
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
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        showAuthError('Passwords do not match');
        return;
    }
    
    showAuthLoading();
    hideAuthError();
    
    try {
        const response = await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
            updateUserInfo();
        } else {
            showAuthError(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAuthError('Network error. Please try again.');
    } finally {
        hideAuthLoading();
    }
}

function showMainApp() {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <header>
            <div class="header-content">
                <div class="header-left">
                    <h1>🍳 Recipe Finder</h1>
                    <p>Upload photos of your fridge and/or pantry to get recipe suggestions</p>
                </div>
                <div class="header-right">
                    <div class="user-info">
                        <span class="user-name">Welcome, <span id="userName"></span>!</span>
                        <div class="user-menu">
                            <button id="userMenuBtn" class="user-menu-btn">⚙️</button>
                            <div id="userDropdown" class="user-dropdown hidden">
                                <button onclick="showUserStats()">My Stats</button>
                                <button onclick="showAllUsers()" id="adminBtn" class="hidden">View Users</button>
                                <button onclick="logout()">Sign Out</button>
                            </div>
                        </div>
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
            
            <!-- Modal for user stats/admin -->
            <div id="modal" class="modal hidden">
                <div class="modal-content">
                    <span class="close" onclick="closeModal()">&times;</span>
                    <div id="modalBody"></div>
                </div>
            </div>
        </main>
    `;
    
    // Reinitialize the main app functionality
    initMainApp();
    
    // Add user menu toggle
    document.getElementById('userMenuBtn').addEventListener('click', toggleUserMenu);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu')) {
            document.getElementById('userDropdown').classList.add('hidden');
        }
    });
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name;
        
        // Show admin button if needed (you can add admin role logic here)
        // For now, showing for all users as a demo
        document.getElementById('adminBtn').classList.remove('hidden');
    }
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('hidden');
}

async function logout() {
    const sessionToken = localStorage.getItem(AUTH_CONFIG.SESSION_KEY);
    
    try {
        await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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

function showUserStats() {
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <h2>Your Stats</h2>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-number">${currentUser.recipe_count || 0}</div>
                <div class="stat-label">Recipes Generated</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${formatDate(currentUser.created_at)}</div>
                <div class="stat-label">Member Since</div>
            </div>
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

async function showAllUsers() {
    const sessionToken = localStorage.getItem(AUTH_CONFIG.SESSION_KEY);
    
    try {
        const response = await fetch(AUTH_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'get_users',
                session_token: sessionToken
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const modalBody = document.getElementById('modalBody');
            modalBody.innerHTML = `
                <h2>All Users (${data.total_count})</h2>
                <div class="users-list">
                    ${data.users.map(user => `
                        <div class="user-item">
                            <div class="user-info">
                                <strong>${user.name}</strong>
                                <span class="user-email">${user.email}</span>
                            </div>
                            <div class="user-stats">
                                <span>Joined: ${formatDate(user.created_at)}</span>
                                <span>Recipes: ${user.recipe_count || 0}</span>
                                ${user.last_login ? `<span>Last login: ${formatDate(user.last_login)}</span>` : '<span>Never logged in</span>'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            document.getElementById('modal').classList.remove('hidden');
        } else {
            showError('Failed to load users: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Network error loading users');
    }
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
}

function showAuthError(message) {
    const errorDiv = document.getElementById('authError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideAuthError() {
    const errorDiv = document.getElementById('authError');
    errorDiv.classList.add('hidden');
}

function showAuthLoading() {
    document.getElementById('authLoading').classList.remove('hidden');
}

function hideAuthLoading() {
    document.getElementById('authLoading').classList.add('hidden');
}

// Function to increment recipe count when user generates recipes
async function incrementRecipeCount() {
    if (!currentUser) return;
    
    currentUser.recipe_count = (currentUser.recipe_count || 0) + 1;
    
    // You could also update this on the server if needed
    // For now, just update locally
}