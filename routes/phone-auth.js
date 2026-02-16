const express = require('express');
const User = require('../models/User');

const router = express.Router();

// In-memory OTP store: phone -> { code, expiresAt }
const otpStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000;   // 60 seconds between sends

// Generate a 6-digit OTP
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Normalize phone number (strip spaces/dashes, ensure starts with +)
function normalizePhone(phone) {
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    return cleaned;
}

// POST /api/auth/phone/send-otp
router.post('/phone/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || phone.trim().length < 8) {
            return res.status(400).json({ message: 'Please enter a valid phone number.' });
        }

        const normalizedPhone = normalizePhone(phone);

        // Check cooldown
        const existing = otpStore.get(normalizedPhone);
        if (existing && Date.now() - (existing.expiresAt - OTP_EXPIRY_MS) < OTP_COOLDOWN_MS) {
            const waitSec = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - (existing.expiresAt - OTP_EXPIRY_MS))) / 1000);
            return res.status(429).json({ message: `Please wait ${waitSec}s before requesting a new code.` });
        }

        const code = generateOtp();
        otpStore.set(normalizedPhone, {
            code,
            expiresAt: Date.now() + OTP_EXPIRY_MS
        });

        // ──── Send OTP ────
        // If Twilio is configured, send via SMS; otherwise log to console
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
            try {
                const twilio = require('twilio');
                const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                await client.messages.create({
                    body: `Your login code is: ${code}`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: normalizedPhone
                });
            } catch (smsErr) {
                console.error('Twilio SMS failed:', smsErr.message);
                console.log(`[OTP FALLBACK] Code for ${normalizedPhone}: ${code}`);
            }
        } else {
            console.log(`\n════════════════════════════════`);
            console.log(`  OTP for ${normalizedPhone}: ${code}`);
            console.log(`════════════════════════════════\n`);
        }

        res.json({ message: 'Verification code sent.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/auth/phone/verify-otp
router.post('/phone/verify-otp', async (req, res) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({ message: 'Phone and code are required.' });
        }

        const normalizedPhone = normalizePhone(phone);
        const stored = otpStore.get(normalizedPhone);

        if (!stored) {
            return res.status(400).json({ message: 'No code was sent to this number. Please request a new one.' });
        }

        if (Date.now() > stored.expiresAt) {
            otpStore.delete(normalizedPhone);
            return res.status(400).json({ message: 'Code expired. Please request a new one.' });
        }

        if (stored.code !== code) {
            return res.status(400).json({ message: 'Invalid code. Please try again.' });
        }

        // OTP verified — remove from store
        otpStore.delete(normalizedPhone);

        // Find or create user by phone
        let user = await User.findOne({ phone: normalizedPhone });

        if (!user) {
            user = new User({
                phone: normalizedPhone,
                provider: 'phone'
            });
            await user.save();
        }

        // Establish Passport session so req.isAuthenticated() works
        req.login(user, (loginErr) => {
            if (loginErr) {
                console.error('Session login error:', loginErr);
                return res.status(500).json({ message: 'Login failed.' });
            }
            res.json({
                message: 'Login successful',
                userId: user._id,
                isNewUser: !user.name
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
