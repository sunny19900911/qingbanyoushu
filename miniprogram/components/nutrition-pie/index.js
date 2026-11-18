Component({
  properties: {
    vegetables: { type: Number, value: 0 },
    carbs: { type: Number, value: 0 },
    protein: { type: Number, value: 0 },
    score: { type: Number, value: 0 },
    size: { type: Number, value: 46 }
  },
  lifetimes: { ready() { this.draw(); } },
  observers: { 'vegetables,carbs,protein,size': function() { if (this._ready) this.draw(); } },
  methods: {
    draw() {
      this._ready = true;
      this.createSelectorQuery().select('#pie').fields({ node: true, size: true }).exec(result => {
        const item = result[0];
        if (!item || !item.node) return;
        const canvas = item.node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2;
        const width = item.width || this.data.size;
        canvas.width = width * dpr; canvas.height = width * dpr; ctx.scale(dpr, dpr);
        const center = width / 2; const radius = width * .43; const line = width * .2;
        const values = [this.data.vegetables, this.data.carbs, this.data.protein];
        const colors = ['#2eaa61','#f2a24a','#5796d2'];
        let angle = -Math.PI / 2;
        ctx.clearRect(0,0,width,width);
        values.forEach((value, index) => {
          const next = angle + Math.PI * 2 * value / 100;
          ctx.beginPath(); ctx.arc(center, center, radius, angle, next); ctx.strokeStyle = colors[index]; ctx.lineWidth = line; ctx.lineCap = 'butt'; ctx.stroke(); angle = next;
        });
      });
    }
  }
});
