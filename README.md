# Password Strength Checker

A simple, privacy-focused web app to help users create strong passwords by checking them against customizable criteria. All password analysis happens locally—your data is never sent or stored.

**Live Demo:** [jampanikomal.github.io/Password-Strength-Checker](https://jampanikomal.github.io/Password-Strength-Checker/)

## Features

- Enter your password and click "Check Password" for analysis.
- **Animated Rule Display:** Rules are checked and shown one by one with smooth animation; the strength bar updates progressively.
- **Customizable Rules:** Set requirements for:
     - Minimum length
     - Uppercase letters
     - Lowercase letters
     - Digits
     - Special characters
- **Privacy-Focused:** All logic runs in your browser; passwords are never transmitted or stored.
- **Password Visibility Toggle:** Show/hide your password with an eye icon (visible by default).
- **Dynamic Strength Bar:** Visual indicator updates as rules are checked.
- **Informative Feedback:** See which rules your password meets or fails.
- **Light/Dark Theme:** Switch between themes for comfortable viewing.
- **Responsive Design:** Works on mobile and desktop.

## Technologies Used

- **HTML5:** Page structure
- **CSS3:** Styling and layout
- **JavaScript (jQuery):** Interactivity, analysis, and UI updates

## Installation and Setup

1. **Clone the Repository:**
      ```sh
      git clone https://github.com/JampaniKomal/Password-Strength-Checker.git
      cd Password-Strength-Checker
      ```

2. **Run Locally:**
      - Open `index.html` in your browser, or use a local server for best results.

      **Using VS Code Live Server:**
      - Install the "Live Server" extension, right-click `index.html`, and select "Open with Live Server."

      **Using Python HTTP Server:**
      ```sh
      python -m http.server 8000
      ```
      - Visit [http://localhost:8000/](http://localhost:8000/) in your browser.

## Usage

- **Enter Password:** Type your password in the input field.
- **Toggle Visibility:** Click the eye icon to show/hide your password.
- **Check Password:** Click "Check Password" to analyze strength.
- **Strength Bar:** View the colored bar and label for password strength.
- **View Results:** See which rules are met or failed.
- **Theme Toggle:** Switch between light and dark modes.
- **About:** Click "Info" for privacy and app details.

**Advanced Options:**
- Click "Advanced Options" to customize rules.
- Adjust minimum length and character type requirements.
- Set any value to 0 to disable a rule.
- Click "Apply" to save changes.
- "Info" next to Advanced Options explains each rule.

## Contributing

Fork, open issues, or submit pull requests for improvements or new features!

## Testing & Verification

Actually drove the app in a real browser (Playwright, served locally)
rather than just reading the code: entered real passwords, clicked
Check Password, and read back the actual displayed results and
strength label, for both the default rules and after changing
Advanced Options.

That run surfaced a real bug: the README documents "Set any value to
0 to disable a rule" as a supported way to turn off any of the 5
checks, and that worked correctly for the 4 character-type rules —
but the Minimum Length rule's own Apply handler required the value to
be `>= 1`, so entering 0 and clicking Apply was silently rejected
with an "Invalid Input" alert, and the rule was never actually
disabled. Fixed the validation to accept 0 (and updated the input's
HTML `min` attribute to match); re-ran the same test and confirmed
applying 0 now succeeds and a 1-character password correctly passes
the length check afterward.

Also confirmed correct behavior that didn't need fixing: the
password-visibility eye icon toggles correctly through repeated
clicks (worth checking given the git history shows several earlier
commits reworking this exact logic), and the animated per-rule
results and strength bar/label are consistent for both a weak and a
fully-passing password.

## Known Limitations

- No automated test suite — verification was exercising the real app
  in a real browser.
- The special-character check's definition includes a literal space
  as a qualifying character, which is broader than some definitions
  of "special character."

## License

Open source under the MIT License. See [LICENSE](LICENSE).
