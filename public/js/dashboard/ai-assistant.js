/**
 * AI Assistant Chat Logic
 */
const aiChatInput = document.getElementById('ai-chat-input');
const aiSendBtn = document.getElementById('ai-send-btn');
const aiChatHistory = document.getElementById('ai-chat-history');

function appendToHistory(role, text, rawData = null) {
  if (aiChatHistory.querySelector('div[style*="text-align: center"]')) {
    aiChatHistory.innerHTML = '';
  }

  const msgDiv = document.createElement('div');
  msgDiv.style.marginBottom = '8px';
  msgDiv.style.padding = '10px 14px';
  msgDiv.style.borderRadius = '8px';
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const label = role === 'user' ? 'OPERATOR' : 'AI ASSISTANT';
  const labelColor = role === 'user' ? 'var(--accent)' : 'var(--success)';
  const bgColor = role === 'user' ? 'rgba(240,180,41,0.05)' : 'rgba(52,211,153,0.05)';
  const borderColor = role === 'user' ? 'rgba(240,180,41,0.1)' : 'rgba(52,211,153,0.1)';

  msgDiv.style.background = bgColor;
  msgDiv.style.border = `1px solid ${borderColor}`;

  let jsonHtml = '';
  if (rawData) {
    const jsonId = 'json-' + Math.random().toString(36).substr(2, 9);
    jsonHtml = `
      <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
        <details style="cursor: pointer;">
          <summary style="font-size: 10px; color: var(--muted); outline: none; display: flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px;"><polyline points="9 18 15 12 9 6"/></svg>
            VIEW SOURCE DATA
          </summary>
          <pre style="margin-top: 8px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 11px; overflow-x: auto; color: #9cdcfe; border: 1px solid rgba(255,255,255,0.05);">${JSON.stringify(rawData, null, 2)}</pre>
        </details>
      </div>
    `;
  }

  msgDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
      <span style="font-size: 10px; font-weight: 700; color: ${labelColor}; letter-spacing: 0.05em;">${label}</span>
      <span style="font-size: 9px; color: var(--muted);">${time}</span>
    </div>
    <div style="color: var(--text); font-size: 13px; white-space: pre-wrap;">${text}</div>
    ${jsonHtml}
  `;

  aiChatHistory.appendChild(msgDiv);
  aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
}

async function sendMessageToAI() {
  const message = aiChatInput.value.trim();
  if (!message) return;

  const messageSessionId = "ms-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);

  aiChatInput.value = '';
  aiChatInput.disabled = true;
  aiSendBtn.disabled = true;
  aiSendBtn.innerText = 'WAITING...';
  
  appendToHistory('user', message);

  try {
    const username = document.getElementById('navUsername')?.textContent || 'anonymous';
    const timestamp = new Date().toISOString();
    
    const response = await fetch("https://twinagent.quangphuly.online/chat", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({ 
        message: message, 
        session_id: messageSessionId, 
        user: username,
        timestamp: timestamp,
        convai_mode: true 
      }),
      cache: 'no-cache'
    });

    if (!response.ok) throw new Error('API Error');
    
    const data = await response.json();
    const aiResponse = data.convai?.spoken_answer || data.response || "I encountered an issue processing your request.";
    
    appendToHistory('ai', aiResponse, data);

  } catch (error) {
    console.error("AI Assistant Error:", error);
    appendToHistory('ai', "System Error: Unable to connect to the AI Assistant.");
  } finally {
    aiChatInput.disabled = false;
    aiSendBtn.disabled = false;
    aiSendBtn.innerText = 'SEND';
    aiChatInput.focus();
  }
}

aiSendBtn.addEventListener('click', sendMessageToAI);
aiChatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessageToAI();
});
