// ===================================
// CHAT FUNCTIONALITY WITH BACKEND SERVER
// ===================================

// Configuration
const CHAT_API_URL = 'https://bt-backend-eight.vercel.app/api/chat'; // Backend server

// Conversation history
let conversationHistory = [];

// Send message function
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');
    const userMessage = input.value.trim();

    if (!userMessage) {
        showNotification('Please enter a message.', 'error');
        return;
    }

    // Add user message to UI
    const userDiv = document.createElement('div');
    userDiv.className = 'message user-message';
    userDiv.innerHTML = `<strong>You:</strong> ${escapeHtml(userMessage)}`;
    messages.appendChild(userDiv);

    // Add to conversation history
    conversationHistory.push({
        role: 'user',
        content: userMessage
    });

    // Clear input
    input.value = '';

    // Scroll to bottom
    messages.scrollTop = messages.scrollHeight;

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<strong>GPT:</strong> <span class="typing-dots">...</span>';
    messages.appendChild(typingDiv);
    messages.scrollTop = messages.scrollHeight;

    try {
        await handleStandardResponse(userMessage, messages);
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();

        const errorDiv = document.createElement('div');
        errorDiv.className = 'message bot-message error-message';
        errorDiv.innerHTML = `<strong>Error:</strong> ${escapeHtml(error.message || 'Failed to get response. Please check if the backend server is running.')}`;
        messages.appendChild(errorDiv);
        messages.scrollTop = messages.scrollHeight;

        showNotification('Failed to get response. Please check if the backend server is running.', 'error');
    }
}

// Handle streaming response from backend
async function handleStandardResponse(userMessage, messages) {
    const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: userMessage,
            conversationHistory: conversationHistory.slice(0, -1) // Exclude the message we just added
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    removeTypingIndicator();

    // Create bot message div
    const botDiv = document.createElement('div');
    botDiv.className = 'message bot-message';
    botDiv.innerHTML = `<strong>GPT:</strong> <span class="response-content"></span>`;
    messages.appendChild(botDiv);
    const responseContent = botDiv.querySelector('.response-content');

    let fullMessage = '';
    
    // Read the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.error) {
                            throw new Error(data.error);
                        }
                        
                        if (data.content) {
                            fullMessage += data.content;
                            responseContent.textContent = fullMessage;
                            messages.scrollTop = messages.scrollHeight;
                        }
                        
                        if (data.done) {
                            break;
                        }
                    } catch (e) {
                        // Skip invalid JSON lines
                        console.warn('Failed to parse line:', line, e);
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    // Add to conversation history
    conversationHistory.push({
        role: 'assistant',
        content: fullMessage
    });

    // Render MathJax
    if (window.MathJax) {
        window.MathJax.typesetPromise([responseContent]).catch((err) => console.log('MathJax error:', err));
    }
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Clear conversation
function clearConversation() {
    conversationHistory = [];
    const messages = document.getElementById('chat-messages');
    messages.innerHTML = `
        <div class="message bot-message">
            <strong>GPT:</strong>
            Hello! I'm here to help you with your studies. Feel free to ask me anything!
        </div>
    `;
    showNotification('Conversation cleared', 'success');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Handle Enter key
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('chat-input');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
});
