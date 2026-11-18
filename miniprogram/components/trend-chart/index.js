Component({
  properties: {
    points: { type: Array, value: [] },
    metric: { type: String, value: 'weight' },
    height: { type: Number, value: 190 }
  },
  lifetimes: { ready() { this.draw(); } },
  observers: { 'points,metric,height': function() { if (this._ready) this.draw(); } },
  methods: {
    draw() {
      this._ready = true;
      this.createSelectorQuery().select('#chart').fields({ node: true, size: true }).exec(result => {
        const box = result[0]; if (!box || !box.node) return;
        const canvas = box.node; const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2;
        const width = box.width; const height = box.height || this.data.height;
        canvas.width = width*dpr; canvas.height = height*dpr; ctx.scale(dpr,dpr); ctx.clearRect(0,0,width,height);
        const points = (this.data.points || []).filter(item => item.value !== null && item.value !== undefined);
        if (points.length < 1) { ctx.fillStyle='#9aa39d';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('暂无可绘制数据',width/2,height/2);return; }
        const pad={left:32,right:14,top:18,bottom:30};
        const values=points.map(item=>Number(item.value)); let min=Math.min(...values),max=Math.max(...values);
        if(this.data.metric!=='weight'){min=0;max=10}else{const gap=Math.max(1,(max-min)*.25);min-=gap;max+=gap}
        if(max===min){max+=1;min-=1}
        const x=index=>pad.left+(width-pad.left-pad.right)*(points.length===1?.5:index/(points.length-1));
        const y=value=>pad.top+(height-pad.top-pad.bottom)*(1-(value-min)/(max-min));
        ctx.strokeStyle='#e7ece8';ctx.lineWidth=1;
        for(let i=0;i<4;i++){const gy=pad.top+(height-pad.top-pad.bottom)*i/3;ctx.beginPath();ctx.moveTo(pad.left,gy);ctx.lineTo(width-pad.right,gy);ctx.stroke()}
        const color=this.data.metric==='weight'?'#2e9d62':this.data.metric==='health'?'#f2a24a':'#8268c7';
        const gradient=ctx.createLinearGradient(0,pad.top,0,height-pad.bottom);gradient.addColorStop(0,color+'55');gradient.addColorStop(1,color+'05');
        ctx.beginPath();points.forEach((p,i)=>{if(i===0)ctx.moveTo(x(i),y(p.value));else ctx.lineTo(x(i),y(p.value))});ctx.lineTo(x(points.length-1),height-pad.bottom);ctx.lineTo(x(0),height-pad.bottom);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
        ctx.beginPath();points.forEach((p,i)=>{if(i===0)ctx.moveTo(x(i),y(p.value));else ctx.lineTo(x(i),y(p.value))});ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.stroke();
        points.forEach((p,i)=>{ctx.beginPath();ctx.arc(x(i),y(p.value),3.5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke()});
        ctx.fillStyle='#879089';ctx.font='10px sans-serif';ctx.textAlign='center';
        const labels=[0,Math.floor((points.length-1)/2),points.length-1];
        [...new Set(labels)].forEach(i=>ctx.fillText(points[i].date.slice(5).replace('-','.'),x(i),height-8));
      });
    }
  }
});
