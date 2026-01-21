const jwt = require('jsonwebtoken');

exports.authenticate = (req, res, next) => {
  // 1. Ambil token dari header atau cookie
  const token = req.header('Authorization')?.replace('Bearer ', '') || 
                (req.cookies ? req.cookies.token : null);

  if (!token) {
    return res.status(401).json({ 
      error: 'Akses ditolak. Token tidak ditemukan.' 
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET not configured');
    return res.status(500).send('<script>alert("Server error"); window.location="/"</script>');
  }

  try {
    // 2. Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Attach user ke request
    req.user = {
      userId: decoded.userId, // ⬅️ INI SUDAH BENAR KALAU TOKEN MENGANDUNG `userId`
      role: decoded.role
    };

    
    // 4. Lanjut ke controller
    next();

  } catch (error) {
    // 5. Handle error spesifik
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).clearCookie('token').render('login', {
        error: 'Sesi expired. Silakan login kembali'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).clearCookie('token').json({ 
        error: 'Token tidak valid' 
      });
    }

    console.error('Auth error:', error);
    res.status(500).send('Terjadi kesalahan server');
  }
};