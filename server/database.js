const mongoose = require('mongoose');

async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('❌ MONGODB_URI が設定されていません');
      console.log('💡 .env ファイルに MONGODB_URI を設定してください');
      process.exit(1);
    }

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ MongoDB接続成功');
    console.log(`📦 データベース: ${mongoose.connection.name}`);
    
    // 接続エラーハンドリング
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB接続エラー:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDBから切断されました');
    });

  } catch (error) {
    console.error('❌ MongoDB接続失敗:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
