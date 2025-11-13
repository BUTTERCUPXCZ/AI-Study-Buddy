// API base URL
const API_BASE = window.location.origin;

// Current state
let currentMaterials = [];
let currentQuiz = [];
let userAnswers = {};

// Utility function to escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initUpload();
    initNotes();
    initQuiz();
    initTutor();
    loadMaterials();
});

// Tab switching functionality
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
        });
    });
}

// Upload functionality
function initUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());

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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

// Handle file upload
async function handleFileUpload(file) {
    const statusDiv = document.getElementById('uploadStatus');
    
    if (!file.name.endsWith('.pdf')) {
        showStatus('Please upload a PDF file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showStatus('Uploading...', 'info');

    try {
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showStatus(`Successfully uploaded: ${data.filename}`, 'success');
            loadMaterials();
        } else {
            showStatus(`Error: ${data.detail}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Show status message
function showStatus(message, type) {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
}

// Load materials
async function loadMaterials() {
    try {
        const response = await fetch(`${API_BASE}/api/materials`);
        const data = await response.json();
        currentMaterials = data.materials;
        
        updateMaterialsUI();
        updateMaterialSelects();
    } catch (error) {
        console.error('Error loading materials:', error);
    }
}

// Update materials list UI
function updateMaterialsUI() {
    const listDiv = document.getElementById('materialsList');
    
    if (currentMaterials.length === 0) {
        listDiv.innerHTML = '<p style="text-align: center; color: #999;">No materials uploaded yet</p>';
        return;
    }

    listDiv.innerHTML = '<h3>Uploaded Materials:</h3>';
    currentMaterials.forEach(material => {
        const item = document.createElement('div');
        item.className = 'material-item';
        item.innerHTML = `
            <div>
                <strong>📄 ${material.filename}</strong><br>
                <small>ID: ${material.material_id}</small>
            </div>
            <div>
                ${material.has_notes ? '✅ Notes' : '❌ Notes'} | 
                ${material.has_quiz ? '✅ Quiz' : '❌ Quiz'}
            </div>
        `;
        listDiv.appendChild(item);
    });
}

// Update material select dropdowns
function updateMaterialSelects() {
    const selects = ['notesMaterial', 'quizMaterial', 'tutorMaterial'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        
        // Clear and add default option
        select.innerHTML = selectId === 'tutorMaterial' 
            ? '<option value="">-- General questions --</option>'
            : '<option value="">-- Select a material --</option>';
        
        // Add material options
        currentMaterials.forEach(material => {
            const option = document.createElement('option');
            option.value = material.material_id;
            option.textContent = material.filename;
            select.appendChild(option);
        });
        
        // Restore previous selection if still valid
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// Notes functionality
function initNotes() {
    const generateBtn = document.getElementById('generateNotesBtn');
    generateBtn.addEventListener('click', generateNotes);
}

async function generateNotes() {
    const materialId = document.getElementById('notesMaterial').value;
    
    if (!materialId) {
        alert('Please select a material first');
        return;
    }

    const loadingDiv = document.getElementById('notesLoading');
    const contentDiv = document.getElementById('notesContent');
    
    loadingDiv.classList.remove('hidden');
    contentDiv.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE}/api/generate-notes?material_id=${materialId}`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok) {
            contentDiv.innerHTML = marked(data.notes);
        } else {
            contentDiv.innerHTML = `<p style="color: red;">Error: ${data.detail}</p>`;
        }
    } catch (error) {
        contentDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    } finally {
        loadingDiv.classList.add('hidden');
    }
}

// Simple markdown-like parser
function marked(text) {
    // Convert markdown to HTML (basic implementation)
    return text
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/## (.*)/g, '<h2>$1</h2>')
        .replace(/# (.*)/g, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n- /g, '<li>')
        .replace(/<li>/g, '</ul><ul><li>')
        .replace(/^<\/ul>/, '')
        .replace(/<\/ul><ul>/g, '<ul>')
        .replace(/\n/g, '<br>');
}

// Quiz functionality
function initQuiz() {
    const generateBtn = document.getElementById('generateQuizBtn');
    const submitBtn = document.getElementById('submitQuizBtn');
    
    generateBtn.addEventListener('click', generateQuiz);
    submitBtn.addEventListener('click', submitQuiz);
}

async function generateQuiz() {
    const materialId = document.getElementById('quizMaterial').value;
    const numQuestions = document.getElementById('numQuestions').value;
    
    if (!materialId) {
        alert('Please select a material first');
        return;
    }

    const loadingDiv = document.getElementById('quizLoading');
    const contentDiv = document.getElementById('quizContent');
    const resultsDiv = document.getElementById('quizResults');
    const submitBtn = document.getElementById('submitQuizBtn');
    
    loadingDiv.classList.remove('hidden');
    contentDiv.innerHTML = '';
    resultsDiv.classList.add('hidden');
    submitBtn.classList.add('hidden');
    userAnswers = {};

    try {
        const response = await fetch(`${API_BASE}/api/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                material_id: materialId,
                num_questions: parseInt(numQuestions)
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentQuiz = data.quiz;
            displayQuiz(data.quiz);
            submitBtn.classList.remove('hidden');
        } else {
            contentDiv.innerHTML = `<p style="color: red;">Error: ${data.detail}</p>`;
        }
    } catch (error) {
        contentDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    } finally {
        loadingDiv.classList.add('hidden');
    }
}

function displayQuiz(quiz) {
    const contentDiv = document.getElementById('quizContent');
    contentDiv.innerHTML = '';

    if (quiz.raw_text) {
        contentDiv.innerHTML = `<div class="content-area">${marked(quiz.raw_text)}</div>`;
        document.getElementById('submitQuizBtn').classList.add('hidden');
        return;
    }

    quiz.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'quiz-question';
        
        let optionsHTML = '';
        question.options.forEach((option, optIndex) => {
            const optionLetter = String.fromCharCode(65 + optIndex);
            optionsHTML += `
                <label class="quiz-option">
                    <input type="radio" name="question${index}" value="${optionLetter}">
                    ${option}
                </label>
            `;
        });

        questionDiv.innerHTML = `
            <h3>Question ${index + 1}</h3>
            <p>${question.question}</p>
            <div class="quiz-options">
                ${optionsHTML}
            </div>
        `;
        
        contentDiv.appendChild(questionDiv);
    });
}

function submitQuiz() {
    const resultsDiv = document.getElementById('quizResults');
    let correct = 0;
    let total = currentQuiz.length;

    resultsDiv.innerHTML = '';
    
    currentQuiz.forEach((question, index) => {
        const selected = document.querySelector(`input[name="question${index}"]:checked`);
        const userAnswer = selected ? selected.value : null;
        
        const resultDiv = document.createElement('div');
        resultDiv.className = 'question-result';
        
        if (userAnswer === question.correct_answer) {
            correct++;
            resultDiv.classList.add('correct');
            resultDiv.innerHTML = `
                <strong>✅ Question ${index + 1}: Correct!</strong><br>
                ${escapeHtml(question.explanation || '')}
            `;
        } else {
            resultDiv.classList.add('incorrect');
            resultDiv.innerHTML = `
                <strong>❌ Question ${index + 1}: Incorrect</strong><br>
                Your answer: ${escapeHtml(userAnswer || 'No answer')}<br>
                Correct answer: ${escapeHtml(question.correct_answer)}<br>
                ${escapeHtml(question.explanation || '')}
            `;
        }
        
        resultsDiv.appendChild(resultDiv);
    });

    const scoreDiv = document.createElement('div');
    scoreDiv.innerHTML = `<h3>Your Score: ${correct}/${total} (${Math.round(correct/total*100)}%)</h3>`;
    resultsDiv.insertBefore(scoreDiv, resultsDiv.firstChild);
    
    resultsDiv.classList.remove('hidden');
}

// Tutor functionality
function initTutor() {
    const sendBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;

    const materialId = document.getElementById('tutorMaterial').value;
    const messagesDiv = document.getElementById('chatMessages');

    // Add user message
    addChatMessage(message, 'user');
    chatInput.value = '';

    // Show loading
    const loadingId = 'loading-' + Date.now();
    addChatMessage('Thinking...', 'bot', loadingId);

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                material_id: materialId || null
            })
        });

        const data = await response.json();

        // Remove loading message
        document.getElementById(loadingId)?.remove();

        if (response.ok) {
            addChatMessage(data.response, 'bot');
        } else {
            addChatMessage(`Error: ${data.detail}`, 'bot');
        }
    } catch (error) {
        document.getElementById(loadingId)?.remove();
        addChatMessage(`Error: ${error.message}`, 'bot');
    }
}

function addChatMessage(message, type, id = null) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    if (id) messageDiv.id = id;
    
    if (type === 'user') {
        messageDiv.innerHTML = `<strong>You:</strong><br>${escapeHtml(message)}`;
    } else {
        messageDiv.innerHTML = `<strong>AI Tutor:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}`;
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
