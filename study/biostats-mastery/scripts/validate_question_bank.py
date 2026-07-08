#!/usr/bin/env python3
"""
Question-bank validator — consolidates every rule implied by bugs found
during the manual audit into one script that catches the whole class,
not just the one instance a screenshot happened to surface.

Run this after ANY edit to stats_questions.json, before merging.
Each rule below exists because a real bug slipped through without it.
"""
import json, re, math, sys

def erf(x):
    t = 1/(1+0.3275911*abs(x))
    y = 1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*math.exp(-x*x)
    return y if x>=0 else -y
def normal_cdf(x): return 0.5*(1+erf(x/math.sqrt(2)))

def load(path):
    return json.load(open(path))

def rule_schema_completeness(data):
    """Rule: every question needs the fields SCHEMA.md declares required.
    Caught: the 110-question old-schema bug (answer/letter instead of correct/label)."""
    issues = []
    required_q = ['id','stem','options','correct','baseGraph','explanation','trap']
    required_opt = ['label','text','graph','desc']
    for q in data:
        for f in required_q:
            if f not in q:
                issues.append(f"Q{q.get('id','?')}: missing required field '{f}'")
        for i,o in enumerate(q.get('options',[])):
            for f in required_opt:
                if f not in o:
                    issues.append(f"Q{q.get('id','?')} option {i}: missing required field '{f}'")
    return issues

def rule_basegraph_matches_correct(data):
    """Rule: baseGraph must equal options[correct].graph on every shared key.
    Caught: Q2, Q6, Q8, Q11, Q12, Q15, Q18, Q19, Q23, Q30, Q43, Q46 all drifted."""
    issues = []
    for q in data:
        bg = q.get('baseGraph') or {}
        correct = q.get('correct')
        if correct is None or correct >= len(q.get('options',[])): continue
        cg = q['options'][correct].get('graph') or {}
        for k in ('hr','brate','d','n','control','treatment'):
            if k in bg and k in cg and abs(bg[k] - cg[k]) > 1e-6:
                issues.append(f"Q{q['id']}: baseGraph.{k}={bg[k]} but correct answer's graph.{k}={cg[k]}")
    return issues

def rule_terminology_grounding(data):
    """Rule: explanation text must not reference a statistic (HR=, RR=, OR=) that
    doesn't correspond to a field actually present in that question's graph type.
    Caught: 17 instances of 'HR=X.XX' copy-pasted into Cohen's-d questions."""
    issues = []
    patterns = {'HR': re.compile(r'\bHR\s*=\s*[\d.]+'), 'RR': re.compile(r'\bRR\s*=\s*[\d.]+'), 'OR': re.compile(r'\bOR\s*=\s*[\d.]+')}
    valid_type_for_term = {'HR':'cumulative', 'RR':'bar', 'OR':'contingencyTable'}
    for q in data:
        gtype = (q.get('baseGraph') or {}).get('type','cumulative')
        for o in q.get('options',[]):
            desc = o.get('desc','')
            for term, pat in patterns.items():
                if pat.search(desc) and gtype != valid_type_for_term[term]:
                    issues.append(f"Q{q['id']} opt {o.get('label')}: desc references '{term}=' but graph type is '{gtype}', not '{valid_type_for_term[term]}'")
    return issues

def rule_ci_pvalue_consistency(data, tolerance=0.35):
    """Rule: p-value should be derivable from the reported CI within a reasonable
    tolerance (Wald back-calculation: SE = (ln(hi)-ln(lo))/(2*1.96)).
    Caught: Q18/Q19's stored d (1.636) didn't match 2.6/1.4=1.857 from the ad's own numbers."""
    issues = []
    for q in data:
        for o in q.get('options', []):
            g = o.get('graph') or {}
            p_stored = o.get('pValue') or g.get('pValue')
            if p_stored is None or 'ciLow' not in g or 'ciHigh' not in g or 'estimate' not in g: continue
            try:
                se = (math.log(g['ciHigh']) - math.log(g['ciLow'])) / (2*1.959964)
                z = math.log(g['estimate']) / se
                p_computed = 2*(1-normal_cdf(abs(z)))
                if abs(p_computed - p_stored) > tolerance * max(p_stored, 0.001):
                    issues.append(f"Q{q['id']} opt {o.get('label')}: stored p={p_stored:.3g}, recomputed from CI={p_computed:.3g} (>{tolerance*100:.0f}% off)")
            except (ValueError, ZeroDivisionError):
                continue
    return issues

def rule_hr_range_safety(data):
    """Rule: any code path rendering 'kept X% / Y% prevented' language assumes HR<=1.
    Flag every question whose data actually uses HR>1, as a standing reminder that
    display code for this chart type must handle that branch.
    Caught: HeartGuard (HR=1.08, 1.15) rendering 'Kept 115%'."""
    issues = []
    for q in data:
        if (q.get('baseGraph') or {}).get('type') != 'cumulative': continue
        for o in q.get('options', []):
            hr = (o.get('graph') or {}).get('hr')
            if hr is not None and hr > 1:
                issues.append(f"Q{q['id']} opt {o.get('label')}: hr={hr} > 1 — confirm 'kept/prevented' display code handles HR>1 (non-inferiority/harm framing)")
                break
    return issues

def rule_concept_graph_type_map(data):
    """Rule: each concept tag maps to an allowed set of graph types.
    Caught: 135 of 179 questions on the wrong chart type for their concept."""
    ALLOWED = {
        'confounding': {'dag','cumulative'}, 'lead-time bias': {'biasDiagram'},
        'recall bias': {'biasDiagram'}, 'selection bias': {'biasDiagram'},
        'positive predictive value': {'ppvCurve','contingencyTable'},
        'sensitivity': {'contingencyTable','rocCurve'}, 'specificity': {'contingencyTable','rocCurve'},
        'meta-analysis': {'forestPlot'}, 'case-control study': {'studyDesignGrid'},
        'cohort study': {'studyDesignGrid'}, 'power': {'normal'}, 'confidence interval': {'normal','forestPlot'},
        'normal distribution': {'normal'}, 'absolute risk reduction': {'bar'}, 'relative risk reduction': {'bar'},
    }
    issues = []
    for q in data:
        concept = q.get('concept')
        gtype = (q.get('baseGraph') or {}).get('type','cumulative')
        if concept in ALLOWED and gtype not in ALLOWED[concept]:
            issues.append(f"Q{q['id']}: concept '{concept}' typically wants {ALLOWED[concept]}, currently '{gtype}'")
    return issues

def main(path):
    data = load(path)
    rules = [
        ("Schema completeness", rule_schema_completeness),
        ("baseGraph matches correct answer", rule_basegraph_matches_correct),
        ("Terminology grounded in graph type", rule_terminology_grounding),
        ("CI-to-p-value consistency", rule_ci_pvalue_consistency),
        ("HR>1 range safety (non-inferiority)", rule_hr_range_safety),
        ("Concept-to-graph-type mapping", rule_concept_graph_type_map),
    ]
    total = 0
    for name, fn in rules:
        found = fn(data)
        print(f"\n=== {name} — {len(found)} issue(s) ===")
        for line in found[:25]:
            print(" ", line)
        if len(found) > 25:
            print(f"  ... and {len(found)-25} more")
        total += len(found)
    print(f"\nTOTAL ISSUES: {total}")
    return total

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'stats_questions.json'
    sys.exit(1 if main(path) > 0 else 0)
