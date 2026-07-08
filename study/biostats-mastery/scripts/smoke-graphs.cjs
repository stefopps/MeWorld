const fs = require('fs');
const html = fs.readFileSync('../index.html', 'utf8');
const scriptMatch = html.match(/<script>\s*([\s\S]*?)<\/script>/);
const script = scriptMatch ? scriptMatch[1] : '';

console.log('=== DOM CANVASES ===');
['chart-quiz-cumulative','chart-quiz-normal','chart-quiz-bar','chart-quiz-forest','chart-quiz-html'].forEach(function(id) {
  console.log(id + ': ' + (html.includes('id="' + id + '"') ? 'PRESENT' : 'MISSING'));
});

console.log('');
console.log('hideAllQuizChartPanels called in updateQuizGraph: ' + script.includes('hideAllQuizChartPanels()'));

// Count safeCall wrappers
const safeCallCount = (script.match(/safeCall\(/g) || []).length;
console.log('safeCall wrappers: ' + safeCallCount);

// Check nextQuestion
const nextQMatch = script.match(/function nextQuestion\(\)\{[^}]+\}/);
if (nextQMatch) console.log('nextQuestion: ' + nextQMatch[0]);

console.log('');
const qb = JSON.parse(fs.readFileSync('../stats_questions.json', 'utf8'));
console.log('Total questions: ' + qb.length);
var types = {};
qb.forEach(function(q) { var t = q.baseGraph ? q.baseGraph.type || 'cumulative' : 'cumulative'; types[t] = (types[t] || 0) + 1; });
console.log('Graph type distribution:');
Object.keys(types).sort().forEach(function(t) { console.log('  ' + t + ': ' + types[t] + ' questions'); });

// Show a question of each type
console.log('');
console.log('=== SAMPLE PER TYPE ===');
var shown = {};
qb.forEach(function(q) {
  var t = q.baseGraph ? q.baseGraph.type || 'cumulative' : 'cumulative';
  if (!shown[t]) {
    shown[t] = true;
    console.log('Q' + q.id + ' [' + t + ']: ' + (q.stem || '').slice(0, 80));
  }
});

// Check renderQuestion for updateQuizGraph call
console.log('');
var rqMatch = script.match(/function renderQuestion\(\)[\s\S]*?^\}/m);
if (rqMatch) {
  var rq = rqMatch[0];
  console.log('renderQuestion:');
  console.log('  updateQuizGraph called: ' + rq.includes('updateQuizGraph()'));
  console.log('  updateQuizCard called: ' + rq.includes('updateQuizCard()'));
  console.log('  applyGraphPresetByType: ' + rq.includes('applyGraphPresetByType'));
  
  // Find where updateQuizGraph is called relative to other calls
  var lines = rq.split('\n');
  lines.forEach(function(l, i) {
    if (l.includes('updateQuizGraph') || l.includes('updateQuizCard') || l.includes('applyGraphPresetByType') || l.includes('updateSlidersFromState') || l.includes('syncViewModeToCrossAt')) {
      console.log('  L' + i + ': ' + l.trim().slice(0, 120));
    }
  });
}
