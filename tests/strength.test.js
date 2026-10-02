'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/strength.js');

// --- Composition rules ------------------------------------------------------

test('evaluateRules: a password meeting all default rules passes 5/5', () => {
    const r = S.evaluateRules('Abcdef1!', S.DEFAULT_RULES);
    assert.equal(r.total, 5);
    assert.equal(r.passedCount, 5);
});

test('evaluateRules: a weak password fails the right checks', () => {
    const r = S.evaluateRules('abc', S.DEFAULT_RULES); // short, no upper/digit/special
    const byName = Object.fromEntries(r.checks.map(c => [c.name, c.passed]));
    assert.equal(byName['Minimum Length'], false);
    assert.equal(byName['Lowercase Letters'], true);
    assert.equal(byName['Uppercase Letters'], false);
    assert.equal(byName['Numbers'], false);
    assert.equal(byName['Special Characters'], false);
    assert.equal(r.passedCount, 1);
});

// Regression for the documented "set a value to 0 to disable a rule" behaviour,
// including minLength=0 (the bug Overhaul 1 fixed in the Apply handler).
test('evaluateRules: a requirement of 0 disables that check (always passes)', () => {
    const rules = { minLength: 0, requireUppercase: 0, requireLowercase: 0, requireNumbers: 0, requireSpecial: 0 };
    const r = S.evaluateRules('', rules);
    assert.equal(r.passedCount, 5, 'every rule disabled -> even an empty string passes all 5');
    const r2 = S.evaluateRules('a', { ...S.DEFAULT_RULES, minLength: 0 });
    assert.equal(r2.checks[0].passed, true, 'minLength 0 -> a 1-char password passes the length check');
});

test('evaluateRules: a space counts as a special character (documented quirk)', () => {
    const r = S.evaluateRules('ab cde', { ...S.DEFAULT_RULES, requireSpecial: 1, minLength: 1,
        requireUppercase: 0, requireNumbers: 0 });
    const special = r.checks.find(c => c.name === 'Special Characters');
    assert.equal(special.found, 1);
    assert.equal(special.passed, true);
});

// --- Entropy ----------------------------------------------------------------

test('charPoolSize reflects the character classes used', () => {
    assert.equal(S.charPoolSize('abc'), 26);
    assert.equal(S.charPoolSize('abcABC'), 52);
    assert.equal(S.charPoolSize('abc123'), 36);
    assert.equal(S.charPoolSize('abcABC123'), 62);
    assert.equal(S.charPoolSize('abc!'), 26 + 33);
});

test('estimateEntropyBits: 0 for empty, and matches length*log2(pool)', () => {
    assert.equal(S.estimateEntropyBits(''), 0);
    // 8 lowercase letters -> pool 26 -> 8 * log2(26) ~= 37.6 bits
    const bits = S.estimateEntropyBits('abcdefgh');
    assert.ok(Math.abs(bits - 8 * Math.log2(26)) < 1e-9);
    assert.ok(bits > 37 && bits < 38);
});

test('estimateEntropyBits: more length / a bigger pool means more bits', () => {
    assert.ok(S.estimateEntropyBits('abcdefghij') > S.estimateEntropyBits('abcdefgh'));
    assert.ok(S.estimateEntropyBits('abcdEF12') > S.estimateEntropyBits('abcdefgh'));
});

// --- Pattern / common-password warnings -------------------------------------

test('findWarnings: flags an exact common password', () => {
    assert.ok(S.findWarnings('password').some(w => /most common/i.test(w)));
    assert.ok(S.findWarnings('qwerty').length > 0);
});

test('findWarnings: flags a common word with digits/symbols tacked on', () => {
    // "Password1!" passes every composition rule but is a decorated common word.
    const w = S.findWarnings('Password1!');
    assert.ok(w.some(x => /common password/i.test(x)));
});

test('findWarnings: flags sequences, repeats, years and numeric-only', () => {
    assert.ok(S.findWarnings('myqwertylogin').some(w => /sequence/i.test(w)));
    assert.ok(S.findWarnings('aaahello').some(w => /repeated/i.test(w)));
    assert.ok(S.findWarnings('summer2024').some(w => /year/i.test(w)));
    assert.ok(S.findWarnings('849302715').some(w => /numeric/i.test(w)));
});

test('findWarnings: a strong passphrase has no warnings', () => {
    assert.deepEqual(S.findWarnings('tangerine-glacier-fox-amber-97QT'), []);
});

// --- Crack time -------------------------------------------------------------

test('estimateCrackTime: scales from instant to centuries', () => {
    assert.equal(S.estimateCrackTime(0), 'instantly');
    assert.equal(S.estimateCrackTime(200), 'centuries');
    const mid = S.estimateCrackTime(50);
    assert.equal(typeof mid, 'string');
    assert.ok(mid.length > 0);
});

// --- End-to-end practical verdict ------------------------------------------

test('assessPractical: a rule-passing but common password is still rated weak', () => {
    const rules = S.evaluateRules('Password1!', S.DEFAULT_RULES);
    assert.equal(rules.passedCount, 5, 'it passes all composition rules');
    const p = S.assessPractical('Password1!');
    assert.ok(p.warnings.length > 0, 'but the practical screen warns about it');
    assert.ok(p.ratingScore <= 1, 'and the practical rating is weak');
});

test('assessPractical: a long random passphrase rates strong with no warnings', () => {
    const p = S.assessPractical('tangerine-glacier-fox-amber-97QT');
    assert.equal(p.warnings.length, 0);
    assert.ok(p.ratingScore >= 3);
    assert.ok(p.entropyBits > 100);
});

test('assess: returns both views', () => {
    const a = S.assess('Abcdef1!');
    assert.ok(a.rules && a.practical);
    assert.equal(a.rules.total, 5);
    assert.equal(typeof a.practical.entropyBits, 'number');
});
