const api = require('../../services/api');

const recorder = wx.getRecorderManager();

Page({
  data: {
    userId: '', userAlias: '', isCoach: false, coachMode: 'workspace', loading: true,
    training: null, history: [], replies: [], dashboard: { students: [], questions: [] },
    categories: [], exercises: [], filteredExercises: [], activeCategory: '全部', detailExercise: null,
    questionOpen: false, questionText: '', questionSent: false, isRecording: false, voiceHint: '',
    replyQuestionId: '', replyText: '', targetStudentId: 'USR-DEMO-001', selectedExerciseIds: [],
    prescription: '每个动作 2 组，每组 8—10 次', assignmentNote: '动作稳定优先，完成后告诉我哪里最累。'
  },
  onLoad() {
    recorder.onStart(() => this.setData({ isRecording: true, voiceHint: '' }));
    recorder.onStop(async result => {
      this.setData({ isRecording: false });
      try {
        const response = await api.uploadVoice(this.data.userId, result.tempFilePath, result.duration, 'coach-question');
        if (response.transcript) this.setData({ questionText: response.transcript, questionOpen: true });
        else this.setData({ questionOpen: true, voiceHint: '语音已保存。演示版请补一句文字，正式后端接通后会自动转写并发给教练。' });
      } catch (error) {
        this.setData({ questionOpen: true, voiceHint: '语音暂时没有转写成功，可以直接打字。' });
      }
    });
    recorder.onError(() => this.setData({ isRecording: false, questionOpen: true, voiceHint: '没有取得录音权限，可以直接打字。' }));
  },
  onShow() {
    if (this.getTabBar) this.getTabBar().setData({ selected: 2 });
    const app = getApp();
    const isCoach = app.globalData.userId === 'USR-SELF-001';
    this.setData({ userId: app.globalData.userId, userAlias: app.globalData.userAlias, isCoach, coachMode: isCoach ? 'workspace' : 'learner' });
    this.load();
  },
  chooseUser() {
    wx.showActionSheet({
      itemList: ['YC（教练 / 学员）', '示例学员（学员）'],
      success: result => {
        const user = result.tapIndex === 0 ? { userId: 'USR-SELF-001', displayAlias: 'YC' } : { userId: 'USR-DEMO-001', displayAlias: '示例学员' };
        getApp().switchUser(user);
        const isCoach = user.userId === 'USR-SELF-001';
        this.setData({ userId: user.userId, userAlias: user.displayAlias, isCoach, coachMode: isCoach ? 'workspace' : 'learner' });
        this.load();
      }
    });
  },
  async load() {
    this.setData({ loading: true });
    try {
      const library = await api.exerciseList();
      if (this.data.isCoach && this.data.coachMode === 'workspace') {
        const dashboard = await api.coachDashboard();
        this.setData({ categories: library.categories, exercises: library.exercises.map(item => ({ ...item, selected: this.data.selectedExerciseIds.includes(item.id) })), dashboard, loading: false });
      } else {
        const [training, history, replies] = await Promise.all([
          api.training(this.data.userId), api.coachFeedback(this.data.userId), api.coachReplies(this.data.userId)
        ]);
        this.setData({ categories: library.categories, exercises: library.exercises, training, history: history.slice().reverse(), replies, loading: false });
        this.syncExerciseFilter();
      }
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: '页面读取失败', icon: 'none' });
    }
  },
  switchCoachMode(event) {
    this.setData({ coachMode: event.currentTarget.dataset.mode });
    this.load();
  },
  syncExerciseFilter() {
    const filteredExercises = this.data.exercises
      .filter(item => this.data.activeCategory === '全部' || item.bodyPart === this.data.activeCategory)
      .map(item => ({ ...item, selected: this.data.selectedExerciseIds.includes(item.id) }));
    this.setData({ filteredExercises });
  },
  filterCategory(event) {
    this.setData({ activeCategory: event.currentTarget.dataset.category });
    this.syncExerciseFilter();
  },
  openExercise(event) {
    const detailExercise = this.data.exercises.find(item => item.id === event.currentTarget.dataset.id);
    this.setData({ detailExercise });
  },
  closeExercise() { this.setData({ detailExercise: null }); },
  noop() {},
  toggleExerciseSelect(event) {
    const id = event.currentTarget.dataset.id;
    const selectedExerciseIds = this.data.selectedExerciseIds.includes(id)
      ? this.data.selectedExerciseIds.filter(item => item !== id)
      : [...this.data.selectedExerciseIds, id];
    this.setData({ selectedExerciseIds, exercises: this.data.exercises.map(item => ({ ...item, selected: selectedExerciseIds.includes(item.id) })) });
  },
  onPrescriptionInput(event) { this.setData({ prescription: event.detail.value }); },
  onAssignmentNoteInput(event) { this.setData({ assignmentNote: event.detail.value }); },
  async saveAssignment() {
    if (!this.data.selectedExerciseIds.length) return wx.showToast({ title: '先选择至少一个动作', icon: 'none' });
    await api.assignTraining(this.data.targetStudentId, this.data.selectedExerciseIds, this.data.prescription.trim(), this.data.assignmentNote.trim());
    this.setData({ selectedExerciseIds: [], exercises: this.data.exercises.map(item => ({ ...item, selected: false })) });
    wx.showToast({ title: '训练提醒已发出', icon: 'success' });
    this.load();
  },
  openReply(event) { this.setData({ replyQuestionId: event.currentTarget.dataset.id, replyText: '' }); },
  closeReply() { this.setData({ replyQuestionId: '', replyText: '' }); },
  onReplyInput(event) { this.setData({ replyText: event.detail.value }); },
  async sendReply() {
    const question = this.data.dashboard.questions.find(item => item.questionId === this.data.replyQuestionId);
    if (!question || this.data.replyText.trim().length < 2) return;
    await api.replyQuestion(question.userId, question.questionId, this.data.replyText.trim());
    this.setData({ replyQuestionId: '', replyText: '' });
    wx.showToast({ title: '回复已发送', icon: 'success' });
    this.load();
  },
  toggleVoice() {
    if (this.data.isCoach || this.data.isRecording) return this.data.isRecording && recorder.stop();
    recorder.start({ duration: 60000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' });
  },
  toggleQuestion() { this.setData({ questionOpen: !this.data.questionOpen, voiceHint: '' }); },
  onQuestionInput(event) { this.setData({ questionText: event.detail.value, questionSent: false }); },
  async sendQuestion() {
    if (this.data.isCoach || this.data.questionText.trim().length < 2) return;
    await api.submitQuestion(this.data.userId, this.data.questionText.trim(), 'text');
    this.setData({ questionText: '', questionSent: true, questionOpen: false, voiceHint: '' });
    wx.showToast({ title: '已发送给教练', icon: 'success' });
  }
});
