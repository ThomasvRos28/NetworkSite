const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ProfessionalInfo = require('../models/ProfessionalInfo');
const Skill = require('../models/Skill');

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
      fieldOfWork
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

module.exports = router;
