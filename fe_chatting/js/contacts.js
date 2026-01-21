const token = localStorage.getItem('token');
let currentUserId = null;
let dataGlobal = []
if (!token) {
  window.location.href = 'login.html';
} else {
  verifyToken(token)
    .then(userData => {
      
      const user = userData.user || {};
      currentUserId = user.user_id || user.id || decodeToken(token); // fallback terakhir

      // Validasi user ID
      if (!currentUserId) {
        throw new Error("User ID tidak ditemukan di token atau respons");
      }
      loadProtectedContent(userData);
      
      
    })
    .catch(error => {
      console.error('Authentication error:', error);
      localStorage.removeItem('token');
      logoutOnline()
      window.location.href = 'login.html';
    });
}

// Fungsi verifikasi token
async function verifyToken(token) {
  try {
    const response = await fetch('http://localhost:3000/api/verify-token', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Authentication failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Verify token error:', error);
    throw error;
  }
}

// Fungsi tampilkan konten
function loadProtectedContent(userData) {
    try {
      // 1. Debug: Tampilkan isi lengkap userData
      // console.log('Parsed user data:', JSON.parse(JSON.stringify(userData)));
      
      // 2. Akses data dengan benar
      const user = userData.user || {};
      const username = user.username || 'Guest';
      const userId = user.id || 'N/A';
      document.title = `Chat App - ${username}`; // ⬅️ Tambahkan ini
      // 3. Update DOM
      const homeElement = document.getElementById('home');
      if (homeElement) {
        homeElement.textContent = `${username} (ID: ${userId})`;
      }
  
    
      document.getElementById('logout').addEventListener('click', async () => {
        try{
          const response = await fetch('http://localhost:3000/api/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if(response.status === 200){
            showAlert('Logout berhasil!', 'success');
            localStorage.removeItem('token');
            window.location.href = '/views/login.html';
          }
        } catch (error) {
          console.error('Logout error:', error);
          showAlert('Logout gagal!', 'danger');
        }
      });
  

      
    } catch (error) {
      console.error('Error loading content:', error);
      document.body.innerHTML = `
        <p>Error loading user data. Please <a href="login.html">login again</a>.</p>
      `;
    }
  }

async function logoutOnline(){
  try{
    const response = await fetch('http://localhost:3000/api/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if(response.status === 200){
      showAlert('Logout berhasil!', 'success');
      window.location.href = '/views/login.html';
    }
  } catch (error) {
    console.error('Logout error:', error);
    showAlert('Logout gagal!', 'danger');
  }
}

// Ambil daftar kontak dari backend
async function loadAllChatList() {
  try {
    const [contactRes, groupRes] = await Promise.all([
      fetch('http://localhost:3000/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch('http://localhost:3000/api/allGroup', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    if (contactRes.status === 401 || groupRes.status === 401) {
      showAlert('Sesi habis! Silakan login lagi.', 'danger');
      localStorage.removeItem('token');
      logoutOnline();
      setTimeout(() => {
        window.location.href = '/views/login.html';
      }, 1500);
      return;
    }

    if (!contactRes.ok || !groupRes.ok) {
      throw new Error(`Gagal memuat data!`);
    }

    const contacts = await contactRes.json();
    const groups = await groupRes.json();

    const formattedContacts = contacts.map(c => ({
      type: 'user',
      id: c.user_id,
      name: c.username,
      lastMessage: c.last_message,
      lastTime: c.last_message_time,
      status: c.status
    }));

    const formattedGroups = groups.map(g => ({
      type: 'group',
      id: g.group_id,
      name: g.group_name,
      lastMessage: g.last_message,
      lastTime: g.last_message_time,
      sender: g.sender_username
    }));

    // Gabungkan dan sortir berdasarkan waktu pesan terakhir
    const combined = [...formattedContacts, ...formattedGroups]
      .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

    // Simpan ke global jika perlu
    dataGlobal = combined;

    // Render semua dengan 1 fungsi
    listContact(combined);

  } catch (error) {
    console.error('Gagal memuat kontak/grup:', error);
    contactsList.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle fa-3x mb-3 text-danger"></i>
        <h5 class="text-danger">Gagal memuat data</h5>
        <p class="text-muted">${error.message}</p>
        <button class="btn btn-retry" onclick="loadAllChatList()">
          <i class="fas fa-sync-alt"></i> Coba Lagi
        </button>
      </div>
    `;
  }
}


// Fungsi untuk menampilkan alert
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
// Mulai percakapan dengan user tertentu
async function startChat(datanya) {
  const otherUserId = datanya.otherUserId
  const username = datanya.username
  

  try {
    if (!otherUserId || isNaN(otherUserId)) {
      throw new Error('ID kontak tidak valid');
    }

    const response = await fetch('http://localhost:3000/api/conversations/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ otherUserId }) // ⬅️ hanya kirim ini
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMsg = errorData.message || "Terjadi kesalahan";
      if (response.status === 401) {
        window.location.href = 'login.html?error=unauthorized';
        return; // Stop eksekusi
      }
  
      throw new Error(errorMsg); // Lempar error untuk ditangkap di catch
    }
    // jika berhasil
    const data = await response.json();
    if (!data.conversationId) {
      throw new Error("ID percakapan tidak ditemukan");
    }
    window.location.href = `contact.html?conversationId=${data.conversationId}&username=${username}`;

  } catch (error) {
    console.error('Error:', error);
    alert(error.message.includes('User tidak valid')
      ? `Kontak tidak valid. Pastikan user ada di sistem.\n${error.message}`
      : `token sudah kadaluarsa: ${error.message}`
    );
    window.location.href = 'login.html?error=unauthorized'
  }
}
const pencarian = document.getElementById('pencarian')

pencarian.addEventListener('input', function() {
  const cari = this.value.toLowerCase();
  const filterdata = dataGlobal.filter(data =>
    data.name && data.name.toLowerCase().includes(cari)
  );
  listContact(filterdata);
});

// Muat daftar kontak saat halaman terbuka
loadAllChatList()
function listContact(combinedList) {
  const contactsList = document.getElementById('contacts-list');

  // Loading
  contactsList.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">Memuat kontak & grup...</p>
    </div>
  `;

  if (!combinedList || combinedList.length === 0) {
    contactsList.innerHTML = `
      <div class="empty-state text-center py-5">
        <i class="fas fa-user-friends fa-3x mb-3 text-muted"></i>
        <h5 class="text-muted">Tidak ada kontak/grup</h5>
        <p class="text-muted">Mulai obrolan dengan teman atau grup</p>
      </div>
    `;
    return;
  }

  // Clear & render
  contactsList.innerHTML = combinedList.map(item => {
    const time = item.lastTime ? formatDate(item.lastTime) : '';
    const lastMsg = item.lastMessage || 'Tidak ada pesan';

    if (item.type === 'user') {
      const status = item.status === 'online' ? 'online' : 'offline';
      const statusText = status === 'online' ? 'Online' : 'Offline';

      return `
        <div class="contact-card" data-user-id="${item.id}">
          <div class="contact-main">
            <div class="contact-avatar">${item.name.charAt(0).toUpperCase()}</div>
            <div class="contact-info">
              <div class="contact-header">
                <h5 class="contact-name">${item.name}</h5>
                <span class="message-time">${time}</span>
              </div>
              <div class="contact-status-row">
                <span class="status-indicator ${status}"></span>
                <span class="status-text">${statusText}</span>
              </div>
              <p class="last-message">${lastMsg}</p>
            </div>
          </div>
          <button class="btn btn-chat"
                  data-user-id="${item.id}"
                  onClick="startChat({
                    otherUserId: ${item.id},
                    username: '${item.name}',
                    status: '${item.status}'
                  })">
            <i class="fas fa-comment-dots"></i> Chat
          </button>
        </div>
      `;
    }

    // Grup
    if (item.type === 'group') {
      return `
        <div class="contact-card" data-group-id="${item.id}">
          <div class="contact-main">
            <div class="contact-avatar bg-primary text-white">
              ${item.name.charAt(0).toUpperCase()}
            </div>
            <div class="contact-info">
              <div class="contact-header">
                <h5 class="contact-name"><small class="nama-grup">Group:</small> ${item.name}</h5>
                <span class="message-time">${time}</span>
              </div>
              <p class="last-message">${item.sender || ''} : ${lastMsg}</p>
            </div>
          </div>
          <button class="btn btn-chat"
                  data-group-id="${item.id}"
                  data-group-name="${item.name}"
                  onClick="window.location.href='contact.html?grupId=${item.id}&username=${item.name}'">
            <i class="fas fa-comment-dots"></i> Chat
          </button>
        </div>
      `;
    }

    return '';
  }).join('');
}





const formGroup = document.getElementById('formGroup');
formGroup.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const nameInput = document.getElementById('name'); // Pastikan ID-nya ada di HTML
    const name = nameInput.value;

    // Validasi input
    if (!name.trim()) {
      showAlert('Nama grup tidak boleh kosong', 'danger');
      return;
    }

    const response = await fetch('http://localhost:3000/api/newGroup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json' // ✅ Penting!
      },
      body: JSON.stringify({ name: name })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    
    if (json.status === 'success') {
      showAlert('Grup berhasil dibuat', 'success');
      loadGroup()
      formGroup.reset();
    } else {
      showAlert(json.message || 'Grup gagal dibuat', 'danger'); // Tampilkan pesan error dari server
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Terjadi kesalahan saat membuat grup', 'danger');
  }
});

function formatDate(isoString) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const now = new Date();
  
  // Jika kurang dari 1 menit lalu
  const diffMinutes = Math.floor((now - date) / 60000);
  if (diffMinutes < 1) return 'Baru saja';
  
  // Jika hari ini
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Jika kemarin
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Kemarin';
  }
  
  // Format tanggal
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short'
  });
}

// bagian chatnya

// ============================
// Ambil conversationId dari URL
// ============================
const urlParams = new URLSearchParams(window.location.search);
const conversationId = urlParams.get('conversationId');
const lawanChat =urlParams.get('username');

const grupId = urlParams.get('grupId')

    



// if (!conversationId || isNaN(conversationId)) {
//   alert('Percakapan tidak valid!');
//   window.location.href = 'contacts.html';
// }

// ============================
// Fungsi: Kirim Pesan
// ============================

document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});

async function sendMessage() {
  const messageInput = document.getElementById('message-input');
  const fileInput = document.getElementById('file-input');
  const content = messageInput.value.trim();
  const file = fileInput.files[0];

  if (!content && !file) return; // Jangan kirim kalau tidak ada teks & file

  const formData = new FormData();
  formData.append('content', content);
  if (file) {
    formData.append('image', file);
  }

  if (grupId) {
    await sendMessageGrup(); // belum dibahas ya bagian grup ini
  } else if (conversationId) {
    try {
      const response = await fetch(`http://localhost:3000/api/${conversationId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}` // ✅ hanya ini
        },
        body: formData
      });

      if (response.ok) {
        messageInput.value = '';
        fileInput.value = ''; // reset input file
        loadMessages();
        loadAllChatList()
      } else {
        alert('Gagal mengirim pesan!');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
}



// ============================
// Fungsi: Ambil Pesan
// ============================
if (conversationId && !isNaN(conversationId)) {
  document.querySelector('.chat-container').style.display = 'block';
  loadMessages();

  // Hanya sembunyikan kontak jika di layar kecil (max-width: 768px)
  if (window.innerWidth <= 768) {
    document.getElementById('kontak').style.display = 'none';
  }

} else if (grupId && !isNaN(grupId)) {
  document.querySelector('.chat-container').style.display = 'block';
  loadMessagesGrup();

  if (window.innerWidth <= 768) {
    document.getElementById('kontak').style.display = 'none';
  }

} else {
  document.querySelector('.chat-container').style.display = 'none';
  document.getElementById('pesanBelumada').innerHTML = `
    <i class="bi bi-chat-dots"></i> <span>Silahkan pilih orang untuk chat</span>`;
}

function showContacts() {
  document.getElementById('kontak').style.display = 'block';
  document.querySelector('.chat-container').style.display = 'none';
}


async function loadMessages() {
  try {
    const response = await fetch(`http://localhost:3000/api/${conversationId}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      document.getElementById('messages').textContent = 'Gagal memuat pesan.';
      return;
    }

    const data = await response.json(); // Ambil data sekali saja
    const messages = data.messages || [];
    const lawanChat = data.lawanChat || {};

    const isipesan = document.getElementById('messages');
    const namachat = document.getElementById('chat-name');

    isipesan.innerHTML = '';

    // Tampilkan nama dan status lawan chat
    const statusnya = lawanChat.status === 'online' ? 'online' : 'offline';
    namachat.innerHTML = `
  <div class="chat-header">
    <strong>#${lawanChat.username || 'Lawan Chat'}</strong>
    <div class="contact-status">
      <span class="status-indicator ${statusnya}"></span>
      <span class="status-text">${statusnya}</span>
      ${statusnya !== 'online' && lawanChat.lastOnline ? `
        <span class="pesan">• terakhir online: ${new Date(lawanChat.lastOnline).toLocaleTimeString()}</span>
      ` : ''}
    </div>
  </div>
`;


    // Tampilkan pesan satu per satu
    messages.forEach(p => {
      const isSent = p.sender.id === currentUserId;
      const kelas = isSent ? 'message sent' : 'message received';
      const username = p.sender.username || 'Anonim';
    
      // Tambahkan tombol hapus hanya jika pesan milik user
      const tombolHapus = isSent ? `
        <button class="btn btn-sm btn-outline-danger" onclick="deleteMessage(${p.messageId})"  title="Hapus Pesan">
    <i class="bi bi-trash"></i>
  </button>
      ` : '';
      const tombolEdit = isSent ? `
      <button class="btn btn-sm btn-outline-primary" onclick="editMessage(${p.messageId})"  title="Edit Pesan">

        <i class="bi bi-pencil"></i>
      </button>
    ` : '';
    
    
      const pesan = `
        <div class="${kelas}">
          <p>
            <strong>${username}:</strong> ${renderContent(p.content)}

            ${tombolEdit}
            ${tombolHapus}
          </p>
          <div class="message-time">${new Date(p.timestamp).toLocaleTimeString()}</div>
        </div>
      `;
    
      isipesan.innerHTML += pesan;
    });
    

    isipesan.scrollTop = isipesan.scrollHeight;

  } catch (error) {
    console.error('Gagal memuat pesan:', error);
    if (error.message.includes('401')) {
      window.location.href = 'login.html';
    }
  }


}

function renderContent(content) {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

  try {
    const url = new URL(content);
    const isImage = imageExtensions.some(ext => url.pathname.endsWith(ext));
    if (isImage) {
      return `<img src="${url.href}" alt="image" class="chat-image" style="max-width: 200px; max-height: 200px; border-radius: 8px;">`;
    }
  } catch (e) {
    // bukan URL, biarkan sebagai teks biasa
  }

  // jika bukan gambar, tampilkan teks biasa (dengan sanitasi dasar)
  return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function loadMessagesGrup() {
  try {
    const response = await fetch(`http://localhost:3000/api/grup/${grupId}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      // const errorData = await response.json();
      // const errorMsg = errorData.details
      //   ? `User tidak valid. Detail: ${JSON.stringify(errorData.details)}`
      //   : errorData.error || 'Gagal memulai chat';
        
      // throw new Error(errorMsg);
      window.location.href = 'login.html?error=unauthorized'
    }

    const messages = await response.json();
    const isipesan = document.getElementById('messages');
    const namachat =document.getElementById('chat-name')    


    isipesan.innerHTML = '';

    messages.map(p => {
      const statusnya =p.sender.stat
      const statusnyasatu = statusnya === 'online' ? 'online' : 'offline';
      const statusnyaText =statusnyasatu === 'online' ? 'online' : 'offline';
      namachat.innerHTML=`#${lawanChat} <div class="contact-status">
            <span class="status-indicator ${statusnyasatu}"></span>
            ${statusnyaText}
          </div>`;
      const isSent = p.sender.id === currentUserId; // pastikan currentUserId sudah betul
      const kelas = isSent ? 'message sent' : 'message received';
      const username = p.sender.username || 'Anonim';
      const tombolEdit = isSent ? `
      <button class="btn btn-sm btn-outline-primary" onclick="editMessageGrup(${p.messageId})"  title="Edit Pesan">

        <i class="bi bi-pencil"></i>
      </button>
    ` : '';
      const tombolHapus = isSent ? `
        <button class="btn btn-sm btn-outline-danger" onclick="deleteMessageGrup(${p.messageId})"  title="Hapus Pesan">
    <i class="bi bi-trash"></i>
  </button>
      ` : '';
      const pesan = `
        <div class="${kelas}">
          <p><strong>${username}:</strong> ${renderContent(p.content)} ${tombolEdit} ${tombolHapus}</p>
          <div class="message-time">${new Date(p.timestamp).toLocaleTimeString()}</div>
        </div>
      `;
      isipesan.innerHTML += pesan;
      isipesan.scrollTop = isipesan.scrollHeight;

    });
    
  } catch (error) {
    console.error('Gagal memuat pesan:', error);
    if (error.message.includes('401')) {
      window.location.href = 'login.html';
    }
  }
}
// ============================
// Fungsi: Delete Pesan
// ============================
async function deleteMessage(messageId) {
  
  const konfirmasi = confirm('Yakin ingin menghapus pesan ini?');

  if (!konfirmasi) return; // Kalau user batal, jangan lanjut

  try {
    const response = await fetch(`http://localhost:3000/api/hapuspesan/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      loadMessages(); // Refresh ulang chat
      loadAllChatList();
    } else {
      alert('Gagal menghapus pesan!');
    }
  } catch (err) {
    console.error('Error:', err);
    alert('Gagal menghapus pesan. Silakan coba lagi.');
  }
}
async function deleteMessageGrup(messageId) {
  
  const konfirmasi = confirm('Yakin ingin menghapus pesan ini?');

  if (!konfirmasi) return; // Kalau user batal, jangan lanjut

  try {
    const response = await fetch(`http://localhost:3000/api/delete/grup/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    result = await response.json()
    if (response.ok) {
      loadMessagesGrup(); // Refresh ulang chat
      loadAllChatList();
      showAlert(` ${result.message}`)
    } else {
      showAlert(`Gagal menghapus pesan! ${result.message}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    alert(`Gagal menghapus pesan. Silakan coba lagi. ${err.message}`);
  }
}
async function editMessage(messageId) {
  try {
    // Ambil pesan lama
    const resGet = await fetch(`http://localhost:3000/api/editpesan/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await resGet.json();
    const pesanLama = data;
    const pesanBaru = prompt( 'Ubah pesan:', pesanLama);

    if (!pesanBaru) {
      alert('Pesan tidak boleh kosong!');
      return;
    }

    // Kirim update ke server
    const resUpdate = await fetch(`http://localhost:3000/api/updatepesan/${messageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: pesanBaru })
    });

    if (resUpdate.ok) {
      showAlert('berhasil mengedit pesan')
      loadMessages(); // Refresh chat
      loadAllChatList();
    } else {
      alert('Gagal mengedit pesan!');
    }

  } catch (error) {
    console.error('Gagal mengedit pesan:', error);
    alert('Terjadi kesalahan saat mengedit pesan.');
  }
}
async function editMessage(messageId) {
  try {
    // Ambil pesan lama
    const resGet = await fetch(`http://localhost:3000/api/editpesan/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await resGet.json();
    const pesanLama = data;
    const pesanBaru = prompt( 'Ubah pesan:', pesanLama);

    if (!pesanBaru) {
      alert('Pesan tidak boleh kosong!');
      return;
    }

    // Kirim update ke server
    const resUpdate = await fetch(`http://localhost:3000/api/updatepesan/${messageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: pesanBaru })
    });

    if (resUpdate.ok) {
      showAlert('berhasil mengedit pesan')
      loadMessages(); // Refresh chat
      loadAllChatList();
    } else {
      alert('Gagal mengedit pesan!');
    }

  } catch (error) {
    console.error('Gagal mengedit pesan:', error);
    alert('Terjadi kesalahan saat mengedit pesan.');
  }
}
async function editMessageGrup(messageId) {
  try {
    // Ambil pesan lama
    const resGet = await fetch(`http://localhost:3000/api/editpesangrup/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await resGet.json();
    const pesanLama = data;
    const pesanBaru = prompt( 'Ubah pesan:', pesanLama);

    if (!pesanBaru) {
      alert('Pesan tidak boleh kosong!');
      return;
    }

    // Kirim update ke server
    const resUpdate = await fetch(`http://localhost:3000/api/updatepesangrup/${messageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: pesanBaru })
    });

    if (resUpdate.ok) {
      console.log('berhasil mengedit pesan')
      loadMessagesGrup(); // Refresh chat
      loadAllChatList();
    } else {
      alert('Gagal mengedit pesan!');
    }

  } catch (error) {
    console.error('Gagal mengedit pesan:', error);
    alert('Terjadi kesalahan saat mengedit pesan.');
  }
}


// ============================
// Fungsi: Decode Token JWT
// ============================
function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId;
  } catch (err) {
    console.error('Gagal decode token:', err);
    return null;
  }
}

// untuk grup





async function sendMessageGrup() {
  const messageInput = document.getElementById('message-input');
  const content = messageInput.value.trim();
  const file = document.getElementById('file-input').files[0];
  if (!content && !file) return;
  const formData = new FormData();
  formData.append('content', content);
  if (file) {
  formData.append('image', file);
}

  try {
    const response = await fetch(`http://localhost:3000/api/grup/${grupId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (response.ok) {
      messageInput.value = '';
      loadMessagesGrup();
      loadAllChatList();
      console.log(`berhasil mengirim pesan`)
    } else {
      showAlert(`Gagal mengirim pesan!`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    showAlert(`Gagal mengirim pesan. Silakan coba lagi. ${error.message}`);
  }
}