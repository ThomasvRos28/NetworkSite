const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/User');
const ProfessionalInfo = require('../models/ProfessionalInfo');
const Skill = require('../models/Skill');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Function to display all users
async function displayUsers() {
  try {
    const users = await User.find({}).select('-password'); // Exclude password field
    console.log('\n=== USERS ===');
    console.log(JSON.stringify(users, null, 2));
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

// Function to display professional info
async function displayProfessionalInfo() {
  try {
    const professionalInfo = await ProfessionalInfo.find({});
    console.log('\n=== PROFESSIONAL INFO ===');
    console.log(JSON.stringify(professionalInfo, null, 2));
  } catch (error) {
    console.error('Error fetching professional info:', error);
  }
}

// Function to display skills
async function displaySkills() {
  try {
    const skills = await Skill.find({});
    console.log('\n=== SKILLS ===');
    console.log(JSON.stringify(skills, null, 2));
  } catch (error) {
    console.error('Error fetching skills:', error);
  }
}

// Function to display user profiles with related data
async function displayUserProfiles() {
  try {
    const users = await User.find({}).select('-password');
    console.log('\n=== USER PROFILES ===');
    
    for (const user of users) {
      // Get professional info
      const professionalInfo = await ProfessionalInfo.findOne({ user: user._id });
      
      // Get skills
      const skills = await Skill.find({ user: user._id });
      
      // Create profile object
      const profile = {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        professionalInfo: professionalInfo || 'No professional info',
        skills: skills.map(s => s.skill) || []
      };
      
      console.log(JSON.stringify(profile, null, 2));
      console.log('-----------------------------------');
    }
  } catch (error) {
    console.error('Error fetching user profiles:', error);
  }
}

// Run all display functions and then disconnect
async function main() {
  try {
    await displayUsers();
    await displayProfessionalInfo();
    await displaySkills();
    await displayUserProfiles();
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main();
