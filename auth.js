document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const senhaInput = document.getElementById('senha');
  const loginError = document.getElementById('login-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.classList.remove('show');

    let valid = true;
    const email = emailInput.value.trim();
    const senha = senhaInput.value;

    const errEmail = document.getElementById('err-email');
    const errSenha = document.getElementById('err-senha');
    errEmail.classList.remove('show');
    errSenha.classList.remove('show');
    emailInput.parentElement.classList.remove('error');
    senhaInput.parentElement.classList.remove('error');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      errEmail.classList.add('show');
      emailInput.parentElement.classList.add('error');
      valid = false;
    }
    if (!senha) {
      errSenha.classList.add('show');
      senhaInput.parentElement.classList.add('error');
      valid = false;
    }
    if (!valid) return;

    if (login(email, senha)) {
      window.location.href = 'index.html';
    } else {
      loginError.classList.add('show');
    }
  });
});