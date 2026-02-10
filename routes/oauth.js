const express = require('express');
const passport = require('passport');
const router = express.Router();

// Helper function to check if provider is configured
const isProviderConfigured = (provider) => {
    switch(provider) {
        case 'google':
            return process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id';
        case 'github':
            return process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'your_github_client_id';
        case 'facebook':
            return process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id';
        default:
            return false;
    }
};

// Success/failure redirect pages
const successRedirect = '/success.html';
const failureRedirect = '/login.html?error=auth_failed';

// ========== GOOGLE ==========
router.get('/google', (req, res, next) => {
    if (!isProviderConfigured('google')) {
        return res.redirect('/login.html?error=google_not_configured');
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect }),
    (req, res) => {
        res.redirect(successRedirect);
    }
);

// ========== GITHUB ==========
router.get('/github', (req, res, next) => {
    if (!isProviderConfigured('github')) {
        return res.redirect('/login.html?error=github_not_configured');
    }
    passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get('/github/callback',
    passport.authenticate('github', { failureRedirect }),
    (req, res) => {
        res.redirect(successRedirect);
    }
);

// ========== FACEBOOK ==========
router.get('/facebook', (req, res, next) => {
    if (!isProviderConfigured('facebook')) {
        return res.redirect('/login.html?error=facebook_not_configured');
    }
    passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect }),
    (req, res) => {
        res.redirect(successRedirect);
    }
);

// ========== CHECK AUTH STATUS ==========
router.get('/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user._id,
                email: req.user.email,
                name: req.user.name,
                avatar: req.user.avatar,
                provider: req.user.provider
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ========== LOGOUT ==========
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.redirect('/login.html');
    });
});

module.exports = router;
