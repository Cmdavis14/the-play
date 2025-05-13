import { realtimeDB, auth, storage } from '../firebase/config.js';
import { ref, set, push, onValue, update, remove, get, query, orderByChild, limitToLast, increment, onDisconnect } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';



export const directMessagingService = {
  // Send direct message to another user
  sendDirectMessage: async (receiverId, text, mediaFile = null) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      const senderId = auth.currentUser.uid;
      
      // Create references for both sender and receiver to store the same message
      const senderMessagesRef = ref(realtimeDB, `directMessages/${senderId}/${receiverId}`);
      const receiverMessagesRef = ref(realtimeDB, `directMessages/${receiverId}/${senderId}`);
      
      // Generate a unique ID for this message
      const newMessageRef = push(senderMessagesRef);
      const messageId = newMessageRef.key;
      
      let mediaUrl = null;
      if (mediaFile) {
        const fileRef = storageRef(storage, `direct-messages/${senderId}_${receiverId}/${messageId}_${mediaFile.name}`);
        await uploadBytes(fileRef, mediaFile);
        mediaUrl = await getDownloadURL(fileRef);
      }

      const messageData = {
        text: text,
        senderId: senderId,
        senderName: auth.currentUser.displayName || 'Anonymous User',
        timestamp: Date.now(),
        isRead: false,
        media: mediaUrl
      };

      // Store message in sender's node
      await set(ref(realtimeDB, `directMessages/${senderId}/${receiverId}/${messageId}`), messageData);
      
      // Store the same message in receiver's node
      await set(ref(realtimeDB, `directMessages/${receiverId}/${senderId}/${messageId}`), messageData);
      
      // Update recent contacts for both users
      await update(ref(realtimeDB, `userContacts/${senderId}/${receiverId}`), {
        lastMessage: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        timestamp: Date.now(),
        unreadCount: 0
      });
      
      await update(ref(realtimeDB, `userContacts/${receiverId}/${senderId}`), {
        lastMessage: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        timestamp: Date.now(),
        unreadCount: increment(1)
      });

      return messageId;
    } catch (error) {
      console.error('Error sending direct message:', error);
      throw error;
    }
  },

  // Listen for messages between two users
  listenToDirectMessages: (otherUserId, callback) => {
    if (!auth.currentUser) return () => {};
    
    const userId = auth.currentUser.uid;
    const messagesRef = query(
      ref(realtimeDB, `directMessages/${userId}/${otherUserId}`),
      orderByChild('timestamp')
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

  // Mark direct messages as read
  markDirectMessagesAsRead: async (otherUserId) => {
    try {
      if (!auth.currentUser) return;
      
      const userId = auth.currentUser.uid;
      const messagesRef = ref(realtimeDB, `directMessages/${userId}/${otherUserId}`);
      const snapshot = await get(messagesRef);
      
      const updates = {};
      snapshot.forEach((childSnapshot) => {
        const message = childSnapshot.val();
        if (!message.isRead && message.senderId !== userId) {
          updates[`${childSnapshot.key}/isRead`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        await update(messagesRef, updates);
      }
      
      // Reset unread count in contacts
      await update(ref(realtimeDB, `userContacts/${userId}/${otherUserId}`), {
        unreadCount: 0
      });
    } catch (error) {
      console.error('Error marking direct messages as read:', error);
    }
  },

  // Get user contacts with most recent conversations
  getUserContacts: (callback) => {
    if (!auth.currentUser) return () => {};
    
    const contactsRef = ref(realtimeDB, `userContacts/${auth.currentUser.uid}`);
    
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      const contacts = [];
      snapshot.forEach((childSnapshot) => {
        contacts.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      // Sort by most recent
      contacts.sort((a, b) => b.timestamp - a.timestamp);
      
      callback(contacts);
    });

    return unsubscribe;
  },

  // Get total unread direct messages
  getTotalUnreadMessages: (callback) => {
    if (!auth.currentUser) return () => {};
    
    const contactsRef = ref(realtimeDB, `userContacts/${auth.currentUser.uid}`);
    
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      let total = 0;
      snapshot.forEach((childSnapshot) => {
        const contact = childSnapshot.val();
        if (contact.unreadCount) {
          total += contact.unreadCount;
        }
      });
      
      callback(total);
    });

    return unsubscribe;
  },

  // User typing indicator
  setTypingStatus: async (otherUserId, isTyping) => {
    if (!auth.currentUser) return;
    
    try {
      const typingRef = ref(realtimeDB, `typing/${otherUserId}/${auth.currentUser.uid}`);
      
      if (isTyping) {
        await set(typingRef, {
          typing: true,
          timestamp: Date.now()
        });
      } else {
        await remove(typingRef);
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  },

  // Listen for typing indicators
  listenToTypingStatus: (otherUserId, callback) => {
    if (!auth.currentUser) return () => {};
    
    const typingRef = ref(realtimeDB, `typing/${auth.currentUser.uid}/${otherUserId}`);
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const isTyping = snapshot.exists();
      callback(isTyping);
    });

    return unsubscribe;
  }
};