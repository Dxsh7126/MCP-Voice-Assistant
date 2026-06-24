import React, { useState, useRef } from 'react';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Tap to talk to Jarvis");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Replace this with your secure Ngrok/Cloudflare Tunnel URL when testing on your phone
  const BACKEND_URL = "http://localhost:8050"; 

  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendVoiceToJarvis(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatus("Listening...");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setStatus("Microphone permission denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus("Processing processing...");
    }
  };

  const sendVoiceToJarvis = async (audioBlob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "user_voice.wav");

    try {
      const response = await fetch(`${BACKEND_URL}/api/voice`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Backend failed to respond");

      setStatus("Jarvis responding...");
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => setStatus("Tap to talk to Jarvis");
      await audio.play();
    } catch (error) {
      console.error(error);
      setStatus("Error connecting to Jarvis.");
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>JARVIS</h1>
        <p style={styles.status}>{status}</p>
      </header>

      <div style={styles.buttonContainer}>
        <button 
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          style={{
            ...styles.micButton,
            backgroundColor: isRecording ? '#ff4d4d' : '#00bcd4',
            transform: isRecording ? 'scale(1.1)' : 'scale(1)'
          }}
        >
          {isRecording ? "🔴" : "🎤"}
        </button>
        <p style={styles.hint}>Hold button down to speak, release to send</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#121212',
    color: '#ffffff',
    fontFamily: 'sans-serif',
    padding: '40px 20px',
    boxSizing: 'border-box'
  },
  header: {
    textAlign: 'center',
    marginTop: '40px',
  },
  status: {
    color: '#00bcd4',
    fontSize: '18px',
    marginTop: '10px',
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '60px',
  },
  micButton: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: 'none',
    fontSize: '40px',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0px 4px 20px rgba(0, 188, 212, 0.4)',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  hint: {
    marginTop: '20px',
    fontSize: '14px',
    color: '#888888',
  }
};

export default App;