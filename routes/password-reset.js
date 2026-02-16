const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const router = express.Router();

// In-memory OTP store: email -> { code, expiresAt }
const resetOtpStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000;   // 60 seconds

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/password/send-otp
router.post('/password/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'Please enter your email address.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user exists
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(400).json({ message: 'No account found with this email.' });
        }

        // Check cooldown
        const existing = resetOtpStore.get(normalizedEmail);
        if (existing && Date.now() - (existing.expiresAt - OTP_EXPIRY_MS) < OTP_COOLDOWN_MS) {
            const waitSec = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - (existing.expiresAt - OTP_EXPIRY_MS))) / 1000);
            return res.status(429).json({ message: `Please wait ${waitSec}s before requesting a new code.` });
        }

        const code = generateOtp();
        resetOtpStore.set(normalizedEmail, {
            code,
            expiresAt: Date.now() + OTP_EXPIRY_MS
        });

        // Log OTP to console (or send via email service if configured)
        console.log(`\n════════════════════════════════`);
        console.log(`  PASSWORD RESET OTP for ${normalizedEmail}: ${code}`);
        console.log(`════════════════════════════════\n`);

        res.json({ message: 'Reset code sent to your email.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/auth/password/verify-otp
router.post('/password/verify-otp', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: 'Email and code are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const stored = resetOtpStore.get(normalizedEmail);

        if (!stored) {
            return res.status(400).json({ message: 'No code was sent to this email. Please request a new one.' });
        }

        if (Date.now() > stored.expiresAt) {
            resetOtpStore.delete(normalizedEmail);
            return res.status(400).json({ message: 'Code expired. Please request a new one.' });
        }

        if (stored.code !== code) {
            return res.status(400).json({ message: 'Invalid code. Please try again.' });
        }

        // Mark as verified (keep in store for the reset step)
        stored.verified = true;

        res.json({ message: 'Code verified. You can now reset your password.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/auth/password/reset
router.post('/password/reset', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const stored = resetOtpStore.get(normalizedEmail);

        if (!stored || !stored.verified || stored.code !== code) {
            return res.status(400).json({ message: 'Invalid or expired reset session. Please start over.' });
        }

        if (Date.now() > stored.expiresAt) {
            resetOtpStore.delete(normalizedEmail);
            return res.status(400).json({ message: 'Reset session expired. Please start over.' });
        }

        // Hash new password and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findOneAndUpdate(
            { email: normalizedEmail },
            { password: hashedPassword }
        );

        // Clean up
        resetOtpStore.delete(normalizedEmail);

        res.json({ message: 'Password reset successfully. You can now sign in.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
