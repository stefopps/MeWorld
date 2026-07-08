const fs = require('fs');
const html = fs.readFileSync('C:/Users/steve/MeWorld/game/study/biostats-mastery/index.html', 'utf8');
const lines = html.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // ── qzDimPlugin patch — already has harmed vars, fix remaining references ──
  if (line.includes('const qzDimPlugin=') && line.includes('harmed=hr>1')) {
    line = line.replace(
      "ctx.fillText('\u2193 '+trimmed.toFixed(0)+'%',bx+16,gm-8);ctx.fillStyle='#6b7280';ctx.font='400 10px Inter,sans-serif';ctx.fillText('reduction in hazard',bx+16,gm+8)",
      "ctx.fillText(dirArrow+' '+pctChange.toFixed(0)+'%',bx+16,gm-8);ctx.fillStyle='#6b7280';ctx.font='400 10px Inter,sans-serif';ctx.fillText(dirWord+' in hazard',bx+16,gm+8)"
    );
    line = line.replace(
      'keptW=(kept/100)*barW,trimW=(trimmed/100)*barW',
      'keptW=Math.min(hr,1)*barW,trimW=harmed?0:((1-hr)*100)/100*barW,excessW=harmed?((hr-1)*100)/100*barW:0'
    );
    line = line.replace(
      "fillText('Kept '+kept.toFixed(0)+'%',barX+keptW/2",
      "fillText((harmed?'':'Kept ')+(hr*100).toFixed(0)+'%',barX+keptW/2"
    );
    line = line.replace(
      "fillText(trimmed.toFixed(0)+'% prevented',barX+keptW+trimW/2",
      "fillText(pctChange.toFixed(0)+'% prevented',barX+keptW+trimW/2"
    );
    // Insert excessW block before Tx label
    line = line.replace(
      "}ctx.fillStyle='#6b7280';ctx.font='500 .625rem Inter,sans-serif';ctx.textAlign='left';ctx.fillText('Tx',barX-28",
      "}if(excessW>1){ctx.fillStyle='rgba(251,146,60,.35)';ctx.strokeStyle='#fb923c';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(barX+barW,barYt,excessW,barHB,{tl:0,tr:barR,bl:0,br:barR});ctx.fill();ctx.stroke();ctx.fillStyle='#9a3412';ctx.font='700 .625rem Inter,sans-serif';ctx.textAlign='left';ctx.fillText('+'+pctChange.toFixed(0)+'% more events',barX+barW+excessW+6,barYt+barHB/2+1)}ctx.fillStyle='#6b7280';ctx.font='500 .625rem Inter,sans-serif';ctx.textAlign='left';ctx.fillText('Tx',barX-28"
    );
    // Bracket text
    line = line.replace(
      "ctx.fillText('↓ '+(1-hr).toFixed(2)+' = '+(trimmed).toFixed(0)+'%',bracketX-10,(barYc+barHB+barYt)/2)",
      "ctx.fillText(dirArrow+' '+Math.abs(1-hr).toFixed(2)+' = '+pctChange.toFixed(0)+'%',bracketX-10,(barYc+barHB+barYt)/2)"
    );
    lines[i] = line;
    console.log('Patched qzDimPlugin');
  }

  // ── hrDimPlugin patch (full replacement, still has kept/trimmed) ──
  if (line.includes('const hrDimPlugin=') && line.includes('kept=hr*100')) {
    line = line.replace(
      'kept=hr*100,trimmed=(1-hr)*100',
      "harmed=hr>1,pctChange=Math.abs((1-hr)*100),dirWord=harmed?'increase':'reduction',dirArrow=harmed?'\u2191':'\u2193'"
    );
    line = line.replace(
      "ctx.fillText('\u2193 '+trimmed.toFixed(0)+'%',bx+16,gm-8);ctx.fillStyle='#6b7280';ctx.font='400 10px Inter,sans-serif';ctx.fillText('reduction in hazard',bx+16,gm+8)",
      "ctx.fillText(dirArrow+' '+pctChange.toFixed(0)+'%',bx+16,gm-8);ctx.fillStyle='#6b7280';ctx.font='400 10px Inter,sans-serif';ctx.fillText(dirWord+' in hazard',bx+16,gm+8)"
    );
    line = line.replace(
      'keptW=(kept/100)*barW,trimW=(trimmed/100)*barW',
      'keptW=Math.min(hr,1)*barW,trimW=harmed?0:((1-hr)*100)/100*barW,excessW=harmed?((hr-1)*100)/100*barW:0'
    );
    line = line.replace(
      "fillText('Kept '+kept.toFixed(0)+'%',barX+keptW/2",
      "fillText((harmed?'':'Kept ')+(hr*100).toFixed(0)+'%',barX+keptW/2"
    );
    line = line.replace(
      "fillText(trimmed.toFixed(0)+'% prevented',barX+keptW+trimW/2",
      "fillText(pctChange.toFixed(0)+'% prevented',barX+keptW+trimW/2"
    );
    line = line.replace(
      "}ctx.fillStyle='#6b7280';ctx.font='500 .625rem Inter,sans-serif';ctx.textAlign='left';ctx.fillText('Tx',barX-28",
      "}if(excessW>1){ctx.fillStyle='rgba(251,146,60,.35)';ctx.strokeStyle='#fb923c';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(barX+barW,barYt,excessW,barHB,{tl:0,tr:barR,bl:0,br:barR});ctx.fill();ctx.stroke();ctx.fillStyle='#9a3412';ctx.font='700 .625rem Inter,sans-serif';ctx.textAlign='left';ctx.fillText('+'+pctChange.toFixed(0)+'% more events',barX+barW+excessW+6,barYt+barHB/2+1)}ctx.fillStyle='#6b7280';ctx.font='500 .625rem Inter,sans-serif';ctx.textAlign='left';ctx.fillText('Tx',barX-28"
    );
    line = line.replace(
      "ctx.fillText('↓ '+(1-hr).toFixed(2)+' = '+(trimmed).toFixed(0)+'%',bracketX-10,(barYc+barHB+barYt)/2)",
      "ctx.fillText(dirArrow+' '+Math.abs(1-hr).toFixed(2)+' = '+pctChange.toFixed(0)+'%',bracketX-10,(barYc+barHB+barYt)/2)"
    );
    lines[i] = line;
    console.log('Patched hrDimPlugin');
  }
}
fs.writeFileSync('C:/Users/steve/MeWorld/game/study/biostats-mastery/index.html', lines.join('\n'));
console.log('Done');
