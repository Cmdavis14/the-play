import { realtimeDB, auth, storage } from '../firebase/config.js';
import { ref, set, push, onValue, update, remove, get, query, orderByChild, limitToLast } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export const chatService = {
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

  // Report inappropriate message
  reportMessage: async (eventId, messageId, reason) => {
    try {
      const reportRef = ref(realtimeDB, `reportedMessages/${messageId}`);
      await set(reportRef, {
        messageId: messageId,
        eventId: eventId,
        reportedBy: auth.currentUser.uid,
        reportedAt: Date.now(),
        reason: reason
      });
    } catch (error) {
      console.error('Error reporting message:', error);
      throw error;
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