import { realtimeDB, auth } from '../firebase/config.js';
import { ref, set, remove, onValue, get } from 'firebase/database';

export const messageModService = {
  // Filter profanity from a message
  filterProfanity: (text) => {
    // Simple profanity list - in a real app, use a more comprehensive solution
    const profanityList = [
      'badword1', 'badword2', 'offensive', 'inappropriate'
      // Add more words as needed
    ];
    
    let filteredText = text;
    profanityList.forEach(word => {
      const regex = new RegExp('\\b' + word + '\\b', 'gi');
      filteredText = filteredText.replace(regex, '*'.repeat(word.length));
    });
    
    return filteredText;
  },
  
  // Check if message contains profanity
  containsProfanity: (text) => {
    const profanityList = [
      'badword1', 'badword2', 'offensive', 'inappropriate'
      // Add more words as needed
    ];
    
    const lowerText = text.toLowerCase();
    return profanityList.some(word => 
      lowerText.includes(word) || 
      new RegExp('\\b' + word + '\\b', 'i').test(lowerText)
    );
  },
  
  // Report a message as inappropriate
  reportMessage: async (messageId, eventId, reason) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Get the message content
      const messageRef = ref(realtimeDB, `chatRooms/${eventId}/messages/${messageId}`);
      const messageSnapshot = await get(messageRef);
      
      if (!messageSnapshot.exists()) {
        throw new Error('Message not found');
      }
      
      const message = messageSnapshot.val();
      
      // Create report
      const reportRef = ref(realtimeDB, `reportedMessages/${messageId}`);
      await set(reportRef, {
        messageId,
        eventId,
        text: message.text,
        userId: message.userId,
        username: message.username,
        timestamp: message.timestamp,
        reportedBy: auth.currentUser.uid,
        reporterName: auth.currentUser.displayName || 'Anonymous User',
        reportReason: reason,
        reportedAt: Date.now(),
        status: 'pending' // pending, reviewed, rejected, actioned
      });
      
      return true;
    } catch (error) {
      console.error('Error reporting message:', error);
      throw error;
    }
  },
  
  // Get reported messages (admin only)
  getReportedMessages: (callback) => {
    const reportsRef = ref(realtimeDB, 'reportedMessages');
    
    const unsubscribe = onValue(reportsRef, (snapshot) => {
      const reports = [];
      snapshot.forEach((childSnapshot) => {
        reports.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      // Sort by most recent
      reports.sort((a, b) => b.reportedAt - a.reportedAt);
      
      callback(reports);
    });
    
    return unsubscribe;
  },
  
  // Review and take action on reported message (admin only)
  reviewReport: async (messageId, action, notes) => {
    try {
      // Update report status
      const reportRef = ref(realtimeDB, `reportedMessages/${messageId}`);
      const reportSnapshot = await get(reportRef);
      
      if (!reportSnapshot.exists()) {
        throw new Error('Report not found');
      }
      
      const report = reportSnapshot.val();
      
      // Take action based on decision
      if (action === 'delete') {
        // Delete the message from the chat room
        const messageRef = ref(realtimeDB, `chatRooms/${report.eventId}/messages/${messageId}`);
        await remove(messageRef);
      }
      
      // Update report status
      await set(reportRef, {
        ...report,
        status: action === 'delete' ? 'actioned' : 
               action === 'reject' ? 'rejected' : 'reviewed',
        reviewedBy: auth.currentUser.uid,
        reviewerName: auth.currentUser.displayName || 'Admin',
        reviewedAt: Date.now(),
        notes: notes || ''
      });
      
      return true;
    } catch (error) {
      console.error('Error reviewing report:', error);
      throw error;
    }
  },
  
  // Block a user (for the current user)
  blockUser: async (userIdToBlock) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }
      
      const blockedUserRef = ref(realtimeDB, `blockedUsers/${auth.currentUser.uid}/${userIdToBlock}`);
      await set(blockedUserRef, {
        blockedAt: Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  },
  
  // Unblock a user
  unblockUser: async (userIdToUnblock) => {
    try {
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }
      
      const blockedUserRef = ref(realtimeDB, `blockedUsers/${auth.currentUser.uid}/${userIdToUnblock}`);
      await remove(blockedUserRef);
      
      return true;
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  },
  
  // Check if a user is blocked
  isUserBlocked: async (userId) => {
    try {
      if (!auth.currentUser) return false;
      
      const blockedUserRef = ref(realtimeDB, `blockedUsers/${auth.currentUser.uid}/${userId}`);
      const snapshot = await get(blockedUserRef);
      
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking blocked status:', error);
      return false;
    }
  },
  
  // Get list of blocked users
  getBlockedUsers: async () => {
    try {
      if (!auth.currentUser) return [];
      
      const blockedUsersRef = ref(realtimeDB, `blockedUsers/${auth.currentUser.uid}`);
      const snapshot = await get(blockedUsersRef);
      
      const blockedUsers = [];
      snapshot.forEach((childSnapshot) => {
        blockedUsers.push(childSnapshot.key);
      });
      
      return blockedUsers;
    } catch (error) {
      console.error('Error getting blocked users:', error);
      return [];
    }
  }
};