/*
 * Password-strength engine.
 *
 * Lives in one module so it runs both in the browser (loaded as a plain
 * <script>, exposing a global `PasswordStrength`) and under Node (via
 * `require`), which is what the automated test suite uses.
 *
 * Two independent views of a password:
 *   1. evaluateRules()  - the configurable composition rules (length +
 *      character-class counts). This is what the UI's 0-5 strength bar shows.
 *   2. assessPractical() - a reality check that composition rules miss: a
 *      rough entropy estimate plus a screen for common passwords and obvious
 *      patterns. NIST SP 800-63B deprecates composition rules precisely
 *      because a password can satisfy them all and still be trivial to guess
 *      (e.g. "Password1!"). assess() combines both.
 *
 * Nothing here is a substitute for a real strength estimator like zxcvbn or
 * for screening against a full breached-password corpus; see the README.
 */
(function (global, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        global.PasswordStrength = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var DEFAULT_RULES = {
        minLength: 8,
        requireUppercase: 1,
        requireLowercase: 1,
        requireNumbers: 1,
        requireSpecial: 1
    };

    // Matches the app's historical definition of "special character" - note it
    // deliberately includes a literal space.
    var SPECIAL_CLASS = "!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?~` ";
    var SPECIAL_RE = new RegExp('[' + SPECIAL_CLASS + ']', 'g'); // for counting (.match)
    var SPECIAL_TEST = new RegExp('[' + SPECIAL_CLASS + ']');    // for .test() (no 'g': stateless)

    // A small, illustrative list of the most common passwords. This is NOT a
    // full breach corpus (a real deployment would screen against one, e.g.
    // Have I Been Pwned's k-anonymity range API); it is here to demonstrate the
    // idea and to catch the usual suspects.
    var COMMON_PASSWORDS = [
        'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
        '123456', '1234567', '12345678', '123456789', '1234567890', '12345', '123123',
        '111111', '000000', '654321', '121212', '112233',
        'qwerty', 'qwerty123', 'qwertyuiop', '1q2w3e4r', '1qaz2wsx', 'zaq12wsx',
        'abc123', 'admin', 'administrator', 'root', 'toor', 'letmein', 'welcome',
        'welcome1', 'monkey', 'dragon', 'master', 'login', 'princess', 'sunshine',
        'iloveyou', 'football', 'baseball', 'superman', 'batman', 'trustno1',
        'whatever', 'shadow', 'michael', 'jennifer', 'hunter2', 'starwars'
    ];

    var KEYBOARD_SEQUENCES = [
        'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'abcdefghijklmnopqrstuvwxyz', '0123456789'
    ];

    function countMatches(password, re) {
        return (password.match(re) || []).length;
    }

    // --- 1. Composition rules -------------------------------------------------

    // A rule whose requirement is 0 is treated as disabled: the check always
    // passes (matching the app's documented "set any value to 0 to disable").
    function evaluateRules(password, rules) {
        rules = rules || DEFAULT_RULES;
        var upper = countMatches(password, /[A-Z]/g);
        var lower = countMatches(password, /[a-z]/g);
        var digits = countMatches(password, /[0-9]/g);
        var special = countMatches(password, SPECIAL_RE);

        var checks = [
            { name: 'Minimum Length', required: rules.minLength, found: password.length, passed: password.length >= rules.minLength },
            { name: 'Uppercase Letters', required: rules.requireUppercase, found: upper, passed: upper >= rules.requireUppercase },
            { name: 'Lowercase Letters', required: rules.requireLowercase, found: lower, passed: lower >= rules.requireLowercase },
            { name: 'Numbers', required: rules.requireNumbers, found: digits, passed: digits >= rules.requireNumbers },
            { name: 'Special Characters', required: rules.requireSpecial, found: special, passed: special >= rules.requireSpecial }
        ];

        var passedCount = checks.reduce(function (n, c) { return n + (c.passed ? 1 : 0); }, 0);
        return { checks: checks, passedCount: passedCount, total: checks.length };
    }

    // --- 2. Practical assessment ---------------------------------------------

    // Size of the character pool the password draws from. This is the input to
    // the naive entropy estimate.
    function charPoolSize(password) {
        var pool = 0;
        if (/[a-z]/.test(password)) pool += 26;
        if (/[A-Z]/.test(password)) pool += 26;
        if (/[0-9]/.test(password)) pool += 10;
        if (SPECIAL_TEST.test(password)) pool += 33; // common ASCII symbols incl. space
        // Any character outside those classes (e.g. accented or non-Latin).
        if (/[^\x00-\x7F]/.test(password)) pool += 100;
        return pool;
    }

    // Naive Shannon-style estimate: length * log2(poolSize). This is an UPPER
    // bound that assumes every character was chosen independently and at
    // random - real passwords are far more predictable, which is what the
    // pattern warnings below are for.
    function estimateEntropyBits(password) {
        if (!password) return 0;
        var pool = charPoolSize(password);
        if (pool <= 1) return 0;
        return password.length * (Math.log(pool) / Math.log(2));
    }

    function hasSequentialRun(lowerPwd, minRun) {
        minRun = minRun || 4;
        for (var s = 0; s < KEYBOARD_SEQUENCES.length; s++) {
            var seq = KEYBOARD_SEQUENCES[s];
            var rev = seq.split('').reverse().join('');
            for (var i = 0; i + minRun <= seq.length; i++) {
                var fwd = seq.substr(i, minRun);
                var bwd = rev.substr(i, minRun);
                if (lowerPwd.indexOf(fwd) !== -1 || lowerPwd.indexOf(bwd) !== -1) return true;
            }
        }
        return false;
    }

    function hasLongRepeat(password, minRun) {
        minRun = minRun || 3;
        var run = 1;
        for (var i = 1; i < password.length; i++) {
            run = password[i] === password[i - 1] ? run + 1 : 1;
            if (run >= minRun) return true;
        }
        return false;
    }

    // Strip trailing digits / a single trailing symbol so "password1!" can be
    // recognised as "password" with decoration.
    function baseWord(lowerPwd) {
        return lowerPwd.replace(/[0-9]+$/,'').replace(/[!@#$%^&*._-]+$/,'');
    }

    function findWarnings(password) {
        var warnings = [];
        if (!password) return warnings;
        var lower = password.toLowerCase();

        if (COMMON_PASSWORDS.indexOf(lower) !== -1) {
            warnings.push('This is one of the most common passwords - it would be guessed almost immediately.');
        } else if (COMMON_PASSWORDS.indexOf(baseWord(lower)) !== -1) {
            warnings.push('This is a common password with a predictable number/symbol tacked on - attackers try exactly these variations.');
        }
        if (hasSequentialRun(lower)) {
            warnings.push('Contains a keyboard or alphabetical sequence (e.g. "qwerty", "abcd", "1234").');
        }
        if (hasLongRepeat(password)) {
            warnings.push('Contains a run of repeated characters.');
        }
        if (/^(19|20)\d{2}$/.test(password) || /(19|20)\d{2}$/.test(password)) {
            warnings.push('Ends in something that looks like a year - a very common and weak pattern.');
        }
        if (/^\d+$/.test(password)) {
            warnings.push('Digits only - a numeric-only password has a very small search space.');
        }
        return warnings;
    }

    // Average guesses to crack ~= half the keyspace, at an assumed offline
    // fast-hash rate. Returned as a human string; clearly an illustration.
    function estimateCrackTime(entropyBits, guessesPerSecond) {
        guessesPerSecond = guessesPerSecond || 1e10; // ~10 billion/s, offline GPU on a fast hash
        if (entropyBits <= 0) return 'instantly';
        var seconds = Math.pow(2, entropyBits) / 2 / guessesPerSecond;
        if (!isFinite(seconds) || seconds > 3.15e9 * 1000) return 'centuries';
        var units = [
            ['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400],
            ['year', 31557600], ['century', 3155760000]
        ];
        if (seconds < 1) return 'less than a second';
        var chosen = units[0];
        for (var i = 0; i < units.length; i++) {
            if (seconds >= units[i][1]) chosen = units[i];
        }
        var value = Math.round(seconds / chosen[1]);
        return value + ' ' + chosen[0] + (value === 1 ? '' : 's');
    }

    // Practical verdict on a 0-4 scale, folding in entropy AND the warnings.
    function practicalRating(entropyBits, warnings) {
        if (warnings.length > 0) return { score: 0, label: 'Very Weak' };
        if (entropyBits < 28) return { score: 0, label: 'Very Weak' };
        if (entropyBits < 36) return { score: 1, label: 'Weak' };
        if (entropyBits < 60) return { score: 2, label: 'Reasonable' };
        if (entropyBits < 128) return { score: 3, label: 'Strong' };
        return { score: 4, label: 'Very Strong' };
    }

    function assessPractical(password) {
        var entropyBits = estimateEntropyBits(password);
        var warnings = findWarnings(password);
        var rating = practicalRating(entropyBits, warnings);
        // The brute-force crack time (from entropy) is only the relevant threat
        // when there is nothing smarter to try. If the password matches a common
        // password or an obvious pattern, a dictionary/rule attack cracks it
        // almost instantly, so quoting the brute-force number would badly
        // overstate its safety.
        var guessable = warnings.length > 0;
        return {
            entropyBits: Math.round(entropyBits * 10) / 10,
            poolSize: charPoolSize(password),
            guessable: guessable,
            crackTime: guessable ? 'seconds (it matches a common password or pattern)'
                                 : estimateCrackTime(entropyBits),
            bruteForceCrackTime: estimateCrackTime(entropyBits),
            warnings: warnings,
            rating: rating.label,
            ratingScore: rating.score
        };
    }

    // Everything in one call.
    function assess(password, rules) {
        return {
            rules: evaluateRules(password, rules),
            practical: assessPractical(password)
        };
    }

    return {
        DEFAULT_RULES: DEFAULT_RULES,
        evaluateRules: evaluateRules,
        charPoolSize: charPoolSize,
        estimateEntropyBits: estimateEntropyBits,
        findWarnings: findWarnings,
        estimateCrackTime: estimateCrackTime,
        assessPractical: assessPractical,
        assess: assess,
        COMMON_PASSWORDS: COMMON_PASSWORDS
    };
});
