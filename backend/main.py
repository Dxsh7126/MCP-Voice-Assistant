import os
import shutil
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from groq import Groq
import edge_tts
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jarvis-core")

app = FastAPI(title="Jarvis Core Orchestrator")

# Enable CORS so your phone can connect via local tunnel/IP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq Client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Define your running MCP server endpoint
# Adjust this to where your Google Tasks/Outlook MCP server is running
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", ",http://127.0.0.1:8000")

@app.post("/api/voice")
async def process_voice(file: UploadFile = File(...)):
    """Receives voice from React frontend, handles STT -> Agentic LLM -> TTS."""
    temp_audio_path = f"temp_{file.filename}"
    output_tts_path = "jarvis_response.mp3"
    
    try:
        # 1. Save incoming audio blob from phone
        with open(temp_audio_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Speech-to-Text via Groq Whisper
        logger.info("Transcribing audio via Groq Whisper...")
        with open(temp_audio_path, "rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_file,
                response_format="text"
            )
        
        user_text = transcription.strip()
        logger.info(f"User Said: {user_text}")
        
        if not user_text:
            raise HTTPException(status_code=400, detail="Could not understand audio.")

        # 3. Agentic Routing Loop (LLaMA 3.1 Tool Call Integration)
        # Note: For simplicity here, we use prompt engineering to match intent.
        # You can expand this into full tool calling using the MCP Client SDK.
        system_prompt = f"""You are Jarvis, a highly intelligent personal assistant.
        You have access to an Outlook and Google Tasks MCP server running at {MCP_SERVER_URL}.
        Be concise, clear, and direct in your responses."""
        
        logger.info("Generating response from LLaMA 3.1...")
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text}
            ],
            model="llama-3.3-70b-versatile",
        )
        
        jarvis_response_text = chat_completion.choices[0].message.content
        logger.info(f"Jarvis Response: {jarvis_response_text}")

        # 4. Text-to-Speech via Edge TTS (Free, fast, no tokens required)
        logger.info("Synthesizing voice response...")
        communicate = edge_tts.Communicate(jarvis_response_text, "en-US-BrianNeural")
        await communicate.save(output_tts_path)

        # 5. Return the audio file back to the React app
        return FileResponse(output_tts_path, media_type="audio/mp3")

    except Exception as e:
        logger.error(f"Error processing voice: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up the incoming chunk
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8050)