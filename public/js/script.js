const apiKeyInput = document.getElementById('api-key-input');
const saveKeyButton = document.getElementById('save-key-button');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const sessionNameInput = document.getElementById('session-name-input');
const createSessionButton = document.getElementById('create-session-button');
const sessionList = document.getElementById('session-list');

// 从本地存储加载 API Key
const savedApiKey = localStorage.getItem('apiKey');
if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
}

// 保存 API Key
saveKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        localStorage.setItem('apiKey', apiKey);
        alert('API Key 已保存');
    }
});

// 从会话中加载对话
let currentSession = { id: null, conversation: [] };

// 添加消息到聊天界面
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.textContent = content;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 发送消息
async function sendMessage() {
    const message = messageInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!message) return;
    if (!apiKey) {
        alert('请先输入 API Key');
        return;
    }

    addMessage(message, true);
    messageInput.value = '';

    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.className = 'message ai-message';
    chatContainer.appendChild(aiMessageDiv);

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, apiKey }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;

                    aiResponse += data;
                    aiMessageDiv.textContent = aiResponse;
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }
        }

        // 将用户和AI的消息添加到会话中
        currentSession.conversation.push({ content: message, isUser: true });
        currentSession.conversation.push({ content: aiResponse, isUser: false });

        // 保存会话数据到服务器
        saveSessionData();
    } catch (error) {
        console.error('Error:', error);
        aiMessageDiv.textContent = '发生错误，请重试';
    }
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// 创建新会话
createSessionButton.addEventListener('click', () => {
    const sessionName = sessionNameInput.value.trim();
    if (!sessionName) return;

    fetch('/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName }),
    }).then(response => response.json())
        .then(data => {
            currentSession = { id: data.sessionId, conversation: [] };
            updateSessionList();
            sessionNameInput.value = '';
        });
});

// 更新会话列表
function updateSessionList() {
    fetch('/sessions', {
        method: 'GET',
    }).then(response => response.json())
        .then(sessions => {
            sessionList.innerHTML = '';
            sessions.forEach(session => {
                const sessionElement = document.createElement('div');
                sessionElement.textContent = session.session_name;
                sessionElement.onclick = () => enterSession(session.id);
                sessionList.appendChild(sessionElement);
            });
        });
}

// 进入会话
function enterSession(sessionId) {
    fetch(`/sessions/${sessionId}`, {
        method: 'GET',
    }).then(response => response.json())
        .then(session => {
            const conversation = JSON.parse(session.session_data).conversation;
            currentSession = { id: sessionId, conversation };
            updateChatBox(conversation);
        });
}

// 更新聊天框内容
function updateChatBox(conversation) {
    chatContainer.innerHTML = '';
    conversation.forEach(message => {
        addMessage(message.content, message.isUser);
    });
}

// 保存会话数据
function saveSessionData() {
    fetch('/update-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.id, conversation: currentSession.conversation }),
    }).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    }).then(data => {
        if (data.success) {
            console.log('Session data saved successfully');
        }
    }).catch(error => {
        console.error('Error saving session data:', error);
    });
}

// 页面加载时，加载会话列表
document.addEventListener('DOMContentLoaded', updateSessionList);