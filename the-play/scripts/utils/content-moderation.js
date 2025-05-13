/**
 * Content moderation utility for The Play
 * Provides methods to check and filter chat messages for inappropriate content
 */

class ContentModerator {
  // Profanity list - in production, this would be more extensive and potentially loaded from a database
  static profanityList = [
    'asshole', 'bastard', 'bitch', 'cunt', 'damn', 'fuck', 'shit', 'piss',
    // Add more words as needed
  ];

  // Spam patterns
  static spamPatterns = [
    /\b(earn|make).*money\b/i,
    /\b(click|check|visit).*link\b/i,
    /\bhttps?:\/\/\S+\b/i, // Any URL - in a real app, you'd have a more nuanced approach
    /\b(bitcoin|crypto|invest)\b.*\b(profit|earn|money)\b/i,
    /\b(free|discount|sale).*\b(iphone|macbook|laptop)\b/i,
    /\b(viagra|cialis)\b/i,
    // Add more patterns as needed
  ];

  /**
   * Check content for inappropriate or harmful language
   * @param {string} text - Text to check
   * @returns {Object} Result with filtered text and flags
   */
  static checkContent(text) {
    if (!text) {
      return {
        filteredText: '',
        isAcceptable: true,
        containsProfanity: false,
        containsHarmfulContent: false,
        isLikelySpam: false
      };
    }

    let filteredText = text;
    let containsProfanity = false;
    let containsHarmfulContent = false;
    let isLikelySpam = false;
    
    // Check for profanity
    this.profanityList.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(text)) {
        containsProfanity = true;
        // Replace the profanity with asterisks
        filteredText = filteredText.replace(regex, '*'.repeat(word.length));
      }
    });
    
    // Check for spam patterns
    isLikelySpam = this.spamPatterns.some(pattern => pattern.test(text));
    
    // Check for potentially harmful content - this is a simple implementation
    // In a real app, you might use AI-based content moderation APIs
    containsHarmfulContent = /\b(kill|suicide|shoot|bomb|attack|die)\b/i.test(text);
    
    // Determine overall acceptability
    const isAcceptable = !containsHarmfulContent && !isLikelySpam;
    
    return {
      filteredText,
      isAcceptable,
      containsProfanity,
      containsHarmfulContent,
      isLikelySpam
    };
  }

  /**
   * Sanitize user input to prevent XSS attacks
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  static sanitizeText(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Rate limit check - to prevent spam by frequency
   * @param {Array} recentMessages - Array of recent message timestamps from the user
   * @param {number} maxMessages - Maximum allowed messages in the time period
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {boolean} True if user is sending too many messages
   */
  static isRateLimited(recentMessages, maxMessages = 5, timeWindowMs = 10000) {
    if (!recentMessages || !recentMessages.length) return false;
    
    const now = Date.now();
    const messagesInWindow = recentMessages.filter(timestamp => (now - timestamp) < timeWindowMs);
    
    return messagesInWindow.length >= maxMessages;
  }
}

export default ContentModerator;