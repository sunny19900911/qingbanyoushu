const store = require('./services/store');

App({
  globalData: {
    userId: 'USR-SELF-001',
    userAlias: 'YC'
  },
  onLaunch() {
    const savedUser = store.getSelectedUser();
    this.globalData.userId = savedUser.userId;
    this.globalData.userAlias = savedUser.displayAlias;
  },
  switchUser(user) {
    this.globalData.userId = user.userId;
    this.globalData.userAlias = user.displayAlias;
    store.setSelectedUser(user);
  }
});
