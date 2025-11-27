const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const eyeIcon = document.getElementById('eyeIcon');

const eyePath = `
  <path d="M12 5C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 11
           a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
`;

setEyeClosed();

function setEyeOpen() {
  eyeIcon.innerHTML = `
    ${eyePath}
    <line x1="4" y1="4" x2="20" y2="20"
          stroke="#e0fff0" stroke-width="2" stroke-linecap="round"/>
  `;
}

function setEyeClosed() {
  eyeIcon.innerHTML = eyePath;
}

togglePassword.addEventListener('click', () => {
  const showing = passwordInput.type === 'password';
  passwordInput.type = showing ? 'text' : 'password';
  showing ? setEyeOpen() : setEyeClosed();
});
