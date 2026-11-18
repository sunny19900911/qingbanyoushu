Component({
  data: {
    selected: 0,
    hidden: false,
    list: [
      { pagePath: '/pages/record/index', text: '记录', icon: 'record' },
      { pagePath: '/pages/trend/index', text: '趋势', icon: 'trend' },
      { pagePath: '/pages/coach/index', text: '训练·教练', icon: 'coach' }
    ]
  },
  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const item = this.data.list[index];
      if (index === this.data.selected) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});
