/*
 * Password Strength Checker - UI wiring.
 *
 * All analysis logic lives in js/strength.js (global `PasswordStrength`).
 * This file only handles the DOM: theme, modals, visibility toggle, the
 * animated composition-rule list + 0-5 strength bar, the advanced-rules
 * editor, and the "practical assessment" panel (entropy, crack-time estimate,
 * common-password / pattern warnings).
 *
 * Nothing is sent anywhere - every value stays in the page.
 */
$(document).ready(function () {
    // --- Theme toggle ---
    var applyTheme = function (theme) {
        $('body').removeClass('dark-mode light-mode').addClass(theme);
        try { localStorage.setItem('theme', theme); } catch (e) { /* storage may be blocked */ }
    };

    $('#themeToggle').on('change', function () {
        applyTheme($(this).is(':checked') ? 'dark-mode' : 'light-mode');
    });

    var savedTheme = null;
    try { savedTheme = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
    if (savedTheme === 'light-mode') {
        $('#themeToggle').prop('checked', false);
        applyTheme('light-mode');
    } else {
        $('#themeToggle').prop('checked', true);
        applyTheme('dark-mode');
    }

    // --- Custom alert ---
    var customAlertModal = $('#customAlertModal');
    var showAlert = function (title, message) {
        $('#customAlertTitle').text(title);
        $('#customAlertMessage').text(message);
        customAlertModal.show();
    };
    $('.custom-alert-close-button, .custom-alert-ok-button').on('click', function () { customAlertModal.hide(); });

    // --- Modals ---
    var infoModal = $('#infoModal');
    var advancedOptionsModal = $('#advancedOptionsModal');
    var advancedOptionsInfoModal = $('#advancedOptionsInfoModal');

    $('#infoBtn').on('click', function () { infoModal.show(); });
    $('.info-close-button').on('click', function () { infoModal.hide(); });
    $('#advancedOptionsBtn').on('click', function () { advancedOptionsModal.show(); });
    $('.advanced-close-button').on('click', function () { advancedOptionsModal.hide(); });
    $('#advancedOptionsInfoBtn').on('click', function () { advancedOptionsInfoModal.show(); });
    $('.advanced-info-close-button').on('click', function () { advancedOptionsInfoModal.hide(); });

    $(window).on('click', function (event) {
        [customAlertModal, infoModal, advancedOptionsModal, advancedOptionsInfoModal].forEach(function (m) {
            if ($(event.target).is(m)) m.hide();
        });
    });

    // --- Password visibility toggle ---
    $('#togglePasswordVisibility').on('click', function () {
        var input = $('#passwordInput');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            $('#eyeOpen').show();
            $('#eyeClosed').hide();
        } else {
            input.attr('type', 'password');
            $('#eyeOpen').hide();
            $('#eyeClosed').show();
        }
    });

    // --- Rules state ---
    var currentRules = Object.assign({}, PasswordStrength.DEFAULT_RULES);

    var updateStrengthBar = function (score, totalChecks) {
        var width = (score / totalChecks) * 100;
        var color = 'var(--red)';
        var label = 'Strength: N/A';
        if (score === 0) { width = 0; label = 'Strength: N/A'; }
        else if (score === 1) { color = 'var(--red)'; label = 'Strength: Weak'; }
        else if (score === 2) { color = 'var(--orange)'; label = 'Strength: Fair'; }
        else if (score === 3) { color = 'var(--primary)'; label = 'Strength: Good'; }
        else if (score === 4) { color = 'var(--green)'; label = 'Strength: Strong'; }
        else if (score >= 5) { color = 'var(--green)'; label = 'Strength: Very Strong!'; }
        $('#strengthBar').css({ width: width + '%', backgroundColor: color });
        $('#strengthLabel').text(label);
    };

    var renderPractical = function (password) {
        var p = PasswordStrength.assessPractical(password);
        var card = $('#practicalAssessment');
        $('#entropyBits').text(p.entropyBits);
        $('#poolInfo').text('(character pool ~' + p.poolSize + ')');
        $('#crackTime').text(p.crackTime);
        $('#crackNote').text(p.guessable ? '' : '(offline brute force, ~10^10 guesses/s)');

        var verdict = $('#practicalVerdict');
        verdict.removeClass('success-text error-text warn-text');
        if (p.ratingScore >= 3) verdict.addClass('success-text');
        else if (p.ratingScore === 2) verdict.addClass('warn-text');
        else verdict.addClass('error-text');
        verdict.text('Practical strength: ' + p.rating);

        var list = $('#warningsList').empty();
        if (p.warnings.length === 0) {
            list.append($('<li class="success-text"></li>').text('No common-password or obvious-pattern problems found.'));
        } else {
            p.warnings.forEach(function (w) {
                list.append($('<li class="error-text"></li>').text('⚠ ' + w));
            });
        }
        card.show();
    };

    var checkPasswordStrength = function () {
        var password = $('#passwordInput').val();
        var resultsDiv = $('#passwordResults').empty();
        $('.strength-bar-container').show();
        $('#passwordResults').show();

        if (password.length === 0) {
            resultsDiv.append('<p class="placeholder-text">Enter a password and click "Check Password" to see the strength analysis.</p>');
            updateStrengthBar(0, 5);
            $('#practicalAssessment').hide();
            return;
        }

        var evalResult = PasswordStrength.evaluateRules(password, currentRules);
        var checks = evalResult.checks.map(function (c) {
            var msg;
            if (c.name === 'Minimum Length') {
                msg = (c.passed ? '[PASS]' : '[FAIL]') + ' Minimum length of ' + c.required + ' characters';
            } else {
                var noun = { 'Uppercase Letters': 'uppercase letter', 'Lowercase Letters': 'lowercase letter',
                             'Numbers': 'number', 'Special Characters': 'special character' }[c.name];
                msg = (c.passed ? '[PASS]' : '[FAIL]') + ' At least ' + c.required + ' ' + noun + '(s) (found: ' + c.found + ')';
            }
            return { passed: c.passed, message: msg };
        });

        updateStrengthBar(0, checks.length);
        $('#checkPasswordBtn').prop('disabled', true);

        var passedSoFar = 0;
        var idx = 0;
        var animate = function () {
            if (idx < checks.length) {
                var ch = checks[idx];
                $('<p class="' + (ch.passed ? 'success-text' : 'error-text') + '"></p>')
                    .text(ch.message).hide().appendTo(resultsDiv).fadeIn(300);
                if (ch.passed) passedSoFar++;
                updateStrengthBar(passedSoFar, checks.length);
                idx++;
                setTimeout(animate, 350);
            } else {
                if (passedSoFar === checks.length) {
                    resultsDiv.prepend('<p class="overall-strength success-text">Password meets all configured rules.</p>');
                } else {
                    resultsDiv.prepend('<p class="overall-strength error-text">Password needs improvement.</p>');
                }
                renderPractical(password);
                $('#checkPasswordBtn').prop('disabled', false);
            }
        };
        animate();
    };

    $('#checkPasswordBtn').on('click', checkPasswordStrength);

    // --- Advanced options ---
    var loadAdvancedRules = function () {
        $('#minLengthInput').val(currentRules.minLength);
        $('#requireUppercase').val(currentRules.requireUppercase);
        $('#requireLowercase').val(currentRules.requireLowercase);
        $('#requireNumbers').val(currentRules.requireNumbers);
        $('#requireSpecial').val(currentRules.requireSpecial);
    };

    $('.btn-apply').on('click', function () {
        if ($(this).data('rule') === 'minLength') {
            var value = parseInt($('#minLengthInput').val(), 10);
            if (!isNaN(value) && value >= 0) {
                currentRules.minLength = value;
                showAlert('Rule Applied', 'Minimum length rule applied: ' + value + ' characters.');
            } else {
                showAlert('Invalid Input', 'Please enter a valid minimum length (0 or a positive number).');
            }
        }
        advancedOptionsModal.hide();
    });

    $('.apply-char-rules-btn').on('click', function () {
        var vals = {
            requireUppercase: parseInt($('#requireUppercase').val(), 10),
            requireLowercase: parseInt($('#requireLowercase').val(), 10),
            requireNumbers: parseInt($('#requireNumbers').val(), 10),
            requireSpecial: parseInt($('#requireSpecial').val(), 10)
        };
        var valid = Object.keys(vals).every(function (k) { return !isNaN(vals[k]) && vals[k] >= 0; });
        if (valid) {
            Object.assign(currentRules, vals);
            showAlert('Rules Applied', 'Character type rules applied!');
        } else {
            showAlert('Invalid Input', 'Please enter valid non-negative numbers for all character type rules.');
        }
        advancedOptionsModal.hide();
    });

    $('#advancedOptionsBtn').on('click', loadAdvancedRules);

    // Optional demo prefill for documentation screenshots: index.html?demo
    if (/[?&]demo(\b|=)/.test(window.location.search)) {
        $('#passwordInput').val('Password1!');
        checkPasswordStrength();
    }
});
