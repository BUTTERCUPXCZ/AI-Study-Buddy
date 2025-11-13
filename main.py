from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import google.generativeai as genai
import PyPDF2
import os
from dotenv import load_dotenv
from typing import List, Optional
import json

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="AI Study Buddy", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configure Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-pro')
else:
    model = None

# Store lecture materials in memory (in production, use a database)
lecture_materials = {}

# Request models
class ChatRequest(BaseModel):
    message: str
    material_id: Optional[str] = None

class QuizRequest(BaseModel):
    material_id: str
    num_questions: int = 5

@app.get("/")
async def read_root():
    return {"message": "Welcome to AI Study Buddy API"}

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF lecture material and extract text content"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Read PDF content
        pdf_content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        
        # Extract text from all pages
        text_content = ""
        for page in pdf_reader.pages:
            text_content += page.extract_text() + "\n"
        
        if not text_content.strip():
            raise HTTPException(status_code=400, detail="No text content found in PDF")
        
        # Generate unique ID for the material
        material_id = file.filename.replace('.pdf', '').replace(' ', '_')
        
        # Store material
        lecture_materials[material_id] = {
            "filename": file.filename,
            "content": text_content,
            "notes": None,
            "quiz": None
        }
        
        return JSONResponse({
            "status": "success",
            "message": "PDF uploaded successfully",
            "material_id": material_id,
            "filename": file.filename
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/api/generate-notes")
async def generate_notes(material_id: str):
    """Generate study notes from uploaded lecture material using Gemini AI"""
    if material_id not in lecture_materials:
        raise HTTPException(status_code=404, detail="Material not found")
    
    if not model:
        raise HTTPException(status_code=500, detail="Gemini API not configured")
    
    try:
        content = lecture_materials[material_id]["content"]
        
        # Generate notes using Gemini
        prompt = f"""Based on the following lecture material, create comprehensive study notes. 
        Include:
        - Key concepts and definitions
        - Main topics covered
        - Important points to remember
        - Summary of each section
        
        Lecture Material:
        {content[:4000]}
        
        Please format the notes in a clear, structured markdown format."""
        
        response = model.generate_content(prompt)
        notes = response.text
        
        # Store generated notes
        lecture_materials[material_id]["notes"] = notes
        
        return JSONResponse({
            "status": "success",
            "notes": notes
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating notes: {str(e)}")

@app.post("/api/generate-quiz")
async def generate_quiz(request: QuizRequest):
    """Generate a quiz based on uploaded lecture material using Gemini AI"""
    if request.material_id not in lecture_materials:
        raise HTTPException(status_code=404, detail="Material not found")
    
    if not model:
        raise HTTPException(status_code=500, detail="Gemini API not configured")
    
    try:
        content = lecture_materials[request.material_id]["content"]
        
        # Generate quiz using Gemini
        prompt = f"""Based on the following lecture material, create a quiz with {request.num_questions} multiple-choice questions.

        For each question, provide:
        1. The question text
        2. Four answer options (A, B, C, D)
        3. The correct answer
        4. A brief explanation
        
        Format the output as a JSON array with this structure:
        [
            {{
                "question": "Question text here?",
                "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
                "correct_answer": "A",
                "explanation": "Explanation here"
            }}
        ]
        
        Lecture Material:
        {content[:4000]}
        
        Return only valid JSON without any markdown formatting or code blocks."""
        
        response = model.generate_content(prompt)
        quiz_text = response.text.strip()
        
        # Try to parse JSON, handle markdown code blocks if present
        if quiz_text.startswith("```json"):
            quiz_text = quiz_text.replace("```json", "").replace("```", "").strip()
        elif quiz_text.startswith("```"):
            quiz_text = quiz_text.replace("```", "").strip()
        
        try:
            quiz = json.loads(quiz_text)
        except json.JSONDecodeError:
            # If JSON parsing fails, return as text
            quiz = {"raw_text": quiz_text}
        
        # Store generated quiz
        lecture_materials[request.material_id]["quiz"] = quiz
        
        return JSONResponse({
            "status": "success",
            "quiz": quiz
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")

@app.post("/api/chat")
async def chat_with_tutor(request: ChatRequest):
    """Chat with AI tutor based on lecture material context"""
    if not model:
        raise HTTPException(status_code=500, detail="Gemini API not configured")
    
    try:
        # Build context from lecture material if provided
        context = ""
        if request.material_id and request.material_id in lecture_materials:
            content = lecture_materials[request.material_id]["content"]
            context = f"""You are an AI tutor helping a student understand the following lecture material:

{content[:3000]}

Based on this lecture material, answer the student's question in a helpful, educational manner."""
        else:
            context = "You are an AI tutor. Help the student with their question in a clear and educational manner."
        
        # Generate response using Gemini
        prompt = f"""{context}

Student's question: {request.message}

Please provide a clear, helpful answer."""
        
        response = model.generate_content(prompt)
        answer = response.text
        
        return JSONResponse({
            "status": "success",
            "response": answer
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error chatting with tutor: {str(e)}")

@app.get("/api/materials")
async def list_materials():
    """List all uploaded materials"""
    materials = [
        {
            "material_id": mat_id,
            "filename": mat_data["filename"],
            "has_notes": mat_data["notes"] is not None,
            "has_quiz": mat_data["quiz"] is not None
        }
        for mat_id, mat_data in lecture_materials.items()
    ]
    return JSONResponse({"materials": materials})

@app.get("/api/material/{material_id}")
async def get_material(material_id: str):
    """Get details of a specific material"""
    if material_id not in lecture_materials:
        raise HTTPException(status_code=404, detail="Material not found")
    
    material = lecture_materials[material_id]
    return JSONResponse({
        "material_id": material_id,
        "filename": material["filename"],
        "content_preview": material["content"][:500] + "...",
        "notes": material["notes"],
        "quiz": material["quiz"]
    })

# Add missing import
import io

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
