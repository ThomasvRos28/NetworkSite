const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Connection = require('../models/Connection');

// Helper function to check if users are connected
async function areUsersConnected(userId1, userId2) {
  try {
    console.log(`Checking connection between ${userId1} and ${userId2}`);

    const connection = await Connection.findOne({
      $or: [
        { fromUser: userId1, toUser: userId2, status: 'accepted' },
        { fromUser: userId2, toUser: userId1, status: 'accepted' }
      ]
    });

    console.log('Connection found:', connection);

    // For testing purposes, temporarily return true to allow all messages
    // Remove this in production and use the line below instead
    return true;
    // return !!connection;
  } catch (error) {
    console.error('Error checking connection:', error);
    return false;
  }
}

// @route   GET /api/messages/conversations
// @desc    Get all conversations for a user
// @access  Public (should be protected in production)
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find all conversations where the user is a participant
    const conversations = await Conversation.find({
      participants: userId
    })
    .populate({
      path: 'participants',
      select: 'firstName lastName username',
      match: { _id: { $ne: userId } } // Exclude the current user
    })
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    // Format the response
    const formattedConversations = conversations.map(conversation => {
      const otherParticipant = conversation.participants[0]; // Since we excluded the current user

      return {
        id: conversation._id,
        user: {
          id: otherParticipant._id,
          firstName: otherParticipant.firstName,
          lastName: otherParticipant.lastName,
          username: otherParticipant.username
        },
        lastMessage: conversation.lastMessage ? {
          text: conversation.lastMessage.content,
          time: conversation.lastMessage.createdAt,
          isRead: conversation.lastMessage.isRead || conversation.lastMessage.sender.toString() === userId
        } : null,
        updatedAt: conversation.updatedAt
      };
    });

    return res.json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/messages/:conversationId
// @desc    Get messages for a conversation
// @access  Public (should be protected in production)
router.get('/:conversationId/:userId', async (req, res) => {
  try {
    const { conversationId, userId } = req.params;

    console.log(`Fetching messages for conversation ${conversationId} and user ${userId}`);

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(conversationId) && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid IDs"
      });
    }

    let conversation;

    // Check if the conversationId is actually a userId (for new conversations)
    if (mongoose.Types.ObjectId.isValid(conversationId)) {
      // Try to find an existing conversation
      conversation = await Conversation.findOne({
        $or: [
          { _id: conversationId, participants: userId },
          { participants: { $all: [conversationId, userId] } }
        ]
      });
    }

    // If no conversation found but we have valid IDs, check if it's a user ID
    if (!conversation && mongoose.Types.ObjectId.isValid(conversationId)) {
      // Check if this is a valid user (potential recipient)
      const potentialRecipient = await User.findById(conversationId);

      if (potentialRecipient) {
        // Check if users are connected
        const areConnected = await areUsersConnected(userId, conversationId);

        if (areConnected) {
          // This is a valid user and they're connected, so we can create a new conversation
          console.log(`Creating new conversation between ${userId} and ${conversationId}`);

          conversation = new Conversation({
            participants: [userId, conversationId],
            createdAt: new Date(),
            updatedAt: new Date()
          });

          await conversation.save();
          console.log(`New conversation created with ID: ${conversation._id}`);
        } else {
          return res.json({
            success: false,
            message: "Users must be connected to message each other"
          });
        }
      } else {
        return res.json({
          success: false,
          message: "Recipient user not found"
        });
      }
    }

    if (!conversation) {
      console.log('No conversation found');
      return res.json({
        success: true,
        messages: []
      });
    }

    console.log(`Found conversation: ${conversation._id}`);

    // Get messages for the conversation
    const messages = await Message.find({
      conversation: conversation._id
    })
    .populate('sender', 'firstName lastName username')
    .sort({ createdAt: 1 });

    console.log(`Found ${messages.length} messages`);

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversation._id,
        sender: { $ne: userId },
        isRead: false
      },
      { isRead: true }
    );

    // Format the response
    const formattedMessages = messages.map(message => ({
      id: message._id,
      sender: message.sender._id,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim() || message.sender.username,
      text: message.content,
      time: message.createdAt,
      isRead: message.isRead
    }));

    return res.json({
      success: true,
      conversationId: conversation._id,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   POST /api/messages/
// @desc    Send a message
// @access  Public (should be protected in production)
router.post('/', async (req, res) => {
  try {
    const { senderId, recipientId, content } = req.body;

    // Validate user IDs
    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Check if users are connected
    const areConnected = await areUsersConnected(senderId, recipientId);

    if (!areConnected) {
      return res.json({
        success: false,
        message: "Users must be connected to send messages"
      });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId]
      });
      await conversation.save();
    }

    // Create new message
    const message = new Message({
      conversation: conversation._id,
      sender: senderId,
      content,
      isRead: false
    });

    // Save message
    await message.save();

    // Update conversation's lastMessage and updatedAt
    conversation.lastMessage = message._id;
    conversation.updatedAt = Date.now();
    await conversation.save();

    return res.json({
      success: true,
      message: "Message sent successfully",
      messageData: {
        id: message._id,
        conversationId: conversation._id,
        sender: senderId,
        content,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/messages/unread/:userId
// @desc    Get count of unread messages for a user
// @access  Public (should be protected in production)
router.get('/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find conversations where the user is a participant
    const conversations = await Conversation.find({
      participants: userId
    });

    // Count unread messages
    let unreadCount = 0;
    for (const conversation of conversations) {
      const count = await Message.countDocuments({
        conversation: conversation._id,
        sender: { $ne: userId },
        isRead: false
      });
      unreadCount += count;
    }

    return res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error counting unread messages:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

module.exports = router;
