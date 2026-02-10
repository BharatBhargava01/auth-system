const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id') {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists
            let user = await User.findOne({ providerId: profile.id, provider: 'google' });
            
            if (user) {
                return done(null, user);
            }

            // Check if email already exists
            const existingEmail = await User.findOne({ email: profile.emails[0].value });
            if (existingEmail) {
                // Link accounts
                existingEmail.provider = 'google';
                existingEmail.providerId = profile.id;
                existingEmail.name = profile.displayName;
                existingEmail.avatar = profile.photos[0]?.value;
                await existingEmail.save();
                return done(null, existingEmail);
            }

            // Create new user
            user = new User({
                email: profile.emails[0].value,
                name: profile.displayName,
                avatar: profile.photos[0]?.value,
                provider: 'google',
                providerId: profile.id
            });
            await user.save();
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
}

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'your_github_client_id') {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: '/api/auth/github/callback',
        scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ providerId: profile.id, provider: 'github' });
            
            if (user) {
                return done(null, user);
            }

            const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;

            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                existingEmail.provider = 'github';
                existingEmail.providerId = profile.id;
                existingEmail.name = profile.displayName || profile.username;
                existingEmail.avatar = profile.photos[0]?.value;
                await existingEmail.save();
                return done(null, existingEmail);
            }

            user = new User({
                email,
                name: profile.displayName || profile.username,
                avatar: profile.photos[0]?.value,
                provider: 'github',
                providerId: profile.id
            });
            await user.save();
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
}

// Facebook Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id') {
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: '/api/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name', 'displayName', 'photos']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ providerId: profile.id, provider: 'facebook' });
            
            if (user) {
                return done(null, user);
            }

            const email = profile.emails?.[0]?.value || `${profile.id}@facebook.local`;

            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                existingEmail.provider = 'facebook';
                existingEmail.providerId = profile.id;
                existingEmail.name = profile.displayName;
                existingEmail.avatar = profile.photos[0]?.value;
                await existingEmail.save();
                return done(null, existingEmail);
            }

            user = new User({
                email,
                name: profile.displayName,
                avatar: profile.photos[0]?.value,
                provider: 'facebook',
                providerId: profile.id
            });
            await user.save();
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
}

module.exports = passport;
