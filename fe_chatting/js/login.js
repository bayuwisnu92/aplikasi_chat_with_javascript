const form = document.getElementById('formLogin');



form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const email = form.querySelector('#email').value; // Ambil nilai email
        const password = form.querySelector('#password').value; // Ambil nilai password

        const response = await fetch('http://localhost:3000/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // << PENTING!
            },
            body: JSON.stringify({ // Kirim sebagai JSON
                email: email,
                password: password
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        if (!data.token) {
            throw new Error('No token received from server');
        }

        // Simpan token dan redirect
        localStorage.setItem('token', data.token);
        window.location.href = 'contact.html';

    } catch (err) {
        console.error("Login error:", err);
        alert(err.message || "Login failed. Please try again.");
    }
});

const token = localStorage.getItem('token');

// 1. Cek apakah token ada di localStorage
if (token) {
  // Jika tidak ada token, redirect ke halaman login
  showAlert('token masih valid ke halaman utama')
  setTimeout(() => {
    window.location.href = 'contact.html';
  }, 200);
} 

const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get('error');
if (error === 'unauthorized') {
  showAlert('masa login kamu sudah berakhir ,,, silakan login lagi !!!');
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.prepend(alertDiv);
    
    // Hilangkan alert setelah 3 detik
    setTimeout(() => {
      alertDiv.classList.remove('show');
      setTimeout(() => alertDiv.remove(), 150);
    }, 3000);
  }