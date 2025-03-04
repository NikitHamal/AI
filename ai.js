// DOM Elements
const messagesContainer = document.querySelector('.messages-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-btn');
const settingsBtn = document.querySelector('.settings-btn');
const deleteAllBtn = document.querySelector('.delete-all-btn');
const settingsModal = document.getElementById('settings-modal');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const closeModalBtns = document.querySelectorAll('.close-modal');
const saveSettingsBtn = document.getElementById('save-settings');
const newChatBtn = document.querySelector('.new-chat-btn');
const conversationList = document.querySelector('.conversation-list');
const modelBadge = document.querySelector('.model-badge');
const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
const closeSidebarBtn = document.querySelector('.close-sidebar-btn');
const sidebar = document.querySelector('.sidebar');
const typingStatus = document.querySelector('.typing-status');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const suggestionChips = document.querySelectorAll('.suggestion-chip');
const inputArea = document.querySelector('.input-area');

// Utility functions
const fetchWithTimeout = (url, options = {}) => {
    const { timeout = 8000, ...fetchOptions } = options;
    return Promise.race([
        fetch(url, fetchOptions),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timed out')), timeout)
        )
    ]);
};

// Debounce function to prevent excessive function calls
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

// Kimi API Configuration
let kimiConfig = {
    model: 'kimi',
    useSearch: true,
    useResearch: false,
    deviceId: '7470186203606840333',
    sessionId: '1731130480464666566',
    trafficId: 'cuh5rgiav1f3eq17cf50',
    endpoint: 'https://kimi.moonshot.cn/api/chat/completions',
    apiBaseUrl: 'https://kimi.moonshot.cn/api',
    useProxy: false,
    proxyEndpoint: 'http://localhost:3000/kimi-proxy',
    authorization: 'Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1c2VyLWNlbnRlciIsImV4cCI6MTc0MzYwMTM5MywiaWF0IjoxNzQxMDA5MzkzLCJqdGkiOiJjdjJyM3NlczFyaDZrcDU5YmVhMCIsInR5cCI6ImFjY2VzcyIsImFwcF9pZCI6ImtpbWkiLCJzdWIiOiJjdWg1cmdpYXYxZjNlcTE3Y2Y1MCIsInNwYWNlX2lkIjoiY3VoNXJnaWF2MWYzZXExN2NmNGciLCJhYnN0cmFjdF91c2VyX2lkIjoiY3VoNXJnaWF2MWYzZXExN2NmNDAiLCJzc2lkIjoiMTczMTEzMDQ4MDQ2NDY2NjU2NiIsImRldmljZV9pZCI6Ijc0NzAxODYyMDM2MDY4NDAzMzMifQ.88AudKg4StX9pdMJeBW0Vmpcmfu5sTjBygADw5H74fz3fS1vZ_2W6hNKKkX-5Ar4Okd1MoE6IVr7o6sjC8a84w'
};

// App state
let conversations = [];
let currentConversation = null;
let isProcessing = false;
let shouldAutoScroll = true;
let userScrolled = false;
let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
let currentGroupId = null;
let currentChatId = null;
let recommendedPromptsCache = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeApp);

// Event listeners
function initializeApp() {
    // Check if device is iOS and add appropriate class
    if (isIOS) {
        document.body.classList.add('ios-device');
    }
    
    // Load saved settings
    loadSettings();
    
    // Load recommended prompts cache
    loadRecommendedPromptsFromCache();
    
    // Load saved conversations
    loadConversations();
    
    // Check for session ID in URL path
    const pathSegments = window.location.pathname.split('/');
    const sessionId = pathSegments[pathSegments.length - 1];
    
    // If we have a valid session ID in the URL, try to find a conversation with matching API session ID
    if (sessionId && sessionId.length > 8 && sessionId !== 'ai.html') {
        // First try to find a conversation with matching Kimi chat ID
        const matchingByKimiChatId = conversations.find(conv => conv.kimiChatId === sessionId);
        if (matchingByKimiChatId) {
            loadConversation(matchingByKimiChatId.id, false); // Load without updating URL
            return;
        }
        
        // Fallback to matching on conversation ID if needed
        const matchingById = conversations.find(conv => conv.id === sessionId);
        if (matchingById) {
            loadConversation(matchingById.id, false); // Load without updating URL
            return;
        }
    }
    
    // If no valid session ID or conversation not found, load most recent or create new
    if (conversations.length === 0) {
        createNewConversation();
    } else {
        // Load the most recent conversation
        loadConversation(conversations[0].id, false); // Don't update URL for initial load
    }
    
    // Add event listeners
    initEventListeners();
    
    // Auto-resize textarea
    userInput.addEventListener('input', autoResizeTextarea);
    
    // Handle scroll events
    messagesContainer.addEventListener('scroll', handleScroll);
    
    // Update model badge
    updateModelBadge();
    
    // Fix for iOS viewport height issues
    if (isIOS) {
        fixIOSViewportHeight();
        window.addEventListener('resize', fixIOSViewportHeight);
        window.addEventListener('orientationchange', fixIOSViewportHeight);
    }
    
    // Check if server is available if proxy is enabled
    if (kimiConfig.useProxy) {
        checkServerAvailability();
    }
    
    // Add a welcome message after a small delay for a better UX
    setTimeout(addWelcomeMessage, 100);
}

// iOS height fix
function fixIOSViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Initialize event listeners with iOS optimizations
function initEventListeners() {
    // User input events
    userInput.addEventListener('input', autoResizeTextarea);
    userInput.addEventListener('keydown', handleInputKeydown);
    
    // Send button
    sendButton.addEventListener('click', handleSendMessage);
    
    // Sidebar toggle
    mobileNavToggle.addEventListener('click', toggleSidebar);
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', toggleSidebar);
    }
    
    // New chat button
    newChatBtn.addEventListener('click', createNewConversation);
    
    // Suggestion chips - use touchend for iOS
    suggestionChips.forEach(chip => {
        if (isIOS) {
            chip.addEventListener('touchend', (e) => {
                e.preventDefault();
                userInput.value = chip.textContent;
                handleSendMessage();
            });
        } else {
        chip.addEventListener('click', () => {
            userInput.value = chip.textContent;
            handleSendMessage();
        });
        }
    });
    
    // Settings modal events
    settingsBtn.addEventListener('click', openSettingsModal);
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal.id === 'settings-modal') {
                closeSettingsModal();
            } else if (modal.id === 'delete-confirm-modal') {
                closeDeleteModal();
            }
        });
    });
    
    saveSettingsBtn.addEventListener('click', saveSettings);
    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    }
    
    // Delete all chats button
    deleteAllBtn.addEventListener('click', openDeleteModal);
    
    // Delete confirmation modal events
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }
    confirmDeleteBtn.addEventListener('click', deleteAllChats);
    
    // Handle clicks outside sidebar on mobile
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            e.target !== mobileNavToggle) {
            toggleSidebar();
        }
    });
    
    // Add popstate event listener for handling browser back/forward navigation
    window.addEventListener('popstate', handlePopState);
    
    // Prevent iOS rubber-banding/bouncing effect
    if (isIOS) {
        document.body.addEventListener('touchmove', function(e) {
            if (e.target.closest('.messages-container, .conversation-list, .modal-body')) {
                const scrollContainer = e.target.closest('.messages-container, .conversation-list, .modal-body');
                const isAtTop = scrollContainer.scrollTop <= 0;
                const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 1;
                
                if ((isAtTop && e.touches[0].screenY > e.touches[0].screenY) || 
                    (isAtBottom && e.touches[0].screenY < e.touches[0].screenY)) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
    }
}

// Handle scroll events for auto-scrolling
function handleScroll() {
    // Calculate if we're at the bottom
    const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 50;
    
    // If user scrolled up manually, disable auto-scrolling
    if (!isAtBottom && !userScrolled) {
        userScrolled = true;
        shouldAutoScroll = false;
    }
    
    // If user scrolled back to bottom, re-enable auto-scrolling
    if (isAtBottom && userScrolled) {
        userScrolled = false;
        shouldAutoScroll = true;
    }
}

// Auto-resize textarea as user types
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    const newHeight = Math.min(140, userInput.scrollHeight);
    userInput.style.height = newHeight + 'px';
}

// Handle Enter key to send message (but allow Shift+Enter for new lines)
function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
}

// Create a new chat conversation
function createNewConversation() {
    const newConversation = {
        id: generateId(),
        title: 'New Conversation',
        messages: [],
        created: new Date().toISOString(),
        kimiChatId: null // Add a field to store the Kimi chat ID
    };
    
    // Add to conversations array
    conversations.unshift(newConversation);
    
    // Save to localStorage
    saveConversations();
    
    // Update the UI
    updateConversationsList();
    
    // Reset chat and group IDs
    currentChatId = null;
    currentGroupId = null;
    
    // Update URL to remove any session parameter and just show ai.html
    const currentPath = window.location.pathname;
    const basePath = currentPath.split('/').filter(segment => 
        segment !== '' && !segment.includes('ai.html') && segment.length < 20
    ).join('/');
    
    const newPath = basePath ? `/${basePath}/ai.html` : `/ai.html`;
    window.history.pushState({}, '', newPath);
    
    // Load the new conversation
    loadConversation(newConversation.id, false); // Don't update URL again since we just did
    
    // Focus the input field - on iOS, delay focus to avoid keyboard issues
    if (isIOS) {
        setTimeout(() => userInput.focus(), 100);
    } else {
        userInput.focus();
    }
}

// Load a specific conversation
function loadConversation(id, shouldUpdateUrl = true) {
    // Reset chat and group IDs when loading a new conversation
    currentChatId = null;
    currentGroupId = null;
    
    // Find the conversation
    currentConversation = conversations.find(conv => conv.id === id);
    
    if (!currentConversation) {
        console.error('Conversation not found:', id);
        // Create a new conversation if the requested one doesn't exist
        createNewConversation();
        return;
    }
    
    // Update URL with session ID if requested and if this is not a new empty conversation
    if (shouldUpdateUrl && currentConversation.messages.length > 0) {
        updateUrlWithSessionId(currentConversation.kimiChatId || id);
    }
    
    // Update active state in sidebar
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === id) {
            item.classList.add('active');
        }
    });
    
    // Clear messages container
    messagesContainer.innerHTML = '';
    
    // Add all messages to the container
    if (currentConversation.messages.length > 0) {
        currentConversation.messages.forEach(msg => {
            appendMessage(msg.role, msg.content, msg.searchData, msg.thinking);
        });
        
        // Try to load cached prompts if this conversation has a Kimi chat ID
        if (currentConversation.kimiChatId) {
            currentChatId = currentConversation.kimiChatId;
            const lastAssistantMessage = currentConversation.messages.findLast(msg => msg.role === 'assistant');
            if (lastAssistantMessage && lastAssistantMessage.group_id) {
                currentGroupId = lastAssistantMessage.group_id;
                // Load cached prompts with a small delay to ensure smooth animation
                setTimeout(() => {
                    try {
                        const cachedData = recommendedPromptsCache[`${currentChatId}-${currentGroupId}`];
                        if (cachedData && (Date.now() - cachedData.timestamp) < 30 * 60 * 1000) {
                            displayRecommendedPrompts(cachedData.prompts);
                        }
                    } catch (error) {
                        console.error('Error loading cached prompts:', error);
                    }
                }, 100);
            }
        }
    } else {
        // Add welcome message if the conversation is empty
        setTimeout(addWelcomeMessage, 100);
    }
    
    // Scroll to bottom
    scrollToBottom();
    
    // Close sidebar on mobile after loading conversation
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
        document.body.classList.remove('sidebar-open');
    }
    
    // Remove recommended prompts when loading a new conversation
    const existingPrompts = document.querySelector('.recommended-prompts');
    if (existingPrompts) existingPrompts.remove();
}

// Helper function to update URL with session ID
function updateUrlWithSessionId(sessionId) {
    if (!sessionId) return;
    
    // Get the base path without any session ID
    const currentPath = window.location.pathname;
    const basePath = currentPath.split('/').filter(segment => 
        segment !== '' && !segment.includes('ai.html') && segment.length < 20
    ).join('/');
    
    // Construct the new path with session parameter
    const newPath = basePath ? 
        `/${basePath}/ai.html?session=${sessionId}` : 
        `/ai.html?session=${sessionId}`;
    
    // Update URL with query parameter
    window.history.pushState({}, '', newPath);
}

// Update the conversation list in the sidebar
function updateConversationsList() {
    conversationList.innerHTML = '';
    
    conversations.forEach(conv => {
        const convEl = document.createElement('div');
        convEl.className = 'conversation-item';
        convEl.dataset.id = conv.id;
        
        if (currentConversation && conv.id === currentConversation.id) {
            convEl.classList.add('active');
        }
        
        convEl.innerHTML = `
            <span class="conversation-title">${conv.title}</span>
            <button class="delete-conversation" aria-label="Delete conversation">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        // Add click event for loading conversation
        convEl.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-conversation')) {
                loadConversation(conv.id);
            }
        });
        
        // Add delete button event listener
        convEl.querySelector('.delete-conversation').addEventListener('click', (e) => {
            deleteConversation(conv.id, e);
        });
        
        conversationList.appendChild(convEl);
    });
}

// Append a message to the chat
function appendMessage(role, content, searchData = null, thinking = null) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    
    // Create message content wrapper
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // If we have thinking data, add it as a collapsible section before the content
    if (thinking && typeof thinking === 'object' && role === 'assistant') {
        const thinkingSection = document.createElement('div');
        thinkingSection.className = 'thinking-section';
        
        const formattedThinkingText = thinking.text ? thinking.text.split('\n').map(p => `<p>${p}</p>`).join('') : '';
        
        thinkingSection.innerHTML = `
            <div class="thinking-header">
                <span class="thinking-status completed">
                    Thought for <span class="duration">${thinking.duration}s</span>
                </span>
                <span class="thinking-toggle">
                    Show thinking
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </span>
            </div>
            <div class="thinking-content">
                ${formattedThinkingText}
            </div>
        `;
        
        // Add click handler for toggling
        const header = thinkingSection.querySelector('.thinking-header');
        const content = thinkingSection.querySelector('.thinking-content');
        const toggle = thinkingSection.querySelector('.thinking-toggle');
        
        header.addEventListener('click', () => {
            const isExpanded = content.classList.toggle('expanded');
            toggle.classList.toggle('expanded');
            toggle.firstChild.textContent = isExpanded ? 'Hide thinking' : 'Show thinking';
        });
        
        messageContent.insertBefore(thinkingSection, messageContent.firstChild);
    }
    
    // Format the content
    const formattedContent = document.createElement('div');
    formattedContent.className = 'formatted-content';
    formattedContent.innerHTML = formatMessage(content);
    messageContent.appendChild(formattedContent);
    
    // If we have search data and this is an assistant message, add search results before the content
    if (role === 'assistant' && searchData && searchData.results && searchData.results.length > 0) {
        const searchResultsEl = createSearchResultsElement(searchData.targets || [], searchData.results);
        messageEl.appendChild(searchResultsEl);
    }
    
    messageEl.appendChild(messageContent);
    messagesContainer.appendChild(messageEl);
    
    // Scroll to the new message if auto-scroll is enabled
    if (shouldAutoScroll) {
        scrollToBottom();
    }
}

// Show typing indicator while waiting for response
function showTypingIndicator() {
    // Create a typing indicator element
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message assistant thinking-bubble';
    typingIndicator.innerHTML = `
        <div class="message-content">
            <div class="thinking-dots">
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
            </div>
        </div>
    `;
    
    // Add to messages container
    messagesContainer.appendChild(typingIndicator);
    
    // Scroll to show the typing indicator
    scrollToBottom();
    
    // Return the element so it can be removed later
    return typingIndicator;
}

// Format message with Markdown-like syntax
function formatMessage(text) {
    // Process code blocks with language support
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`;
    });
    
    // Process inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Process bold text
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Process italic text
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Process links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Process lists
    text = text.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Process numbered lists
    text = text.replace(/^\s*(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
    
    // Process blockquotes
    text = text.replace(/^\s*>\s*(.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Process headers
    text = text.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>');
    text = text.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>');
    text = text.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>');
    text = text.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');
    
    // Process tables
    text = text.replace(/\|(.+)\|/g, (match, content) => {
        const cells = content.split('|').map(cell => cell.trim());
        return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    });
    text = text.replace(/(<tr>.*<\/tr>)/s, '<table>$1</table>');
    
    // Process horizontal rules
    text = text.replace(/^---+$/gm, '<hr>');
    
    // Process paragraphs (double newlines)
    text = text.replace(/\n\n/g, '</p><p>');
    
    // Wrap in paragraph tags if not already wrapped
    if (!text.startsWith('<')) {
        text = `<p>${text}</p>`;
    }
    
    return text;
}

// Scroll to the bottom of the messages container
function scrollToBottom() {
    // Use requestAnimationFrame for smoother scrolling
    requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Handle sending a message
async function handleSendMessage() {
    const message = userInput.value.trim();
    
    // Don't send empty messages
    if (!message || isProcessing) {
        return;
    }
    
    // Disable input during processing
    isProcessing = true;
    userInput.disabled = true;
    sendButton.disabled = true;
    
    // Hide any existing recommended prompts with fade out
    const existingPrompts = document.querySelector('.recommended-prompts');
    if (existingPrompts) {
        existingPrompts.classList.remove('visible');
        setTimeout(() => existingPrompts.remove(), 300); // Remove after fade out
    }
    
    // On iOS, blur the input to hide keyboard
    if (isIOS) {
        userInput.blur();
    }
    
    // Clear the input field
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Remove welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    // Add user message to UI
    appendMessage('user', message);
    
    // Add to conversation
    if (!currentConversation) {
        createNewConversation();
    }
    
    currentConversation.messages.push({
        role: 'user',
        content: message
    });
        
    // Update conversation title if this is the first message
    if (currentConversation.messages.length === 1) {
        currentConversation.title = message.length > 30 ? message.substring(0, 30) + '...' : message;
        updateConversationsList();
        
        // Create a new chat session with Kimi API for first message
        try {
            const chatId = await createKimiChatSession(message);
            if (chatId) {
                currentConversation.kimiChatId = chatId;
                console.log(`Created new Kimi chat session with ID: ${chatId}`);
                // Update URL with the new chat ID
                updateUrlWithSessionId(chatId);
                saveConversations();
            }
        } catch (error) {
            console.error('Failed to create Kimi chat session:', error);
        }
    } else if (currentChatId) {
        // If not the first message and we have a chat ID, update URL
        updateUrlWithSessionId(currentChatId);
    }
        
    // Save to localStorage
    saveConversations();
    
    // Show typing indicator
    const typingIndicator = showTypingIndicator();
    
    try {
        // Send to Kimi API
        await sendToKimi(message, typingIndicator);
    } catch (error) {
        console.error('Error during Kimi communication:', error);
        
        // Remove typing indicator
        if (typingIndicator.parentNode) {
            messagesContainer.removeChild(typingIndicator);
        }
        
        // Add error message
        appendMessage('assistant', 'I apologize, but there was an error processing your request. Please try again later.');
        
        // Add to conversation
        currentConversation.messages.push({
            role: 'assistant',
            content: 'I apologize, but there was an error processing your request. Please try again later.'
        });
                
        // Save conversation with error
        saveConversations();
    }
    
    // Re-enable input
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    
    // On mobile, focus with a delay to avoid iOS issues
    if (window.innerWidth > 768 || !isIOS) {
        userInput.focus();
    }
}

// Create a new chat session with Kimi API
async function createKimiChatSession(firstMessage) {
    try {
        const endpoint = kimiConfig.useProxy ? 
            `${kimiConfig.proxyEndpoint}/chat` : 
            `${kimiConfig.apiBaseUrl}/chat`;
    
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': kimiConfig.authorization,
            'x-msh-device-id': kimiConfig.deviceId,
            'x-msh-session-id': kimiConfig.sessionId,
            'x-traffic-id': kimiConfig.trafficId,
            'x-msh-platform': 'web',
            'x-language': 'en-US',
            'r-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        
        const payload = {
            "name": firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage,
            "born_from": "chat",
            "model": kimiConfig.model === 'k1' ? 'k1' : 'kimi',
            "source": "web",
            "messages": [{
                "role": "user",
                "content": firstMessage
            }]
        };
        
        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            timeout: 10000
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create chat session: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        // Store both chat_id and group_id
        currentChatId = data.conversation_id || data.id;
        currentGroupId = data.group_id;
        
        // Update the URL with the API-provided chat ID
        if (currentChatId) {
            updateUrlWithSessionId(currentChatId);
        }
        
        // Fetch recommended prompts after creating new session
        await fetchRecommendedPrompts();
        
        return currentChatId;
    } catch (error) {
        console.error('Error creating chat session:', error);
        throw error;
    }
}

// Send message to Kimi API
async function sendToKimi(message, typingIndicator) {
    try {
        let chatEndpoint;
        
        if (currentChatId) {
            chatEndpoint = kimiConfig.useProxy ? 
                `${kimiConfig.proxyEndpoint}/chat/${currentChatId}/completion/stream` : 
                `${kimiConfig.apiBaseUrl}/chat/${currentChatId}/completion/stream`;
        } else {
            const chatId = await createKimiChatSession(message);
            currentChatId = chatId;
            chatEndpoint = kimiConfig.useProxy ? 
                `${kimiConfig.proxyEndpoint}/chat/${chatId}/completion/stream` : 
                `${kimiConfig.apiBaseUrl}/chat/${chatId}/completion/stream`;
        }
    
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': kimiConfig.authorization,
            'x-msh-device-id': kimiConfig.deviceId,
            'x-msh-session-id': kimiConfig.sessionId,
            'x-traffic-id': kimiConfig.trafficId,
            'x-msh-platform': 'web',
            'x-language': 'en-US',
            'r-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        // Format messages for API
        const formattedMessages = currentConversation.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            name: msg.role === 'user' ? 'user' : 'assistant'
        }));

        const requestData = {
            kimiplus_id: "kimi",
            extend: {
                sidebar: true
            },
            model: kimiConfig.model === 'k1' ? 'k1' : 'kimi',
            use_research: kimiConfig.useResearch,
            use_search: kimiConfig.useSearch,
            messages: [{
                role: 'user',
                content: message
            }],
            refs: [],
            history: [],
            scene_labels: []
        };
        
        const response = await fetchWithTimeout(chatEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
            timeout: 30000
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }
        
        // Process the streaming response
        await processStreamingResponse(response, typingIndicator);
        
    } catch (error) {
        console.error('Error during Kimi communication:', error);
        throw error;
    }
}

async function processStreamingResponse(response, typingIndicator) {
    let responseText = '';
    let thoughtText = '';
    let searchResults = [];
    let searchTargets = [];
    let isThinking = false;
    let startTime = Date.now();
    let thinkingTimer;
    let searchResultsAdded = false;
    let groupIdReceived = false;

    // Hide any existing recommended prompts immediately
    const existingPrompts = document.querySelector('.recommended-prompts');
    if (existingPrompts) {
        existingPrompts.classList.remove('visible');
        setTimeout(() => existingPrompts.remove(), 300);
    }

    // Create response element
    const responseEl = document.createElement('div');
    responseEl.className = 'message assistant';
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Create formatted content container
    const formattedContent = document.createElement('div');
    formattedContent.className = 'formatted-content';
    messageContent.appendChild(formattedContent);

    // Add thinking section if needed
    let thinkingSection;
    
    // Append message content after search results will be added
    responseEl.appendChild(messageContent);
        messagesContainer.replaceChild(responseEl, typingIndicator);

    try {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines from the buffer
            let lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    // Remove "data: " prefix if present and parse JSON
                    const jsonStr = line.replace(/^data: /, '').trim();
                    if (!jsonStr) continue;
                    
                    const jsonData = JSON.parse(jsonStr);

                    // Check for group_id in the response
                    if (jsonData.group_id && !groupIdReceived) {
                        currentGroupId = jsonData.group_id;
                        groupIdReceived = true;
                    }

                    // Handle search events first
                    if (jsonData.event === 'k1' && jsonData.type === 'search_results') {
                        if (!searchResults) {
                            searchResults = [];
                        }
                        // Add new results only if they're not already in the array
                        jsonData.search_results.forEach(newResult => {
                            if (!searchResults.some(existingResult => existingResult.url === newResult.url)) {
                                searchResults.push(newResult);
                            }
                        });
                    }

                    if (jsonData.event === 'k1' && jsonData.type === 'search_targets') {
                        searchTargets = jsonData.search_targets;
                    }

                    // Create search results element if we have both targets and results
                    if (searchResults && searchResults.length > 0 && searchTargets && !searchResultsAdded) {
                        const searchResultsEl = createSearchResultsElement(searchTargets, searchResults);
                        responseEl.insertBefore(searchResultsEl, messageContent);
                        searchResultsAdded = true;
                        }

                        // Handle thought process (k1 model)
                    if (jsonData.event === 'k1' && jsonData.text) {
                        if (!isThinking) {
                            isThinking = true;
                            startTime = Date.now();
                            thinkingSection = document.createElement('div');
                            thinkingSection.className = 'thinking-section';
                            thinkingSection.innerHTML = `
                                <div class="thinking-header">
                                    <span class="thinking-status active">
                                        Thinking <span class="duration">0s</span>
                                    </span>
                                    <span class="thinking-toggle">
                                        Show thinking &nbsp;<span class="duration"></span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </span>
                                </div>
                                <div class="thinking-content"></div>
                            `;
                            messageContent.insertBefore(thinkingSection, formattedContent);

                            // Add click handler for toggling
                            const header = thinkingSection.querySelector('.thinking-header');
                            const content = thinkingSection.querySelector('.thinking-content');
                            const toggle = thinkingSection.querySelector('.thinking-toggle');
                            
                            header.addEventListener('click', () => {
                                const isExpanded = content.classList.toggle('expanded');
                                toggle.classList.toggle('expanded');
                                toggle.firstChild.textContent = isExpanded ? 'Hide thinking ' : 'Show thinking ';
                            });

                            // Start timer update
                            thinkingTimer = setInterval(() => {
                                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                                const timeEl = thinkingSection.querySelector('.duration');
                                if (timeEl) timeEl.textContent = `${elapsedSeconds}s`;
                            }, 1000);
                        }
                        thoughtText += jsonData.text;
                        const content = thinkingSection.querySelector('.thinking-content');
                        if (content) {
                            content.innerHTML = thoughtText.split('\n').map(p => `<p>${p}</p>`).join('');
                        }
                            if (shouldAutoScroll) requestAnimationFrame(scrollToBottom);
                        }

                        // Handle response text
                        if (jsonData.event === 'cmpl' && jsonData.text) {
                            if (isThinking) {
                            // Stop and update timer before switching to response
                            clearInterval(thinkingTimer);
                            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                            const headerEl = thinkingSection.querySelector('.thinking-header');
                            if (headerEl) {
                                headerEl.innerHTML = `
                                    <div class="thinking-status completed">
                                        Thought for <span class="duration">${elapsedSeconds}s</span>
                                    </div>
                                    <div class="thinking-toggle">
                                        Show thinking <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                    </div>
                                `;
                            }
                                isThinking = false;
                            }
                            responseText += jsonData.text;
                        formattedContent.innerHTML = formatMessage(responseText);
                            if (shouldAutoScroll) requestAnimationFrame(scrollToBottom);
                    }
                } catch (e) {
                    console.error('Error parsing JSON:', e, 'Line:', line);
                }
            }
        }

        // Process any remaining data in the buffer
        if (buffer.trim()) {
            try {
                const jsonStr = buffer.replace(/^data: /, '').trim();
                if (jsonStr) {
                    const jsonData = JSON.parse(jsonStr);
                    if (jsonData.event === 'cmpl' && jsonData.text) {
                        responseText += jsonData.text;
                        formattedContent.innerHTML = formatMessage(responseText);
                            }
                        }
                    } catch (e) {
                console.error('Error parsing remaining buffer:', e);
            }
        }

        // Only fetch prompts after full completion
        if (currentChatId && currentGroupId) {
            try {
                await fetchRecommendedPrompts();
            } catch (error) {
                console.error('Error fetching prompts after completion:', error);
            }
        }
    } catch (error) {
        console.error('Error reading response:', error);
    }

    // Save the message to conversation history
            const messageData = {
                role: 'assistant',
                content: responseText,
        group_id: currentGroupId // Save the group_id with the message
    };

    if (thoughtText) {
        messageData.thinking = {
            text: thoughtText,
            duration: Math.floor((Date.now() - startTime) / 1000)
        };
    }

    if (searchResults.length > 0) {
        messageData.searchData = {
            targets: searchTargets,
            results: searchResults
        };
            }
            
            currentConversation.messages.push(messageData);
            saveConversations();
}

// Function to create search results element
function createSearchResultsElement(targets, results) {
    const searchResultsEl = document.createElement('div');
    searchResultsEl.className = 'search-results';

    // Add Understanding Question section
    const understandingSection = document.createElement('div');
    understandingSection.className = 'search-section';
    
    const understandingHeader = document.createElement('div');
    understandingHeader.className = 'section-header main';
    understandingHeader.innerHTML = `
        <svg class="checkmark-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
        </svg>
        <span>Understanding Question</span>
    `;
    
    const understandingContent = document.createElement('div');
    understandingContent.className = 'search-content thread-container';
    
    // Add Searched Web section inside Understanding Question
    if (targets.length > 0) {
        const searchWebSection = document.createElement('div');
        searchWebSection.className = 'search-section nested thread-item';
        
        const searchHeader = document.createElement('div');
        searchHeader.className = 'section-header nested expandable';
        searchHeader.innerHTML = `
            <div class="thread-line"></div>
            <svg class="checkmark-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
            <span>Searched Web</span>
        `;
        
        const searchContent = document.createElement('div');
        searchContent.className = 'search-content nested';
        searchContent.innerHTML = `
            <div class="search-queries">
                ${targets.map(target => 
                    `<a href="https://www.google.com/search?q=${encodeURIComponent(target)}" target="_blank" class="search-query">${target}</a>`
                ).join('')}
            </div>
        `;
        
        searchWebSection.appendChild(searchHeader);
        searchWebSection.appendChild(searchContent);
        
        // Add click handler for Searched Web section
        searchHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            searchHeader.classList.toggle('expanded');
            searchContent.classList.toggle('visible');
        });
        
        understandingContent.appendChild(searchWebSection);
    }

    // Add Read Web Pages section inside Understanding Question
    if (results && results.length > 0) {
        const readPagesSection = document.createElement('div');
        readPagesSection.className = 'search-section nested thread-item';
        
        const readPagesHeader = document.createElement('div');
        readPagesHeader.className = 'section-header nested expandable';
        readPagesHeader.innerHTML = `
            <div class="thread-line"></div>
            <svg class="checkmark-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
            </svg>
            <span>Read ${results.length} web pages</span>
        `;
        
        const readPagesContent = document.createElement('div');
        readPagesContent.className = 'search-content nested';
        readPagesContent.innerHTML = `
            <div class="read-pages-list">
                ${results.map(result => `
                    <div class="search-result">
                        <div class="source">
                            ${result.icon ? `<img src="${result.icon}" alt="${result.site_name}" class="favicon">` : ''}
                            <span class="site-name">${result.site_name}</span>
                            ${result.date ? `<span class="date">[${result.date}]</span>` : ''}
                        </div>
                        <a href="${result.url}" target="_blank" rel="noopener noreferrer" class="result-title">${result.title}</a>
                        <p class="snippet">${result.snippet}</p>
                        <a href="${result.url}" target="_blank" rel="noopener noreferrer" class="url">${result.url}</a>
                    </div>
                `).join('')}
            </div>
        `;
        
        readPagesSection.appendChild(readPagesHeader);
        readPagesSection.appendChild(readPagesContent);
        
        // Add click handler for Read Web Pages section
        readPagesHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            readPagesHeader.classList.toggle('expanded');
            readPagesContent.classList.toggle('visible');
        });
        
        understandingContent.appendChild(readPagesSection);
    }

    understandingSection.appendChild(understandingHeader);
    understandingSection.appendChild(understandingContent);
    
    // Add click handler for toggling content
    understandingHeader.addEventListener('click', () => {
        understandingHeader.classList.toggle('expanded');
        understandingContent.classList.toggle('visible');
    });
    
    searchResultsEl.appendChild(understandingSection);
    return searchResultsEl;
}

// Settings functions
function openSettingsModal() {
    loadSettingsToForm();
    settingsModal.classList.add('active');
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

function loadSettingsToForm() {
    document.getElementById('model-select').value = kimiConfig.model;
    document.getElementById('web-search').checked = kimiConfig.useSearch;
    document.getElementById('research-mode').checked = kimiConfig.useResearch;
    document.getElementById('device-id').value = kimiConfig.deviceId;
    document.getElementById('session-id').value = kimiConfig.sessionId;
    document.getElementById('traffic-id').value = kimiConfig.trafficId;
    document.getElementById('use-proxy').checked = kimiConfig.useProxy;
    document.getElementById('proxy-endpoint').value = kimiConfig.proxyEndpoint;
}

function saveSettings() {
    kimiConfig.model = document.getElementById('model-select').value;
    kimiConfig.useSearch = document.getElementById('web-search').checked;
    kimiConfig.useResearch = document.getElementById('research-mode').checked;
    kimiConfig.deviceId = document.getElementById('device-id').value;
    kimiConfig.sessionId = document.getElementById('session-id').value;
    kimiConfig.trafficId = document.getElementById('traffic-id').value;
    kimiConfig.useProxy = document.getElementById('use-proxy').checked;
    kimiConfig.proxyEndpoint = document.getElementById('proxy-endpoint').value;
    
    // Save to localStorage
    localStorage.setItem('kimiConfig', JSON.stringify(kimiConfig));
    
    // Update UI
    updateModelBadge();
    
    // Close modal
    closeSettingsModal();
}

function updateModelBadge() {
    modelBadge.textContent = kimiConfig.model === 'k1' ? 'AI 1.5' : 'AI';
}

// Load settings from localStorage
function loadSettings() {
    const savedConfig = localStorage.getItem('kimiConfig');
    if (savedConfig) {
        try {
            const parsedConfig = JSON.parse(savedConfig);
            kimiConfig = { ...kimiConfig, ...parsedConfig };
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// Load conversations from localStorage
function loadConversations() {
    try {
        const savedConversations = localStorage.getItem('kimiConversations');
        if (savedConversations) {
            conversations = JSON.parse(savedConversations);
            
            // Ensure search_data is properly initialized for each message
            conversations.forEach(conv => {
                if (conv.messages) {
                    conv.messages.forEach(msg => {
                        if (msg.role === 'assistant') {
                            // Initialize searchData if it doesn't exist
                            if (!msg.searchData) {
                                msg.searchData = {
                                targets: [],
                                results: []
                            };
                            }
                            // Migrate old search_data to searchData if needed
                            if (msg.search_data && !msg.searchData) {
                                msg.searchData = msg.search_data;
                                delete msg.search_data;
                            }
                        }
                    });
                }
            });
        } else {
            conversations = [];
        }
        
        if (conversations.length > 0) {
            updateConversationsList();
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
        conversations = [];
    }
}

// Save conversations to localStorage
function saveConversations() {
    localStorage.setItem('kimiConversations', JSON.stringify(conversations));
}

// Generate a unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Check if the server is available
async function checkServerAvailability() {
    console.log('Checking server availability...');
    
    // If proxy is not enabled, no need to check
    if (!kimiConfig.useProxy) {
        console.log('Proxy server not in use, using direct API access');
        return true;
    }
    
    try {
        const response = await fetchWithTimeout(kimiConfig.proxyEndpoint + '/health', {
            method: 'GET',
            timeout: 3000 // Short timeout for quick checks
        });
        
        if (response.ok) {
            console.log('Proxy server is available');
            return true;
        } else {
            console.warn('Proxy server responded with error:', response.status);
            // Automatically switch to direct API access
            kimiConfig.useProxy = false;
            updateSettingsUI();
            return false;
        }
    } catch (error) {
        console.error('Failed to connect to proxy server:', error);
        // Automatically switch to direct API access
        kimiConfig.useProxy = false;
        updateSettingsUI();
        
        // Show notification to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'system-message warning';
        errorDiv.innerHTML = `<p>Proxy server is not available. Switched to direct API access.</p>`;
        messagesContainer.appendChild(errorDiv);
        scrollToBottom();
        
        return false;
    }
}

// Update settings UI elements based on current config
function updateSettingsUI() {
    // Update UI elements to reflect current configuration
    document.getElementById('model-select').value = kimiConfig.model;
    document.getElementById('web-search').checked = kimiConfig.useSearch;
    document.getElementById('research-mode').checked = kimiConfig.useResearch;
    document.getElementById('device-id').value = kimiConfig.deviceId;
    document.getElementById('session-id').value = kimiConfig.sessionId;
    document.getElementById('traffic-id').value = kimiConfig.trafficId;
    document.getElementById('use-proxy').checked = kimiConfig.useProxy;
    document.getElementById('proxy-endpoint').value = kimiConfig.proxyEndpoint;
    
    // Update model badge
    updateModelBadge();
    
    // Save settings to localStorage
    localStorage.setItem('kimiConfig', JSON.stringify(kimiConfig));
}

// Toggle sidebar with proper iOS support
function toggleSidebar() {
    sidebar.classList.toggle('active');
    document.body.classList.toggle('sidebar-open');
    
    console.log('Sidebar toggle clicked, new state:', sidebar.classList.contains('active') ? 'open' : 'closed');
    
    // For iOS, ensure proper scroll behavior when toggling
    if (isIOS && sidebar.classList.contains('active')) {
        // Prevent background scrolling when sidebar is open
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    } else if (isIOS) {
        // Restore scrolling when sidebar is closed
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }
}

// Delete a specific conversation
function deleteConversation(id, event) {
    event.stopPropagation(); // Prevent triggering conversation selection
    
    // Filter out the conversation to delete from the global conversations array
    conversations = conversations.filter(conv => conv.id !== id);
    
    // Save to localStorage
    saveConversations();
    
    // Update UI
    updateConversationsList();
    
    // If it was the active conversation, create a new one or load the most recent one
    if (currentConversation && currentConversation.id === id) {
        // Reset chat and group IDs
        currentChatId = null;
        currentGroupId = null;
        
        // Update URL to remove session parameter
        const url = new URL(window.location);
        url.searchParams.delete('session');
        window.history.pushState({}, '', url.pathname);
        
        if (conversations.length > 0) {
            loadConversation(conversations[0].id);
        } else {
            createNewConversation();
        }
    }
}

// Open delete confirmation modal
function openDeleteModal() {
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

// Close delete confirmation modal
function closeDeleteModal() {
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Delete all chats
function deleteAllChats() {
    try {
        // Clear localStorage
        localStorage.removeItem('kimiConversations');
        
        // Reset conversations array and current states
        conversations = [];
        currentConversation = null;
        currentChatId = null;
        currentGroupId = null;
        
        // Update URL to remove session parameter
        const url = new URL(window.location);
        url.searchParams.delete('session');
        window.history.pushState({}, '', url.pathname);
        
        // Clear UI
        conversationList.innerHTML = '';
        messagesContainer.innerHTML = '';
        
        // Create new conversation
        createNewConversation();
        
        // Add welcome message
        addWelcomeMessage();
        
        // Close modal
        closeDeleteModal();
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    } catch (error) {
        console.error('Error deleting all chats:', error);
    }
}

// Add welcome message
function addWelcomeMessage() {
    if (!messagesContainer.querySelector('.welcome-message') && 
        (!currentConversation || currentConversation.messages.length === 0)) {
        const welcome = document.createElement('div');
        welcome.className = 'welcome-message';
        welcome.innerHTML = `
            <h2>Welcome to AI Chat</h2>
            <p>I'm your AI assistant, ready to help with any questions or tasks you have.</p>
            <div class="suggestion-chips">
                <button class="suggestion-chip">Tell me about yourself</button>
                <button class="suggestion-chip">What can you do?</button>
                <button class="suggestion-chip">Help me with coding</button>
            </div>
        `;
    
        // Add event listeners to suggestion chips
        welcome.querySelectorAll('.suggestion-chip').forEach(chip => {
            if (isIOS) {
                chip.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    userInput.value = chip.textContent;
                    handleSendMessage();
                });
            } else {
                chip.addEventListener('click', () => {
                    userInput.value = chip.textContent;
                    handleSendMessage();
                });
            }
        });
        
        messagesContainer.appendChild(welcome);
    }
}

// Handle browser back/forward navigation
function handlePopState() {
    // Get session ID from query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    
    // If no session ID or invalid URL, load most recent conversation
    if (!sessionId) {
        if (conversations.length > 0) {
            loadConversation(conversations[conversations.length - 1].id, false);
        } else {
            createNewConversation();
        }
        return;
    }
    
    // Try to find conversation with matching Kimi chat ID
    const matchingByKimiChatId = conversations.find(conv => conv.kimiChatId === sessionId);
    if (matchingByKimiChatId) {
        loadConversation(matchingByKimiChatId.id, false); // Load without updating URL
        return;
    }
    
    // Fallback to matching on conversation ID
    const matchingById = conversations.find(conv => conv.id === sessionId);
    if (matchingById) {
        loadConversation(matchingById.id, false);
        return;
    }
    
    // If no matching conversation found, create new one
    createNewConversation();
}

// Add this function to save prompts to local storage
function saveRecommendedPromptsToCache(key, prompts) {
    recommendedPromptsCache[key] = {
        prompts: prompts,
        timestamp: Date.now()
    };
    localStorage.setItem('recommendedPromptsCache', JSON.stringify(recommendedPromptsCache));
}

// Add this function to load prompts from local storage
function loadRecommendedPromptsFromCache() {
    const cached = localStorage.getItem('recommendedPromptsCache');
    if (cached) {
        recommendedPromptsCache = JSON.parse(cached);
    }
}

// Update the fetchRecommendedPrompts function
async function fetchRecommendedPrompts() {
    try {
        if (!currentChatId || !currentGroupId) {
            return;
        }

        // Create a unique cache key with both chatId and groupId
        const cacheKey = `${currentChatId}-${currentGroupId}`;
        
        // Check cache with the new key
        const cachedData = recommendedPromptsCache[cacheKey];
        const cacheExpiry = 30 * 60 * 1000;
        if (cachedData && (Date.now() - cachedData.timestamp) < cacheExpiry) {
            displayRecommendedPrompts(cachedData.prompts);
            return;
        }

        const endpoint = kimiConfig.useProxy ? 
            `${kimiConfig.proxyEndpoint}/chat/recommend-prompt` : 
            `${kimiConfig.apiBaseUrl}/chat/recommend-prompt`;

        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': kimiConfig.authorization,
                'x-msh-device-id': kimiConfig.deviceId,
                'x-msh-session-id': kimiConfig.sessionId,
                'x-traffic-id': kimiConfig.trafficId,
                'x-msh-platform': 'web',
                'x-language': 'en-US',
                'r-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            body: JSON.stringify({
                chat_id: currentChatId,
                group_id: currentGroupId,
                use_search: kimiConfig.useSearch
            }),
            timeout: 10000
        });

        if (!response.ok) throw new Error(`Failed to fetch prompts: ${response.status}`);

        // Process response and save with new cache key
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let prompts = [];

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                try {
                    const jsonStr = line.replace(/^data: /, '').trim();
                    if (!jsonStr) continue;
                    
                    const jsonData = JSON.parse(jsonStr);
                    if (jsonData.event === 'chat_prompt' && jsonData.text) {
                        prompts.push(jsonData.text);
                    }
                } catch (e) {
                    console.error('Error parsing JSON:', e, 'Line:', line);
                }
            }
        }

        // Save with composite key
        saveRecommendedPromptsToCache(cacheKey, prompts);
        displayRecommendedPrompts(prompts);

    } catch (error) {
        console.error('Error fetching recommended prompts:', error);
    }
}

// Add this new function to handle prompt display
function displayRecommendedPrompts(prompts) {
    if (!prompts || prompts.length === 0) return;

    // Remove existing prompts with fade out
    const existingPrompts = document.querySelector('.recommended-prompts');
    if (existingPrompts) {
        existingPrompts.classList.remove('visible');
        setTimeout(() => existingPrompts.remove(), 300);
    }

    // Create container
    const promptsContainer = document.createElement('div');
    promptsContainer.className = 'recommended-prompts';

    // Add header
    const header = document.createElement('div');
    header.className = 'recommended-prompts-header';
    header.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span>Suggested questions</span>
    `;
    promptsContainer.appendChild(header);

    // Add prompts list
    const promptsList = document.createElement('div');
    promptsList.className = 'recommended-prompts-list';

    prompts.forEach((promptText, index) => {
        const promptElement = document.createElement('button');
        promptElement.className = 'recommended-prompt';
        promptElement.textContent = promptText;
        
        promptElement.addEventListener('click', () => {
            userInput.value = promptText;
            userInput.focus();
            handleSendMessage();
        });

        promptsList.appendChild(promptElement);
    });

    promptsContainer.appendChild(promptsList);

    // Find the last assistant message and append prompts
    const messages = document.querySelectorAll('.message');
    let lastAssistantMessage = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].classList.contains('assistant') && !messages[i].classList.contains('thinking-bubble')) {
            lastAssistantMessage = messages[i];
            break;
        }
    }

    if (lastAssistantMessage) {
        lastAssistantMessage.insertAdjacentElement('afterend', promptsContainer);
        // Add visible class after a short delay to trigger animation
        requestAnimationFrame(() => {
            promptsContainer.classList.add('visible');
        });
        scrollToBottom();
    }
}

// Initialize dev tools
devTools.loadFromLocalStorage(); 