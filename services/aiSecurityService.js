const COMMON_WEAK_PASSWORDS = [
    'password',
    'password123',
    '123456',
    'qwerty',
    'letmein',
    'admin',
    'welcome',
    'iloveyou'
];

function normalizeEmail(email = '') {
    return String(email).trim().toLowerCase();
}

function estimatePasswordStrength(password = '', email = '') {
    let score = 0;
    const suggestions = [];
    const passwordValue = String(password);
    const normalizedPassword = passwordValue.toLowerCase();
    const normalizedEmail = normalizeEmail(email);

    if (!passwordValue) {
        return {
            score,
            label: 'Very weak',
            suggestions: ['Use at least 12 characters with mixed symbols and numbers.'],
            checks: []
        };
    }

    const checks = [
        {
            name: 'length',
            pass: passwordValue.length >= 12,
            weight: 25,
            suggestion: 'Use 12+ characters for better resilience.'
        },
        {
            name: 'upperLowerMix',
            pass: /[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue),
            weight: 20,
            suggestion: 'Mix uppercase and lowercase letters.'
        },
        {
            name: 'numbers',
            pass: /\d/.test(passwordValue),
            weight: 15,
            suggestion: 'Add at least one number.'
        },
        {
            name: 'symbols',
            pass: /[^A-Za-z0-9]/.test(passwordValue),
            weight: 15,
            suggestion: 'Add a symbol (for example: !@#$).'
        },
        {
            name: 'notCommon',
            pass: !COMMON_WEAK_PASSWORDS.includes(normalizedPassword),
            weight: 15,
            suggestion: 'Avoid common passwords and predictable patterns.'
        },
        {
            name: 'notPersonalized',
            pass: normalizedEmail
                ? !normalizedPassword.includes(normalizedEmail.split('@')[0])
                : true,
            weight: 10,
            suggestion: 'Avoid using parts of your email in the password.'
        }
    ];

    for (const check of checks) {
        if (check.pass) {
            score += check.weight;
        } else {
            suggestions.push(check.suggestion);
        }
    }

    let label = 'Very weak';
    if (score >= 80) label = 'Strong';
    else if (score >= 60) label = 'Good';
    else if (score >= 40) label = 'Fair';
    else if (score >= 20) label = 'Weak';

    return {
        score,
        label,
        suggestions: suggestions.slice(0, 3),
        checks: checks.map(({ name, pass }) => ({ name, pass }))
    };
}

function assessLoginRisk({ user, ipAddress = '', userAgent = '' }) {
    const reasons = [];
    let score = 5;

    if (!user) {
        return {
            score: 10,
            level: 'low',
            reasons: ['No historical data for this account.']
        };
    }

    const security = user.security || {};
    if (security.failedLoginAttempts >= 3) {
        score += 25;
        reasons.push('Recent failed sign-in attempts detected.');
    }

    if (security.lastLoginIp && ipAddress && security.lastLoginIp !== ipAddress) {
        score += 20;
        reasons.push('Sign-in from a new network.');
    }

    if (security.lastLoginUserAgent && userAgent && security.lastLoginUserAgent !== userAgent) {
        score += 15;
        reasons.push('Sign-in from a different device/browser profile.');
    }

    let level = 'low';
    if (score >= 60) level = 'high';
    else if (score >= 30) level = 'medium';

    return {
        score: Math.min(score, 100),
        level,
        reasons
    };
}

module.exports = {
    estimatePasswordStrength,
    assessLoginRisk,
    normalizeEmail
};