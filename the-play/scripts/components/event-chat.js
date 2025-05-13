import chatService from '../services/chat-service.js';
import errorHandler from '../utils/error-handler.js';
import { formatTime } from '../utils/date-format.js';

class EventChat {
  constructor(containerId, eventId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.eventId = eventId;
    this.messages = [];
    this.typingTimeout = null;
    this.typingUsers = {};
    this.mediaFile = null;
    this.isInitialized = false;
    this.isExpanded = true;
    this.messagesListenerId = null;
    this.typingListenerId = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load chat component
      await this.loadChatComponent();

      // Set up event listeners
      this.setupEventListeners();

      // Join event chat
      await chatService.joinEventChat(this.eventId);

      // Listen for messages
      this.messagesListenerId = chatService.listenToEventChat(this.eventId, messages => {
        this.messages = messages;
        this.renderMessages();
      });

      // Listen for typing indicators
      this.typingListenerId = chatService.listenToEventChatTyping(this.eventId, typingUsers => {
        this.typingUsers = typingUsers;
        this.updateTypingIndicator();
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing event chat:', error);
      errorHandler.showToast('Failed to load chat', 'error');
    }
  }

  async loadChatComponent() {
    // Use component loader to load chat HTML
    try {
      const response = await fetch('../../components/chat/event-chat.html');
      const html = await response.text();
      this.container.innerHTML = html;
    } catch (error) {
      console.error('Error loading chat component:', error);
      this.container.innerHTML = '<div class="bg-white rounded-xl shadow-md p-4 text-center">Failed to load chat component</div>';
      throw error;
    }
  }

  setupEventListeners() {
    // Message form submission
    const messageForm = document.getElementById('message-form');
    messageForm.addEventListener('submit', e => {
      e.preventDefault();
      this.sendMessage();
    });

    // Message input typing
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('input', () => {
      this.handleTyping();
    });

    // Media upload button
    const mediaUploadBtn = document.getElementById('media-upload-btn');
    mediaUploadBtn.addEventListener('click', () => {
      document.getElementById('media-upload-input').click();
    });

    // Media file selected
    const mediaUploadInput = document.getElementById('media-upload-input');
    mediaUploadInput.addEventListener('change', e => {
      this.handleMediaUpload(e.target.files[0]);
    });

    // Remove media button
    const mediaRemoveBtn = document.getElementById('media-remove-btn');
    mediaRemoveBtn.addEventListener('click', () => {
      this.removeMedia();
    });

    // Toggle chat expansion
    const chatToggleBtn = document.querySelector('.chat-toggle-btn');
    chatToggleBtn.addEventListener('click', () => {
      this.toggleChatExpansion();
    });

    // Initialize emoji picker if needed
    // this.initializeEmojiPicker();
  }

  async sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    // Don't send empty messages (unless there's media)
    if (!message && !this.mediaFile) return;
    
    try {
      messageInput.disabled = true;
      
      let mediaUrl = null;
      let mediaType = null;
      
      // Upload media if present
      if (this.mediaFile) {
        const uploadResult = await chatService.uploadChatMedia(
          this.mediaFile,
          'event',
          this.eventId
        );
        
        mediaUrl = uploadResult.url;
        mediaType = uploadResult.type;
      }
      
      // Send message
      await chatService.sendEventChatMessage(
        this.eventId,
        message,
        mediaUrl,
        mediaType
      );
      
      // Clear input and media
      messageInput.value = '';
      this.removeMedia();
      
      // Stop typing indicator
      chatService.setEventChatTyping(this.eventId, false);
      
      // Scroll to bottom
      this.scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      errorHandler.showToast('Failed to send message', 'error');
    } finally {
      messageInput.disabled = false;
      messageInput.focus();
    }
  }

  handleTyping() {
    // Set typing indicator
    chatService.setEventChatTyping(this.eventId, true);
    
    // Clear previous timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Auto-cancel typing after 5 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      chatService.setEventChatTyping(this.eventId, false);
    }, 5000);
  }

  handleMediaUpload(file) {
    if (!file) return;
    
    // Check file size (max 5MB)
    const maxSizeInBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      errorHandler.showToast('File is too large. Maximum size is 5MB.', 'error');
      return;
    }
    
    // Check file type
    if (!file.type.match('image.*') && !file.type.match('video.*')) {
      errorHandler.showToast('Only images and videos are supported.', 'error');
      return;
    }
    
    // Store file
    this.mediaFile = file;
    
    // Show preview
    const mediaPreview = document.getElementById('media-preview');
    const mediaPreviewImage = document.getElementById('media-preview-image');
    const mediaPreviewName = document.getElementById('media-preview-name');
    
    mediaPreviewName.textContent = file.name;
    
    if (file.type.match('image.*')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        mediaPreviewImage.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      // For videos, use a generic icon
      mediaPreviewImage.src = '/assets/images/icons/video-icon.svg';
    }
    
    mediaPreview.classList.remove('hidden');
  }

  removeMedia() {
    this.mediaFile = null;
    document.getElementById('media-upload-input').value = '';
    document.getElementById('media-preview').classList.add('hidden');
  }

  renderMessages() {
  const messagesList = document.getElementById('messages-list');
  const currentUser = firebase.auth().currentUser;
  
  if (!messagesList || !currentUser) return;
  
  // Store scroll position info
  const messagesContainer = document.getElementById('messages-container');
  const wasAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100;
  
  let html = '';
  
  // Group messages by date
  let lastDate = null;
  let lastSenderId = null;
  
  this.messages.forEach((message, index) => {
    const timestamp = new Date(message.timestamp);
    const messageDate = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
    
    // Add date divider if the date changes
    if (!lastDate || messageDate.getTime() !== lastDate.getTime()) {
      html += this.createDateDivider(messageDate);
      lastDate = messageDate;
      lastSenderId = null; // Reset sender for new day
    }
    
    // Determine if this message is from current user
    const isCurrentUser = message.userId === currentUser.uid;
    
    // Determine if we should show the sender info
    // Show if: first message, different sender than previous, or more than 5 minutes from the previous
    const showSender = !lastSenderId || lastSenderId !== message.userId || 
                     (index > 0 && (message.timestamp - this.messages[index - 1].timestamp) > 5 * 60 * 1000);
    
    // Add the message
    html += this.createMessageElement(message, isCurrentUser, showSender);
    
    // Update last sender
    lastSenderId = message.userId;
  });
  
  // Update DOM
  messagesList.innerHTML = html;
  
  // Set up message menu event listeners
  this.setupMessageMenuListeners();
  
  // Scroll to bottom if was at bottom before
  if (wasAtBottom) {
    this.scrollToBottom();
  }
}

  createDateDivider(date) {
    const now = new Date();
    let dateText;
    
    if (date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()) {
      dateText = 'Today';
    } else if (date.getFullYear() === now.getFullYear() &&
              date.getMonth() === now.getMonth() &&
              date.getDate() === now.getDate() - 1) {
      dateText = 'Yesterday';
    } else {
      dateText = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    return `
      <div class="flex items-center justify-center my-4">
        <div class="border-b border-gray-200 flex-grow"></div>
        <div class="mx-4 text-xs text-gray-500">${dateText}</div>
        <div class="border-b border-gray-200 flex-grow"></div>
      </div>
    `;
  }

  createMessageElement(message, isCurrentUser, showSender) {
  const timestamp = new Date(message.timestamp);
  const time = formatTime(timestamp);
  const alignmentClass = isCurrentUser ? 'justify-end' : 'justify-start';
  const bubbleClass = isCurrentUser ? 'outgoing' : 'incoming';
  
  // Check if message is hidden due to reports
  if (message.isHidden) {
    return `
      <div class="flex ${alignmentClass} mb-3">
        <div class="max-w-[80%]">
          <div class="message-bubble bg-gray-200 text-gray-500 p-3 italic">
            This message has been hidden.
          </div>
          <div class="message-timestamp text-gray-500 ${isCurrentUser ? 'text-right' : 'text-left'}">${time}</div>
        </div>
      </div>
    `;
  }
  
  let mediaElement = '';
  if (message.mediaUrl) {
    if (message.mediaType === 'image') {
      mediaElement = `
        <div class="mb-2">
          <img src="${message.mediaUrl}" alt="Shared image" class="rounded-lg max-h-64 cursor-pointer" onclick="window.open('${message.mediaUrl}', '_blank')">
        </div>
      `;
    } else if (message.mediaType === 'video') {
      mediaElement = `
        <div class="mb-2">
          <video src="${message.mediaUrl}" controls class="rounded-lg max-h-64 max-w-full"></video>
        </div>
      `;
    }
  }
  
  // Determine if we should show sender avatar and name
  let senderElement = '';
  if (showSender && !isCurrentUser) {
    senderElement = `
      <div class="flex items-center mb-1">
        <div class="w-6 h-6 rounded-full overflow-hidden mr-2">
          <img src="${message.photoURL || '/api/placeholder/24/24'}" alt="${message.displayName || 'User'}" class="w-full h-full object-cover">
        </div>
        <div class="text-xs font-medium">${message.displayName || 'User'}</div>
      </div>
    `;
  }
  
  // Create context menu for non-user messages
  const contextMenu = !isCurrentUser ? this.createMessageContextMenu(message) : '';
  
  return `
    <div class="flex ${alignmentClass} mb-3" id="message-${message.id}">
      <div class="max-w-[80%]">
        ${senderElement}
        <div class="relative group">
          <div class="message-bubble ${bubbleClass} p-3">
            ${mediaElement}
            <div>${message.text}</div>
            ${contextMenu}
          </div>
          <div class="message-timestamp text-gray-500 ${isCurrentUser ? 'text-right' : 'text-left'}">${time}</div>
        </div>
      </div>
    </div>
  `;
}

  updateTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    const typingText = document.querySelector('.typing-text');
    
    // Count typing users
    const typingUserIds = Object.keys(this.typingUsers);
    const typingCount = typingUserIds.length;
    
    if (typingCount > 0) {
      // Show typing indicator
      typingIndicator.classList.remove('hidden');
      
      // Update text
      if (typingCount === 1) {
        // Try to get user name
        const typingUserId = typingUserIds[0];
        this.getUserDisplayName(typingUserId).then(name => {
          typingText.textContent = `${name} is typing...`;
        });
      } else if (typingCount === 2) {
        typingText.textContent = '2 people are typing...';
      } else {
        typingText.textContent = 'Several people are typing...';
      }
    } else {
      // Hide typing indicator
      typingIndicator.classList.add('hidden');
    }
  }

  async getUserDisplayName(userId) {
    try {
      const doc = await firebase.firestore().collection('users').doc(userId).get();
      if (doc.exists) {
        return doc.data().displayName || 'Someone';
      }
      return 'Someone';
    } catch (error) {
      console.error('Error getting user display name:', error);
      return 'Someone';
    }
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  toggleChatExpansion() {
    const chatContainer = document.querySelector('.chat-container');
    const toggleIcon = document.querySelector('.chat-toggle-btn i');
    
    this.isExpanded = !this.isExpanded;
    
    if (this.isExpanded) {
      chatContainer.style.display = 'block';
      toggleIcon.className = 'fas fa-chevron-up';
    } else {
      chatContainer.style.display = 'none';
      toggleIcon.className = 'fas fa-chevron-down';
    }
  }

  cleanup() {
    // Remove event listeners
    if (this.messagesListenerId) {
      this.messagesListenerId();
      this.messagesListenerId = null;
    }
    
    if (this.typingListenerId) {
      this.typingListenerId();
      this.typingListenerId = null;
    }
    
    // Leave event chat
    chatService.leaveEventChat(this.eventId).catch(error => {
      console.error('Error leaving event chat:', error);
    });
    
    this.isInitialized = false;
  }

  // ADD THE NEW METHODS HERE
  createMessageContextMenu(message) {
    return `
      <div class="message-context-menu absolute top-2 right-2">
        <button class="message-menu-btn p-1 text-gray-500 hover:text-gray-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          <i class="fas fa-ellipsis-v"></i>
        </button>
        <div class="message-menu-dropdown hidden absolute right-0 mt-1 bg-white shadow-md rounded-lg py-2 w-32 z-10">
          <button class="report-message-btn w-full text-left px-3 py-1 hover:bg-gray-100 text-xs" data-message-id="${message.id}">
            <i class="fas fa-flag mr-1"></i> Report
          </button>
        </div>
      </div>
    `;
  }

  setupMessageMenuListeners() {
    // Toggle message menu
    document.querySelectorAll('.message-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;
        
        // Hide all other dropdowns
        document.querySelectorAll('.message-menu-dropdown').forEach(otherDropdown => {
          if (otherDropdown !== dropdown) {
            otherDropdown.classList.add('hidden');
          }
        });
        
        // Toggle this dropdown
        dropdown.classList.toggle('hidden');
      });
    });
    
    // Report message
    document.querySelectorAll('.report-message-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const messageId = btn.dataset.messageId;
        this.reportMessage(messageId);
        
        // Hide dropdown
        btn.closest('.message-menu-dropdown').classList.add('hidden');
      });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.message-menu-dropdown').forEach(dropdown => {
        dropdown.classList.add('hidden');
      });
    });
  }

  reportMessage(messageId) {
    // Import and load the report modal
    import('../../scripts/utils/component-Loader.js').then(module => {
      const { loadComponent } = module;
      
      // Load the report modal component if not already loaded
      loadComponent('modal-report-container', '../../components/modals/report-message-modal.html')
        .then(() => {
          // Initialize report modal
          if (typeof window.initializeReportModal === 'function') {
            window.initializeReportModal(messageId, this.eventId);
          } else {
            console.error('Report modal initialization function not found');
            errorHandler.showToast('Could not load report dialog', 'error');
          }
        })
        .catch(error => {
          console.error('Error loading report modal:', error);
          errorHandler.showToast('Could not load report dialog', 'error');
        });
    });
}


  }

export default EventChat;