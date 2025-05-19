const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ProfessionalInfo = require('../models/ProfessionalInfo');
const Skill = require('../models/Skill');
const Connection = require('../models/Connection');
const mongoose = require('mongoose');

// @route   POST /api/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      workExperience,
      companyName,
      fieldOfWork,
      country,
      location,
      skill1,
      skill2,
      skill3
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.json({
        success: false,
        message: "Username or email already exists"
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password, // Will be hashed by pre-save hook
      firstName,
      lastName
    });

    // Save user to database
    await user.save();

    // Create professional info
    const professionalInfo = new ProfessionalInfo({
      user: user._id,
      workExperience,
      companyName,
      fieldOfWork,
      country,
      location
    });

    // Save professional info
    await professionalInfo.save();

    // Add skills
    const skills = [skill1, skill2, skill3].filter(skill => skill && skill.trim());

    for (const skillText of skills) {
      const skill = new Skill({
        user: user._id,
        skill: skillText
      });
      await skill.save();
    }

    return res.json({
      success: true,
      message: "User registered successfully"
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   POST /api/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Return user data (similar to the original implementation)
    return res.json({
      success: true,
      message: "Authentication successful",
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error authenticating user:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   POST /api/toggle-mentorship
// @desc    Toggle mentorship availability
// @access  Public (should be protected in production)
router.post('/toggle-mentorship', async (req, res) => {
  try {
    const { userId, availableForMentorship, mentorshipDetails } = req.body;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find professional info for the user
    let professionalInfo = await ProfessionalInfo.findOne({ user: userId });

    if (!professionalInfo) {
      return res.json({
        success: false,
        message: "Professional information not found"
      });
    }

    // Update availability status
    professionalInfo.availableForMentorship = availableForMentorship;

    // Update mentorship details if provided
    if (mentorshipDetails !== undefined) {
      professionalInfo.mentorshipDetails = mentorshipDetails;
    }

    // Save changes
    await professionalInfo.save();

    return res.json({
      success: true,
      message: "Mentorship availability updated successfully",
      availableForMentorship: professionalInfo.availableForMentorship,
      mentorshipDetails: professionalInfo.mentorshipDetails
    });
  } catch (error) {
    console.error('Error updating mentorship availability:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/available-mentors
// @desc    Get list of available mentors
// @access  Public
router.get('/available-mentors', async (req, res) => {
  try {
    // Find all professional info records where availableForMentorship is true
    const availableMentors = await ProfessionalInfo.find({ availableForMentorship: true })
      .populate('user', 'firstName lastName username')
      .select('user mentorshipDetails fieldOfWork companyName country location');

    return res.json({
      success: true,
      mentors: availableMentors
    });
  } catch (error) {
    console.error('Error fetching available mentors:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   POST /api/connection-request
// @desc    Send a connection request to another user
// @access  Public (should be protected in production)
router.post('/connection-request', async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;

    // Validate user IDs
    if (!mongoose.Types.ObjectId.isValid(fromUserId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Check if users exist
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!fromUser || !toUser) {
      return res.json({
        success: false,
        message: "One or both users not found"
      });
    }

    // Check if a connection request already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { fromUser: fromUserId, toUser: toUserId },
        { fromUser: toUserId, toUser: fromUserId }
      ]
    });

    if (existingConnection) {
      return res.json({
        success: false,
        message: "A connection request already exists between these users"
      });
    }

    // Create new connection request
    const connection = new Connection({
      fromUser: fromUserId,
      toUser: toUserId,
      status: 'pending'
    });

    // Save connection request
    await connection.save();

    return res.json({
      success: true,
      message: "Connection request sent successfully"
    });
  } catch (error) {
    console.error('Error sending connection request:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/connection-requests
// @desc    Get connection requests for a user
// @access  Public (should be protected in production)
router.get('/connection-requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find pending connection requests sent to the user
    const pendingRequests = await Connection.find({
      toUser: userId,
      status: 'pending'
    }).populate('fromUser', 'firstName lastName username');

    return res.json({
      success: true,
      connectionRequests: pendingRequests
    });
  } catch (error) {
    console.error('Error fetching connection requests:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/connections/:userId
// @desc    Get all connections for a user
// @access  Public (should be protected in production)
router.get('/connections/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find all accepted connections where the user is either the sender or receiver
    const connections = await Connection.find({
      $or: [
        { fromUser: userId, status: 'accepted' },
        { toUser: userId, status: 'accepted' }
      ]
    });

    // Extract the IDs of connected users
    const connectedUserIds = connections.map(connection => {
      return connection.fromUser.toString() === userId ?
        connection.toUser : connection.fromUser;
    });

    // Get the user details for all connected users
    const connectedUsers = await User.find({
      _id: { $in: connectedUserIds }
    }).select('firstName lastName username');

    // Get professional info for connected users
    const ProfessionalInfo = require('../models/ProfessionalInfo');
    const professionalInfos = await ProfessionalInfo.find({
      user: { $in: connectedUserIds }
    });

    // Combine user data with professional info
    const formattedConnections = connectedUsers.map(user => {
      const userInfo = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        fullName: `${user.firstName} ${user.lastName}`.trim() || user.username
      };

      // Find professional info for this user
      const profInfo = professionalInfos.find(info =>
        info.user.toString() === user._id.toString()
      );

      if (profInfo) {
        userInfo.workExperience = profInfo.workExperience;
        userInfo.companyName = profInfo.companyName;
        userInfo.fieldOfWork = profInfo.fieldOfWork;
        userInfo.country = profInfo.country;
        userInfo.location = profInfo.location;
        userInfo.availableForMentorship = profInfo.availableForMentorship;
      }

      return userInfo;
    });

    return res.json({
      success: true,
      connections: formattedConnections
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   PUT /api/connection-request/:id
// @desc    Update a connection request status (accept/reject)
// @access  Public (should be protected in production)
router.put('/connection-request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate connection ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.json({
        success: false,
        message: "Invalid connection ID"
      });
    }

    // Validate status
    if (!['accepted', 'rejected'].includes(status)) {
      return res.json({
        success: false,
        message: "Status must be 'accepted' or 'rejected'"
      });
    }

    // Find the connection request
    const connection = await Connection.findById(id);

    if (!connection) {
      return res.json({
        success: false,
        message: "Connection request not found"
      });
    }

    // Update the connection status
    connection.status = status;
    await connection.save();

    // If the request is accepted, create a conversation between the users
    if (status === 'accepted') {
      // Check if a conversation already exists
      const Conversation = require('../models/Conversation');
      let conversation = await Conversation.findOne({
        participants: { $all: [connection.fromUser, connection.toUser] }
      });

      // If no conversation exists, create one
      if (!conversation) {
        conversation = new Conversation({
          participants: [connection.fromUser, connection.toUser]
        });
        await conversation.save();
      }
    }

    return res.json({
      success: true,
      message: `Connection request ${status}`,
      connection
    });
  } catch (error) {
    console.error('Error updating connection request:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

module.exports = router;
