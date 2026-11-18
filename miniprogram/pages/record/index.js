const api = require('../../services/api');
const { todayLabel } = require('../../utils/date');

const recorder = wx.getRecorderManager();

Page({
  data: {
    dateLabel: '', userId: '', userAlias: '',
    phase: 'idle', keyboardOpen: false, typedText: '', preview: null,
    isRecording: false, recordStartedAt: 0, voiceHint: '', feedback: null,
    saving: false, followup: '', headerTop: 64
  },
  onLoad() {
    this.bindRecorder();
    this.refreshUser();
    this.setData({ dateLabel: todayLabel(), headerTop: this.getHeaderTop() });
  },
  onShow() {
    this.refreshUser();
    if (this.getTabBar) this.getTabBar().setData({ selected: 0, hidden: this.data.keyboardOpen });
  },
  getHeaderTop() {
    try {
      const menu = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
      if (menu && menu.bottom) return menu.bottom + 10;
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      return (windowInfo.statusBarHeight || 24) + 50;
    } catch (error) { return 74; }
  },
  setTabHidden(hidden) {
    if (this.getTabBar) this.getTabBar().setData({ selected: 0, hidden });
  },
  bindRecorder() {
    recorder.onStart(() => this.setData({ isRecording: true, recordStartedAt: Date.now(), voiceHint: '' }));
    recorder.onStop(async result => {
      const duration = result.duration || Date.now() - this.data.recordStartedAt;
      this.setData({ isRecording: false, phase: 'parsing' });
      try {
        const response = await api.uploadVoice(this.data.userId, result.tempFilePath, duration, 'daily-entry');
        if (response.transcript) return this.parseRecord(response.transcript, 'voice');
        this.setData({ phase: 'idle', keyboardOpen: true, voiceHint: '语音已保存在本机演示档案。正式后端接通后会自动转成文字；现在可补一句文字完成存档。' });
        this.setTabHidden(true);
      } catch (error) {
        this.setData({ phase: 'idle', keyboardOpen: true, voiceHint: '这次语音没有转写成功，可以直接补一句文字。' });
        this.setTabHidden(true);
      }
    });
    recorder.onError(() => {
      this.setData({ isRecording: false, voiceHint: '没有取得录音权限，可以使用键盘输入。', keyboardOpen: true });
      this.setTabHidden(true);
    });
  },
  refreshUser() {
    const app = getApp();
    this.setData({ userId: app.globalData.userId, userAlias: app.globalData.userAlias });
  },
  chooseUser() {
    wx.showActionSheet({
      itemList: ['YC', '示例学员'],
      success: result => {
        const user = result.tapIndex === 0 ? { userId:'USR-SELF-001', displayAlias:'YC' } : { userId:'USR-DEMO-001', displayAlias:'示例学员' };
        getApp().switchUser(user);
        this.reset();
        this.refreshUser();
      }
    });
  },
  toggleRecord() {
    if (this.data.phase === 'parsing') return;
    if (this.data.isRecording) return recorder.stop();
    recorder.start({ duration: 60000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' });
  },
  openKeyboard() { this.setData({ keyboardOpen: true, voiceHint: '' }); this.setTabHidden(true); },
  noop() {},
  closeKeyboard() { this.setData({ keyboardOpen: false }); this.setTabHidden(false); },
  onTextInput(event) { this.setData({ typedText: event.detail.value }); },
  onFollowupInput(event) { this.setData({ followup: event.detail.value }); },
  submitText() { if (this.data.typedText.trim().length >= 2) this.parseRecord(this.data.typedText, 'text'); },
  async parseRecord(text, inputMode) {
    this.setData({ phase: 'parsing', keyboardOpen: false, voiceHint: '' });
    this.setTabHidden(false);
    try {
      const preview = await api.parse(this.data.userId, text, inputMode);
      this.setData({ preview, phase: 'confirm' });
    } catch (error) {
      this.setData({ phase: 'idle' });
      wx.showToast({ title: '暂时无法整理记录', icon: 'none' });
    }
  },
  addFollowup() {
    if (!this.data.followup.trim()) return;
    const combined = `${this.data.preview.rawText}。补充：${this.data.followup.trim()}`;
    this.parseRecord(combined, this.data.preview.inputMode);
    this.setData({ followup: '' });
  },
  async confirmEntry() {
    if (!this.data.preview || this.data.saving) return;
    this.setData({ saving: true });
    try {
      await api.saveEntry(this.data.userId, this.data.preview);
      const feedback = await api.feedback(this.data.userId, this.data.preview);
      this.setData({ feedback, phase: 'saved', saving: false });
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({ title: '存档失败，请再试一次', icon: 'none' });
    }
  },
  reset() {
    if (this.data.isRecording) recorder.stop();
    this.setData({ phase:'idle', keyboardOpen:false, typedText:'', preview:null, feedback:null, saving:false, followup:'', voiceHint:'' });
    this.setTabHidden(false);
  }
});
