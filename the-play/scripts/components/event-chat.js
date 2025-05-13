// scripts/components/event-chat.js
import { firebase } from '../firebase/config.js';
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
    this.onlineUsersListenerId = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Ensure user is authenticated
      if (!firebase.auth().currentUser) {
        this.container.innerHTML = `
          <div class="p-6 text-center">
            <p class="text-gray-600 mb-3">Sign in to join the event chat</p>
            <a href="../auth/login.html" class="btn-primary inline-block">Sign In</a>
          </div>
        `;
        return;
      }

      // Load chat component
      await this.loadChatComponent();

      // Set up event listeners
      this.setupEventListeners();

      // Initialize chat room in Firebase if it doesn't exist
      await this.initializeChatRoom();

      // Join event chat and update user status
      await this.joinChat();

      // Listen for messages
      this.listenForMessages();

      // Listen for typing indicators
      this.listenForTypingIndicators();

      // Listen for online users
      this.listenForOnlineUsers();

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing event chat:', error);
      errorHandler.showToast('Failed to load chat', 'error');
      this.container.innerHTML = `
        <div class="p-6 text-center">
          <p class="text-red-600 mb-3">Error loading chat: ${error.message}</p>
          <button class="btn-primary" onclick="location.reload()">Try Again</button>
        </div>
      `;
    }
  }

  async loadChatComponent() {
    try {
      const response = await fetch('../../components/chat/event-chat.html');
      if (!response.ok) {
        throw new Error(`Failed to load component: ${response.status}`);
      }
      const html = await response.text();
      this.container.innerHTML = html;
    } catch (error) {
      console.error('Error loading chat component:', error);
      throw error;
    }
  }

  async initializeChatRoom() {
    const db = firebase.firestore();
    const eventRef = db.collection('events').doc(this.eventId);
    
    // Get event details
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      throw new Error('Event not found');
    }
    
    const eventData = eventDoc.data();
    
    // Check if chat room exists in realtime db
    const chatRoomRef = firebase.database().ref(`chatRooms/${this.eventId}`);
    const snapshot = await chatRoomRef.once('value');
    
    if (!snapshot.exists()) {
      // Create chat room
      await chatRoomRef.set({
        name: eventData.title || 'Event Chat',
        eventId: this.eventId,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
    }
    
    // Update chat title
    const titleElement = this.container.querySelector('.chat-title');
    if (titleElement) {
      titleElement.textContent = eventData.title || 'Event Chat';
    }
  }

  async joinChat() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    // Add user to online users
    const userRef = firebase.database().ref(`chatRooms/${this.eventId}/onlineUsers/${user.uid}`);
    await userRef.set({
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || null,
      lastActive: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Remove user when disconnected
    userRef.onDisconnect().remove();
  }

  listenForMessages() {
    const messagesRef = firebase.database().ref(`chatRooms/${this.eventId}/messages`).orderByChild('timestamp').limitToLast(50);
    
    this.messagesListenerId = messagesRef.on('value', snapshot => {
      const messages = [];
      snapshot.forEach(childSnapshot => {
        messages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      this.messages = messages;
      this.renderMessages();
      
      // Scroll to bottom on first load
      if (messages.length > 0) {
        this.scrollToBottom();
      }
    });
  }

  listenForTypingIndicators() {
    const typingRef = firebase.database().ref(`chatRooms/${this.eventId}/typing`);
    
    this.typingListenerId = typingRef.on('value', snapshot => {
      const typingUsers = {};
      
      snapshot.forEach(childSnapshot => {
        // Ignore current user
        if (childSnapshot.key !== firebase.auth().currentUser.uid) {
          typingUsers[childSnapshot.key] = childSnapshot.val();
        }
      });
      
      this.typingUsers = typingUsers;
      this.updateTypingIndicator();
    });
  }

  listenForOnlineUsers() {
    const onlineUsersRef = firebase.database().ref(`chatRooms/${this.eventId}/onlineUsers`);
    
    this.onlineUsersListenerId = onlineUsersRef.on('value', snapshot => {
      const count = snapshot.numChildren();
      
      // Update count in UI
      const countElement = this.container.querySelector('.count-num');
      if (countElement) {
        countElement.textContent = count;
      }
    });
  }

  setupEventListeners() {
    // Message form submission
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
      messageForm.addEventListener('submit', e => {
        e.preventDefault();
        this.sendMessage();
      });
    }
    
    // Message input for typing indicator
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
      messageInput.addEventListener('input', () => {
        this.handleTyping();
        
        // Enable/disable send button based on input
        const sendButton = document.getElementById('send-message-button');
        if (sendButton) {
          sendButton.disabled = messageInput.value.trim() === '' && !this.mediaFile;
        }
      });
    }
    
    // Media upload
    const mediaUploadBtn = document.getElementById('media-upload-btn');
    const mediaUploadInput = document.getElementById('media-upload-input');
    
    if (mediaUploadBtn && mediaUploadInput) {
      mediaUploadBtn.addEventListener('click', () => {
        mediaUploadInput.click();
      });
      
      mediaUploadInput.addEventListener('change', e => {
        if (e.target.files.length > 0) {
          this.handleMediaUpload(e.target.files[0]);
        }
      });
    }
    
    // Media remove button
    const mediaRemoveBtn = document.getElementById('media-remove-btn');
    if (mediaRemoveBtn) {
      mediaRemoveBtn.addEventListener('click', () => {
        this.removeMedia();
      });
    }
    
    // Chat toggle
    const chatToggleBtn = this.container.querySelector('.chat-toggle-btn');
    if (chatToggleBtn) {
      chatToggleBtn.addEventListener('click', () => {
        this.toggleChatExpansion();
      });
    }
  }

  async sendMessage() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    const text = messageInput.value.trim();
    
    // Don't send empty message unless there's media
    if (!text && !this.mediaFile) return;
    
    // Disable input while sending
    messageInput.disabled = true;
    
    try {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      let mediaUrl = null;
      let mediaType = null;
      
      // Upload media if available
      if (this.mediaFile) {
        const fileRef = firebase.storage().ref(`chat-media/${this.eventId}/${Date.now()}_${this.mediaFile.name}`);
        await fileRef.put(this.mediaFile);
        mediaUrl = await fileRef.getDownloadURL();
        mediaType = this.mediaFile.type.startsWith('image/') ? 'image' : 'video';
      }
      
      // Send message
      const messagesRef = firebase.database().ref(`chatRooms/${this.eventId}/messages`);
      await messagesRef.push({
        text: text,
        userId: user.uid,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL || null,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        mediaUrl: mediaUrl,
        mediaType: mediaType
      });
      
      // Clear input and media
      messageInput.value = '';
      this.removeMedia();
      
      // Set typing status to false
      this.setTypingStatus(false);
      
      // Scroll to bottom
      this.scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      errorHandler.showToast('Failed to send message', 'error');
    } finally {
      // Re-enable input
      messageInput.disabled = false;
      messageInput.focus();
    }
  }

  handleTyping() {
    // Set typing status
    this.setTypingStatus(true);
    
    // Clear previous timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Auto-cancel typing after 5 seconds
    this.typingTimeout = setTimeout(() => {
      this.setTypingStatus(false);
    }, 5000);
  }

  async setTypingStatus(isTyping) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    const typingRef = firebase.database().ref(`chatRooms/${this.eventId}/typing/${user.uid}`);
    
    if (isTyping) {
      await typingRef.set({
        displayName: user.displayName || user.email.split('@')[0],
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
    } else {
      await typingRef.remove();
    }
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
    
    // Enable send button
    const sendButton = document.getElementById('send-message-button');
    if (sendButton) {
      sendButton.disabled = false;
    }
    
    // Show preview
    const mediaPreview = document.getElementById('media-preview');
    const mediaPreviewImage = document.getElementById('media-preview-image');
    const mediaPreviewName = document.getElementById('media-preview-name');
    
    if (mediaPreview && mediaPreviewImage && mediaPreviewName) {
      mediaPreviewName.textContent = file.name;
      
      if (file.type.match('image.*')) {
        const reader = new FileReader();
        reader.onload = function(e) {
          mediaPreviewImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        mediaPreviewImage.src = '/assets/images/icons/video-icon.svg';
      }
      
      mediaPreview.classList.remove('hidden');
    }
  }

  removeMedia() {
    this.mediaFile = null;
    
    const mediaUploadInput = document.getElementById('media-upload-input');
    const mediaPreview = document.getElementById('media-preview');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-message-button');
    
    if (mediaUploadInput) {
      mediaUploadInput.value = '';
    }
    
    if (mediaPreview) {
      mediaPreview.classList.add('hidden');
    }
    
    // Disable send button if text is also empty
    if (sendButton && messageInput) {
      sendButton.disabled = messageInput.value.trim() === '';
    }
  }

  renderMessages() {
    const messagesList = document.getElementById('messages-list');
    if (!messagesList) return;
    
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    // Check if scrolled to bottom before update
    const messagesContainer = document.getElementById('messages-container');
    const wasAtBottom = messagesContainer && 
      (messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100);
    
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
      const showSender = !lastSenderId || lastSenderId !== message.userId || 
                        (index > 0 && (message.timestamp - this.messages[index - 1].timestamp) > 5 * 60 * 1000);
      
      // Add the message
      html += this.createMessageElement(message, isCurrentUser, showSender);
      
      // Update last sender
      lastSenderId = message.userId;
    });
    
    // Show empty state if no messages
    if (this.messages.length === 0) {
      html = `
        <div class="text-center py-4 chat-start-message">
          <div class="inline-block rounded-full bg-gray-200 p-3 mb-2">
            <i class="fas fa-comments text-gray-500"></i>
          </div>
          <p class="text-gray-500">Welcome to the event chat! Connect with other attendees.</p>
        </div>
      `;
    }
    
    // Update DOM
    messagesList.innerHTML = html;
    
    // Set up message menu events
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
    
    // Check if message is hidden due to moderation
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
          <div class="w-6 h-6 rounded-full overflow-hidden mr-2 bg-gray-200">
            <img src="${message.photoURL || '/api/placeholder/24/24'}" alt="${message.displayName || 'User'}" class="w-full h-full object-cover">
          </div>
          <div class="text-xs font-medium">${message.displayName || 'User'}</div>
        </div>
      `;
    }
    
    // Create context menu for other users' messages
    const contextMenu = !isCurrentUser ? `
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
    ` : '';
    
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

  // scripts/components/event-chat.js (continued)
  updateTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    const typingText = document.querySelector('.typing-text');
    
    if (!typingIndicator || !typingText) return;
    
    // Count typing users (excluding current user)
    const typingUserIds = Object.keys(this.typingUsers);
    const typingCount = typingUserIds.length;
    
    if (typingCount > 0) {
      // Show typing indicator
      typingIndicator.classList.remove('hidden');
      
      // Update text
      if (typingCount === 1) {
        const typingUser = this.typingUsers[typingUserIds[0]];
        typingText.textContent = `${typingUser.displayName || 'Someone'} is typing...`;
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

  scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  toggleChatExpansion() {
    const chatContainer = this.container.querySelector('.chat-container');
    const toggleIcon = this.container.querySelector('.chat-toggle-btn i');
    
    if (!chatContainer || !toggleIcon) return;
    
    this.isExpanded = !this.isExpanded;
    
    if (this.isExpanded) {
      chatContainer.style.display = 'block';
      toggleIcon.className = 'fas fa-chevron-up';
    } else {
      chatContainer.style.display = 'none';
      toggleIcon.className = 'fas fa-chevron-down';
    }
  }

  setupMessageMenuListeners() {
    // Toggle message menu
    document.querySelectorAll('.message-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;
        if (!dropdown) return;
        
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
    
    // Report message button
    document.querySelectorAll('.report-message-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const messageId = btn.dataset.messageId;
        if (messageId) {
          this.reportMessage(messageId);
        }
        
        // Hide dropdown
        const dropdown = btn.closest('.message-menu-dropdown');
        if (dropdown) {
          dropdown.classList.add('hidden');
        }
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
    // Check if report modal exists
    let reportModal = document.getElementById('reportMessageModal');
    
    if (!reportModal) {
      // Load report modal dynamically
      fetch('../../components/modals/report-message-modal.html')
        .then(response => response.text())
        .then(html => {
          // Create container for modal
          const modalContainer = document.createElement('div');
          modalContainer.id = 'report-modal-container';
          document.body.appendChild(modalContainer);
          
          // Insert modal HTML
          modalContainer.innerHTML = html;
          
          // Initialize modal
          this.initializeReportModal(messageId);
        })
        .catch(error => {
          console.error('Error loading report modal:', error);
          errorHandler.showToast('Could not load report dialog', 'error');
        });
    } else {
      // Modal already exists, just initialize it
      this.initializeReportModal(messageId);
    }
  }

  initializeReportModal(messageId) {
    const reportModal = document.getElementById('reportMessageModal');
    if (!reportModal) return;
    
    // Show modal
    reportModal.classList.remove('hidden');
    
    // Set up close buttons
    reportModal.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        reportModal.classList.add('hidden');
      });
    });
    
    // Close when clicking outside
    reportModal.addEventListener('click', (e) => {
      if (e.target === reportModal) {
        reportModal.classList.add('hidden');
      }
    });
    
    // Set up submit button
    const submitBtn = document.getElementById('submit-report');
    if (submitBtn) {
      // Remove old event listeners
      const newSubmitBtn = submitBtn.cloneNode(true);
      submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
      
      // Add new event listener
      newSubmitBtn.addEventListener('click', () => {
        this.submitReport(messageId);
      });
    }
  }

  async submitReport(messageId) {
    // Get report reason
    const reasonInput = document.querySelector('input[name="report-reason"]:checked');
    if (!reasonInput) {
      errorHandler.showToast('Please select a reason for your report', 'warning');
      return;
    }
    
    const reason = reasonInput.value;
    const description = document.getElementById('report-description')?.value || '';
    
    // Disable submit button
    const submitBtn = document.getElementById('submit-report');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting...';
    }
    
    try {
      // Get message data
      const messageRef = firebase.database().ref(`chatRooms/${this.eventId}/messages/${messageId}`);
      const messageSnapshot = await messageRef.once('value');
      
      if (!messageSnapshot.exists()) {
        throw new Error('Message not found');
      }
      
      const message = messageSnapshot.val();
      
      // Create report
      const reportRef = firebase.database().ref(`reportedMessages/${messageId}`);
      await reportRef.set({
        messageId,
        roomId: this.eventId,
        messageContent: message.text,
        userId: message.userId,
        userDisplayName: message.displayName || 'Unknown User',
        reportedBy: firebase.auth().currentUser.uid,
        reportedByName: firebase.auth().currentUser.displayName || 'Anonymous User',
        reason: reason,
        description: description,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'pending'
      });
      
      // Close modal
      const reportModal = document.getElementById('reportMessageModal');
      if (reportModal) {
        reportModal.classList.add('hidden');
      }
      
      // Show success message
      errorHandler.showToast('Report submitted. Thank you for helping keep The Play safe.', 'success');
    } catch (error) {
      console.error('Error submitting report:', error);
      errorHandler.showToast('Failed to submit report. Please try again.', 'error');
    } finally {
      // Reset button
      const submitBtn = document.getElementById('submit-report');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Report';
      }
    }
  }

  cleanup() {
    // Remove event listeners
    if (this.messagesListenerId) {
      firebase.database().ref(`chatRooms/${this.eventId}/messages`).off('value', this.messagesListenerId);
      this.messagesListenerId = null;
    }
    
    if (this.typingListenerId) {
      firebase.database().ref(`chatRooms/${this.eventId}/typing`).off('value', this.typingListenerId);
      this.typingListenerId = null;
    }
    
    if (this.onlineUsersListenerId) {
      firebase.database().ref(`chatRooms/${this.eventId}/onlineUsers`).off('value', this.onlineUsersListenerId);
      this.onlineUsersListenerId = null;
    }
    
    // Leave chat room
    const user = firebase.auth().currentUser;
    if (user) {
      firebase.database().ref(`chatRooms/${this.eventId}/onlineUsers/${user.uid}`).remove()
        .catch(error => console.error('Error leaving chat room:', error));
    }
    
    this.isInitialized = false;
  }
}

export default EventChat;