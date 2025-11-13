# 🎓 AI Study Buddy

An AI-powered study platform that helps students learn more effectively by transforming PDF lecture materials into interactive study resources.

## ✨ Features

- **📤 PDF Upload**: Upload your lecture materials in PDF format
- **📝 Study Notes Generation**: Automatically generate comprehensive study notes using Google Gemini AI
- **❓ Quiz Generation**: Create custom quizzes based on your lecture materials to test your knowledge
- **💬 AI Tutor**: Chat with an AI tutor that understands your lecture materials and can answer questions

## 🚀 Getting Started

### Prerequisites

- Python 3.8 or higher
- Google Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/BUTTERCUPXCZ/AI-Study-Buddy.git
cd AI-Study-Buddy
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up your environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_api_key_here
```

### Running the Application

1. Start the server:
```bash
python main.py
```

2. Open your browser and navigate to:
```
http://localhost:8000/static/index.html
```

## 📖 How to Use

### 1. Upload Lecture Material
- Go to the **Upload** tab
- Click the upload area or drag and drop a PDF file
- Wait for the upload to complete

### 2. Generate Study Notes
- Go to the **Study Notes** tab
- Select your uploaded material from the dropdown
- Click "Generate Notes"
- Review the AI-generated study notes

### 3. Take a Quiz
- Go to the **Quiz** tab
- Select your uploaded material
- Choose the number of questions (3-10)
- Click "Generate Quiz"
- Answer the questions and click "Submit Quiz" to see your results

### 4. Chat with AI Tutor
- Go to the **AI Tutor** tab
- Optionally select a material for context-aware responses
- Type your question and click "Send"
- The AI tutor will respond based on your lecture materials

## 🛠️ Technology Stack

- **Backend**: FastAPI (Python)
- **AI**: Google Gemini AI
- **PDF Processing**: PyPDF2
- **Frontend**: HTML, CSS, JavaScript
- **Styling**: Custom CSS with gradient theme

## 📁 Project Structure

```
AI-Study-Buddy/
├── main.py                 # FastAPI backend application
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── static/
│   ├── index.html         # Main HTML page
│   ├── style.css          # Styling
│   └── script.js          # Frontend JavaScript
└── README.md              # This file
```

## 🔧 API Endpoints

- `POST /api/upload` - Upload a PDF file
- `POST /api/generate-notes` - Generate study notes
- `POST /api/generate-quiz` - Generate a quiz
- `POST /api/chat` - Chat with AI tutor
- `GET /api/materials` - List all uploaded materials
- `GET /api/material/{material_id}` - Get specific material details

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Note

This application stores materials in memory. For production use, implement proper database storage for persistence.