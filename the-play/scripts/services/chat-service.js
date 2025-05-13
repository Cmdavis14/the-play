import { database, firestore, storage } from '../firebase/config.js';
import userProfile from '../components/profile.js';
import errorHandler from '../utils/error-handler.js';
import ContentModerator from '../utils/content-moderation.js';

class ChatService {
  constructor() {
    this.db = database;
    this.firestore = firestore;
    this.storage = storage;
    this.listeners = {};
    this.currentUser = null;
  }

  async initialize() {
    // Initialize user
    if (firebase.auth().currentUser) {
      this.currentUser = firebase.auth().currentUser;
    } else {
      await new Promise(resolve => {
        const unsubscribe = firebase.auth().onAuthStateChanged(user => {
          this.currentUser = user;
          unsubscribe();
          resolve();
        });
      });
    }

    return this.currentUser;
  }

  /**
   * EVENT CHAT ROOMS
   */

  // Get event chat room ID
  getEventChatRoomId(eventId) {
    return `event_${eventId}`;
  }

  // Join event chat
  async joinEventChat(eventId) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');

    const roomId = this.getEventChatRoomId(eventId);
    
    try {
      // Add user to room members
      await this.db.ref(`roomMembers/${roomId}/${this.currentUser.uid}`).set(true);
      
      // Add room to user's rooms
      await this.db.ref(`userRooms/${this.currentUser.uid}/${roomId}`).set(true);
      
      return roomId;
    } catch (error) {
      console.error('Error joining event chat:', error);
      throw error;
    }
  }

  // Leave event chat
  async leaveEventChat(eventId) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');

    const roomId = this.getEventChatRoomId(eventId);
    
    try {
      // Remove user from room members
      await this.db.ref(`roomMembers/${roomId}/${this.currentUser.uid}`).remove();
      
      // Remove room from user's rooms
      await this.db.ref(`userRooms/${this.currentUser.uid}/${roomId}`).remove();
      
      return true;
    } catch (error) {
      console.error('Error leaving event chat:', error);
      throw error;
    }
  }

  // Send message to event chat
async sendEventChatMessage(eventId, message, mediaUrl = null, mediaType = null) {
  if (!this.currentUser) await this.initialize();
  if (!this.currentUser) throw new Error('User not authenticated');

  const roomId = this.getEventChatRoomId(eventId);
  
  try {
    // Check for blocked users
    const isUserBlocked = await this.isUserBlocked(this.currentUser.uid);
    if (isUserBlocked) {
      throw new Error('You have been blocked from sending messages');
    }
    
    // Moderate content
    const moderationResult = ContentModerator.checkContent(message);
    
    // Use filtered text
    const filteredMessage = moderationResult.filteredText;
    
    // Flag very problematic content
    if (moderationResult.isLikelySpam) {
      throw new Error('Your message appears to be spam. Please try a different message.');
    }
    
    // Get user display name and photo
    await userProfile.initialize();
    const displayName = userProfile.getDisplayName();
    const photoURL = userProfile.getPhotoURL();
    
    // Create message object
    const messageData = {
      text: filteredMessage,
      userId: this.currentUser.uid,
      displayName: displayName,
      photoURL: photoURL,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Add media if provided
    if (mediaUrl) {
      messageData.mediaUrl = mediaUrl;
      messageData.mediaType = mediaType || 'image';
    }
    
    // Add message to room
    const newMessageRef = await this.db.ref(`messages/${roomId}`).push();
    await newMessageRef.set(messageData);
    
    // If the message was flagged but still sent, log it for review
    if (!moderationResult.isAcceptable) {
      await this.firestore.collection('flaggedMessages').add({
        messageId: newMessageRef.key,
        roomId: roomId,
        userId: this.currentUser.uid,
        userDisplayName: displayName,
        original: message,
        filtered: filteredMessage,
        containsProfanity: moderationResult.containsProfanity,
        containsHarmfulContent: moderationResult.containsHarmfulContent,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return newMessageRef.key;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

  // Set typing indicator for event chat
  async setEventChatTyping(eventId, isTyping) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');

    const roomId = this.getEventChatRoomId(eventId);
    
    try {
      const typingRef = this.db.ref(`typing/${roomId}/${this.currentUser.uid}`);
      
      if (isTyping) {
        // Set typing indicator with server timestamp
        await typingRef.set(firebase.database.ServerValue.TIMESTAMP);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          typingRef.set(false);
        }, 5000);
      } else {
        // Remove typing indicator
        await typingRef.set(false);
      }
      
      return true;
    } catch (error) {
      console.error('Error setting typing indicator:', error);
      return false;
    }
  }

  // Listen for typing indicators in event chat
  listenToEventChatTyping(eventId, callback) {
    if (!this.currentUser) {
      this.initialize().then(() => this.listenToEventChatTyping(eventId, callback));
      return null;
    }

    const roomId = this.getEventChatRoomId(eventId);
    const typingRef = this.db.ref(`typing/${roomId}`);
    
    // Remove existing listener if any
    if (this.listeners[`typing_${eventId}`]) {
      this.listeners[`typing_${eventId}`]();
      delete this.listeners[`typing_${eventId}`];
    }
    
    // Add new listener
    const listener = typingRef.on('value', snapshot => {
      const typingUsers = {};
      const now = Date.now();
      const typingTimeout = 5000; // 5 seconds
      
      if (snapshot.exists()) {
        snapshot.forEach(childSnapshot => {
          const userId = childSnapshot.key;
          const value = childSnapshot.val();
          
          // Skip current user
          if (userId === this.currentUser.uid) return;
          
          // Check if user is actually typing (value is timestamp and not too old)
          if (typeof value === 'number' && (now - value) < typingTimeout) {
            typingUsers[userId] = true;
          }
        });
      }
      
      callback(typingUsers);
    });
    
    // Store listener for cleanup
    this.listeners[`typing_${eventId}`] = () => typingRef.off('value', listener);
    
    return () => this.listeners[`typing_${eventId}`]();
  }

  /**
   * DIRECT MESSAGING
   */

  // Get direct chat ID between two users
  getDirectChatId(otherUserId) {
    if (!this.currentUser) throw new Error('User not authenticated');
    
    // Create a consistent chat ID regardless of who initiated
    const userIds = [this.currentUser.uid, otherUserId].sort();
    return `${userIds[0]}_${userIds[1]}`;
  }

  // Start or get direct conversation with user
  async startDirectConversation(otherUserId) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');
    
    try {
      // Get other user info
      const otherUserDoc = await this.firestore.collection('users').doc(otherUserId).get();
      if (!otherUserDoc.exists) {
        throw new Error('User not found');
      }
      
      const otherUser = otherUserDoc.data();
      const chatId = this.getDirectChatId(otherUserId);
      
      // Add to current user's conversations if not exists
      const userConvRef = this.db.ref(`userConversations/${this.currentUser.uid}/${chatId}`);
      const userConvSnapshot = await userConvRef.once('value');
      
      if (!userConvSnapshot.exists()) {
        await userConvRef.set({
          otherUserId: otherUserId,
          otherUserName: otherUser.displayName || 'User',
          otherUserPhoto: otherUser.photoURL || null,
          lastMessage: '',
          lastTimestamp: firebase.database.ServerValue.TIMESTAMP,
          unreadCount: 0
        });
      }
      
      // Add to other user's conversations if not exists
      const otherConvRef = this.db.ref(`userConversations/${otherUserId}/${chatId}`);
      const otherConvSnapshot = await otherConvRef.once('value');
      
      if (!otherConvSnapshot.exists()) {
        await userProfile.initialize();
        await otherConvRef.set({
          otherUserId: this.currentUser.uid,
          otherUserName: userProfile.getDisplayName(),
          otherUserPhoto: userProfile.getPhotoURL(),
          lastMessage: '',
          lastTimestamp: firebase.database.ServerValue.TIMESTAMP,
          unreadCount: 0
        });
      }
      
      return {
        chatId,
        otherUser: {
          id: otherUserId,
          name: otherUser.displayName || 'User',
          photo: otherUser.photoURL || null
        }
      };
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  }

  // Send direct message
  // Send direct message
async sendDirectMessage(otherUserId, message, mediaUrl = null, mediaType = null) {
  if (!this.currentUser) await this.initialize();
  if (!this.currentUser) throw new Error('User not authenticated');
  
  try {
    // Check if user is blocked
    const isBlocked = await this.isUserBlocked(otherUserId);
    if (isBlocked) {
      throw new Error('You have blocked this user');
    }
    
    // Check if current user is blocked by the other user
    const isBlockedBy = await this.isBlockedBy(otherUserId);
    if (isBlockedBy) {
      throw new Error('You cannot send messages to this user');
    }
    
    // Moderate content
    const moderationResult = ContentModerator.checkContent(message);
    
    // Use filtered text
    const filteredMessage = moderationResult.filteredText;
    
    // Flag very problematic content
    if (moderationResult.isLikelySpam) {
      throw new Error('Your message appears to be spam. Please try a different message.');
    }
    
    // Get user display name and photo
    await userProfile.initialize();
    const displayName = userProfile.getDisplayName();
    const photoURL = userProfile.getPhotoURL();
    
    const chatId = this.getDirectChatId(otherUserId);
    
    // Create message object
    const messageData = {
      text: filteredMessage,
      userId: this.currentUser.uid,
      displayName: displayName,
      photoURL: photoURL,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Add media if provided
    if (mediaUrl) {
      messageData.mediaUrl = mediaUrl;
      messageData.mediaType = mediaType || 'image';
    }
    
    // Add message to conversation
    const newMessageRef = await this.db.ref(`directMessages/${chatId}`).push();
    await newMessageRef.set(messageData);
    
    // Update conversation metadata for current user
    await this.db.ref(`userConversations/${this.currentUser.uid}/${chatId}`).update({
      lastMessage: filteredMessage,
      lastTimestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Update conversation metadata for other user and increment unread count
    const otherUserConvRef = this.db.ref(`userConversations/${otherUserId}/${chatId}`);
    const otherUserConvSnapshot = await otherUserConvRef.once('value');
    
    if (otherUserConvSnapshot.exists()) {
      const currentUnreadCount = otherUserConvSnapshot.val().unreadCount || 0;
      await otherUserConvRef.update({
        lastMessage: filteredMessage,
        lastTimestamp: firebase.database.ServerValue.TIMESTAMP,
        unreadCount: currentUnreadCount + 1
      });
    } else {
      // Create new conversation for other user if it doesn't exist
      await this.startDirectConversation(otherUserId);
      
      // Then update it
      await otherUserConvRef.update({
        lastMessage: filteredMessage,
        lastTimestamp: firebase.database.ServerValue.TIMESTAMP,
        unreadCount: 1
      });
    }
    
    // If the message was flagged but still sent, log it for review
    if (!moderationResult.isAcceptable) {
      await this.firestore.collection('flaggedMessages').add({
        messageId: newMessageRef.key,
        chatId: chatId,
        senderId: this.currentUser.uid,
        senderDisplayName: displayName,
        receiverId: otherUserId,
        original: message,
        filtered: filteredMessage,
        containsProfanity: moderationResult.containsProfanity,
        containsHarmfulContent: moderationResult.containsHarmfulContent,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return newMessageRef.key;
  } catch (error) {
    console.error('Error sending direct message:', error);
    throw error;
  }
}

//check if current user is blocked by another user
async isBlockedBy(userId) {
  if (!this.currentUser) await this.initialize();
  if (!this.currentUser) throw new Error('User not authenticated');
  
  try {
    const userDoc = await this.firestore.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    return userData.blockedUsers && userData.blockedUsers.includes(this.currentUser.uid);
  } catch (error) {
    console.error('Error checking if blocked by user:', error);
    return false;
  }
}

  // Listen for new direct messages
  listenToDirectMessages(otherUserId, callback) {
    if (!this.currentUser) {
      this.initialize().then(() => this.listenToDirectMessages(otherUserId, callback));
      return null;
    }
    
    const chatId = this.getDirectChatId(otherUserId);
    const messagesRef = this.db.ref(`directMessages/${chatId}`).orderByChild('timestamp').limitToLast(50);
    
    // Remove existing listener if any
    if (this.listeners[`direct_${otherUserId}`]) {
      this.listeners[`direct_${otherUserId}`]();
      delete this.listeners[`direct_${otherUserId}`];
    }
    
    // Add new listener
    const listener = messagesRef.on('value', snapshot => {
      const messages = [];
      
      if (snapshot.exists()) {
        snapshot.forEach(childSnapshot => {
          messages.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
      }
      
      callback(messages);
      
      // Mark messages as read if they're from the other user
      this.markDirectMessagesAsRead(otherUserId);
    });
    
    // Store listener for cleanup
    this.listeners[`direct_${otherUserId}`] = () => messagesRef.off('value', listener);
    
    return () => this.listeners[`direct_${otherUserId}`]();
  }

  // Listen for user conversations
  listenToUserConversations(callback) {
    if (!this.currentUser) {
      this.initialize().then(() => this.listenToUserConversations(callback));
      return null;
    }
    
    const conversationsRef = this.db.ref(`userConversations/${this.currentUser.uid}`).orderByChild('lastTimestamp');
    
    // Remove existing listener if any
    if (this.listeners['user_conversations']) {
      this.listeners['user_conversations']();
      delete this.listeners['user_conversations'];
    }
    
    // Add new listener
    const listener = conversationsRef.on('value', snapshot => {
      const conversations = [];
      
      if (snapshot.exists()) {
        snapshot.forEach(childSnapshot => {
          conversations.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
      }
      
      // Sort by latest timestamp
      conversations.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
      
      callback(conversations);
    });
    
    // Store listener for cleanup
    this.listeners['user_conversations'] = () => conversationsRef.off('value', listener);
    
    return () => this.listeners['user_conversations']();
  }

  // Mark direct messages as read
  async markDirectMessagesAsRead(otherUserId) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');
    
    const chatId = this.getDirectChatId(otherUserId);
    
    try {
      // Reset unread count in the conversation
      await this.db.ref(`userConversations/${this.currentUser.uid}/${chatId}`).update({
        unreadCount: 0
      });
      
      return true;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
  }

  // Set typing indicator for direct chat
  async setDirectChatTyping(otherUserId, isTyping) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');
    
    const chatId = this.getDirectChatId(otherUserId);
    
    try {
      const typingRef = this.db.ref(`typing/${chatId}/${this.currentUser.uid}`);
      
      if (isTyping) {
        // Set typing indicator with server timestamp
        await typingRef.set(firebase.database.ServerValue.TIMESTAMP);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          typingRef.set(false);
        }, 5000);
      } else {
        // Remove typing indicator
        await typingRef.set(false);
      }
      
      return true;
    } catch (error) {
      console.error('Error setting typing indicator:', error);
      return false;
    }
  }

  // Listen for typing indicators in direct chat
  listenToDirectChatTyping(otherUserId, callback) {
    if (!this.currentUser) {
      this.initialize().then(() => this.listenToDirectChatTyping(otherUserId, callback));
      return null;
    }
    
    const chatId = this.getDirectChatId(otherUserId);
    const typingRef = this.db.ref(`typing/${chatId}/${otherUserId}`);
    
    // Remove existing listener if any
    if (this.listeners[`typing_direct_${otherUserId}`]) {
      this.listeners[`typing_direct_${otherUserId}`]();
      delete this.listeners[`typing_direct_${otherUserId}`];
    }
    
    // Add new listener
    const listener = typingRef.on('value', snapshot => {
      const value = snapshot.val();
      const now = Date.now();
      const typingTimeout = 5000; // 5 seconds
      
      // Check if user is actually typing (value is timestamp and not too old)
      const isTyping = typeof value === 'number' && (now - value) < typingTimeout;
      
      callback(isTyping);
    });
    
    // Store listener for cleanup
    this.listeners[`typing_direct_${otherUserId}`] = () => typingRef.off('value', listener);
    
    return () => this.listeners[`typing_direct_${otherUserId}`]();
  }

  /**
   * MEDIA HANDLING
   */
  
  /**
   * Upload media for chat messages
   * @param {File} file - The file to upload
   * @param {string} chatType - 'event' or 'direct'
   * @param {string} chatId - The ID of the chat room or direct conversation
   * @returns {Promise<Object>} - Object containing URL and type of the uploaded media
   */
  async uploadChatMedia(file, chatType, chatId) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');
    
    try {
      // Validate file
      if (!file) throw new Error('No file provided');
      
      // Check file size (max 5MB)
      const maxSizeInBytes = 5 * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
        throw new Error('File is too large. Maximum size is 5MB.');
      }
      
      // Determine file type
      let mediaType = 'file';
      if (file.type.match('image.*')) {
        mediaType = 'image';
      } else if (file.type.match('video.*')) {
        mediaType = 'video';
      }
      
      // Create a unique filename
      const fileExtension = file.name.split('.').pop();
      const fileName = `${chatType}_${chatId}_${Date.now()}.${fileExtension}`;
      
      // Create reference to the storage location
      const fileRef = this.storage.ref(`chat_media/${this.currentUser.uid}/${fileName}`);
      
      // Upload the file
      const uploadTask = await fileRef.put(file);
      
      // Get the download URL
      const downloadURL = await uploadTask.ref.getDownloadURL();
      
      return {
        url: downloadURL,
        type: mediaType
      };
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  }

  /**
   * MESSAGE MODERATION
   */

  // Report message:
async reportMessage(messageId, roomId, reportDetails) {
  if (!this.currentUser) await this.initialize();
  if (!this.currentUser) throw new Error('User not authenticated');
  
  try {
    // Get the message data
    let messageData = null;
    let messageType = 'unknown';
    
    // Try event chat first
    const eventMessageRef = this.db.ref(`messages/${roomId}/${messageId}`);
    const eventMessageSnapshot = await eventMessageRef.once('value');
    
    if (eventMessageSnapshot.exists()) {
      messageData = eventMessageSnapshot.val();
      messageType = 'event';
    } else {
      // Try direct messages
      const directMessageRooms = await this.db.ref('directMessages').orderByKey().once('value');
      directMessageRooms.forEach(roomSnapshot => {
        const roomMessageRef = roomSnapshot.child(messageId);
        if (roomMessageRef.exists()) {
          messageData = roomMessageRef.val();
          messageType = 'direct';
          roomId = roomSnapshot.key;
        }
      });
    }
    
    if (!messageData) {
      throw new Error('Message not found');
    }
    
    // Get reporter info
    await userProfile.initialize();
    const reporterDisplayName = userProfile.getDisplayName();
    
    // Create report record
    await this.firestore.collection('messageReports').add({
      messageId,
      roomId,
      messageType,
      reportedBy: this.currentUser.uid,
      reportedByName: reporterDisplayName,
      userId: messageData.userId,
      userDisplayName: messageData.displayName || 'Unknown',
      messageContent: messageData.text,
      reason: reportDetails.reason,
      description: reportDetails.description || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });
    
    // Update report count for the message
    if (messageType === 'event') {
      await eventMessageRef.update({
        reportCount: (messageData.reportCount || 0) + 1
      });
    } else if (messageType === 'direct') {
      const directMessageRef = this.db.ref(`directMessages/${roomId}/${messageId}`);
      await directMessageRef.update({
        reportCount: (messageData.reportCount || 0) + 1
      });
    }
    
    // If message has been reported multiple times, hide it automatically
    if ((messageData.reportCount || 0) >= 2) {
      if (messageType === 'event') {
        await eventMessageRef.update({
          isHidden: true
        });
      } else if (messageType === 'direct') {
        const directMessageRef = this.db.ref(`directMessages/${roomId}/${messageId}`);
        await directMessageRef.update({
          isHidden: true
        });
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error reporting message:', error);
    throw error;
  }
}

  // Block user
  async blockUser(userId) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');
    
    try {
      await this.firestore.collection('users').doc(this.currentUser.uid).update({
        blockedUsers: firebase.firestore.FieldValue.arrayUnion(userId)
      });
      
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }

  // Check if user is blocked
  async isUserBlocked(userId) {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');
    
    try {
      const userDoc = await this.firestore.collection('users').doc(this.currentUser.uid).get();
      if (!userDoc.exists) return false;
      
      const userData = userDoc.data();
      return userData.blockedUsers && userData.blockedUsers.includes(userId);
    } catch (error) {
      console.error('Error checking blocked status:', error);
      return false;
    }
  }

  // Get unread messages count
  async getUnreadMessagesCount() {
    if (!this.currentUser) await this.initialize();
    if (!this.currentUser) throw new Error('User not authenticated');
    
    try {
      const snapshot = await this.db.ref(`userConversations/${this.currentUser.uid}`).once('value');
      let totalUnread = 0;
      
      if (snapshot.exists()) {
        snapshot.forEach(childSnapshot => {
          const conversation = childSnapshot.val();
          totalUnread += conversation.unreadCount || 0;
        });
      }
      
      return totalUnread;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Clean up listeners
  cleanup() {
    Object.values(this.listeners).forEach(removeListener => {
      if (typeof removeListener === 'function') {
        removeListener();
      }
    });
    
    this.listeners = {};
  }
}