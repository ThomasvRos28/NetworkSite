const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ProfessionalInfo = require('../models/ProfessionalInfo');
const Skill = require('../models/Skill');
const Connection = require('../models/Connection');
const Match = require('../models/Match');
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
      postalCode,
      skill1,
      skill2,
      skill3,
      latitude,
      longitude,
      locationSharing,
      remoteWork
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

    // Prepare coordinates if latitude and longitude are provided
    let coordinates = undefined;
    if (latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {
      coordinates = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)] // GeoJSON format is [longitude, latitude]
      };
    }

    // Create professional info
    const professionalInfo = new ProfessionalInfo({
      user: user._id,
      workExperience,
      companyName,
      fieldOfWork,
      country,
      location,
      postalCode,
      coordinates: coordinates,
      locationSharingEnabled: locationSharing === true || locationSharing === 'true',
      remoteWorkEnabled: remoteWork === true || remoteWork === 'true'
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

// @route   POST /api/match
// @desc    Record a user's swipe action (like/dislike)
// @access  Public (should be protected in production)
router.post('/match', async (req, res) => {
  try {
    const { fromUserId, toUserId, action } = req.body;

    // Validate user IDs
    if (!mongoose.Types.ObjectId.isValid(fromUserId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Validate action
    if (!['like', 'dislike'].includes(action)) {
      return res.json({
        success: false,
        message: "Action must be 'like' or 'dislike'"
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

    // Check if a connection already exists between these users
    const existingConnection = await Connection.findOne({
      $or: [
        { fromUser: fromUserId, toUser: toUserId },
        { fromUser: toUserId, toUser: fromUserId }
      ],
      status: 'accepted'
    });

    if (existingConnection) {
      return res.json({
        success: false,
        message: "Users are already connected"
      });
    }

    // Check if a match record already exists and update it, or create a new one
    let match = await Match.findOne({ fromUser: fromUserId, toUser: toUserId });

    if (match) {
      // Update existing match
      match.action = action;
    } else {
      // Create new match
      match = new Match({
        fromUser: fromUserId,
        toUser: toUserId,
        action
      });
    }

    // Save the match
    await match.save();

    // If this is a 'like' action, check if the other user has also liked this user
    let mutualMatch = false;
    if (action === 'like') {
      const otherUserLike = await Match.findOne({
        fromUser: toUserId,
        toUser: fromUserId,
        action: 'like'
      });

      // If mutual like, create a connection automatically
      if (otherUserLike) {
        mutualMatch = true;

        // Check if a connection request already exists
        let connection = await Connection.findOne({
          $or: [
            { fromUser: fromUserId, toUser: toUserId },
            { fromUser: toUserId, toUser: fromUserId }
          ]
        });

        if (!connection) {
          // Create new connection with accepted status
          connection = new Connection({
            fromUser: fromUserId,
            toUser: toUserId,
            status: 'accepted'
          });
          await connection.save();

          // Create a conversation between the users
          const Conversation = require('../models/Conversation');
          let conversation = await Conversation.findOne({
            participants: { $all: [fromUserId, toUserId] }
          });

          // If no conversation exists, create one
          if (!conversation) {
            conversation = new Conversation({
              participants: [fromUserId, toUserId]
            });
            await conversation.save();
          }
        } else if (connection.status === 'pending') {
          // Update existing connection to accepted
          connection.status = 'accepted';
          await connection.save();

          // Create a conversation between the users
          const Conversation = require('../models/Conversation');
          let conversation = await Conversation.findOne({
            participants: { $all: [fromUserId, toUserId] }
          });

          // If no conversation exists, create one
          if (!conversation) {
            conversation = new Conversation({
              participants: [fromUserId, toUserId]
            });
            await conversation.save();
          }
        }
      }
    }

    // If there's a mutual match, return more information about the matched user
    if (mutualMatch) {
      // Get user details for the notification
      const matchedUser = await User.findById(toUserId).select('firstName lastName username');
      const currentUser = await User.findById(fromUserId).select('firstName lastName username');

      return res.json({
        success: true,
        message: `${action === 'like' ? 'Like' : 'Dislike'} recorded successfully`,
        mutualMatch: true,
        matchedUser: {
          id: toUserId,
          name: `${matchedUser.firstName} ${matchedUser.lastName}`.trim() || matchedUser.username
        },
        currentUser: {
          name: `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.username
        }
      });
    } else {
      return res.json({
        success: true,
        message: `${action === 'like' ? 'Like' : 'Dislike'} recorded successfully`,
        mutualMatch: false
      });
    }
  } catch (error) {
    console.error('Error recording match action:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/potential-matches/:userId
// @desc    Get potential matches for a user
// @access  Public (should be protected in production)
router.get('/potential-matches/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.json({
        success: false,
        message: "User not found"
      });
    }

    // Get all users that the current user has already swiped on
    const swipedUsers = await Match.find({ fromUser: userId }).select('toUser');
    const swipedUserIds = swipedUsers.map(match => match.toUser);

    // Get all existing connections (both accepted and pending)
    const connections = await Connection.find({
      $or: [
        { fromUser: userId },
        { toUser: userId }
      ]
    });

    const connectedUserIds = connections.map(conn =>
      conn.fromUser.toString() === userId ? conn.toUser : conn.fromUser
    );

    // Get users who have liked the current user
    const likedByUsers = await Match.find({
      toUser: userId,
      action: 'like'
    }).select('fromUser');

    const likedByUserIds = likedByUsers.map(match => match.fromUser.toString());

    // Combine the lists of users to exclude
    const excludeUserIds = [...swipedUserIds, ...connectedUserIds, userId];

    // Find the user's professional info to get their coordinates
    const userProfInfo = await ProfessionalInfo.findOne({ user: userId });
    const hasValidLocation = userProfInfo &&
                            userProfInfo.locationSharingEnabled &&
                            userProfInfo.coordinates &&
                            userProfInfo.coordinates.coordinates &&
                            userProfInfo.coordinates.coordinates.length === 2 &&
                            !(userProfInfo.coordinates.coordinates[0] === 0 && userProfInfo.coordinates.coordinates[1] === 0);

    // If user has valid location, use geoNear to find potential matches with distance
    let potentialMatches;

    if (hasValidLocation) {
      potentialMatches = await ProfessionalInfo.aggregate([
        {
          $geoNear: {
            near: userProfInfo.coordinates,
            distanceField: "calculatedDistance",
            query: {
              user: { $nin: excludeUserIds.map(id => new mongoose.Types.ObjectId(id.toString())) },
              locationSharingEnabled: true // Only include users who have enabled location sharing
            },
            spherical: true
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $unwind: '$userInfo'
        },
        {
          $project: {
            _id: '$userInfo._id',
            firstName: '$userInfo.firstName',
            lastName: '$userInfo.lastName',
            username: '$userInfo.username',
            professionalInfo: {
              fieldOfWork: '$fieldOfWork',
              companyName: '$companyName',
              country: '$country',
              location: '$location',
              mentorshipDetails: '$mentorshipDetails',
              locationSharingEnabled: '$locationSharingEnabled'
            },
            // Convert distance from meters to kilometers and round to 1 decimal place
            distance: {
              $round: [
                {
                  $cond: {
                    if: { $lt: ["$calculatedDistance", 1000] }, // If less than 1km
                    then: 1, // Show as 1km minimum
                    else: { $divide: ["$calculatedDistance", 1000] } // Convert to km
                  }
                },
                1 // Round to 1 decimal place
              ]
            }
          }
        }
      ]);

      // Find users without location sharing enabled separately
      const usersWithoutLocation = await User.aggregate([
        {
          $match: {
            _id: { $nin: excludeUserIds.map(id => new mongoose.Types.ObjectId(id.toString())) }
          }
        },
        {
          $lookup: {
            from: 'professionalinfos',
            localField: '_id',
            foreignField: 'user',
            as: 'professionalInfo'
          }
        },
        {
          $unwind: {
            path: '$professionalInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $match: {
            $or: [
              { 'professionalInfo.locationSharingEnabled': { $ne: true } },
              { 'professionalInfo.locationSharingEnabled': { $exists: false } }
            ]
          }
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            username: 1,
            'professionalInfo.fieldOfWork': 1,
            'professionalInfo.companyName': 1,
            'professionalInfo.country': 1,
            'professionalInfo.location': 1,
            'professionalInfo.mentorshipDetails': 1,
            'professionalInfo.locationSharingEnabled': 1
          }
        }
      ]);

      // Combine both sets of users
      potentialMatches = [...potentialMatches, ...usersWithoutLocation];
    } else {
      // If user doesn't have valid location, use regular query
      potentialMatches = await User.aggregate([
        {
          $match: {
            _id: { $nin: excludeUserIds.map(id => new mongoose.Types.ObjectId(id.toString())) }
          }
        },
        {
          $lookup: {
            from: 'professionalinfos',
            localField: '_id',
            foreignField: 'user',
            as: 'professionalInfo'
          }
        },
        {
          $unwind: {
            path: '$professionalInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            username: 1,
            'professionalInfo.fieldOfWork': 1,
            'professionalInfo.companyName': 1,
            'professionalInfo.country': 1,
            'professionalInfo.location': 1,
            'professionalInfo.mentorshipDetails': 1,
            'professionalInfo.locationSharingEnabled': 1
          }
        }
      ]);
    }

    // Add a flag to indicate if the user has already liked the current user
    const formattedMatches = potentialMatches.map(match => {
      return {
        ...match,
        hasLikedYou: likedByUserIds.includes(match._id.toString())
      };
    });

    // Sort by distance if available, otherwise randomize
    formattedMatches.sort((a, b) => {
      if (a.distance && b.distance) {
        return a.distance - b.distance;
      } else if (a.distance) {
        return -1; // a has distance, b doesn't, so a comes first
      } else if (b.distance) {
        return 1; // b has distance, a doesn't, so b comes first
      } else {
        return Math.random() - 0.5; // randomize users without distance
      }
    });

    return res.json({
      success: true,
      potentialMatches: formattedMatches
    });
  } catch (error) {
    console.error('Error fetching potential matches:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/swipe-history/:userId
// @desc    Get a user's swipe history
// @access  Public (should be protected in production)
router.get('/swipe-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find all users that the current user has swiped on
    const swipedUsers = await Match.find({ fromUser: userId })
      .populate({
        path: 'toUser',
        select: 'firstName lastName username'
      })
      .sort({ createdAt: -1 });

    // Get professional info for these users
    const userIds = swipedUsers.map(match => match.toUser._id);
    const professionalInfos = await ProfessionalInfo.find({
      user: { $in: userIds }
    });

    // Format the response
    const swipeHistory = swipedUsers.map(match => {
      const user = match.toUser;
      const profInfo = professionalInfos.find(info =>
        info.user.toString() === user._id.toString()
      );

      return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        action: match.action,
        timestamp: match.createdAt,
        professionalInfo: profInfo ? {
          fieldOfWork: profInfo.fieldOfWork,
          companyName: profInfo.companyName,
          country: profInfo.country,
          location: profInfo.location
        } : null
      };
    });

    return res.json({
      success: true,
      swipeHistory
    });
  } catch (error) {
    console.error('Error fetching swipe history:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   DELETE /api/disconnect/:userId/:connectionId
// @desc    Disconnect from a user
// @access  Public (should be protected in production)
router.delete('/disconnect/:userId/:connectionId', async (req, res) => {
  try {
    const { userId, connectionId } = req.params;

    // Validate user IDs
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(connectionId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find the connection
    const connection = await Connection.findOne({
      $or: [
        { fromUser: userId, toUser: connectionId },
        { fromUser: connectionId, toUser: userId }
      ]
    });

    if (!connection) {
      return res.json({
        success: false,
        message: "Connection not found"
      });
    }

    // Delete the connection
    await Connection.deleteOne({ _id: connection._id });

    // Delete any match records between these users
    await Match.deleteMany({
      $or: [
        { fromUser: userId, toUser: connectionId },
        { fromUser: connectionId, toUser: userId }
      ]
    });

    // Find and delete any conversations between these users
    const Conversation = require('../models/Conversation');
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, connectionId] }
    });

    if (conversation) {
      // Delete the conversation
      await Conversation.deleteOne({ _id: conversation._id });

      // Delete all messages in the conversation
      const Message = require('../models/Message');
      await Message.deleteMany({ conversation: conversation._id });
    }

    return res.json({
      success: true,
      message: "Successfully disconnected"
    });
  } catch (error) {
    console.error('Error disconnecting users:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   DELETE /api/reset-all-swipes
// @desc    Reset all swipe history in the system
// @access  Public (should be protected in production)
router.delete('/reset-all-swipes', async (req, res) => {
  try {
    // Delete all match records
    await Match.deleteMany({});

    // Delete all pending connections
    await Connection.deleteMany({ status: 'pending' });

    return res.json({
      success: true,
      message: "All swipe history reset successfully"
    });
  } catch (error) {
    console.error('Error resetting all swipe history:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/users
// @desc    Get all users
// @access  Public (should be protected in production)
router.get('/users', async (req, res) => {
  try {
    // Get all users
    const users = await User.find().select('firstName lastName username');

    return res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   DELETE /api/reset-swipes/:userId
// @desc    Reset a user's swipe history
// @access  Public (should be protected in production)
router.delete('/reset-swipes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Delete all match records where this user is the fromUser
    await Match.deleteMany({ fromUser: userId });

    // Also delete any connections that aren't accepted yet
    await Connection.deleteMany({
      $or: [
        { fromUser: userId, status: 'pending' },
        { toUser: userId, status: 'pending' }
      ]
    });

    return res.json({
      success: true,
      message: "Swipe history reset successfully"
    });
  } catch (error) {
    console.error('Error resetting swipe history:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/mutual-matches/:userId
// @desc    Get mutual matches for a user (users who have liked each other but aren't connected yet)
// @access  Public (should be protected in production)
router.get('/mutual-matches/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find users that the current user has liked
    const userLikes = await Match.find({
      fromUser: userId,
      action: 'like'
    }).select('toUser');

    const likedUserIds = userLikes.map(match => match.toUser.toString());

    // Find users that have liked the current user
    const likedByUsers = await Match.find({
      toUser: userId,
      action: 'like'
    }).select('fromUser');

    const likedByUserIds = likedByUsers.map(match => match.fromUser.toString());

    // Find the intersection (mutual likes)
    const mutualLikeIds = likedUserIds.filter(id => likedByUserIds.includes(id));

    // Get existing connections
    const connections = await Connection.find({
      $or: [
        { fromUser: userId, toUser: { $in: mutualLikeIds }, status: 'accepted' },
        { toUser: userId, fromUser: { $in: mutualLikeIds }, status: 'accepted' }
      ]
    });

    const connectedUserIds = connections.map(conn =>
      conn.fromUser.toString() === userId ? conn.toUser.toString() : conn.fromUser.toString()
    );

    // Filter out users that are already connected
    const pendingMutualLikeIds = mutualLikeIds.filter(id => !connectedUserIds.includes(id));

    // Get user details for mutual matches
    const mutualMatches = await User.find({
      _id: { $in: pendingMutualLikeIds }
    }).select('firstName lastName username');

    // Get professional info for mutual matches
    const professionalInfos = await ProfessionalInfo.find({
      user: { $in: pendingMutualLikeIds }
    });

    // Combine user data with professional info
    const formattedMatches = mutualMatches.map(user => {
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
      }

      return userInfo;
    });

    return res.json({
      success: true,
      mutualMatches: formattedMatches
    });
  } catch (error) {
    console.error('Error fetching mutual matches:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/nearby-users/:userId
// @desc    Get nearby users with distance information
// @access  Public (should be protected in production)
router.get('/nearby-users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxDistance = 100000 } = req.query; // Default max distance is 100km

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find the user's professional info to get their coordinates
    const userProfInfo = await ProfessionalInfo.findOne({ user: userId });
    if (!userProfInfo) {
      return res.json({
        success: false,
        message: "User professional info not found"
      });
    }

    // Check if user has location sharing enabled and has valid coordinates
    if (!userProfInfo.locationSharingEnabled ||
        !userProfInfo.coordinates ||
        !userProfInfo.coordinates.coordinates ||
        userProfInfo.coordinates.coordinates.length !== 2 ||
        userProfInfo.coordinates.coordinates[0] === 0 && userProfInfo.coordinates.coordinates[1] === 0) {
      return res.json({
        success: false,
        message: "Location sharing is disabled or location is not available"
      });
    }

    // Find nearby users with distance calculation
    const nearbyUsers = await ProfessionalInfo.aggregate([
      {
        $geoNear: {
          near: userProfInfo.coordinates,
          distanceField: "calculatedDistance",
          maxDistance: parseInt(maxDistance),
          query: {
            user: { $ne: new mongoose.Types.ObjectId(userId) }, // Exclude the current user
            locationSharingEnabled: true // Only include users who have enabled location sharing
          },
          spherical: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $project: {
          _id: 0,
          userId: '$user',
          firstName: '$userInfo.firstName',
          lastName: '$userInfo.lastName',
          username: '$userInfo.username',
          fieldOfWork: 1,
          companyName: 1,
          country: 1,
          location: 1,
          isAvailableAsMentor: '$userInfo.isAvailableAsMentor',
          // Convert distance from meters to kilometers and round to 1 decimal place
          distance: {
            $round: [
              {
                $cond: {
                  if: { $lt: ["$calculatedDistance", 1000] }, // If less than 1km
                  then: 1, // Show as 1km minimum
                  else: { $divide: ["$calculatedDistance", 1000] } // Convert to km
                }
              },
              1 // Round to 1 decimal place
            ]
          }
        }
      },
      {
        $sort: { distance: 1 } // Sort by distance ascending
      }
    ]);

    return res.json({
      success: true,
      nearbyUsers
    });
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/mentors/:userId
// @desc    Get available mentors for a user
// @access  Public (should be protected in production)
router.get('/mentors/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.json({
        success: false,
        message: "User not found"
      });
    }

    // Find all users who are available as mentors
    // Join with professional info to get more details
    const mentors = await User.aggregate([
      {
        $match: {
          _id: { $ne: new mongoose.Types.ObjectId(userId) }, // Exclude the current user
          isAvailableAsMentor: true // Only include users who are available as mentors
        }
      },
      {
        $lookup: {
          from: 'professionalinfos',
          localField: '_id',
          foreignField: 'user',
          as: 'professionalInfo'
        }
      },
      {
        $unwind: {
          path: '$professionalInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          username: 1,
          'professionalInfo.fieldOfWork': 1,
          'professionalInfo.companyName': 1,
          'professionalInfo.country': 1,
          'professionalInfo.location': 1,
          'professionalInfo.mentorshipDetails': 1
        }
      }
    ]);

    return res.json({
      success: true,
      mentors
    });
  } catch (error) {
    console.error('Error fetching mentors:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/my-mentors/:userId
// @desc    Get mentors for a user
// @access  Public (should be protected in production)
router.get('/my-mentors/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find connections where the user is the mentee
    const connections = await Connection.find({
      fromUser: userId,
      isMentorship: true,
      status: 'accepted'
    }).populate({
      path: 'toUser',
      select: 'firstName lastName username',
      populate: {
        path: 'professionalInfo',
        select: 'fieldOfWork companyName country location mentorshipDetails'
      }
    });

    // Format the mentors
    const mentors = connections.map(connection => {
      const mentor = connection.toUser;
      return {
        _id: mentor._id,
        firstName: mentor.firstName,
        lastName: mentor.lastName,
        username: mentor.username,
        professionalInfo: mentor.professionalInfo
      };
    });

    return res.json({
      success: true,
      mentors
    });
  } catch (error) {
    console.error('Error fetching my mentors:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/mentorship-requests/:userId
// @desc    Get mentorship requests for a user
// @access  Public (should be protected in production)
router.get('/mentorship-requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find mentorship requests where the user is the mentor
    const requests = await Connection.find({
      toUser: userId,
      isMentorship: true,
      status: 'pending'
    }).populate({
      path: 'fromUser',
      select: 'firstName lastName username',
      populate: {
        path: 'professionalInfo',
        select: 'fieldOfWork companyName country location'
      }
    });

    return res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error fetching mentorship requests:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   POST /api/request-mentorship
// @desc    Request mentorship from a user
// @access  Public (should be protected in production)
router.post('/request-mentorship', async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;

    // Validate user IDs
    if (!mongoose.Types.ObjectId.isValid(fromUserId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Check if a connection already exists
    const existingConnection = await Connection.findOne({
      fromUser: fromUserId,
      toUser: toUserId,
      isMentorship: true
    });

    if (existingConnection) {
      return res.json({
        success: false,
        message: "A mentorship request already exists"
      });
    }

    // Create a new connection request
    const connection = new Connection({
      fromUser: fromUserId,
      toUser: toUserId,
      status: 'pending',
      isMentorship: true
    });

    await connection.save();

    return res.json({
      success: true,
      message: "Mentorship request sent successfully"
    });
  } catch (error) {
    console.error('Error requesting mentorship:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   PUT /api/mentorship-request/:requestId
// @desc    Update mentorship request status
// @access  Public (should be protected in production)
router.put('/mentorship-request/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    // Validate request ID
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.json({
        success: false,
        message: "Invalid request ID"
      });
    }

    // Validate status
    if (status !== 'accepted' && status !== 'rejected') {
      return res.json({
        success: false,
        message: "Invalid status"
      });
    }

    // Find the connection request
    const connection = await Connection.findById(requestId);
    if (!connection) {
      return res.json({
        success: false,
        message: "Mentorship request not found"
      });
    }

    // Update the status
    connection.status = status;
    await connection.save();

    // If accepted, create a conversation
    if (status === 'accepted') {
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
      message: `Mentorship request ${status === 'accepted' ? 'accepted' : 'declined'} successfully`
    });
  } catch (error) {
    console.error('Error updating mentorship request:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   GET /api/user/:userId
// @desc    Get user data with professional info
// @access  Public (should be protected in production)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find the user with professional info
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.json({
        success: false,
        message: "User not found"
      });
    }

    // Get professional info
    const professionalInfo = await ProfessionalInfo.findOne({ user: userId });

    // Convert to plain object to add professionalInfo
    const userObj = user.toObject();
    userObj.professionalInfo = professionalInfo || null;

    return res.json({
      success: true,
      user: userObj
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   PUT /api/update-location/:userId
// @desc    Update user's location
// @access  Public (should be protected in production)
router.put('/update-location/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude, locationSharingEnabled } = req.body;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find the user's professional info
    const professionalInfo = await ProfessionalInfo.findOne({ user: userId });
    if (!professionalInfo) {
      return res.json({
        success: false,
        message: "Professional info not found"
      });
    }

    // Update location sharing preference if provided
    if (locationSharingEnabled !== undefined) {
      professionalInfo.locationSharingEnabled = locationSharingEnabled;
    }

    // Update coordinates if provided and location sharing is enabled
    if (professionalInfo.locationSharingEnabled &&
        latitude && longitude &&
        !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {

      professionalInfo.coordinates = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)] // GeoJSON format is [longitude, latitude]
      };
      professionalInfo.lastLocationUpdate = new Date();
    }

    await professionalInfo.save();

    return res.json({
      success: true,
      message: "Location updated successfully"
    });
  } catch (error) {
    console.error('Error updating location:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// @route   PUT /api/toggle-mentor-status/:userId
// @desc    Toggle user's availability as a mentor
// @access  Public (should be protected in production)
router.put('/toggle-mentor-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAvailable, mentorshipDetails } = req.body;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: false,
        message: "Invalid user ID"
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.json({
        success: false,
        message: "User not found"
      });
    }

    // Update user's mentor status
    user.isAvailableAsMentor = isAvailable;
    await user.save();

    // Update professional info if mentorship details are provided
    if (mentorshipDetails) {
      let professionalInfo = await ProfessionalInfo.findOne({ user: userId });

      if (professionalInfo) {
        professionalInfo.mentorshipDetails = mentorshipDetails;
        await professionalInfo.save();
      } else {
        // Create new professional info if it doesn't exist
        professionalInfo = new ProfessionalInfo({
          user: userId,
          mentorshipDetails: mentorshipDetails
        });
        await professionalInfo.save();
      }
    }

    return res.json({
      success: true,
      message: `You are now ${isAvailable ? 'available' : 'unavailable'} as a mentor`
    });
  } catch (error) {
    console.error('Error toggling mentor status:', error);
    return res.json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

module.exports = router;
