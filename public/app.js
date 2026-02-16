// グローバル変数
let socket = null;
let currentUser = null;
let fingerprint = null;
let currentParty = null;
let inQueue = false;
let pendingPartyInvite = null;

// ===== キーボードショートカット（最優先で登録） =====
document.addEventListener('keydown', (e) => {
  console.log('⌨️ キー:', e.key, 'Ctrl:', e.ctrlKey, 'Code:', e.code);
  
  // Ctrl+1
  if (e.ctrlKey && (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1')) {
    e.preventDefault();
    console.log('✅ Ctrl+1 検出 - サイト切り替え');
    toggleSite();
    return;
  }
  
  // Ctrl+Q
  if (e.ctrlKey && (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ')) {
    e.preventDefault();
    console.log('✅ Ctrl+Q 検出 - サイト切り替え');
    toggleSite();
    return;
  }
});

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 DOMContentLoaded - アプリケーション初期化開始');
  
  // フィンガープリント生成
  const fp = new BrowserFingerprint();
  fingerprint = await fp.generate();
  console.log('🔒 Fingerprint:', fingerprint);
  
  // localStorageに保存
  localStorage.setItem('fingerprint', fingerprint);
  
  // 秘密ボタンのクリックイベント（デバッグ用）
  setTimeout(() => {
    const secretBtn = document.getElementById('secret-toggle-btn');
    if (secretBtn) {
      console.log('🔘 秘密ボタン発見');
      secretBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔘 秘密ボタンクリック');
        toggleSite();
      });
    }
  }, 100);
  
  // セッション確認
  await checkSession();
  
  // イベントリスナー設定
  setupEventListeners();
  
  console.log('✅ アプリケーション初期化完了');
  console.log('💡 Ctrl+Q または Ctrl+1 で裏サイトに切り替えられます');
});

// ===== サイト切り替え =====
function toggleSite() {
  const frontSite = document.getElementById('front-site');
  const backSite = document.getElementById('back-site');
  
  console.log('🔄 サイト切り替え実行');
  console.log('表サイト:', frontSite ? '存在' : '見つからない');
  console.log('裏サイト:', backSite ? '存在' : '見つからない');
  
  frontSite.classList.toggle('active');
  backSite.classList.toggle('active');
  
  console.log('表サイト active:', frontSite.classList.contains('active'));
  console.log('裏サイト active:', backSite.classList.contains('active'));
  
  if (backSite.classList.contains('active')) {
    checkSession();
  }
}

// ===== ヒント表示 =====
function showHint() {
  const hint = document.createElement('div');
  hint.className = 'secret-hint';
  hint.innerHTML = `
    <div class="hint-content">
      <p>💡 <strong>隠しコマンド</strong></p>
      <p><kbd>Ctrl</kbd> + <kbd>1</kbd> または <kbd>Ctrl</kbd> + <kbd>Q</kbd></p>
      <p>を押してみてください...</p>
    </div>
  `;
  document.body.appendChild(hint);
  
  setTimeout(() => hint.classList.add('show'), 100);
  
  setTimeout(() => {
    hint.classList.remove('show');
    setTimeout(() => hint.remove(), 500);
  }, 5000);
}

// ===== セッション確認 =====
async function checkSession() {
  try {
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
      showAuthScreen();
      return;
    }
    
    const response = await fetch('/api/auth/verify', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      initializeSocket(sessionToken);
      showLobbyScreen();
    } else {
      localStorage.removeItem('sessionToken');
      showAuthScreen();
    }
  } catch (error) {
    console.error('Session check error:', error);
    showAuthScreen();
  }
}

// ===== 画面表示切り替え =====
function showAuthScreen() {
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('lobby-screen').classList.remove('active');
}

function showLobbyScreen() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('lobby-screen').classList.add('active');
  
  // ユーザー情報表示
  document.getElementById('user-icon').textContent = currentUser.icon;
  document.getElementById('user-nickname').textContent = currentUser.nickname;
  
  // フレンドリスト読み込み
  loadFriends();
  loadPartyInfo();
}

// ===== イベントリスナー設定 =====
function setupEventListeners() {
  console.log('🔧 イベントリスナーを設定中...');
  
  // 認証タブ切り替え
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetTab = e.target.dataset.tab;
      console.log('🔄 タブ切り替え:', targetTab);
      
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      
      e.target.classList.add('active');
      const targetForm = document.getElementById(`${targetTab}-form`);
      if (targetForm) {
        targetForm.classList.add('active');
        console.log('✅ フォーム切り替え成功:', targetTab);
      } else {
        console.error('❌ フォームが見つかりません:', `${targetTab}-form`);
      }
    });
  });
  
  // ログインフォーム
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('login-nickname').value;
    const password = document.getElementById('login-password').value;
    await login(nickname, password);
  });
  
  // 登録フォーム
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('register-nickname').value;
    const password = document.getElementById('register-password').value;
    await register(nickname, password);
  });
  
  // 設定ボタン
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('active');
    loadReceivedFriendRequests();
  });
  
  document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('active');
  });
  
  // 設定タブ
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetTab = e.target.dataset.tab;
      
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
      
      e.target.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
      
      if (targetTab === 'profile') {
        document.getElementById('profile-uid').value = currentUser.uid;
        document.getElementById('profile-nickname').value = currentUser.nickname;
      } else if (targetTab === 'friend-received') {
        loadReceivedFriendRequests();
      }
    });
  });
  
  // プロフィール保存
  document.getElementById('save-profile-btn').addEventListener('click', saveProfile);
  
  // UID コピー
  document.getElementById('copy-uid-btn').addEventListener('click', () => {
    const uid = document.getElementById('profile-uid').value;
    navigator.clipboard.writeText(uid);
    showNotification('UIDをコピーしました');
  });
  
  // アイコン選択
  document.querySelectorAll('.icon-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
      e.target.classList.add('selected');
      currentUser.icon = e.target.dataset.icon;
    });
  });
  
  // ログアウト
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // フレンド検索
  document.getElementById('friend-search-btn').addEventListener('click', sendFriendRequest);
  
  // マッチメイキング
  document.getElementById('solo-queue-btn').addEventListener('click', joinSoloQueue);
  document.getElementById('party-queue-btn').addEventListener('click', joinPartyQueue);
  document.getElementById('party-leave-btn').addEventListener('click', leaveParty);
}

// ===== 認証機能 =====
async function register(nickname, password) {
  console.log('📝 アカウント作成開始:', nickname);
  console.log('   Fingerprint:', fingerprint);
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password, fingerprint })
    });
    
    console.log('   サーバー応答ステータス:', response.status);
    const data = await response.json();
    console.log('   サーバー応答データ:', data);
    
    if (response.ok) {
      localStorage.setItem('sessionToken', data.sessionToken);
      currentUser = data.user;
      console.log('✅ アカウント作成成功:', currentUser);
      initializeSocket(data.sessionToken);
      showLobbyScreen();
    } else {
      console.error('❌ アカウント作成失敗:', data.error);
      document.getElementById('register-error').textContent = data.error;
    }
  } catch (error) {
    console.error('❌ アカウント作成エラー:', error);
    document.getElementById('register-error').textContent = 'サーバーに接続できません。サーバーが起動していますか？';
  }
}

async function login(nickname, password) {
  console.log('🔑 ログイン開始:', nickname);
  console.log('   Fingerprint:', fingerprint);
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password, fingerprint })
    });
    
    console.log('   サーバー応答ステータス:', response.status);
    const data = await response.json();
    console.log('   サーバー応答データ:', data);
    
    if (response.ok) {
      localStorage.setItem('sessionToken', data.sessionToken);
      currentUser = data.user;
      console.log('✅ ログイン成功:', currentUser);
      initializeSocket(data.sessionToken);
      showLobbyScreen();
    } else {
      console.error('❌ ログイン失敗:', data.error);
      document.getElementById('login-error').textContent = data.error;
    }
  } catch (error) {
    console.error('❌ ログインエラー:', error);
    document.getElementById('login-error').textContent = 'サーバーに接続できません。サーバーが起動していますか？';
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('sessionToken');
    currentUser = null;
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    showAuthScreen();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ===== Socket.io 初期化 =====
function initializeSocket(sessionToken) {
  // Socket.ioが利用可能かチェック
  if (typeof io === 'undefined') {
    console.warn('⚠️ Socket.io not loaded yet. Will retry when available.');
    setTimeout(() => initializeSocket(sessionToken), 1000);
    return;
  }
  
  socket = io();
  
  socket.on('connect', () => {
    console.log('✅ Connected to server');
    socket.emit('authenticate', { sessionToken });
  });
  
  socket.on('authenticated', (data) => {
    console.log('✅ Authenticated:', data);
  });
  
  socket.on('friendRequestReceived', (data) => {
    if (data.toUid === currentUser.uid) {
      showNotification(`${data.fromNickname} からフレンド申請が届きました`);
      loadReceivedFriendRequests();
    }
  });
  
  socket.on('friendRequestAccepted', (data) => {
    if (data.toUid === currentUser.uid) {
      showNotification('フレンド申請が承認されました!');
      loadFriends();
    }
  });
  
  socket.on('partyInviteReceived', (data) => {
    if (data.toUid === currentUser.uid) {
      pendingPartyInvite = data;
      showPartyInviteNotification(data);
    }
  });
  
  socket.on('partyMemberJoined', (data) => {
    if (currentParty && currentParty.id === data.partyId) {
      loadPartyInfo();
    }
  });
  
  socket.on('partyMemberLeft', (data) => {
    if (currentParty && currentParty.id === data.partyId) {
      loadPartyInfo();
    }
  });
  
  socket.on('matchFound', (data) => {
    inQueue = false;
    showNotification(`セッション相手が見つかりました: ${data.opponent}`);
    // TODO: セッション画面へ遷移
    document.getElementById('solo-queue-status').textContent = '';
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
  });
}

// ===== プロフィール機能 =====
async function saveProfile() {
  try {
    const nickname = document.getElementById('profile-nickname').value;
    const icon = currentUser.icon;
    
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ nickname, icon })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentUser = data.user;
      document.getElementById('user-icon').textContent = currentUser.icon;
      document.getElementById('user-nickname').textContent = currentUser.nickname;
      showNotification('プロフィールを更新しました');
    } else {
      showNotification(data.error, 'error');
    }
  } catch (error) {
    showNotification('エラーが発生しました', 'error');
  }
}

// ===== フレンド機能 =====
async function loadFriends() {
  try {
    const response = await fetch('/api/friends/list', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    });
    
    const data = await response.json();
    const friendsList = document.getElementById('friends-list');
    
    if (data.friends.length === 0) {
      friendsList.innerHTML = '<p class="empty-message">フレンドがいません</p>';
      return;
    }
    
    friendsList.innerHTML = data.friends.map(friend => `
      <div class="friend-item">
        <span class="friend-icon">${friend.icon}</span>
        <span class="friend-nickname">${friend.nickname}</span>
        <button class="btn-secondary btn-small invite-friend-btn" data-uid="${friend.uid}">招待</button>
      </div>
    `).join('');
    
    // 招待ボタンのイベントリスナー
    document.querySelectorAll('.invite-friend-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetUid = e.target.dataset.uid;
        inviteFriend(targetUid);
      });
    });
  } catch (error) {
    console.error('Load friends error:', error);
  }
}

async function sendFriendRequest() {
  try {
    const searchQuery = document.getElementById('friend-search-input').value.trim();
    
    if (!searchQuery) {
      showNotification('ニックネーム または UID を入力してください', 'error');
      return;
    }
    
    const response = await fetch('/api/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ searchQuery })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification(data.message);
      document.getElementById('friend-search-input').value = '';
    } else {
      showNotification(data.error, 'error');
    }
  } catch (error) {
    showNotification('エラーが発生しました', 'error');
  }
}

async function loadReceivedFriendRequests() {
  try {
    const response = await fetch('/api/friends/requests/received', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    });
    
    const data = await response.json();
    const requestsList = document.getElementById('friend-requests-list');
    
    if (data.requests.length === 0) {
      requestsList.innerHTML = '<p class="empty-message">受信した申請はありません</p>';
      return;
    }
    
    requestsList.innerHTML = data.requests.map(request => `
      <div class="friend-request-item">
        <span class="friend-icon">${request.icon}</span>
        <span class="friend-nickname">${request.nickname}</span>
        <button class="btn-primary btn-small accept-request-btn" data-uid="${request.fromUid}">承認</button>
        <button class="btn-danger btn-small decline-request-btn" data-uid="${request.fromUid}">拒否</button>
      </div>
    `).join('');
    
    // 承認/拒否ボタンのイベントリスナー
    document.querySelectorAll('.accept-request-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        respondToFriendRequest(e.target.dataset.uid, true);
      });
    });
    
    document.querySelectorAll('.decline-request-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        respondToFriendRequest(e.target.dataset.uid, false);
      });
    });
  } catch (error) {
    console.error('Load friend requests error:', error);
  }
}

async function respondToFriendRequest(fromUid, accept) {
  try {
    const response = await fetch('/api/friends/respond', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ fromUid, accept })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification(data.message);
      loadReceivedFriendRequests();
      if (accept) {
        loadFriends();
      }
    } else {
      showNotification(data.error, 'error');
    }
  } catch (error) {
    showNotification('エラーが発生しました', 'error');
  }
}

// ===== パーティー機能 =====
async function inviteFriend(targetUid) {
  try {
    const response = await fetch('/api/party/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ targetUid })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showNotification('グループ招待を送信しました');
      await loadPartyInfo();
    } else {
      showNotification(data.error, 'error');
    }
  } catch (error) {
    showNotification('エラーが発生しました', 'error');
  }
}

async function loadPartyInfo() {
  try {
    const response = await fetch('/api/party/info', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    });
    
    const data = await response.json();
    currentParty = data.party;
    
    if (currentParty) {
      // グループモードに切り替え
      document.getElementById('solo-matchmaking').classList.remove('active');
      document.getElementById('party-matchmaking').classList.add('active');
      
      // メンバー表示
      const membersHtml = currentParty.members.map(member => `
        <div class="party-member">
          <span class="member-icon">${member.icon}</span>
          <span class="member-nickname">${member.nickname}</span>
          ${member.uid === currentParty.leaderId ? '<span class="leader-badge">👑</span>' : ''}
        </div>
      `).join('');
      
      document.getElementById('party-members').innerHTML = membersHtml;
    } else {
      // ソロモードに切り替え
      document.getElementById('solo-matchmaking').classList.add('active');
      document.getElementById('party-matchmaking').classList.remove('active');
    }
  } catch (error) {
    console.error('Load party info error:', error);
  }
}

async function leaveParty() {
  try {
    const response = await fetch('/api/party/leave', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    });
    
    if (response.ok) {
      currentParty = null;
      showNotification('グループから退出しました');
      await loadPartyInfo();
    }
  } catch (error) {
    showNotification('エラーが発生しました', 'error');
  }
}

function showPartyInviteNotification(data) {
  const notification = document.getElementById('party-invite-notification');
  document.getElementById('invite-from').textContent = data.fromNickname;
  notification.classList.add('active');
  
  document.getElementById('accept-party-btn').onclick = async () => {
    await joinParty(data.partyId);
    notification.classList.remove('active');
  };
  
  document.getElementById('decline-party-btn').onclick = () => {
    pendingPartyInvite = null;
    notification.classList.remove('active');
  };
  
  // 10秒後に自動で消える
  setTimeout(() => {
    notification.classList.remove('active');
  }, 10000);
}

async function joinParty(partyId) {
  try {
    const response = await fetch('/api/party/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ partyId })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentParty = data.party;
      showNotification('グループに参加しました');
      await loadPartyInfo();
    } else {
      showNotification(data.error, 'error');
    }
  } catch (error) {
    showNotification('エラーが発生しました', 'error');
  }
}

// ===== セッション検索 =====
function joinSoloQueue() {
  if (inQueue) {
    socket.emit('leaveMatchmaking');
    inQueue = false;
    document.getElementById('solo-queue-btn').textContent = '🔍 ランダムセッションに参加';
    document.getElementById('solo-queue-status').textContent = '';
  } else {
    socket.emit('joinMatchmaking', { mode: 'solo' });
    inQueue = true;
    document.getElementById('solo-queue-btn').textContent = '❌ 検索を中止';
    document.getElementById('solo-queue-status').textContent = 'セッション相手を探しています...';
  }
}

function joinPartyQueue() {
  if (inQueue) {
    socket.emit('leaveMatchmaking');
    inQueue = false;
    document.getElementById('party-queue-btn').textContent = '👥 グループセッションに参加';
  } else {
    socket.emit('joinMatchmaking', { mode: 'party' });
    inQueue = true;
    document.getElementById('party-queue-btn').textContent = '❌ 検索を中止';
  }
}

// ===== 通知機能 =====
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `toast-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('active');
  }, 100);
  
  setTimeout(() => {
    notification.classList.remove('active');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
