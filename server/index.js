require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./database');

// モデル読み込み
const User = require('./models/User');
const Session = require('./models/Session');
const Party = require('./models/Party');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());

// MongoDB接続
connectDB();

// ===== 認証API =====

// アカウント作成
app.post('/api/auth/register', async (req, res) => {
  const { nickname, password, fingerprint } = req.body;

  if (!nickname || !password || !fingerprint) {
    return res.status(400).json({ error: 'すべてのフィールドを入力してください' });
  }

  try {
    // ニックネーム重複チェック
    const existingNickname = await User.findOne({ nickname });
    if (existingNickname) {
      return res.status(409).json({ error: 'このニックネームは既に使用されています' });
    }

    // フィンガープリント重複チェック
    const existingFingerprint = await User.findOne({ fingerprint });
    if (existingFingerprint) {
      return res.status(403).json({ error: 'この端末からは既にアカウントが作成されています' });
    }

    // ユーザー作成
    const newUser = new User({
      uid: uuidv4(),
      nickname,
      password, // 本番環境ではハッシュ化必須
      fingerprint,
      icon: ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫'][Math.floor(Math.random() * 8)]
    });

    await newUser.save();

    // セッショントークン生成
    const sessionToken = uuidv4();
    const newSession = new Session({
      sessionToken,
      uid: newUser.uid
    });
    await newSession.save();

    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        uid: newUser.uid,
        nickname: newUser.nickname,
        icon: newUser.icon
      },
      sessionToken
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ログイン
app.post('/api/auth/login', async (req, res) => {
  const { nickname, password, fingerprint } = req.body;

  if (!nickname || !password) {
    return res.status(400).json({ error: 'ニックネームとパスワードを入力してください' });
  }

  try {
    const user = await User.findOne({ nickname, password });

    if (!user) {
      return res.status(401).json({ error: 'ニックネームまたはパスワードが間違っています' });
    }

    // フィンガープリントチェック
    if (user.fingerprint !== fingerprint) {
      return res.status(403).json({ error: '異なる端末からのログインは許可されていません' });
    }

    // 最終ログイン更新
    user.lastLogin = Date.now();
    await user.save();

    // セッショントークン生成
    const sessionToken = uuidv4();
    const newSession = new Session({
      sessionToken,
      uid: user.uid
    });
    await newSession.save();

    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        uid: user.uid,
        nickname: user.nickname,
        icon: user.icon
      },
      sessionToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// セッション検証
app.get('/api/auth/verify', async (req, res) => {
  const sessionToken = req.cookies.sessionToken || req.headers.authorization?.replace('Bearer ', '');

  if (!sessionToken) {
    return res.status(401).json({ error: 'セッションが見つかりません' });
  }

  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '無効なセッションです' });
    }

    const user = await User.findOne({ uid: session.uid });
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    res.json({
      success: true,
      user: {
        uid: user.uid,
        nickname: user.nickname,
        icon: user.icon
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ログアウト
app.post('/api/auth/logout', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  if (sessionToken) {
    try {
      await Session.deleteOne({ sessionToken });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  res.clearCookie('sessionToken');
  res.json({ success: true });
});

// ===== ユーザーAPI =====

// プロフィール更新
app.put('/api/user/profile', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const user = await User.findOne({ uid: session.uid });
    const { nickname, icon } = req.body;

    if (nickname && nickname !== user.nickname) {
      const existingNickname = await User.findOne({ nickname });
      if (existingNickname) {
        return res.status(409).json({ error: 'このニックネームは既に使用されています' });
      }
      user.nickname = nickname;
    }

    if (icon) {
      user.icon = icon;
    }

    await user.save();

    res.json({
      success: true,
      user: {
        uid: user.uid,
        nickname: user.nickname,
        icon: user.icon
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== フレンド機能API =====

// フレンド申請送信
app.post('/api/friends/request', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const { searchQuery } = req.body;
    
    const targetUser = await User.findOne({
      $or: [{ uid: searchQuery }, { nickname: searchQuery }]
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    if (targetUser.uid === session.uid) {
      return res.status(400).json({ error: '自分自身にフレンド申請はできません' });
    }

    const fromUser = await User.findOne({ uid: session.uid });

    // 既にフレンドかチェック
    if (fromUser.friends.includes(targetUser.uid)) {
      return res.status(400).json({ error: '既にフレンドです' });
    }

    // 既に申請済みかチェック
    if (fromUser.friendRequestsSent.includes(targetUser.uid)) {
      return res.status(400).json({ error: '既にフレンド申請を送信済みです' });
    }

    // フレンド申請を記録
    fromUser.friendRequestsSent.push(targetUser.uid);
    targetUser.friendRequestsReceived.push(fromUser.uid);
    
    await fromUser.save();
    await targetUser.save();

    // リアルタイム通知
    io.emit('friendRequestReceived', {
      fromUid: fromUser.uid,
      fromNickname: fromUser.nickname,
      toUid: targetUser.uid
    });

    res.json({ success: true, message: 'フレンド申請を送信しました' });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// フレンド申請一覧取得
app.get('/api/friends/requests/received', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const user = await User.findOne({ uid: session.uid });
    const requests = await User.find({ uid: { $in: user.friendRequestsReceived } });

    res.json({
      requests: requests.map(u => ({
        fromUid: u.uid,
        nickname: u.nickname,
        icon: u.icon
      }))
    });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// フレンド申請承認/拒否
app.post('/api/friends/respond', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const { fromUid, accept } = req.body;
    
    const user = await User.findOne({ uid: session.uid });
    const fromUser = await User.findOne({ uid: fromUid });

    // 申請を削除
    user.friendRequestsReceived = user.friendRequestsReceived.filter(uid => uid !== fromUid);
    fromUser.friendRequestsSent = fromUser.friendRequestsSent.filter(uid => uid !== session.uid);

    if (accept) {
      // フレンドリストに追加（双方向）
      user.friends.push(fromUid);
      fromUser.friends.push(session.uid);

      // 相手に通知
      io.emit('friendRequestAccepted', {
        fromUid: session.uid,
        toUid: fromUid
      });
    }

    await user.save();
    await fromUser.save();

    res.json({
      success: true,
      message: accept ? 'フレンド申請を承認しました' : 'フレンド申請を拒否しました'
    });
  } catch (error) {
    console.error('Friend respond error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// フレンドリスト取得
app.get('/api/friends/list', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const user = await User.findOne({ uid: session.uid });
    const friends = await User.find({ uid: { $in: user.friends } });

    res.json({
      friends: friends.map(f => ({
        uid: f.uid,
        nickname: f.nickname,
        icon: f.icon,
        online: false
      }))
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== グループ機能API =====

// グループ招待
app.post('/api/party/invite', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const { targetUid } = req.body;

    // パーティーを探す or 作成
    let party = await Party.findOne({ members: session.uid });

    if (!party) {
      party = new Party({
        partyId: uuidv4(),
        leaderId: session.uid,
        members: [session.uid],
        invites: []
      });
    }

    if (!party.invites.includes(targetUid)) {
      party.invites.push(targetUid);
    }

    await party.save();

    const user = await User.findOne({ uid: session.uid });

    // 相手に通知
    io.emit('partyInviteReceived', {
      partyId: party.partyId,
      fromUid: session.uid,
      fromNickname: user.nickname,
      toUid: targetUid
    });

    res.json({ success: true, partyId: party.partyId });
  } catch (error) {
    console.error('Party invite error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// グループ参加
app.post('/api/party/join', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const { partyId } = req.body;
    const party = await Party.findOne({ partyId });

    if (!party) {
      return res.status(404).json({ error: 'グループが見つかりません' });
    }

    if (!party.invites.includes(session.uid)) {
      return res.status(403).json({ error: '招待されていません' });
    }

    party.members.push(session.uid);
    party.invites = party.invites.filter(uid => uid !== session.uid);
    await party.save();

    const user = await User.findOne({ uid: session.uid });

    // パーティーメンバーに通知
    io.emit('partyMemberJoined', {
      partyId,
      uid: session.uid,
      nickname: user.nickname
    });

    const members = await User.find({ uid: { $in: party.members } });

    res.json({
      success: true,
      party: {
        id: party.partyId,
        leaderId: party.leaderId,
        members: members.map(m => ({
          uid: m.uid,
          nickname: m.nickname,
          icon: m.icon
        }))
      }
    });
  } catch (error) {
    console.error('Party join error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// グループ退出
app.post('/api/party/leave', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const party = await Party.findOne({ members: session.uid });

    if (!party) {
      return res.status(404).json({ error: 'グループに参加していません' });
    }

    party.members = party.members.filter(uid => uid !== session.uid);

    if (party.members.length === 0) {
      await Party.deleteOne({ partyId: party.partyId });
    } else {
      if (party.leaderId === session.uid) {
        party.leaderId = party.members[0];
      }
      await party.save();
    }

    io.emit('partyMemberLeft', {
      partyId: party.partyId,
      uid: session.uid
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Party leave error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// グループ情報取得
app.get('/api/party/info', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  try {
    const session = await Session.findOne({ sessionToken });
    if (!session) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const party = await Party.findOne({ members: session.uid });

    if (!party) {
      return res.json({ party: null });
    }

    const members = await User.find({ uid: { $in: party.members } });

    res.json({
      party: {
        id: party.partyId,
        leaderId: party.leaderId,
        members: members.map(m => ({
          uid: m.uid,
          nickname: m.nickname,
          icon: m.icon
        }))
      }
    });
  } catch (error) {
    console.error('Party info error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ===== Socket.io イベント処理 =====

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', async (data) => {
    const { sessionToken } = data;
    
    try {
      const session = await Session.findOne({ sessionToken });
      if (session) {
        connectedUsers.set(socket.id, session.uid);
        socket.emit('authenticated', { uid: session.uid });
        
        const user = await User.findOne({ uid: session.uid });
        if (user) {
          user.friends.forEach(friendUid => {
            io.emit('friendOnline', { uid: session.uid, friendUid });
          });
        }
      }
    } catch (error) {
      console.error('Socket authenticate error:', error);
    }
  });

  socket.on('disconnect', async () => {
    const uid = connectedUsers.get(socket.id);
    if (uid) {
      connectedUsers.delete(socket.id);
      
      try {
        const user = await User.findOne({ uid });
        if (user) {
          user.friends.forEach(friendUid => {
            io.emit('friendOffline', { uid, friendUid });
          });
        }
      } catch (error) {
        console.error('Socket disconnect error:', error);
      }
    }
    console.log('User disconnected:', socket.id);
  });

  // セッション検索（簡易版）
  socket.on('joinMatchmaking', (data) => {
    const uid = connectedUsers.get(socket.id);
    if (!uid) return;

    // TODO: マッチメイキングロジック実装
    console.log('User joined matchmaking:', uid);
  });

  socket.on('leaveMatchmaking', () => {
    const uid = connectedUsers.get(socket.id);
    if (!uid) return;

    console.log('User left matchmaking:', uid);
  });
});

// ===== サーバー起動 =====

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Database: MongoDB (永続化)`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
