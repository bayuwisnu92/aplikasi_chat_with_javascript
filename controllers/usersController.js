const User = require('../models/users');

class UsersController {
    static async getAllUsers(req, res) {
  try {
    const currentUserId = req.user.userId; // dari token login
    const users = await User.getAllUsers(currentUserId); // ini sudah exclude diri sendiri dari SQL

    res.json(users);
  } catch (error) {
    console.error('Error saat mengambil data user:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
}

static async updateProfile(req,res){
    try{
        const id = req.user.userId
        const { imageProfile } = req.body 
         await User.updateProfile(id,imageProfile)
        res.status(200).json({message:'berhasil di update'})
    }
    catch(error){
        console.error('terjagagal mengupdate gambar profile',error)
    
    }
}


    static async getUserById(req, res) {
    try {
        const userId = req.params.id; 
        const user = await User.getUserById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }
        
        res.json(user); // Kirim data user jika sukses
    } catch (error) {
        console.error('Error saat mengambil data user:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
}
static async createUser(req, res) {
    try {
        const userData = req.body;
        const userId = await User.createUser(userData);
        res.status(201).json({ 
            message: 'User berhasil ditambahkan.', 
            userId 
        });  
    } catch (error) {
        console.error('Error saat menambahkan user:', error);
        res.status(500).json({ 
            message: 'Gagal menambahkan user.', 
            error: error.message 
        });
    }
}

static async getContacts(req, res) {
  try {
    const currentUserId = req.user.userId;

    const contacts = await User.getContacts(currentUserId);

    res.json(contacts);
  } catch (error) {
    console.error('Error getContacts:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil kontak'
    });
  }
};

static async searchUsers(req, res) {

  try {

    const keyword = req.query.q;
    const currentUserId = req.user.userId;

    const users = await User.searchUsers(keyword, currentUserId);

    res.json(users);

  } catch (error) {

    console.error("Search user error:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mencari user"
    });

  }

}

}

module.exports = UsersController;
