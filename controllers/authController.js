const User = require('../models/users');

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await User.createUser(username, email, password);
    res.status(201).json({ message: 'User created', userId: user.user_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const token = await User.login(email, password);
    res.json({ token });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};