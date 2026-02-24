const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const {
    estimatePasswordStrength,
    assessLoginRisk,
    normalizeEmail
} = require('../services/aiSecurityService');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

const router = express.Router();

// AI password advisor
router.post('/security/password-feedback', (req, res) => {
    const { email = '', password = '' } = req.body || {};

    if (typeof password !== 'string' || password.length > 256) {
        return res.status(400).json({ message: 'Invalid password payload.' });
    }

    const analysis = estimatePasswordStrength(password, email);

    res.json({
        message: 'Password analysis complete',
        analysis
    });
});

// Register new user
router.post('/register', async (req, res) => {
    try {
        const rawEmail = req.body?.email;
        const password = req.body?.password;

        if (typeof rawEmail !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const email = normalizeEmail(rawEmail);
        if (!email || password.length > 256) {
            return res.status(400).json({ message: 'Invalid registration payload.' });
        }

        const passwordAnalysis = estimatePasswordStrength(password, email);
        if (passwordAnalysis.score < 40) {
            return res.status(400).json({
                message: 'Password is too weak. Please improve it before registering.',
                analysis: passwordAnalysis
            });
        }

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
            password: hashedPassword,
            provider: 'local',
            security: {
                failedLoginAttempts: 0,
                lastFailedLoginAt: null,
                lockUntil: null,
                lastLoginIp: req.ip || null,
                lastLoginUserAgent: req.get('user-agent') || null
            }
        });

        await user.save();

        // Auto-login after registration
        req.login(user, (loginErr) => {
            if (loginErr) {
                console.error('Session login error:', loginErr);
                return res.status(201).json({ message: 'User registered successfully' });
            }
            res.status(201).json({
                message: 'User registered successfully',
                userId: user._id,
                passwordSecurity: passwordAnalysis
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const rawEmail = req.body?.email;
        const password = req.body?.password;

        if (typeof rawEmail !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const email = normalizeEmail(rawEmail);
        const ipAddress = req.ip;
        const userAgent = req.get('user-agent') || 'unknown';

        // Find user by email
        const user = await User.findOne({ email });
        if (!user || !user.password) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Compare password with hashed password
        const lockUntil = user.security?.lockUntil ? new Date(user.security.lockUntil) : null;
        if (lockUntil && lockUntil.getTime() > Date.now()) {
            const retryAfterSec = Math.ceil((lockUntil.getTime() - Date.now()) / 1000);
            return res.status(429).json({
                message: 'Too many failed attempts. Please try again later.',
                retryAfterSec
            });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const failedAttempts = (user.security?.failedLoginAttempts || 0) + 1;
            const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;

            user.security = {
                ...(user.security || {}),
                failedLoginAttempts: failedAttempts,
                lastFailedLoginAt: new Date(),
                lockUntil: shouldLock ? new Date(Date.now() + LOCK_WINDOW_MS) : null
            };

            await user.save();

            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Establish session
         const risk = assessLoginRisk({ user, ipAddress, userAgent });

        user.security = {
            ...(user.security || {}),
            failedLoginAttempts: 0,
            lastFailedLoginAt: null,
            lockUntil: null,
            lastLoginIp: ipAddress || null,
            lastLoginUserAgent: userAgent
        };
        await user.save();

        req.login(user, (loginErr) => {
            if (loginErr) {
                console.error('Session login error:', loginErr);
                return res.status(500).json({ message: 'Login failed' });
            }
            res.json({
                message: 'Login successful',
                userId: user._id,
                securityNotice: risk.level === 'high'
                    ? 'We noticed unusual login signals. Consider enabling MFA for stronger protection.'
                    : undefined
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
