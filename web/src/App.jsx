import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { THEMES } from '../../shared/themeConfig'; 

const API_URL = "http://localhost:3000"; 

function App() {
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const queryParams = new URLSearchParams(window.location.search);
  const username = queryParams.get('u');

  useEffect(() => {
    if (username) {
      axios.get(`${API_URL}/u/${username}`).then(res => setUser(res.data)).catch(e => console.log(e));
    }
  }, [username]);

  const startRec = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    const chunks = [];
    mediaRecorderRef.current.ondataavailable = e => chunks.push(e.data);
    mediaRecorderRef.current.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/mp3' }));
    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRec = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const sendMsg = async () => {
    if(!user) return;
    const formData = new FormData();
    formData.append('recipientId', user.id);
    if (audioBlob) {
      formData.append('type', 'audio');
      formData.append('audio', audioBlob, 'voice.mp3');
    } else {
      formData.append('type', 'text');
      formData.append('content', text);
    }
    await axios.post(`${API_URL}/send`, formData);
    alert("Sent anonymously!");
    setText(""); setAudioBlob(null);
  };

  if (!username) return <h1 style={{color:'#fff'}}>Link required (e.g. ?u=yourname)</h1>;
  if (!user) return <h1 style={{color:'#fff'}}>Loading User...</h1>;

  const theme = THEMES[user.theme_id] || THEMES[0];
  const bgStyle = theme.bg.includes('gradient') ? { background: theme.bg } : { backgroundColor: theme.bg };

  return (
    <div style={{ minHeight: '100vh', color: theme.text, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, ...bgStyle }}>
      <h1 style={{fontFamily: 'sans-serif'}}>Txtme 👻</h1>
      <h3 style={{fontFamily: 'sans-serif'}}>Send anonymous message to {user.username}</h3>
      <div style={{ background: theme.card, padding: 20, borderRadius: 15, width: '100%', maxWidth: 400, border: theme.border || 'none' }}>
        <textarea 
          style={{ width: '95%', background: 'transparent', color: theme.text, border: 'none', fontSize: '16px', outline: 'none', resize: 'none' }}
          placeholder="Type something secret..."
          rows={4}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={isRecording ? stopRec : startRec} style={{padding: 10, borderRadius: '50%', border: 'none', cursor: 'pointer', background: isRecording ? 'red' : '#eee'}}>
            {isRecording ? "🛑" : "🎤"}
          </button>
          {audioBlob && <span>Audio Ready!</span>}
        </div>
      </div>
      <button onClick={sendMsg} style={{ marginTop: 20, padding: "15px 50px", background: theme.accent, border: 'none', color: '#fff', borderRadius: 30, fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>
        Send It!
      </button>
    </div>
  );
}
export default App;