token = localStorage.getItem('token');

if(token) {
    window.location.href = 'index.html';
}


const form = document.getElementById('formRegister');


form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const username = form.querySelector('#username').value;
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;
        

        // Validasi client-side

        if (username.length < 3) {
            throw new Error('Username must be at least 3 characters');
        }

        if (email.length < 3) {
            throw new Error('Email must be at least 3 characters');
        }

        if (password.length < 3) {
            throw new Error('Password must be at least 3 characters');
        }

        const response = await fetch('http://localhost:3000/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                email: email,
                password: password
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Register failed');
        }

        

        // Jika berhasil, redirect ke halaman login
        window.location.href = 'login.html';

    } catch (error) {
        // Menampilkan error ke user
        alert(error.message);
        console.error('Registration error:', error);
    }
});
