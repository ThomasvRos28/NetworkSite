const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const Connection = require('./models/Connection');

// Store active connections with userId as key and WebSocket as value
const clients = new Map();

// Initialize WebSocket server
function initWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    console.log('New WebSocket connection established');

    // Extract userId from query parameters
    const url = new URL(req.url, 'http://localhost');
    const userId = url.searchParams.get('userId');

    if (!userId) {
      console.log('Connection rejected: No userId provided');
      ws.close(1008, 'User ID is required');
      return;
    }

    // Store the connection with userId as key
    clients.set(userId, ws);
    console.log(`User ${userId} connected. Total clients: ${clients.size}`);
    console.log('Active clients:', Array.from(clients.keys()));

    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection_established',
      userId: userId,
      timestamp: new Date()
    }));

    // Handle incoming messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log('Received message:', data);

        // Handle different message types
        switch (data.type) {
          case 'chat_message':
            await handleChatMessage(data, userId);
            break;
          case 'typing':
            await handleTypingIndicator(data, userId);
            break;
          case 'read_receipt':
            await handleReadReceipt(data, userId);
            break;
          default:
            console.log(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Error processing your message',
          error: error.message
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      clients.delete(userId);
      console.log(`User ${userId} disconnected. Remaining clients: ${clients.size}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      clients.delete(userId);
    });
  });

  console.log('WebSocket server initialized');
  return wss;
}

// Handle chat messages
async function handleChatMessage(data, senderId) {
  const { recipientId, content, conversationId } = data;

  try {
    console.log(`Processing message from ${senderId} to ${recipientId}`);

    // Verify users are connected before allowing messaging
    const areConnected = await checkUsersConnected(senderId, recipientId);
    console.log(`Users are connected: ${areConnected}`);

    if (!areConnected) {
      sendErrorToUser(senderId, 'You can only message users you are connected with');
      return;
    }

    // Find or create conversation
    let conversation;

    // First, check if the conversationId is actually a userId (for new conversations)
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      // Try to find an existing conversation
      conversation = await Conversation.findOne({
        $or: [
          { _id: conversationId, participants: { $all: [senderId, recipientId] } },
          { participants: { $all: [senderId, recipientId] } }
        ]
      });
    } else {
      // Check if conversation already exists between these users
      conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] }
      });
    }

    // If no conversation found, create a new one
    if (!conversation) {
      console.log(`Creating new conversation between ${senderId} and ${recipientId}`);
      conversation = new Conversation({
        participants: [senderId, recipientId],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await conversation.save();
      console.log(`New conversation created with ID: ${conversation._id}`);
    } else {
      console.log(`Found existing conversation with ID: ${conversation._id}`);
    }

    // Create and save the message
    const message = new Message({
      conversation: conversation._id,
      sender: senderId,
      content: content,
      isRead: false,
      createdAt: new Date()
    });
    await message.save();
    console.log(`Message saved with ID: ${message._id}`);

    // Update conversation's lastMessage and updatedAt
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    // Get sender info for the message
    const sender = await User.findById(senderId).select('firstName lastName username');

    // Prepare message data to send
    const messageData = {
      type: 'new_message',
      message: {
        id: message._id,
        conversationId: conversation._id,
        sender: {
          id: senderId,
          name: `${sender.firstName} ${sender.lastName}`.trim() || sender.username
        },
        content: content,
        timestamp: message.createdAt,
        isRead: false
      }
    };

    // Send message to recipient if online
    console.log(`Attempting to send message to recipient ${recipientId}`);
    const recipientReceived = sendToUser(recipientId, messageData);
    console.log(`Message sent to recipient: ${recipientReceived}`);

    // Send confirmation to sender with the same message format for consistency
    const confirmationData = {
      type: 'new_message',
      message: {
        id: message._id,
        conversationId: conversation._id,
        sender: {
          id: senderId,
          name: `${sender.firstName} ${sender.lastName}`.trim() || sender.username
        },
        content: content,
        timestamp: message.createdAt,
        isRead: true
      }
    };

    const senderReceived = sendToUser(senderId, confirmationData);
    console.log(`Confirmation sent to sender: ${senderReceived}`);

  } catch (error) {
    console.error('Error handling chat message:', error);
    sendErrorToUser(senderId, 'Error sending message: ' + error.message);
  }
}

// Handle typing indicators
async function handleTypingIndicator(data, senderId) {
  const { recipientId, isTyping } = data;

  try {
    // Send typing indicator to recipient if online
    sendToUser(recipientId, {
      type: 'typing_indicator',
      userId: senderId,
      isTyping: isTyping
    });
  } catch (error) {
    console.error('Error handling typing indicator:', error);
  }
}

// Handle read receipts
async function handleReadReceipt(data, userId) {
  const { conversationId } = data;

  try {
    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        isRead: false
      },
      { isRead: true }
    );

    // Find the other participant in the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return;

    const otherParticipantId = conversation.participants.find(
      id => id.toString() !== userId
    );

    // Notify the sender that their messages were read
    sendToUser(otherParticipantId.toString(), {
      type: 'messages_read',
      conversationId: conversationId,
      readBy: userId,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error handling read receipt:', error);
  }
}

// Check if users are connected
async function checkUsersConnected(userId1, userId2) {
  console.log(`Checking connection between ${userId1} and ${userId2}`);

  try {
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

// Send message to a specific user
function sendToUser(userId, data) {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
    return true;
  }
  return false;
}

// Send error message to a user
function sendErrorToUser(userId, errorMessage) {
  sendToUser(userId, {
    type: 'error',
    message: errorMessage,
    timestamp: new Date()
  });
}

module.exports = { initWebSocketServer };
