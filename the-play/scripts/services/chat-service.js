import { realtimeDB, auth, storage } from '../firebase/config.js';
import { ref, set, push, onValue, update, remove, get, query, orderByChild, limitToLast, onDisconnect } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export const chatService = {
  // Initialize chat service
  initialize: async function() {
    // Check if user is logged in
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    // Return a resolved promise to indicate successful initialization
    return Promise.resolve(true);
  },
  
  // Send a message to an event chat room
  sendMessage: async (eventId, text, mediaFile = null) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      const messagesRef = ref(realtimeDB, `chatRooms/${eventId}/messages`);
      const newMessageRef = push(messagesRef);
      
      let mediaUrl = null;
      if (mediaFile) {
        const fileRef = storageRef(storage, `chat-media/${eventId}/${newMessageRef.key}_${mediaFile.name}`);
        await uploadBytes(fileRef, mediaFile);
        mediaUrl = await getDownloadURL(fileRef);
      }

      await set(newMessageRef, {
        text: text,
        userId: auth.currentUser.uid,
        username: auth.currentUser.displayName || 'Anonymous User',
        timestamp: Date.now(),
        isRead: false,
        media: mediaUrl,
        eventId: eventId
      });

      return newMessageRef.key;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Join an event chat
  joinEventChat: async function(eventId) {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }

    // Add user to chat room's online users
    const userStatusRef = ref(realtimeDB, `chatRooms/${eventId}/onlineUsers/${auth.currentUser.uid}`);
    await set(userStatusRef, {
      displayName: auth.currentUser.displayName || 'Anonymous',
      photoURL: auth.currentUser.photoURL || null,
      lastActive: Date.now()
    });
    
    // Remove user when disconnected
    onDisconnect(userStatusRef).remove();
    
    return true;
  },
  
  // Leave an event chat
  leaveEventChat: async function(eventId) {
    if (!auth.currentUser) return;
    
    // Remove user from chat room's online users
    const userStatusRef = ref(realtimeDB, `chatRooms/${eventId}/onlineUsers/${auth.currentUser.uid}`);
    await remove(userStatusRef);
    
    return true;
  },
  
  // Listen for event chat messages
  listenToEventChat: function(eventId, callback) {
    const messagesRef = query(
      ref(realtimeDB, `chatRooms/${eventId}/messages`),
      orderByChild('timestamp'),
      limitToLast(50)
    );
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const messages = [];
      snapshot.forEach((childSnapshot) => {
        messages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      callback(messages);
    });
    
    return unsubscribe;
  },
  
  // Listen for typing indicators in event chat
  listenToEventChatTyping: function(eventId, callback) {
    const typingRef = ref(realtimeDB, `chatRooms/${eventId}/typing`);
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const typingUsers = {};
      snapshot.forEach((childSnapshot) => {
        typingUsers[childSnapshot.key] = childSnapshot.val();
      });
      callback(typingUsers);
    });
    
    return unsubscribe;
  },
  
  // Set typing status in event chat
  setEventChatTyping: async function(eventId, isTyping) {
    if (!auth.currentUser) return;
    
    const typingRef = ref(realtimeDB, `chatRooms/${eventId}/typing/${auth.currentUser.uid}`);
    
    if (isTyping) {
      await set(typingRef, {
        displayName: auth.currentUser.displayName || 'Anonymous',
        timestamp: Date.now()
      });
    } else {
      await remove(typingRef);
    }
  },
  
  // Send a message to event chat
  sendEventChatMessage: async function(eventId, text, mediaUrl = null, mediaType = null) {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const messagesRef = ref(realtimeDB, `chatRooms/${eventId}/messages`);
    const newMessageRef = push(messagesRef);
    
    await set(newMessageRef, {
      text: text,
      userId: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || 'Anonymous',
      photoURL: auth.currentUser.photoURL || null,
      timestamp: Date.now(),
      mediaUrl: mediaUrl,
      mediaType: mediaType
    });
    
    return newMessageRef.key;
  },
  
  // Upload media for chat
  uploadChatMedia: async function(file, chatType, chatId) {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    // Create a unique file path
    const filePath = `chat-media/${chatType}/${chatId}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, filePath);
    
    // Upload file
    await uploadBytes(fileRef, file);
    
    // Get download URL
    const url = await getDownloadURL(fileRef);
    
    // Determine media type
    const type = file.type.startsWith('image/') ? 'image' : 
                file.type.startsWith('video/') ? 'video' : 'file';
    
    return { url, type };
  },
  
  // Start a direct conversation with another user
  startDirectConversation: async function(otherUserId) {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const currentUserId = auth.currentUser.uid;
    
    // Create or update contact entry
    const contactRef = ref(realtimeDB, `userContacts/${currentUserId}/${otherUserId}`);
    
    // Get user info
    let otherUserName = 'User';
    let otherUserPhoto = null;
    
    try {
      const userDoc = await firebase.firestore().collection('users').doc(otherUserId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        otherUserName = userData.displayName || 'User';
        otherUserPhoto = userData.photoURL || null;
      }
    } catch (error) {
      console.error('Error getting user info:', error);
    }
    
    // Update or create contact
    await update(contactRef, {
      lastActive: Date.now(),
      displayName: otherUserName,
      photoURL: otherUserPhoto
    });
    
    return {
      chatId: `${currentUserId}_${otherUserId}`,
      otherUserId
    };
  },
  
  // Get unread messages count
  getUnreadMessagesCount: async function() {
    if (!auth.currentUser) return 0;
    
    try {
      const contactsRef = ref(realtimeDB, `userContacts/${auth.currentUser.uid}`);
      const snapshot = await get(contactsRef);
      
      let total = 0;
      snapshot.forEach((childSnapshot) => {
        const contact = childSnapshot.val();
        if (contact.unreadCount) {
          total += contact.unreadCount;
        }
      });
      
      return total;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },
  
  // Listen for user conversations
  listenToUserConversations: function(callback) {
    if (!auth.currentUser) return () => {};
    
    const contactsRef = ref(realtimeDB, `userContacts/${auth.currentUser.uid}`);
    
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      const conversations = [];
      snapshot.forEach((childSnapshot) => {
        const userId = childSnapshot.key;
        const data = childSnapshot.val();
        
        conversations.push({
          id: `${auth.currentUser.uid}_${userId}`,
          otherUserId: userId,
          otherUserName: data.displayName || 'User',
          otherUserPhoto: data.photoURL || null,
          lastMessage: data.lastMessage || '',
          lastTimestamp: data.timestamp || 0,
          unreadCount: data.unreadCount || 0
        });
      });
      
      // Sort by most recent
      conversations.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
      
      callback(conversations);
    });
    
    return unsubscribe;
  },
  
  // Block a user
  blockUser: async function(userId) {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Add to blocked users
      const blockedRef = ref(realtimeDB, `blockedUsers/${auth.currentUser.uid}/${userId}`);
      await set(blockedRef, {
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  },
  
  // Check if a user is blocked
  isUserBlocked: async function(userId) {
    if (!auth.currentUser) return false;
    
    try {
      const blockedRef = ref(realtimeDB, `blockedUsers/${auth.currentUser.uid}/${userId}`);
      const snapshot = await get(blockedRef);
      
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking block status:', error);
      return false;
    }
  },
  
  // Report a message
  reportMessage: async function(messageId, roomId, reportData) {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Get message content
      const messageRef = ref(realtimeDB, `chatRooms/${roomId}/messages/${messageId}`);
      const snapshot = await get(messageRef);
      
      if (!snapshot.exists()) {
        throw new Error('Message not found');
      }
      
      const message = snapshot.val();
      
      // Create report
      const reportsRef = ref(realtimeDB, `reportedMessages/${messageId}`);
      await set(reportsRef, {
        messageId,
        roomId,
        messageContent: message.text,
        userId: message.userId,
        userDisplayName: message.displayName || 'Unknown User',
        reportedBy: auth.currentUser.uid,
        reportedByName: auth.currentUser.displayName || 'Anonymous User',
        reason: reportData.reason,
        description: reportData.description || '',
        timestamp: Date.now(),
        status: 'pending'
      });
      
      return true;
    } catch (error) {
      console.error('Error reporting message:', error);
      throw error;
    }
  },
  
  // Listen for new messages in a chat room
  listenToEventMessages: (eventId, callback) => {
    const messagesRef = query(
      ref(realtimeDB, `chatRooms/${eventId}/messages`),
      orderByChild('timestamp'),
      limitToLast(50)
    );
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const messages = [];
      snapshot.forEach((childSnapshot) => {
        messages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      callback(messages);
    });

    return unsubscribe;
  },

  // Create a new chat room for an event
  createChatRoom: async (eventId, eventName) => {
    try {
      const chatRoomRef = ref(realtimeDB, `chatRooms/${eventId}`);
      await set(chatRoomRef, {
        name: eventName,
        eventId: eventId,
        createdAt: Date.now()
      });
      return eventId;
    } catch (error) {
      console.error('Error creating chat room:', error);
      throw error;
    }
  },

  // Mark messages as read
  markMessagesAsRead: async (eventId, userId) => {
    try {
      const messagesRef = ref(realtimeDB, `chatRooms/${eventId}/messages`);
      const snapshot = await get(messagesRef);
      
      const updates = {};
      snapshot.forEach((childSnapshot) => {
        const message = childSnapshot.val();
        if (!message.isRead && message.userId !== userId) {
          updates[`${childSnapshot.key}/isRead`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        await update(messagesRef, updates);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  },

  // Get unread message count for a user
  getUnreadMessageCount: async (userId) => {
    try {
      const chatRoomsRef = ref(realtimeDB, 'chatRooms');
      const snapshot = await get(chatRoomsRef);
      
      let unreadCount = 0;
      snapshot.forEach((roomSnapshot) => {
        const messagesRef = ref(realtimeDB, `chatRooms/${roomSnapshot.key}/messages`);
        get(messagesRef).then((messagesSnapshot) => {
          messagesSnapshot.forEach((messageSnapshot) => {
            const message = messageSnapshot.val();
            if (!message.isRead && message.userId !== userId) {
              unreadCount++;
            }
          });
        });
      });
      
      return unreadCount;
    } catch (error) {
      console.error('Error getting unread message count:', error);
      return 0;
    }
  },

  // Get online users in a chat room
  getOnlineUsers: (eventId, callback) => {
    const onlineRef = ref(realtimeDB, `chatRooms/${eventId}/onlineUsers`);
    const unsubscribe = onValue(onlineRef, (snapshot) => {
      const users = [];
      snapshot.forEach((childSnapshot) => {
        users.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      callback(users);
    });
    
    return unsubscribe;
  },

  // Update user online status
  updateUserStatus: async (eventId, status = true) => {
    if (!auth.currentUser) return;
    
    try {
      const userStatusRef = ref(realtimeDB, `chatRooms/${eventId}/onlineUsers/${auth.currentUser.uid}`);
      if (status) {
        await set(userStatusRef, {
          username: auth.currentUser.displayName || 'Anonymous User',
          lastActive: Date.now()
        });
        
        // Remove user from online users when they disconnect
        await onDisconnect(userStatusRef).remove();
      } else {
        await remove(userStatusRef);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  }
};