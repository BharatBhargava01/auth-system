const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password (fixed: using async/await properly)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user with hashed password
        const user = new User({
            email,
            password: hashedPassword  // Fixed: using correct variable name
        });

        await user.save();

        // Auto-login after registration
        req.login(user, (loginErr) => {
            if (loginErr) {
                console.error('Session login error:', loginErr);
                return res.status(201).json({ message: 'User registered successfully' });
            }
            res.status(201).json({ message: 'User registered successfully', userId: user._id });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Compare password with hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Establish session
        req.login(user, (loginErr) => {
            if (loginErr) {
                console.error('Session login error:', loginErr);
                return res.status(500).json({ message: 'Login failed' });
            }
            res.json({ message: 'Login successful', userId: user._id });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
